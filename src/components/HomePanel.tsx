"use client";

import HealthBar from "@/components/HealthBar";
import MeetingList from "@/components/MeetingList";
import RecordingControls from "@/components/RecordingControls";
import RecordingModeCards from "@/components/RecordingModeCards";
import type { HealthStatus, JobStatus, Meeting, UploadPhase } from "@/types";

type HomePanelProps = {
  health: HealthStatus;
  loadError: string | null;
  meetings: Meeting[];
  selectedMeetingId: string | null;
  isRecording: boolean;
  currentJobId: string | null;
  currentMeetingId: string | null;
  jobStatus: JobStatus | null;
  meetingTitle: string;
  uploadPhase: UploadPhase;
  uiError: string;
  onBootstrap: () => void;
  onLoadMeetingResult: (meetingId: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTitleChange: (title: string) => void;
};

export default function HomePanel({
  health,
  loadError,
  meetings,
  selectedMeetingId,
  isRecording,
  currentJobId,
  currentMeetingId,
  jobStatus,
  meetingTitle,
  uploadPhase,
  uiError,
  onBootstrap,
  onLoadMeetingResult,
  onStartRecording,
  onStopRecording,
  onTitleChange,
}: HomePanelProps) {
  const apiReady = health.status === "ok";
  const summaryReady = !loadError && apiReady;

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-[#24272f] p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">早安，開始新的會議記錄</h1>
            <p className="mt-1 text-sm text-zinc-400">錄音後產生摘要與 TODO，不提供即時字幕。</p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full border px-3 py-1 ${apiReady ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-rose-400/30 bg-rose-500/10 text-rose-200"}`}>
              API {apiReady ? "已連線" : "未連線"}
            </span>
            <span className={`rounded-full border px-3 py-1 ${summaryReady ? "border-violet-400/30 bg-violet-500/10 text-violet-200" : "border-white/10 bg-white/[0.04] text-zinc-400"}`}>
              摘要設定 {summaryReady ? "可用" : "待確認"}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <HealthBar health={health} />
        </div>

        {loadError && (
          <p className="error" role="alert" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {loadError}
            <button className="btn btn-primary whitespace-nowrap" onClick={onBootstrap} style={{ fontSize: "0.85rem" }}>
              重試
            </button>
          </p>
        )}

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#1b1d23] p-4">
            <div>
              <p className="text-sm font-semibold text-zinc-100">系統音訊</p>
              <p className="mt-1 text-xs text-zinc-500">分享畫面時勾選音訊</p>
            </div>
            <span className="rounded-full bg-violet-500 px-3 py-1 text-xs font-semibold text-white">需要授權</span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#1b1d23] p-4">
            <div>
              <p className="text-sm font-semibold text-zinc-100">麥克風</p>
              <p className="mt-1 text-xs text-zinc-500">外接或內建輸入</p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">瀏覽器選擇</span>
          </div>
        </div>

        <RecordingControls
          isRecording={isRecording}
          currentJobId={currentJobId}
          jobStatus={jobStatus}
          meetingTitle={meetingTitle}
          uploadPhase={uploadPhase}
          uiError={uiError}
          onStart={onStartRecording}
          onStop={onStopRecording}
          onTitleChange={onTitleChange}
        />

        <RecordingModeCards />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#24272f] p-5 shadow-xl shadow-black/10">
        <MeetingList meetings={meetings} selectedMeetingId={selectedMeetingId} onSelect={onLoadMeetingResult} />
      </section>

      {currentMeetingId && <p className="footer-note">目前會議 ID: {currentMeetingId}</p>}
    </>
  );
}
