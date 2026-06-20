from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from redis import Redis


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobQueue:
    def __init__(self, redis_url: str, queue_name: str, job_key_prefix: str) -> None:
        self.queue_name = queue_name
        self.job_key_prefix = job_key_prefix
        self.redis = Redis.from_url(redis_url, decode_responses=True)

    def _job_key(self, job_id: str) -> str:
        return f"{self.job_key_prefix}:{job_id}"

    def create_job(
        self,
        meeting_id: str,
        attempt: int = 0,
        summary_api_url: str | None = None,
        summary_model: str | None = None,
        summary_api_key: str | None = None,
    ) -> dict[str, Any]:
        job_id = str(uuid.uuid4())
        summary_config = {
            "summary_api_url": summary_api_url,
            "summary_model": summary_model,
            "summary_api_key": summary_api_key,
        }
        payload = {
            "job_id": job_id,
            "meeting_id": meeting_id,
            "status": "queued",
            "progress": 0,
            "message": "Job queued",
            "attempt": attempt,
            **summary_config,
            "created_at": utcnow_iso(),
            "updated_at": utcnow_iso(),
        }
        self.redis.set(self._job_key(job_id), json.dumps(payload))
        self.redis.lpush(
            self.queue_name,
            json.dumps(
                {
                    "job_id": job_id,
                    "meeting_id": meeting_id,
                    "attempt": attempt,
                    **summary_config,
                }
            ),
        )
        return payload

    def enqueue_existing(
        self,
        job_id: str,
        meeting_id: str,
        attempt: int,
        summary_api_url: str | None = None,
        summary_model: str | None = None,
        summary_api_key: str | None = None,
    ) -> None:
        self.redis.lpush(
            self.queue_name,
            json.dumps(
                {
                    "job_id": job_id,
                    "meeting_id": meeting_id,
                    "attempt": attempt,
                    "summary_api_url": summary_api_url,
                    "summary_model": summary_model,
                    "summary_api_key": summary_api_key,
                }
            ),
        )

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        raw = self.redis.get(self._job_key(job_id))
        if not raw:
            return None
        return json.loads(raw)

    def set_job_status(
        self,
        job_id: str,
        status: str,
        progress: int,
        message: str | None = None,
        attempt: int | None = None,
    ) -> dict[str, Any]:
        job = self.get_job(job_id)
        if not job:
            raise KeyError(f"job not found: {job_id}")

        job["status"] = status
        job["progress"] = progress
        if message is not None:
            job["message"] = message
        if attempt is not None:
            job["attempt"] = attempt
        job["updated_at"] = utcnow_iso()

        self.redis.set(self._job_key(job_id), json.dumps(job))
        return job

    def pop_next(self, timeout: int = 5) -> dict[str, Any] | None:
        data = self.redis.brpop(self.queue_name, timeout=timeout)
        if not data:
            return None
        _, payload = data
        return json.loads(payload)

    def ping(self) -> bool:
        return bool(self.redis.ping())
