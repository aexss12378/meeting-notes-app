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
    <div className="rounded-xl border border-white/[0.06] bg-[#181a21] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-2">
          <span className="text-xs font-medium text-zinc-500">會議標題</span>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={isRecording}
            placeholder="例如：每週產品同步"
            aria-label="會議標題"
            className="h-11 rounded-lg border border-white/[0.08] bg-[#0d0e12] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onStart}
            disabled={isRecording || !!currentJobId}
            aria-label="開始錄音"
            className="flex h-11 items-center gap-2 rounded-lg bg-violet-500 px-5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-violet-500"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="6" />
            </svg>
            開始錄音
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={!isRecording}
            aria-label="停止錄音"
            className="flex h-11 items-center gap-2 rounded-lg bg-rose-500/80 px-5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-rose-500/80"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            停止錄音
          </button>
        </div>
      </div>

      <div
        className="mt-4 flex flex-wrap items-center gap-2 text-xs"
        role="status"
        aria-live="polite"
      >
        <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-zinc-400">
          {statusLabel}
        </span>
        {isRecording && (
          <span className="text-zinc-600">停止後會自動上傳並開始處理。</span>
        )}
        {currentJobId && jobStatus && (
          <span className="text-zinc-600">
            {jobStatus.message || jobStatus.status}
          </span>
        )}
      </div>

      {uiError && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-300"
        >
          {uiError}
        </p>
      )}
    </div>
  );
}