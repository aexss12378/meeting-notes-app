import { useEffect, useMemo, useState } from "react";
import { getMeetingResult, getReadyStatus, listMeetings, updateTodo } from "@/lib/api";
import type { HealthStatus, Meeting, MeetingResult, TodoPatch } from "@/types";

type UseMeetingsOptions = {
  onError: (message: string) => void;
};

export function useMeetings({ onError }: UseMeetingsOptions) {
  const [health, setHealth] = useState<HealthStatus>({ status: "loading", detail: "Checking API..." });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [result, setResult] = useState<MeetingResult | null>(null);

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.meeting_id === selectedMeetingId) || null,
    [meetings, selectedMeetingId],
  );

  const refreshMeetings = async () => {
    const data = await listMeetings();
    setMeetings(data);
  };

  const loadMeetingResult = async (meetingId: string) => {
    const data = await getMeetingResult(meetingId);
    setSelectedMeetingId(meetingId);
    setResult(data);
  };

  const selectPendingMeeting = (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    setResult(null);
  };

  const bootstrap = async () => {
    setLoadError(null);
    try {
      const ready = await getReadyStatus();
      setHealth(ready.status === "ok" ? { status: "ok", detail: "API 已連線" } : { status: "error", detail: "API 尚未就緒" });
    } catch (error) {
      setHealth({ status: "error", detail: `無法連線到 API（${String(error)}）` });
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

  const patchTodo = async (todoId: string, patch: TodoPatch) => {
    if (!selectedMeetingId) return;
    try {
      const updated = await updateTodo(selectedMeetingId, todoId, patch);
      setResult((prev) => {
        if (!prev) return prev;
        return { ...prev, todos: (prev.todos || []).map((t) => (t.id === todoId ? updated : t)) };
      });
    } catch (error) {
      onError(`更新 TODO 失敗：${String(error)}`);
    }
  };

  return {
    health,
    meetings,
    loadError,
    selectedMeeting,
    selectedMeetingId,
    result,
    refreshMeetings,
    loadMeetingResult,
    selectPendingMeeting,
    bootstrap,
    patchTodo,
  };
}
