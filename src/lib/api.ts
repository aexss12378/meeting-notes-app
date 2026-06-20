import type { HealthStatus, JobStatus, Meeting, MeetingResult, Todo, TodoPatch } from "@/types";

const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";

type CreateMeetingResponse = Pick<Meeting, "meeting_id">;

type ProcessMeetingResponse = {
  job_id: string;
};

type ProcessMeetingOptions = {
  summaryApiUrl: string;
  summaryModel: string;
  summaryApiKey: string;
};

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getReadyStatus() {
  return fetchJson<HealthStatus>(`${apiBase}/health/ready`);
}

export function listMeetings() {
  return fetchJson<Meeting[]>(`${apiBase}/api/v1/meetings?limit=50`);
}

export function getMeetingResult(meetingId: string) {
  return fetchJson<MeetingResult>(`${apiBase}/api/v1/meetings/${meetingId}/result`);
}

export function getJobStatus(jobId: string) {
  return fetchJson<JobStatus>(`${apiBase}/api/v1/jobs/${jobId}`);
}

export function createMeeting(title: string) {
  return fetchJson<CreateMeetingResponse>(`${apiBase}/api/v1/meetings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, language: "zh-TW" }),
  });
}

export function startMeetingRecording(meetingId: string) {
  return fetchJson<unknown>(`${apiBase}/api/v1/meetings/${meetingId}/recording/start`, {
    method: "POST",
  });
}

export function finishMeetingRecording(meetingId: string, blob: Blob) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  return fetchJson<unknown>(`${apiBase}/api/v1/meetings/${meetingId}/recording/finish`, {
    method: "POST",
    body: formData,
  });
}

export function processMeeting(meetingId: string, options: ProcessMeetingOptions) {
  return fetchJson<ProcessMeetingResponse>(`${apiBase}/api/v1/meetings/${meetingId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      summary_api_url: options.summaryApiUrl.trim() || null,
      summary_model: options.summaryModel.trim() || null,
      summary_api_key: options.summaryApiKey.trim() || null,
    }),
  });
}

export function updateTodo(meetingId: string, todoId: string, patch: TodoPatch) {
  return fetchJson<Todo>(`${apiBase}/api/v1/meetings/${meetingId}/todos/${todoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
