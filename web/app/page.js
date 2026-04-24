"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import HealthBar from "./components/HealthBar";
import RecordingControls from "./components/RecordingControls";
import MeetingList from "./components/MeetingList";
import MeetingDetail from "./components/MeetingDetail";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const POLL_INITIAL_MS = 2000;
const POLL_MAX_MS = 10000;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

function toCaptureErrorMessage(error) {
  if (!error) return "未知的錄音錯誤";

  const name = error.name || "";
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

export default function HomePage() {
  const [health, setHealth] = useState({ status: "loading", detail: "Checking API..." });
  const [meetings, setMeetings] = useState([]);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [currentMeetingId, setCurrentMeetingId] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadPhase, setUploadPhase] = useState(null);
  const [uiError, setUiError] = useState("");
  const [loadError, setLoadError] = useState(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [result, setResult] = useState(null);

  const recorderRef = useRef(null);
  const micStreamRef = useRef(null);
  const displayStreamRef = useRef(null);
  const mixedStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const chunksRef = useRef([]);

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.meeting_id === selectedMeetingId) || null,
    [meetings, selectedMeetingId],
  );

  const refreshMeetings = async () => {
    const data = await fetchJson(`${apiBase}/api/v1/meetings?limit=50`);
    setMeetings(data);
  };

  const loadMeetingResult = async (meetingId) => {
    const data = await fetchJson(`${apiBase}/api/v1/meetings/${meetingId}/result`);
    setSelectedMeetingId(meetingId);
    setResult(data);
  };

  // #5: retry mechanism — bootstrap can be re-invoked on failure
  const bootstrap = async () => {
    setLoadError(null);
    try {
      const ready = await fetchJson(`${apiBase}/health/ready`);
      setHealth(ready.status === "ok" ? { status: "ok", detail: "API ready" } : { status: "error", detail: "API degraded" });
    } catch (error) {
      setHealth({ status: "error", detail: `Cannot reach API (${String(error)})` });
      setLoadError("無法連線到 API，請確認服務是否已啟動。");
      return;
    }
    try {
      await refreshMeetings();
    } catch (error) {
      setLoadError(`無法載入會議列表：${String(error)}`);
    }
  };

  useEffect(() => { bootstrap(); }, []);

  // #4: polling with exponential backoff
  useEffect(() => {
    if (!currentJobId) return undefined;

    let cancelled = false;
    let delay = POLL_INITIAL_MS;

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await fetchJson(`${apiBase}/api/v1/jobs/${currentJobId}`);
        if (cancelled) return;
        setJobStatus(data);

        if (data.status === "done") {
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

  // #6: upload progress phase
  const uploadAndProcess = async (meetingId, blob) => {
    setUploadPhase("uploading");
    const formData = new FormData();
    formData.append("file", blob, "recording.webm");

    await fetchJson(`${apiBase}/api/v1/meetings/${meetingId}/recording/finish`, {
      method: "POST",
      body: formData,
    });

    setUploadPhase("processing");
    const processResponse = await fetchJson(`${apiBase}/api/v1/meetings/${meetingId}/process`, {
      method: "POST",
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

  const prepareMixedStream = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("你的瀏覽器不支援這個錄音模式，請使用桌面 Chrome 或 Edge。");
    }

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    let displayStream;
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

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
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

  // #3: get permissions BEFORE creating meeting (avoids orphan meetings)
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

      const meeting = await fetchJson(`${apiBase}/api/v1/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, language: "zh-TW" }),
      });

      await fetchJson(`${apiBase}/api/v1/meetings/${meeting.meeting_id}/recording/start`, {
        method: "POST",
      });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = mimeType ? new MediaRecorder(mixedStream, { mimeType }) : new MediaRecorder(mixedStream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
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
      setSelectedMeetingId(meeting.meeting_id);
      setResult(null);
      setIsRecording(true);
      await refreshMeetings();
    } catch (error) {
      await releaseRecorderResources();
      setUiError(`無法開始錄音：${toCaptureErrorMessage(error)}`);
    }
  };

  // #2: patchTodo no longer calls refreshMeetings
  const patchTodo = async (todoId, patch) => {
    if (!selectedMeetingId) return;
    try {
      const updated = await fetchJson(`${apiBase}/api/v1/meetings/${selectedMeetingId}/todos/${todoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setResult((prev) => {
        if (!prev) return prev;
        return { ...prev, todos: prev.todos.map((t) => (t.id === todoId ? updated : t)) };
      });
    } catch (error) {
      setUiError(`更新 TODO 失敗：${String(error)}`);
    }
  };

  return (
    <main className="page">
      <section className="card">
        <h1>Meeting Notes (Post-Meeting)</h1>
        <p>錄音後才生成摘要與 TODO，不提供即時字幕。</p>

        <HealthBar health={health} />

        {loadError && (
          <p className="error" role="alert" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {loadError}
            <button className="btn btn-primary" onClick={bootstrap} style={{ fontSize: "0.85rem" }}>
              重試
            </button>
          </p>
        )}

        <div className="capture-guide">
          需要同時授權「麥克風」與「分享音訊」。請使用桌面 Chrome/Edge，分享畫面時務必勾選音訊。
        </div>

        <RecordingControls
          isRecording={isRecording}
          currentJobId={currentJobId}
          jobStatus={jobStatus}
          meetingTitle={meetingTitle}
          uploadPhase={uploadPhase}
          uiError={uiError}
          onStart={startRecording}
          onStop={stopRecording}
          onTitleChange={setMeetingTitle}
        />
      </section>

      <section className="card split">
        <MeetingList
          meetings={meetings}
          selectedMeetingId={selectedMeetingId}
          onSelect={loadMeetingResult}
        />
        <MeetingDetail
          meeting={selectedMeeting}
          result={result}
          onPatchTodo={patchTodo}
        />
      </section>

      {currentMeetingId && <p className="footer-note">目前會議 ID: {currentMeetingId}</p>}
    </main>
  );
}