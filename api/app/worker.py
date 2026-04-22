from __future__ import annotations

import time
import traceback
from datetime import datetime, timezone

from app.config import get_settings
from app.pipeline import run_pipeline
from app.queue import JobQueue
from app.storage import MeetingStore

settings = get_settings()
store = MeetingStore(settings.data_dir)
queue = JobQueue(settings.redis_url, settings.queue_name, settings.job_key_prefix)


def log(message: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    print(f"[{now}] {message}")


def handle_job(job_id: str, meeting_id: str, attempt: int) -> None:
    queue.set_job_status(job_id, status="running", progress=5, message="Preparing", attempt=attempt)
    store.mark_status(meeting_id, "processing")

    audio_path = store.resolve_audio_file(meeting_id)

    queue.set_job_status(job_id, status="running", progress=35, message="Transcribing audio")
    result = run_pipeline(audio_path, settings)

    queue.set_job_status(job_id, status="running", progress=75, message="Writing outputs")
    store.save_transcript_segments(meeting_id, result.transcript_segments)
    store.save_output(
        meeting_id,
        result.summary.model_dump(),
        [todo.model_dump() for todo in result.todos],
    )

    store.mark_status(meeting_id, "done")
    queue.set_job_status(job_id, status="done", progress=100, message="Completed")


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

        try:
            handle_job(job_id=job_id, meeting_id=meeting_id, attempt=attempt)
            log(f"Job {job_id} finished")
        except Exception as exc:  # pragma: no cover - runtime path
            log(f"Job {job_id} failed: {exc}")
            traceback.print_exc()

            if attempt < 1:
                next_attempt = attempt + 1
                queue.set_job_status(
                    job_id,
                    status="queued",
                    progress=0,
                    message=f"Retrying after error: {exc}",
                    attempt=next_attempt,
                )
                queue.enqueue_existing(job_id=job_id, meeting_id=meeting_id, attempt=next_attempt)
                continue

            store.mark_status(meeting_id, "error")
            queue.set_job_status(
                job_id,
                status="error",
                progress=100,
                message=f"Failed after retry: {exc}",
                attempt=attempt,
            )


if __name__ == "__main__":
    run()
