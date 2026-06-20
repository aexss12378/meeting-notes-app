"use client";

import { useEffect, useRef, useState } from "react";
import {
  createMeeting,
  finishMeetingRecording,
  getJobStatus,
  processMeeting,
  startMeetingRecording,
} from "@/lib/api";
import type { JobStatus, SummaryApiSettings, UploadPhase } from "@/types";

const POLL_INITIAL_MS = 2000;
const POLL_MAX_MS = 10000;

type UseMeetingRecorderOptions = {
  meetingTitle: string;
  uiError: string;
  setUiError: (message: string) => void;
  summaryApiSettings: SummaryApiSettings;
  refreshMeetings: () => Promise<void>;
  loadMeetingResult: (meetingId: string) => Promise<void>;
  selectPendingMeeting: (meetingId: string) => void;
};

function toCaptureErrorMessage(error: unknown) {
  if (!error) return "未知的錄音錯誤";

  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError") return "你拒絕了權限，請允許麥克風與螢幕分享音訊後重試。";
  if (name === "NotFoundError") return "找不到可用麥克風裝置。";
  if (name === "AbortError") return "螢幕分享流程被中斷，請重新操作。";
  if (name === "NotReadableError") return "音訊裝置目前不可讀取，請關閉其他占用程式後重試。";
  if (name === "InvalidStateError") return "瀏覽器狀態不允許啟動錄音，請重新整理頁面後再試。";
  return String(error);
}

function isChromiumBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Chrome|Chromium|Edg\//.test(navigator.userAgent || "");
}

export function useMeetingRecorder({
  meetingTitle,
  uiError,
  setUiError,
  summaryApiSettings,
  refreshMeetings,
  loadMeetingResult,
  selectPendingMeeting,
}: UseMeetingRecorderOptions) {
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!currentJobId) return undefined;

    let cancelled = false;
    let delay = POLL_INITIAL_MS;

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await getJobStatus(currentJobId);
        if (cancelled) return;
        setJobStatus(data);

        if (data.status === "done" && data.meeting_id) {
          await refreshMeetings();
          await loadMeetingResult(data.meeting_id);
          setCurrentJobId(null);
          setUploadPhase(null);
          return;
        }
        if (data.status === "error") {
          setCurrentJobId(null);
          setUploadPhase(null);
          setUiError(data.message || "Processing failed");
          await refreshMeetings();
          return;
        }

        delay = Math.min(delay * 2, POLL_MAX_MS);
        setTimeout(poll, delay);
      } catch (error) {
        if (cancelled) return;
        setCurrentJobId(null);
        setUploadPhase(null);
        setUiError(`Job polling failed: ${String(error)}`);
      }
    };

    const timeoutId = setTimeout(poll, delay);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [currentJobId]);

  const releaseRecorderResources = async () => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorderRef.current = null;
    }
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => { t.onended = null; t.stop(); });
      displayStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (mixedStreamRef.current) {
      mixedStreamRef.current.getTracks().forEach((t) => t.stop());
      mixedStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { await audioContextRef.current.close(); } catch { /* ignore */ }
      audioContextRef.current = null;
    }
    chunksRef.current = [];
    setIsRecording(false);
  };

  useEffect(() => { return () => { releaseRecorderResources(); }; }, []);

  const uploadAndProcess = async (meetingId: string, blob: Blob) => {
    setUploadPhase("uploading");
    await finishMeetingRecording(meetingId, blob);

    setUploadPhase("processing");
    const processResponse = await processMeeting(meetingId, {
      summaryApiUrl: summaryApiSettings.apiUrl,
      summaryModel: summaryApiSettings.model,
      summaryApiKey: summaryApiSettings.apiKey,
    });

    setCurrentJobId(processResponse.job_id);
    setJobStatus({ status: "queued", progress: 0, message: "Queued" });
    setUploadPhase(null);
    await refreshMeetings();
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const prepareMixedStream = async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("你的瀏覽器不支援這個錄音模式，請使用桌面 Chrome 或 Edge。");
    }

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    let displayStream: MediaStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (error) {
      micStream.getTracks().forEach((t) => t.stop());
      throw error;
    }

    const displayAudioTracks = displayStream.getAudioTracks();
    if (!displayAudioTracks.length) {
      displayStream.getTracks().forEach((t) => t.stop());
      micStream.getTracks().forEach((t) => t.stop());
      throw new Error("未偵測到系統音訊。請在分享視窗勾選「分享音訊」後重試。");
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      displayStream.getTracks().forEach((t) => t.stop());
      micStream.getTracks().forEach((t) => t.stop());
      throw new Error("瀏覽器不支援音訊混音。請改用桌面 Chrome 或 Edge。");
    }

    const audioContext = new AudioContextClass();
    const destination = audioContext.createMediaStreamDestination();
    audioContext.createMediaStreamSource(micStream).connect(destination);
    audioContext.createMediaStreamSource(new MediaStream(displayAudioTracks)).connect(destination);

    micStreamRef.current = micStream;
    displayStreamRef.current = displayStream;
    mixedStreamRef.current = destination.stream;
    audioContextRef.current = audioContext;

    displayAudioTracks.forEach((track) => {
      track.onended = () => {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          setUiError("偵測到你已停止分享音訊，已自動結束本次錄音。");
          stopRecording();
        }
      };
    });

    return destination.stream;
  };

  const startRecording = async () => {
    setUiError("");
    if (!isChromiumBrowser()) {
      setUiError("請使用桌面 Chrome 或 Edge 進行麥克風 + 系統音訊錄製。");
      return;
    }
    const title = meetingTitle.trim();
    if (!title) {
      setUiError("請先輸入會議標題。");
      return;
    }

    try {
      const mixedStream = await prepareMixedStream();
      const meeting = await createMeeting(title);
      await startMeetingRecording(meeting.meeting_id);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = mimeType ? new MediaRecorder(mixedStream, { mimeType }) : new MediaRecorder(mixedStream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        await releaseRecorderResources();
        try {
          await uploadAndProcess(meeting.meeting_id, blob);
        } catch (error) {
          setUiError(`上傳或處理失敗：${String(error)}`);
        }
      };

      recorder.start(1000);
      setCurrentMeetingId(meeting.meeting_id);
      selectPendingMeeting(meeting.meeting_id);
      setIsRecording(true);
      await refreshMeetings();
    } catch (error) {
      await releaseRecorderResources();
      setUiError(`無法開始錄音：${toCaptureErrorMessage(error)}`);
    }
  };

  return {
    currentMeetingId,
    currentJobId,
    jobStatus,
    isRecording,
    uploadPhase,
    uiError,
    setUiError,
    startRecording,
    stopRecording,
  };
}
