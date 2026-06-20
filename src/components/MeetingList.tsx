"use client";

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

function statusLabel(status: string) {
  if (status === "done") return "摘要完成";
  if (status === "processing") return "處理中";
  if (status === "recording") return "錄音中";
  if (status === "error") return "處理失敗";
  return status || "待處理";
}

export default function MeetingList({ meetings, selectedMeetingId, onSelect }: MeetingListProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-100">最近會議</h2>
        <span className="text-xs text-zinc-500">{meetings.length ? `${meetings.length} 筆` : "尚無資料"}</span>
      </div>

      <ul className="grid gap-2" role="listbox" aria-label="最近會議">
        {meetings.map((meeting) => (
          <li key={meeting.meeting_id}>
            <button
              className={`grid w-full gap-3 rounded-lg border px-3 py-3 text-left transition md:grid-cols-[1fr_auto] md:items-center ${
                selectedMeetingId === meeting.meeting_id
                  ? "border-violet-400/60 bg-violet-500/10"
                  : "border-white/10 bg-[#1a1c22] hover:border-white/20 hover:bg-white/[0.04]"
              }`}
              onClick={() => onSelect(meeting.meeting_id)}
              aria-label={`${meeting.title} - ${meeting.status}`}
              role="option"
              aria-selected={selectedMeetingId === meeting.meeting_id}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-zinc-100">{meeting.title}</span>
                <span className="mt-1 block text-xs text-zinc-500">{formatMeetingDate(meeting.created_at)}</span>
              </span>
              <span className="flex flex-wrap gap-2 md:justify-end">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">
                  {statusLabel(meeting.status)}
                </span>
                <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200">
                  {meeting.status === "done" ? "摘要 / TODO" : "等待摘要"}
                </span>
              </span>
            </button>
          </li>
        ))}
        {meetings.length === 0 && (
          <li className="rounded-lg border border-dashed border-white/10 bg-[#1a1c22]/60 px-4 py-6 text-sm text-zinc-500">
            目前還沒有會議。
          </li>
        )}
      </ul>
    </div>
  );
}
