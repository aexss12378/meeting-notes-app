from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx

from app.config import Settings
from app.schemas import SummaryModel, TodoItem, WorkerOutput


class PipelineError(RuntimeError):
    pass


SUMMARY_JSON_SHAPE = (
    '{"overview":"...","key_points":["..."],"decisions":["..."],'
    '"risks":["..."],"open_questions":["..."],"todos":[{"text":"..."}]}'
)


def _format_error(exc: Exception) -> str:
    return f"{type(exc).__name__}: {exc}"


def _ollama_chat_url(settings: Settings) -> str:
    value = settings.ollama_base_url.strip().rstrip("/")
    if not value:
        raise PipelineError("ollama_base_url is missing")
    if value.endswith("/api/chat"):
        return value
    if value.endswith("/api/generate"):
        return value[: -len("/generate")] + "/chat"
    if value.endswith("/api"):
        return value + "/chat"
    return value + "/api/chat"


@lru_cache(maxsize=4)
def _load_whisper_model(
    model_size: str, device: str, compute_type: str, cpu_threads: int
):  # pragma: no cover - cached runtime dependency
    try:
        from faster_whisper import WhisperModel
    except Exception as exc:  # pragma: no cover - optional dependency
        raise PipelineError(f"faster-whisper is unavailable: {exc}") from exc

    kwargs: dict[str, Any] = {
        "device": device,
        "compute_type": compute_type,
    }
    if cpu_threads > 0:
        kwargs["cpu_threads"] = cpu_threads

    try:
        return WhisperModel(model_size, **kwargs)
    except Exception as exc:  # pragma: no cover - runtime dependency
        raise PipelineError(
            "faster-whisper model initialization failed: "
            f"model={model_size} device={device} compute_type={compute_type} error={exc}"
        ) from exc


def _transcribe_faster_whisper(audio_path: Path, settings: Settings) -> list[dict[str, Any]]:
    model = _load_whisper_model(
        settings.whisper_model_size,
        settings.whisper_device,
        settings.whisper_compute_type,
        settings.whisper_cpu_threads,
    )

    options: dict[str, Any] = {"vad_filter": True}
    language = settings.transcribe_language.strip()
    if language:
        options["language"] = language

    try:
        chunks, _ = model.transcribe(str(audio_path), **options)
    except Exception as exc:  # pragma: no cover - runtime dependency
        raise PipelineError(f"faster-whisper transcription failed: {exc}") from exc

    segments: list[dict[str, Any]] = []
    for chunk in chunks:
        text = (chunk.text or "").strip()
        if not text:
            continue
        segments.append(
            {
                "start_ms": int(chunk.start * 1000),
                "end_ms": int(chunk.end * 1000),
                "speaker": "Speaker A",
                "text": text,
                "confidence": 0.8,
            }
        )

    if not segments:
        raise PipelineError("empty transcript from faster-whisper")

    return segments


def transcribe_audio(audio_path: Path, settings: Settings) -> list[dict[str, Any]]:
    return _transcribe_faster_whisper(audio_path, settings)


def _transcript_text(segments: list[dict[str, Any]]) -> str:
    return "\n".join(f"{seg['speaker']}: {seg['text']}" for seg in segments)


def _normalize_summary_payload(parsed: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    todos_raw = parsed.get("todos", [])
    todos: list[dict[str, Any]] = []
    for item in todos_raw:
        text = ""
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = str(item.get("text", "")).strip()
        if not text:
            continue
        todos.append(
            {
                "id": f"todo-{len(todos) + 1}",
                "text": text,
                "done": False,
                "source_span": text[:120],
            }
        )

    summary = {
        "overview": str(parsed.get("overview", "")).strip() or "無摘要",
        "key_points": [str(x) for x in parsed.get("key_points", []) if str(x).strip()],
        "decisions": [str(x) for x in parsed.get("decisions", []) if str(x).strip()],
        "risks": [str(x) for x in parsed.get("risks", []) if str(x).strip()],
        "open_questions": [str(x) for x in parsed.get("open_questions", []) if str(x).strip()],
    }

    return summary, todos


def _extract_json_object(raw: str) -> dict[str, Any]:
    text = raw.strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise PipelineError("LLM response is not valid JSON")

    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise PipelineError("Cannot parse JSON from LLM response") from exc

    if not isinstance(parsed, dict):
        raise PipelineError("LLM response JSON root must be an object")
    return parsed


def _split_transcript(transcript: str, max_chars: int) -> list[str]:
    lines = [line.strip() for line in transcript.splitlines() if line.strip()]
    if not lines:
        return []

    limit = max(1500, max_chars)
    chunks: list[str] = []
    current: list[str] = []
    current_chars = 0

    for line in lines:
        line_len = len(line) + 1
        if current and current_chars + line_len > limit:
            chunks.append("\n".join(current))
            current = [line]
            current_chars = len(line)
            continue
        current.append(line)
        current_chars += line_len

    if current:
        chunks.append("\n".join(current))

    return chunks


def _dedupe_texts(items: list[str], limit: int) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for item in items:
        text = item.strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(text)
        if len(deduped) >= limit:
            break
    return deduped


def _combine_structured_summaries(
    parts: list[tuple[dict[str, Any], list[dict[str, Any]]]]
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    overviews = [summary["overview"] for summary, _ in parts if summary.get("overview")]
    key_points: list[str] = []
    decisions: list[str] = []
    risks: list[str] = []
    open_questions: list[str] = []
    todos_raw: list[str] = []

    for summary, todos in parts:
        key_points.extend(summary.get("key_points", []))
        decisions.extend(summary.get("decisions", []))
        risks.extend(summary.get("risks", []))
        open_questions.extend(summary.get("open_questions", []))
        todos_raw.extend(todo.get("text", "") for todo in todos)

    summary = {
        "overview": overviews[0] if overviews else "無摘要",
        "key_points": _dedupe_texts(key_points, limit=6),
        "decisions": _dedupe_texts(decisions, limit=6),
        "risks": _dedupe_texts(risks, limit=6),
        "open_questions": _dedupe_texts(open_questions, limit=6),
    }

    todos = [
        {
            "id": f"todo-{index}",
            "text": text,
            "done": False,
            "source_span": text[:120],
        }
        for index, text in enumerate(_dedupe_texts(todos_raw, limit=12), start=1)
    ]
    return summary, todos


def _build_summary_prompt(transcript: str) -> str:
    return _summary_instructions() + f"\n\n逐字稿：\n{transcript}\n"


def _summary_instructions() -> str:
    return (
        "你是會議助理，請閱讀逐字稿後只輸出 JSON。"
        f"格式必須是：{SUMMARY_JSON_SHAPE}。"
        "規則：使用繁體中文；不得輸出 markdown；若欄位無內容請回空陣列；"
        "todos 只保留可執行任務，不要替每個人亂指派負責人。"
    )


def _build_merge_prompt(parts: list[dict[str, Any]]) -> str:
    payload = json.dumps(parts, ensure_ascii=False)
    return (
        "你是會議助理，以下是多段逐字稿各自產出的摘要 JSON。"
        f"請整併成一份最終 JSON，格式必須是：{SUMMARY_JSON_SHAPE}。"
        "規則：使用繁體中文；去除重複；不要捏造資訊；"
        "若欄位無內容請回空陣列；todos 只保留明確可執行任務。\n\n"
        f"分段摘要 JSON：\n{payload}\n"
    )


def _ollama_transport_error_message(exc: Exception) -> str:
    details = _format_error(exc)

    if isinstance(exc, (httpx.ConnectTimeout, httpx.ConnectError)):
        return (
            "無法連線到遠端 Ollama 端點，請檢查 VPN 是否連線，"
            f"或確認遠端服務是否可用。details={details}"
        )

    if isinstance(exc, httpx.ReadTimeout):
        return f"遠端 Ollama 回應逾時，請檢查 VPN 穩定性或遠端服務負載。details={details}"

    if isinstance(exc, httpx.RemoteProtocolError):
        return (
            "遠端 Ollama 在回應前中斷連線，請檢查 VPN 穩定性，"
            f"或確認遠端服務健康狀態。details={details}"
        )

    return f"ollama request failed: {details}"


def _call_ollama_json(prompt: str, settings: Settings) -> dict[str, Any]:
    payload = {
        "model": settings.ollama_model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
    }
    headers = {}
    if settings.ollama_api_key.strip():
        headers["Authorization"] = f"Bearer {settings.ollama_api_key.strip()}"

    try:
        with httpx.Client(timeout=float(settings.ollama_timeout_seconds)) as client:
            response = client.post(_ollama_chat_url(settings), json=payload, headers=headers)
    except Exception as exc:  # pragma: no cover - runtime dependency
        raise PipelineError(_ollama_transport_error_message(exc)) from exc

    if response.status_code >= 400:
        details = response.text.strip()[:300]
        if response.status_code in {502, 503, 504}:
            raise PipelineError(
                "遠端 Ollama 服務目前不可用，請檢查 VPN 連線或遠端服務狀態。"
                f" status={response.status_code} model={settings.ollama_model} details={details}"
            )
        if response.status_code == 404:
            raise PipelineError(
                "遠端 Ollama 端點不存在，請檢查 OLLAMA_BASE_URL 設定是否正確。"
                f" status={response.status_code} model={settings.ollama_model} details={details}"
            )
        raise PipelineError(
            f"遠端 Ollama 請求失敗 ({response.status_code}) "
            f"model={settings.ollama_model} details={details}"
        )

    try:
        raw = response.json().get("message", {}).get("content", "{}")
    except Exception as exc:
        raise PipelineError(f"ollama returned invalid JSON payload: {_format_error(exc)}") from exc

    return _extract_json_object(str(raw))


def _ask_ollama(transcript: str, settings: Settings) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    chunks = _split_transcript(transcript, settings.summary_chunk_chars)
    if not chunks:
        raise PipelineError("empty transcript for ollama summary")

    if len(chunks) == 1:
        parsed = _call_ollama_json(_build_summary_prompt(chunks[0]), settings)
        return _normalize_summary_payload(parsed)

    partial_results: list[tuple[dict[str, Any], list[dict[str, Any]]]] = []
    partial_payloads: list[dict[str, Any]] = []

    for chunk in chunks:
        parsed = _call_ollama_json(_build_summary_prompt(chunk), settings)
        summary, todos = _normalize_summary_payload(parsed)
        partial_results.append((summary, todos))
        partial_payloads.append(
            {
                "overview": summary["overview"],
                "key_points": summary["key_points"],
                "decisions": summary["decisions"],
                "risks": summary["risks"],
                "open_questions": summary["open_questions"],
                "todos": [{"text": todo["text"]} for todo in todos],
            }
        )

    try:
        merged = _call_ollama_json(_build_merge_prompt(partial_payloads), settings)
        return _normalize_summary_payload(merged)
    except Exception:
        return _combine_structured_summaries(partial_results)


def summarize_and_extract_todos(
    segments: list[dict[str, Any]], settings: Settings
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    transcript = _transcript_text(segments)
    return _ask_ollama(transcript, settings)


def run_pipeline(audio_path: Path, settings: Settings) -> WorkerOutput:
    segments = transcribe_audio(audio_path, settings)
    summary_raw, todos_raw = summarize_and_extract_todos(segments, settings)

    summary = SummaryModel(**summary_raw)
    todos = [TodoItem(**todo) for todo in todos_raw]

    return WorkerOutput(summary=summary, todos=todos, transcript_segments=segments)
