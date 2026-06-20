export type HealthStatus = {
  status: "loading" | "ok" | "error" | string;
  detail: string;
};

export type Meeting = {
  meeting_id: string;
  title: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type JobStatus = {
  status: "queued" | "running" | "done" | "error" | string;
  progress: number;
  message?: string;
  meeting_id?: string;
};

export type UploadPhase = "uploading" | "processing" | null;

export type Summary = {
  overview?: string;
  key_points?: string[];
};

export type Todo = {
  id: string;
  text: string;
  done?: boolean;
};

export type MeetingResult = {
  summary?: Summary;
  todos?: Todo[];
};

export type TodoPatch = Partial<Pick<Todo, "text" | "done">>;

export type ActiveTab = "home" | "recordings" | "summaryApi" | "tags" | "search";

export type NavItem = {
  id: ActiveTab;
  label: string;
};

export type SummaryApiSettings = {
  apiUrl: string;
  model: string;
  apiKey: string;
};
