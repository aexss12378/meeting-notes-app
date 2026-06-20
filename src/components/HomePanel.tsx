import type { HealthStatus, JobStatus, Meeting, UploadPhase } from "@/types";
import HealthBar from "./HealthBar";
import MeetingList from "./MeetingList";
import RecordingControls from "./RecordingControls";
import RecordingModeCards from "./RecordingModeCards";

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
  onLoadMeetingResult: (meetingId: string) => Promise<void>;
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

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">
          早安，開始新的會議記錄
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          錄音後產生摘要與 TODO，不提供即時字幕。
        </p>
      </header>

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
            音訊來源
          </h2>
          <div className="flex gap-2 text-xs">
            <span
              className={`rounded-full border px-3 py-1 ${
                apiReady
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-400/30 bg-rose-500/10 text-rose-200"
              }`}
            >
              API {apiReady ? "已連線" : "未連線"}
            </span>
          </div>
        </div>

        <HealthBar health={health} />

        {loadError && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-rose-400/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={onBootstrap}
              className="ml-auto rounded-md bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/30"
            >
              重試
            </button>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#181a21] p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/[0.04]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">系統音訊</p>
                <p className="text-xs text-zinc-600">分享畫面時勾選音訊</p>
              </div>
            </div>
            <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-300">
              需要授權
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#181a21] p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/[0.04]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">麥克風</p>
                <p className="text-xs text-zinc-600">外接或內建輸入</p>
              </div>
            </div>
            <span className="rounded-full border border-white/[0.06] px-3 py-1 text-xs text-zinc-400">
              瀏覽器選擇
            </span>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <RecordingModeCards />
      </section>

      <section className="mb-8">
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
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
            最近會議
          </h2>
        </div>
        <MeetingList
          meetings={meetings}
          selectedMeetingId={selectedMeetingId}
          onSelect={onLoadMeetingResult}
        />
      </section>
    </div>
  );
}