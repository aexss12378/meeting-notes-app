from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MeetingCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    language: str = Field(default="zh-TW", max_length=32)


class MeetingResponse(BaseModel):
    meeting_id: str
    title: str
    language: str
    status: str
    created_at: datetime


class MeetingListItem(BaseModel):
    meeting_id: str
    title: str
    language: str
    status: str
    created_at: datetime
    updated_at: datetime


class RecordingActionResponse(BaseModel):
    meeting_id: str
    status: str


class RecordingFinishResponse(BaseModel):
    meeting_id: str
    status: str
    audio_filename: str
    audio_size_bytes: int


class ProcessResponse(BaseModel):
    meeting_id: str
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    meeting_id: str
    status: str
    progress: int
    message: str | None = None
    attempt: int = 0


class TodoItem(BaseModel):
    id: str
    text: str
    done: bool = False
    source_span: str | None = None


class SummaryModel(BaseModel):
    overview: str
    key_points: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)


class MeetingResultResponse(BaseModel):
    meeting_id: str
    status: str
    summary: SummaryModel | None = None
    todos: list[TodoItem] = Field(default_factory=list)


class TodoPatchRequest(BaseModel):
    text: str | None = None
    done: bool | None = None


class WorkerOutput(BaseModel):
    summary: SummaryModel
    todos: list[TodoItem]
    transcript_segments: list[dict[str, Any]]
