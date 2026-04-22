"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

function toCaptureErrorMessage(error) {
  if (!error) {
    return "未知的錄音錯誤";
  }

  const name = error.name || "";
  if (name === "NotAllowedError") {
    return "你拒絕了權限，請允許麥克風與螢幕分享音訊後重試。";
  }
  if (name === "NotFoundError") {
    return "找不到可用麥克風裝置。";
  }
  if (name === "AbortError") {
    return "螢幕分享流程被中斷，請重新操作。";
  }
  if (name === "NotReadableError") {
    return "音訊裝置目前不可讀取，請關閉其他占用程式後重試。";
  }
  if (name === "InvalidStateError") {
    return "瀏覽器狀態不允許啟動錄音，請重新整理頁面後再試。";
  }

  return String(error);
}

function isChromiumBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  return /Chrome|Chromium|Edg\//.test(ua);
}

export default function HomePage() {
  const [health, setHealth] = useState({ status: "loading", detail: "Checking API..." });
  const [meetings, setMeetings] = useState([]);
  const [meetingTitle, setMeetingTitle] = useState("");

  const [currentMeetingId, setCurrentMeetingId] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uiError, setUiError] = useState("");
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [result, setResult] = useState(null);

  const recorderRef = useRef(null);
  const micStreamRef = useRef(null);
  const displayStreamRef = useRef(null);
  const mixedStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const chunksRef = useRef([]);

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.meeting_id === selectedMeetingId) || null,
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

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const ready = await fetchJson(`${apiBase}/health/ready`);
        if (ready.status === "ok") {
          setHealth({ status: "ok", detail: "API ready" });
        } else {
          setHealth({ status: "error", detail: "API degraded" });
        }
      } catch (error) {
        setHealth({ status: "error", detail: `Cannot reach API (${String(error)})` });
      }

      try {
        await refreshMeetings();
      } catch (error) {
        setUiError(`Cannot load meetings: ${String(error)}`);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!currentJobId) {
      return undefined;
    }

    const timer = setInterval(async () => {
      try {
        const data = await fetchJson(`${apiBase}/api/v1/jobs/${currentJobId}`);
        setJobStatus(data);

        if (data.status === "done") {
          clearInterval(timer);
          await refreshMeetings();
          await loadMeetingResult(data.meeting_id);
          setCurrentJobId(null);
        }

        if (data.status === "error") {
          clearInterval(timer);
          setCurrentJobId(null);
          setUiError(data.message || "Processing failed");
          await refreshMeetings();
        }
      } catch (error) {
        clearInterval(timer);
        setCurrentJobId(null);
        setUiError(`Job polling failed: ${String(error)}`);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [currentJobId]);

  const releaseRecorderResources = async () => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorderRef.current = null;
    }

    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      displayStreamRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (mixedStreamRef.current) {
      mixedStreamRef.current.getTracks().forEach((track) => track.stop());
      mixedStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    chunksRef.current = [];
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      releaseRecorderResources();
    };
  }, []);

  const uploadAndProcess = async (meetingId, blob) => {
    const formData = new FormData();
    formData.append("file", blob, "recording.webm");

    await fetchJson(`${apiBase}/api/v1/meetings/${meetingId}/recording/finish`, {
      method: "POST",
      body: formData,
    });

    const processResponse = await fetchJson(`${apiBase}/api/v1/meetings/${meetingId}/process`, {
      method: "POST",
    });

    setCurrentMeetingId(meetingId);
    setCurrentJobId(processResponse.job_id);
    setJobStatus({ status: "queued", progress: 0, message: "Queued" });

    await refreshMeetings();
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const prepareMixedStream = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("你的瀏覽器不支援這個錄音模式，請使用桌面 Chrome 或 Edge。");
    }

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    let displayStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
    } catch (error) {
      micStream.getTracks().forEach((track) => track.stop());
      throw error;
    }

    const displayAudioTracks = displayStream.getAudioTracks();
    if (!displayAudioTracks.length) {
      displayStream.getTracks().forEach((track) => track.stop());
      micStream.getTracks().forEach((track) => track.stop());
      throw new Error("未偵測到系統音訊。請在分享視窗勾選「分享音訊」後重試。");
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      displayStream.getTracks().forEach((track) => track.stop());
      micStream.getTracks().forEach((track) => track.stop());
      throw new Error("瀏覽器不支援音訊混音。請改用桌面 Chrome 或 Edge。");
    }

    const audioContext = new AudioContextClass();
    const destination = audioContext.createMediaStreamDestination();

    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);

    const displayAudioOnlyStream = new MediaStream(displayAudioTracks);
    const displaySource = audioContext.createMediaStreamSource(displayAudioOnlyStream);
    displaySource.connect(destination);

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
      const meeting = await fetchJson(`${apiBase}/api/v1/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, language: "zh-TW" }),
      });

      const mixedStream = await prepareMixedStream();

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

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
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

  const patchTodo = async (todoId, patch) => {
    if (!selectedMeetingId) {
      return;
    }
    try {
      const updated = await fetchJson(`${apiBase}/api/v1/meetings/${selectedMeetingId}/todos/${todoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      setResult((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          todos: prev.todos.map((todo) => (todo.id === todoId ? updated : todo)),
        };
      });
      await refreshMeetings();
    } catch (error) {
      setUiError(`更新 TODO 失敗：${String(error)}`);
    }
  };

  return (
    <main className="page">
      <section className="card">
        <h1>Meeting Notes (Post-Meeting)</h1>
        <p>錄音後才生成摘要與 TODO，不提供即時字幕。</p>

        <div className={`health health-${health.status}`}>
          <strong>API:</strong> {health.detail}
        </div>

        <div className="capture-guide">
          需要同時授權「麥克風」與「分享音訊」。請使用桌面 Chrome/Edge，分享畫面時務必勾選音訊。
        </div>

        <div className="controls">
          <input
            className="title-input"
            placeholder="會議標題，例如：每週產品同步"
            value={meetingTitle}
            onChange={(event) => setMeetingTitle(event.target.value)}
            disabled={isRecording}
          />

          <div className="row">
            <button className="btn btn-primary" onClick={startRecording} disabled={isRecording || !!currentJobId}>
              開始錄音
            </button>
            <button className="btn btn-danger" onClick={stopRecording} disabled={!isRecording}>
              停止錄音
            </button>
          </div>

          {isRecording && <p className="hint">錄音中（麥克風 + 系統音訊）... 停止後會自動上傳並開始處理。</p>}
          {currentJobId && jobStatus && (
            <p className="hint">
              處理中 ({jobStatus.progress}%): {jobStatus.message || jobStatus.status}
            </p>
          )}
          {uiError && <p className="error">{uiError}</p>}
        </div>
      </section>

      <section className="card split">
        <div>
          <h2>會議列表</h2>
          <ul className="meeting-list">
            {meetings.map((meeting) => (
              <li key={meeting.meeting_id}>
                <button
                  className={`meeting-item ${selectedMeetingId === meeting.meeting_id ? "active" : ""}`}
                  onClick={() => loadMeetingResult(meeting.meeting_id)}
                >
                  <span className="meeting-title">{meeting.title}</span>
                  <span className="meeting-meta">{meeting.status}</span>
                </button>
              </li>
            ))}
            {meetings.length === 0 && <li className="hint">目前還沒有會議。</li>}
          </ul>
        </div>

        <div>
          <h2>摘要與 TODO</h2>
          {!selectedMeeting && <p className="hint">請先建立會議並完成錄音。</p>}

          {selectedMeeting && !result && <p className="hint">讀取中...</p>}

          {result && (
            <>
              <article className="summary">
                <h3>Summary</h3>
                <p>{result.summary?.overview || "尚未產生摘要"}</p>

                <h4>Key Points</h4>
                <ul>
                  {(result.summary?.key_points || []).map((item, index) => (
                    <li key={`kp-${index}`}>{item}</li>
                  ))}
                  {(result.summary?.key_points || []).length === 0 && <li>目前沒有重點。</li>}
                </ul>
              </article>

              <article className="todos">
                <h3>TODO</h3>
                <ul>
                  {(result.todos || []).map((todo) => (
                    <li key={todo.id} className="todo-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={!!todo.done}
                          onChange={(event) => patchTodo(todo.id, { done: event.target.checked })}
                        />
                      </label>
                      <input
                        type="text"
                        defaultValue={todo.text}
                        onBlur={(event) => {
                          const nextText = event.target.value.trim();
                          if (nextText && nextText !== todo.text) {
                            patchTodo(todo.id, { text: nextText });
                          }
                        }}
                      />
                    </li>
                  ))}
                  {(result.todos || []).length === 0 && <li>目前沒有待辦。</li>}
                </ul>
              </article>
            </>
          )}
        </div>
      </section>

      {currentMeetingId && <p className="footer-note">目前會議 ID: {currentMeetingId}</p>}
    </main>
  );
}
