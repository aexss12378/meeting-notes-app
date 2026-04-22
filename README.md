# Meeting Notes App

Post-meeting workflow for local development:

1. Record in browser (no realtime subtitle)
2. Upload recording when stopped
3. Run background processing: local `faster-whisper` ASR -> remote LLM summary -> TODO
4. Show only summary and TODO in UI

## Stack

- `web`: Next.js (port 3000)
- `api`: FastAPI (port 8000)
- `worker`: background processor
- `redis`: job queue
- Remote LLM provider: your remote Ollama-compatible endpoint

## Current scope

- No realtime subtitle
- No direct file-upload entry page (recording from web only)
- No Zoom/Google Meet API integration
- Intermediate transcript is internal only

## Mic + system audio recording

This app records both microphone and shared system audio (Chrome/Edge desktop only).

1. Click `開始錄音`
2. Allow microphone permission
3. Choose a screen/window/tab and make sure audio sharing is enabled
4. Click `停止錄音` when meeting ends
5. The app uploads and processes audio automatically

Notes:
- If you do not share audio, recording will be blocked with an error.
- If audio sharing ends mid-recording, recording is stopped automatically.

## Quick start

1. Copy environment file:

```bash
cp .env.example .env
```

2. Start services:

```bash
make up
```

3. Check health:

```bash
make smoke
```

4. Open app:

- [http://localhost:3000](http://localhost:3000)

## API overview

- `POST /api/v1/meetings`
- `POST /api/v1/meetings/{meeting_id}/recording/start`
- `POST /api/v1/meetings/{meeting_id}/recording/finish` (`multipart/form-data`, field=`file`)
- `POST /api/v1/meetings/{meeting_id}/process`
- `GET /api/v1/jobs/{job_id}`
- `GET /api/v1/meetings/{meeting_id}/result`
- `PATCH /api/v1/meetings/{meeting_id}/todos/{todo_id}`

## Storage layout

Host path: `data/meetings/<meeting_id>/`

- `metadata.json`
- `audio/*`
- `intermediate/intermediate_transcript.jsonl`
- `output/summary.json`
- `output/todos.json`

The frontend only reads `summary.json` and `todos.json` through API.

## Retention policy

- Worker clears `audio/` and `intermediate/` for meetings older than `RETENTION_DAYS` (default 30).
- Cleanup runs periodically in worker loop.

## Runtime defaults

This project is configured to keep ASR local and send summarization to a remote model endpoint.

Default `.env` values:
- `WHISPER_MODEL_SIZE=small`
- `WHISPER_DEVICE=cpu`
- `WHISPER_COMPUTE_TYPE=int8`
- `OLLAMA_BASE_URL=http://remote-host:11434/api/chat`
- `OLLAMA_MODEL=qwen3:14b`

Notes:
- First startup downloads Whisper weights, so the first run is slower.
- `small + cpu + int8` is the safe default for a laptop or CPU-only Docker setup.
- Long meetings are chunked before summarization so remote or local endpoints do not lose context as quickly.

If you host your own remote Ollama-compatible endpoint:
- Set `OLLAMA_BASE_URL` to your remote server URL. Both base URLs like `http://host:11434` and full chat endpoints like `http://host:11434/api/chat` are supported.
- Set `OLLAMA_MODEL` to the model name exposed by that server

## Troubleshooting

1. Docker daemon not running:
- Start Docker Desktop, then rerun `make up`.

2. API says degraded:
- Check Redis container via `make logs`.
- If `ollama_ok=false`, your configured remote `OLLAMA_BASE_URL` is unreachable.

3. No summary generated:
- Confirm worker is running and inspect `make logs`.
 - Confirm your remote `OLLAMA_BASE_URL` and `OLLAMA_MODEL` are correct.

4. Recording cannot start with system audio:
- Use desktop Chrome or Edge.
- Re-share and enable audio in the share dialog.
- Ensure microphone permission is granted.

5. Local transcription is too slow:
- Try a smaller Whisper model such as `base`.
- Keep `WHISPER_DEVICE=cpu` and `WHISPER_COMPUTE_TYPE=int8` for CPU-only machines.

## Python dependencies

The API now uses `uv` with [pyproject.toml](/Users/chenqien/Documents/會議記錄應用/api/pyproject.toml) instead of `requirements.txt`.
