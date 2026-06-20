import type { Meeting } from "@/types";

type MeetingListProps = {
  meetings: Meeting[];
  selectedMeetingId: string | null;
  onSelect: (meetingId: string) => void;
};

function formatMeetingDate(value?: string) {
  if (!value) return "時間未記錄";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時間未記錄";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusPill(status: string) {
  if (status === "done") {
    return (
      <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-medium text-violet-300">
        摘要 / TODO
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
        AI 處理中
      </span>
    );
  }
  if (status === "recording") {
    return (
      <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-300">
        錄音中
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-300">
        處理失敗
      </span>
    );
  }
  return (
    <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-zinc-500">
      待處理
    </span>
  );
}

export default function MeetingList({
  meetings,
  selectedMeetingId,
  onSelect,
}: MeetingListProps) {
  return (
    <div>
      <ul className="grid gap-2" role="listbox" aria-label="最近會議">
        {meetings.map((meeting) => {
          const selected = selectedMeetingId === meeting.meeting_id;
          return (
            <li key={meeting.meeting_id}>
              <button
                type="button"
                onClick={() => onSelect(meeting.meeting_id)}
                aria-label={`${meeting.title} - ${meeting.status}`}
                role="option"
                aria-selected={selected}
                className={`grid w-full gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  selected
                    ? "border-violet-400/40 bg-violet-500/10"
                    : "border-white/[0.06] bg-[#181a21] hover:border-white/[0.1] hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.03]">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-zinc-600"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {meeting.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">
                      {formatMeetingDate(meeting.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {statusPill(meeting.status)}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {meetings.length === 0 && (
          <li className="rounded-lg border border-dashed border-white/[0.06] bg-[#181a21]/60 px-4 py-8 text-center text-sm text-zinc-600">
            目前還沒有會議。
          </li>
        )}
      </ul>
    </div>
  );
}