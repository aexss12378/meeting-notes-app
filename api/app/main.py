from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_allowed_origins, get_settings
from app.queue import JobQueue
from app.schemas import (
    JobStatusResponse,
    MeetingCreateRequest,
    MeetingListItem,
    ProcessRequest,
    MeetingResponse,
    MeetingResultResponse,
    ProcessResponse,
    RecordingActionResponse,
    RecordingFinishResponse,
    TodoItem,
    TodoPatchRequest,
)
from app.storage import MeetingStore

settings = get_settings()
store = MeetingStore(settings.data_dir)
queue = JobQueue(settings.redis_url, settings.queue_name, settings.job_key_prefix)

app = FastAPI(
    title="Meeting Notes API",
    version="0.2.0",
    description="Backend service for offline subtitle-free meeting notes workflow.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_meeting_exists(meeting_id: str) -> None:
    if not store.exists(meeting_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="meeting not found")


def resolve_ollama_probe_url(raw_url: str) -> str:
    value = raw_url.strip().rstrip("/")
    if not value:
        return ""
    if value.endswith("/api/chat"):
        return value[: -len("/chat")] + "/tags"
    if value.endswith("/api/generate"):
        return value[: -len("/generate")] + "/tags"
    if value.endswith("/api"):
        return value + "/tags"
    return value + "/api/tags"


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "api", "time_utc": now_iso()}


@app.get("/health/live")
def live() -> dict:
    return {"status": "ok", "service": "api", "time_utc": now_iso()}


@app.get("/health/ready")
def ready() -> dict:
    redis_ok = False
    redis_error: str | None = None
    try:
        redis_ok = queue.ping()
    except Exception as exc:  # pragma: no cover - runtime dependency
        redis_error = str(exc)

    data_dir_ok = Path(settings.data_dir).exists()
    ollama_ok = False
    ollama_error: str | None = None

    if not settings.ollama_base_url.strip():
        ollama_error = "OLLAMA_BASE_URL is empty"
    else:
        try:
            probe_url = resolve_ollama_probe_url(settings.ollama_base_url)
            response = httpx.get(probe_url, timeout=5.0)
            ollama_ok = response.status_code < 500
            if not ollama_ok:
                ollama_error = f"unexpected status {response.status_code}"
        except Exception as exc:  # pragma: no cover - runtime dependency
            ollama_error = str(exc)

    status_flag = "ok" if redis_ok and data_dir_ok and ollama_ok else "degraded"
    return {
        "status": status_flag,
        "service": "api",
        "redis_ok": redis_ok,
        "data_dir_ok": data_dir_ok,
        "redis_error": redis_error,
        "ollama_ok": ollama_ok,
        "ollama_error": ollama_error,
        "time_utc": now_iso(),
    }


@app.post("/api/v1/meetings", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_meeting(payload: MeetingCreateRequest) -> dict:
    metadata = store.create_meeting(payload.title.strip(), payload.language.strip())
    return metadata


@app.get("/api/v1/meetings", response_model=list[MeetingListItem])
def list_meetings(limit: int = 50) -> list[dict]:
    rows = store.list_meetings()
    return rows[: max(1, min(limit, 200))]


@app.post("/api/v1/meetings/{meeting_id}/recording/start", response_model=RecordingActionResponse)
def start_recording(meeting_id: str) -> dict:
    ensure_meeting_exists(meeting_id)
    metadata = store.mark_status(meeting_id, "recording")
    return {"meeting_id": meeting_id, "status": metadata["status"]}


@app.post(
    "/api/v1/meetings/{meeting_id}/recording/finish",
    response_model=RecordingFinishResponse,
)
async def finish_recording(meeting_id: str, file: UploadFile = File(...)) -> dict:
    ensure_meeting_exists(meeting_id)

    upload_name = Path(file.filename or "recording.webm").name
    destination = store.recording_path(meeting_id, upload_name)
    backup_destination = store.recording_backup_path(meeting_id, upload_name)
    temp_destination = store.temp_recording_path(meeting_id)
    temp_backup_destination = store.temp_recording_path(meeting_id, backup=True)

    bytes_limit = settings.max_upload_size_mb * 1024 * 1024
    total_size = 0
    sha256 = hashlib.sha256()

    try:
        with temp_destination.open("wb") as output, temp_backup_destination.open("wb") as backup_output:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > bytes_limit:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"recording too large (limit: {settings.max_upload_size_mb} MB)",
                    )
                sha256.update(chunk)
                output.write(chunk)
                backup_output.write(chunk)
    except Exception:
        temp_destination.unlink(missing_ok=True)
        temp_backup_destination.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    destination.unlink(missing_ok=True)
    temp_destination.replace(destination)
    temp_backup_destination.replace(backup_destination)

    metadata = store.mark_recording_finished(
        meeting_id,
        destination.name,
        total_size,
        backup_filename=backup_destination.name,
        audio_sha256=sha256.hexdigest(),
    )
    return {
        "meeting_id": meeting_id,
        "status": metadata["status"],
        "audio_filename": metadata["audio_filename"],
        "audio_size_bytes": total_size,
    }


@app.post("/api/v1/meetings/{meeting_id}/process", response_model=ProcessResponse)
def process_meeting(meeting_id: str, payload: ProcessRequest | None = None) -> dict:
    ensure_meeting_exists(meeting_id)

    try:
        store.resolve_audio_file(meeting_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="recording file not found") from exc

    store.mark_status(meeting_id, "processing")
    summary_api_url = payload.summary_api_url.strip() if payload and payload.summary_api_url else None
    summary_model = payload.summary_model.strip() if payload and payload.summary_model else None
    summary_api_key = payload.summary_api_key.strip() if payload and payload.summary_api_key else None
    job = queue.create_job(
        meeting_id,
        summary_api_url=summary_api_url,
        summary_model=summary_model,
        summary_api_key=summary_api_key,
    )

    return {"meeting_id": meeting_id, "job_id": job["job_id"], "status": job["status"]}


@app.get("/api/v1/jobs/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str) -> dict:
    job = queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    return job


@app.get("/api/v1/meetings/{meeting_id}/result", response_model=MeetingResultResponse)
def get_result(meeting_id: str) -> dict:
    ensure_meeting_exists(meeting_id)
    metadata = store.load_metadata(meeting_id)
    summary, todos = store.load_result(meeting_id)

    return {
        "meeting_id": meeting_id,
        "status": metadata["status"],
        "summary": summary,
        "todos": todos,
    }


@app.patch("/api/v1/meetings/{meeting_id}/todos/{todo_id}", response_model=TodoItem)
def patch_todo(meeting_id: str, todo_id: str, payload: TodoPatchRequest) -> dict:
    ensure_meeting_exists(meeting_id)
    try:
        updated = store.update_todo(meeting_id, todo_id, payload.model_dump())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return updated
