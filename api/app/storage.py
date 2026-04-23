from __future__ import annotations

import json
import shutil
import uuid
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utcnow_iso() -> str:
    return utcnow().isoformat()


def parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


class MeetingStore:
    AUDIO_EXTENSIONS = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".aac", ".flac"}

    def __init__(self, base_dir: str) -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _slugify_title(title: str) -> str:
        normalized = unicodedata.normalize("NFKC", title).strip().lower()
        parts: list[str] = []
        last_was_dash = False

        for char in normalized:
            if char.isalnum():
                parts.append(char)
                last_was_dash = False
                continue

            if not parts or last_was_dash:
                continue

            parts.append("-")
            last_was_dash = True

        slug = "".join(parts).strip("-")
        return slug[:80] or "meeting"

    def _build_storage_key(self, title: str, created_at: datetime) -> str:
        stamp = created_at.strftime("%Y-%m-%d_%H-%M-%SZ")
        slug = self._slugify_title(title)
        base_name = f"{stamp}_{slug}"
        candidate = base_name
        suffix = 2

        while (self.base_dir / candidate).exists():
            candidate = f"{base_name}-{suffix}"
            suffix += 1

        return candidate

    def _find_meeting_dir(self, meeting_id: str) -> Path | None:
        legacy_dir = self.base_dir / meeting_id
        if (legacy_dir / "metadata.json").exists():
            return legacy_dir

        for item in self.base_dir.iterdir():
            if not item.is_dir():
                continue
            metadata_path = item / "metadata.json"
            if not metadata_path.exists():
                continue
            try:
                metadata = self._read_json(metadata_path)
            except json.JSONDecodeError:
                continue
            if metadata.get("meeting_id") == meeting_id:
                return item

        return None

    def meeting_dir(self, meeting_id: str) -> Path:
        return self._find_meeting_dir(meeting_id) or (self.base_dir / meeting_id)

    def metadata_path(self, meeting_id: str) -> Path:
        return self.meeting_dir(meeting_id) / "metadata.json"

    def output_summary_path(self, meeting_id: str) -> Path:
        return self.meeting_dir(meeting_id) / "output" / "summary.json"

    def output_todos_path(self, meeting_id: str) -> Path:
        return self.meeting_dir(meeting_id) / "output" / "todos.json"

    def transcript_path(self, meeting_id: str) -> Path:
        return self.meeting_dir(meeting_id) / "intermediate" / "transcript.jsonl"

    def audio_dir(self, meeting_id: str) -> Path:
        return self.meeting_dir(meeting_id) / "audio"

    def audio_backup_dir(self, meeting_id: str) -> Path:
        return self.meeting_dir(meeting_id) / "audio_backup"

    @staticmethod
    def _ensure_layout_at(root: Path) -> None:
        (root / "audio").mkdir(parents=True, exist_ok=True)
        (root / "audio_backup").mkdir(parents=True, exist_ok=True)
        (root / "intermediate").mkdir(parents=True, exist_ok=True)
        (root / "output").mkdir(parents=True, exist_ok=True)
        (root / "logs").mkdir(parents=True, exist_ok=True)

    def _ensure_layout(self, meeting_id: str) -> None:
        self._ensure_layout_at(self.meeting_dir(meeting_id))

    @staticmethod
    def _write_json(path: Path, payload: Any) -> None:
        temp_path = path.with_suffix(path.suffix + ".tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    @staticmethod
    def _read_json(path: Path) -> Any:
        return json.loads(path.read_text(encoding="utf-8"))

    def create_meeting(self, title: str, language: str) -> dict[str, Any]:
        meeting_id = str(uuid.uuid4())
        created_at = utcnow()
        storage_key = self._build_storage_key(title, created_at)
        root = self.base_dir / storage_key
        self._ensure_layout_at(root)
        now = created_at.isoformat()
        metadata = {
            "meeting_id": meeting_id,
            "storage_key": storage_key,
            "title": title,
            "language": language,
            "status": "created",
            "created_at": now,
            "updated_at": now,
            "audio_filename": None,
            "audio_backup_filename": None,
            "audio_size_bytes": 0,
            "audio_sha256": None,
        }
        self._write_json(root / "metadata.json", metadata)
        return metadata

    def exists(self, meeting_id: str) -> bool:
        return self._find_meeting_dir(meeting_id) is not None

    def load_metadata(self, meeting_id: str) -> dict[str, Any]:
        path = self.metadata_path(meeting_id)
        if not path.exists():
            raise FileNotFoundError(f"meeting not found: {meeting_id}")
        return self._read_json(path)

    def save_metadata(self, meeting_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
        metadata["updated_at"] = utcnow_iso()
        self._write_json(self.metadata_path(meeting_id), metadata)
        return metadata

    def list_meetings(self) -> list[dict[str, Any]]:
        meetings: list[dict[str, Any]] = []
        for item in self.base_dir.iterdir():
            if not item.is_dir():
                continue
            path = item / "metadata.json"
            if not path.exists():
                continue
            try:
                meetings.append(self._read_json(path))
            except json.JSONDecodeError:
                continue
        meetings.sort(key=lambda row: row.get("updated_at", ""), reverse=True)
        return meetings

    def mark_status(self, meeting_id: str, status: str) -> dict[str, Any]:
        metadata = self.load_metadata(meeting_id)
        metadata["status"] = status
        return self.save_metadata(meeting_id, metadata)

    def recording_path(self, meeting_id: str, filename: str) -> Path:
        self._ensure_layout(meeting_id)
        suffix = Path(filename).suffix.lower()
        if suffix not in self.AUDIO_EXTENSIONS:
            suffix = ".webm"
        return self.audio_dir(meeting_id) / f"original{suffix}"

    def recording_backup_path(self, meeting_id: str, filename: str) -> Path:
        self._ensure_layout(meeting_id)
        original_name = self.recording_path(meeting_id, filename).name
        stamp = utcnow().strftime("%Y-%m-%d_%H-%M-%SZ")
        candidate = self.audio_backup_dir(meeting_id) / f"{stamp}_{original_name}"
        suffix = 2

        while candidate.exists():
            stem = Path(original_name).stem
            extension = Path(original_name).suffix
            candidate = self.audio_backup_dir(meeting_id) / f"{stamp}_{stem}-{suffix}{extension}"
            suffix += 1

        return candidate

    def temp_recording_path(self, meeting_id: str, *, backup: bool = False) -> Path:
        base_dir = self.audio_backup_dir(meeting_id) if backup else self.audio_dir(meeting_id)
        self._ensure_layout(meeting_id)
        return base_dir / f".upload-{uuid.uuid4().hex}.tmp"

    def mark_recording_finished(
        self,
        meeting_id: str,
        filename: str,
        audio_size_bytes: int,
        *,
        backup_filename: str,
        audio_sha256: str,
    ) -> dict[str, Any]:
        metadata = self.load_metadata(meeting_id)
        metadata["status"] = "recorded"
        metadata["audio_filename"] = filename
        metadata["audio_backup_filename"] = backup_filename
        metadata["audio_size_bytes"] = audio_size_bytes
        metadata["audio_sha256"] = audio_sha256
        return self.save_metadata(meeting_id, metadata)

    def resolve_audio_file(self, meeting_id: str) -> Path:
        metadata = self.load_metadata(meeting_id)
        filename = metadata.get("audio_filename")
        if filename:
            path = self.audio_dir(meeting_id) / filename
            if path.exists():
                return path

        backup_filename = metadata.get("audio_backup_filename")
        if backup_filename:
            backup_path = self.audio_backup_dir(meeting_id) / backup_filename
            if backup_path.exists():
                return backup_path

        files = sorted(self.audio_dir(meeting_id).glob("*"))
        if files:
            return files[0]

        backup_files = sorted(self.audio_backup_dir(meeting_id).glob("*"))
        if backup_files:
            return backup_files[0]

        raise FileNotFoundError("recording file is missing")

    def save_transcript_segments(self, meeting_id: str, segments: list[dict[str, Any]]) -> None:
        path = self.transcript_path(meeting_id)
        lines = [json.dumps(segment, ensure_ascii=False) for segment in segments]
        path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    def save_output(self, meeting_id: str, summary: dict[str, Any], todos: list[dict[str, Any]]) -> None:
        self._write_json(self.output_summary_path(meeting_id), summary)
        self._write_json(self.output_todos_path(meeting_id), todos)

    def load_result(self, meeting_id: str) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
        summary_path = self.output_summary_path(meeting_id)
        todos_path = self.output_todos_path(meeting_id)

        summary: dict[str, Any] | None = None
        todos: list[dict[str, Any]] = []

        if summary_path.exists():
            summary = self._read_json(summary_path)
        if todos_path.exists():
            todos = self._read_json(todos_path)

        return summary, todos

    def update_todo(self, meeting_id: str, todo_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        todos_path = self.output_todos_path(meeting_id)
        if not todos_path.exists():
            raise FileNotFoundError("todo list not found")
        todos: list[dict[str, Any]] = self._read_json(todos_path)

        updated: dict[str, Any] | None = None
        for todo in todos:
            if todo.get("id") != todo_id:
                continue
            if "text" in patch and patch["text"] is not None:
                todo["text"] = patch["text"]
            if "done" in patch and patch["done"] is not None:
                todo["done"] = patch["done"]
            updated = todo
            break

        if updated is None:
            raise FileNotFoundError(f"todo not found: {todo_id}")

        self._write_json(todos_path, todos)
        self.mark_status(meeting_id, "done")
        return updated

    def clean_retention(self, retention_days: int) -> int:
        removed = 0
        threshold = utcnow() - timedelta(days=retention_days)

        for metadata in self.list_meetings():
            meeting_id = metadata["meeting_id"]
            created_at = metadata.get("created_at")
            if not created_at:
                continue
            try:
                created_dt = parse_dt(created_at)
            except ValueError:
                continue
            if created_dt > threshold:
                continue

            audio_dir = self.audio_dir(meeting_id)
            audio_backup_dir = self.audio_backup_dir(meeting_id)
            intermediate_dir = self.meeting_dir(meeting_id) / "intermediate"
            if audio_dir.exists():
                shutil.rmtree(audio_dir)
                audio_dir.mkdir(parents=True, exist_ok=True)
                removed += 1
            if audio_backup_dir.exists():
                shutil.rmtree(audio_backup_dir)
                audio_backup_dir.mkdir(parents=True, exist_ok=True)
            if intermediate_dir.exists():
                shutil.rmtree(intermediate_dir)
                intermediate_dir.mkdir(parents=True, exist_ok=True)

        return removed
