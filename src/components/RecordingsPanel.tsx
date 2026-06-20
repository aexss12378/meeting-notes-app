"use client";

import MeetingDetail from "@/components/MeetingDetail";
import MeetingList from "@/components/MeetingList";
import type { Meeting, MeetingResult, TodoPatch } from "@/types";

type RecordingsPanelProps = {
  meetings: Meeting[];
  selectedMeeting: Meeting | null;
  selectedMeetingId: string | null;
  result: MeetingResult | null;
  onLoadMeetingResult: (meetingId: string) => void;
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
    <section className="card split">
      <MeetingList meetings={meetings} selectedMeetingId={selectedMeetingId} onSelect={onLoadMeetingResult} />
      <MeetingDetail meeting={selectedMeeting} result={result} onPatchTodo={onPatchTodo} />
    </section>
  );
}
