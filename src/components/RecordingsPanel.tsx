import MeetingDetail from "./MeetingDetail";
import MeetingList from "./MeetingList";
import type { Meeting, MeetingResult, TodoPatch } from "@/types";

type RecordingsPanelProps = {
  meetings: Meeting[];
  selectedMeeting: Meeting | null;
  selectedMeetingId: string | null;
  result: MeetingResult | null;
  onLoadMeetingResult: (meetingId: string) => Promise<void>;
  onPatchTodo: (todoId: string, patch: TodoPatch) => void;
};

export default function RecordingsPanel({
  meetings,
  selectedMeeting,
  selectedMeetingId,
  result,
  onLoadMeetingResult,
  onPatchTodo,
}: RecordingsPanelProps) {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">錄音紀錄</h1>
        <p className="mt-1 text-sm text-zinc-500">
          選擇會議查看摘要與 TODO。
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
              會議列表
            </h2>
            <span className="text-xs text-zinc-700">
              {meetings.length ? `${meetings.length} 筆` : "尚無資料"}
            </span>
          </div>
          <MeetingList
            meetings={meetings}
            selectedMeetingId={selectedMeetingId}
            onSelect={onLoadMeetingResult}
          />
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
              {selectedMeeting ? selectedMeeting.title : "摘要與 TODO"}
            </h2>
          </div>
          <MeetingDetail
            meeting={selectedMeeting}
            result={result}
            onPatchTodo={onPatchTodo}
          />
        </section>
      </div>
    </div>
  );
}