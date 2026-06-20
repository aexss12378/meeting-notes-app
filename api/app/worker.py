from __future__ import annotations

import time
import traceback
from datetime import datetime, timezone

from app.config import get_settings
from app.pipeline import summarize_and_extract_todos, transcribe_audio
from app.queue import JobQueue
from app.schemas import SummaryModel, TodoItem
from app.storage import MeetingStore

settings = get_settings()
store = MeetingStore(settings.data_dir)
queue = JobQueue(settings.redis_url, settings.queue_name, settings.job_key_prefix)


def log(message: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    print(f"[{now}] {message}")


def set_job_status_safe(
    job_id: str,
    *,
    status: str,
    progress: int,
    message: str,
    attempt: int,
) -> None:
    try:
        queue.set_job_status(
            job_id,
            status=status,
            progress=progress,
            message=message,
            attempt=attempt,
        )
    except Exception as exc:  # pragma: no cover - runtime path
        log(f"Failed to update job status for {job_id}: {exc}")


def mark_meeting_status_safe(meeting_id: str, status: str) -> None:
    try:
        store.mark_status(meeting_id, status)
    except Exception as exc:  # pragma: no cover - runtime path
        log(f"Failed to update meeting status for {meeting_id}: {exc}")


def handle_job(
    job_id: str,
    meeting_id: str,
    attempt: int,
    summary_api_url: str | None = None,
    summary_model: str | None = None,
    summary_api_key: str | None = None,
) -> None:
    set_job_status_safe(
        job_id,
        status="running",
        progress=5,
        message="準備處理音檔",
        attempt=attempt,
    )
    mark_meeting_status_safe(meeting_id, "processing")

    audio_path = store.resolve_audio_file(meeting_id)

    set_job_status_safe(
        job_id,
        status="running",
        progress=35,
        message="正在轉錄音檔",
        attempt=attempt,
    )
    segments = transcribe_audio(audio_path, settings)

    set_job_status_safe(
        job_id,
        status="running",
        progress=70,
        message="正在向遠端模型產生摘要與 TODO",
        attempt=attempt,
    )
    runtime_settings = settings.model_copy(
        update={
            key: value
            for key, value in {
                "ollama_base_url": summary_api_url.strip() if summary_api_url else None,
                "ollama_model": summary_model.strip() if summary_model else None,
                "ollama_api_key": summary_api_key.strip() if summary_api_key else None,
            }.items()
            if value
        }
    )
    summary_raw, todos_raw = summarize_and_extract_todos(segments, runtime_settings)
    summary = SummaryModel(**summary_raw)
    todos = [TodoItem(**todo) for todo in todos_raw]

    set_job_status_safe(
        job_id,
        status="running",
        progress=90,
        message="正在寫入結果",
        attempt=attempt,
    )
    store.save_transcript_segments(meeting_id, segments)
    store.save_output(
        meeting_id,
        summary.model_dump(),
        [todo.model_dump() for todo in todos],
    )

    mark_meeting_status_safe(meeting_id, "done")
    set_job_status_safe(
        job_id,
        status="done",
        progress=100,
        message="處理完成",
        attempt=attempt,
    )


def run() -> None:
    cleanup_interval_sec = 3600
    last_cleanup = 0.0

    log("Worker started")
    log(f"REDIS_URL={settings.redis_url}")
    log(f"DATA_DIR={settings.data_dir}")
    log(f"WHISPER_MODEL_SIZE={settings.whisper_model_size}")
    log(f"OLLAMA_MODEL={settings.ollama_model}")

    while True:
        now = time.monotonic()
        if now - last_cleanup >= cleanup_interval_sec:
            removed = store.clean_retention(settings.retention_days)
            log(f"Retention cleanup complete. audio_dirs_cleared={removed}")
            last_cleanup = now

        payload = queue.pop_next(timeout=3)
        if not payload:
            continue

        job_id = payload["job_id"]
        meeting_id = payload["meeting_id"]
        attempt = int(payload.get("attempt", 0))
        summary_api_url = payload.get("summary_api_url")
        summary_model = payload.get("summary_model")
        summary_api_key = payload.get("summary_api_key")

        try:
            handle_job(
                job_id=job_id,
                meeting_id=meeting_id,
                attempt=attempt,
                summary_api_url=summary_api_url,
                summary_model=summary_model,
                summary_api_key=summary_api_key,
            )
            log(f"Job {job_id} finished")
        except Exception as exc:  # pragma: no cover - runtime path
            log(f"Job {job_id} failed: {exc}")
            traceback.print_exc()

            if attempt < 1:
                next_attempt = attempt + 1
                set_job_status_safe(
                    job_id,
                    status="queued",
                    progress=0,
                    message=f"處理失敗，準備重試：{exc}",
                    attempt=next_attempt,
                )
                try:
                    queue.enqueue_existing(
                        job_id=job_id,
                        meeting_id=meeting_id,
                        attempt=next_attempt,
                        summary_api_url=summary_api_url,
                        summary_model=summary_model,
                        summary_api_key=summary_api_key,
                    )
                except Exception as enqueue_exc:  # pragma: no cover - runtime path
                    log(f"Failed to requeue job {job_id}: {enqueue_exc}")
                    mark_meeting_status_safe(meeting_id, "error")
                    set_job_status_safe(
                        job_id,
                        status="error",
                        progress=100,
                        message=f"重新排入佇列失敗：{enqueue_exc}",
                        attempt=next_attempt,
                    )
                continue

            mark_meeting_status_safe(meeting_id, "error")
            set_job_status_safe(
                job_id,
                status="error",
                progress=100,
                message=f"處理失敗：{exc}",
                attempt=attempt,
            )


if __name__ == "__main__":
    run()
