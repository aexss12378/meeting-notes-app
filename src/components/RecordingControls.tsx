"use client";

import type { JobStatus, UploadPhase } from "@/types";

type RecordingControlsProps = {
  isRecording: boolean;
  currentJobId: string | null;
  jobStatus: JobStatus | null;
  meetingTitle: string;
  uploadPhase: UploadPhase;
  uiError: string;
  onStart: () => void;
  onStop: () => void;
  onTitleChange: (title: string) => void;
};

export default function RecordingControls({
  isRecording,
  currentJobId,
  jobStatus,
  meetingTitle,
  uploadPhase,
  uiError,
  onStart,
  onStop,
  onTitleChange,
}: RecordingControlsProps) {
  const statusLabel = isRecording
    ? "錄音中"
    : uploadPhase === "uploading"
      ? "上傳中"
      : uploadPhase === "processing"
        ? "排程中"
        : currentJobId && jobStatus
          ? `處理 ${jobStatus.progress}%`
          : "待命";

  return (
    <div className="mt-5 grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="grid flex-1 gap-2 text-sm text-zinc-400">
          會議標題
          <input
            className="h-12 rounded-lg border border-white/10 bg-[#1a1c23] px-4 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
            placeholder="例如：每週產品同步"
            value={meetingTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={isRecording}
            aria-label="會議標題"
          />
        </label>

        <div className="flex shrink-0 gap-2">
          <button
            className="h-12 rounded-full bg-gradient-to-r from-violet-500 to-violet-400 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-950/35 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            onClick={onStart}
            disabled={isRecording || !!currentJobId}
            aria-label="開始錄音"
          >
            開始錄音
          </button>
          <button
            className="h-12 rounded-full bg-rose-500/60 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
            onClick={onStop}
            disabled={!isRecording}
            aria-label="停止錄音"
          >
            停止錄音
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm" role="status" aria-live="polite">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-zinc-300">{statusLabel}</span>
        {isRecording && <span className="text-zinc-500">停止後會自動上傳並開始處理。</span>}
        {currentJobId && jobStatus && <span className="text-zinc-500">{jobStatus.message || jobStatus.status}</span>}
      </div>

      {uiError && (
        <p className="error" role="alert">
          {uiError}
        </p>
      )}
    </div>
  );
}
