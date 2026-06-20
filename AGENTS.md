# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 常用指令

### Docker Compose（預設執行環境）
```
make up        # 建立並啟動所有服務
make down      # 停止所有服務
make logs      # 持續追蹤日誌（最近 200 行）
make ps        # 顯示執行中容器
make smoke     # 健康檢查（curl /health/live + /health/ready）
make rebuild   # 不使用快取重建映像
make reset     # 停止服務並移除 volumes
```

### 本地開發（不使用 Docker）
```bash
# API — 需另行啟動 Redis
cd api && uv sync && uv run uvicorn app.main:app --reload --port 8000

# Worker — 同一 venv，獨立程序
cd api && uv run python -m app.worker

# Web
npm install && npm run dev
```

## 架構

Docker Compose 四個服務：

| 服務 | 角色 | Port |
|------|------|------|
| `web` | Next.js 14 前端（單頁） | 3000 |
| `api` | FastAPI 後端 | 8000 |
| `worker` | 背景 ASR + 摘要（與 api 共用程式碼） | — |
| `redis` | 工作佇列與狀態儲存 | 6379 |

### 資料流
1. 瀏覽器錄製麥克風 + 系統音訊 → 上傳 `.webm` 到 API
2. API 儲存音檔，將工作排入 Redis（`LPUSH` 至 `meeting:jobs`）
3. Worker 以 `BRPOP` 取出工作，執行 pipeline：
   - **轉錄**：`faster-whisper`（本地 CPU/GPU）
   - **摘要**：Ollama 相容端點（遠端）— 長逐字稿分段摘要後合併
4. Worker 將結果寫入檔案系統，更新 Redis 中的工作狀態
5. 前端每 2 秒輪詢 `GET /api/v1/jobs/{job_id}` 直到完成

### 後端模組（`api/app/`）
- `main.py` — FastAPI 路由、CORS、健康檢查端點
- `worker.py` — 長駐迴圈：取佇列 → 執行 pipeline → 失敗重試一次，定期清理過期資料
- `pipeline.py` — `faster-whisper` 轉錄 + Ollama chat 摘要（JSON 輸出解析）
- `queue.py` — `JobQueue` 類別：Redis 工作佇列 CRUD 與 `BRPOP` 消費者
- `storage.py` — `MeetingStore` 類別：檔案系統為主的會議資料儲存
- `config.py` — `Settings` 透過 `pydantic-settings` 讀取 `.env`
- `schemas.py` — Pydantic 請求/回應模型

### 前端（`src/`）
- `src/app/` — Next.js App Router 路由與版面
- `src/components/` — 前端元件
- `src/lib/` — 前端 API 呼叫與工具
- `src/types.ts` — 前端共用型別
- API base 來自 `NEXT_PUBLIC_API_BASE` 環境變數
- 介面語言為繁體中文

## 關鍵模式

### 檔案系統儲存
會議資料存放在 `data/meetings/<timestamp>_<title-slug>/`：
```
metadata.json
audio/original.webm
audio_backup/<timestamp>_original.webm
intermediate/transcript.jsonl
output/summary.json
output/todos.json
```
`meeting_id` 是 metadata 中的 UUID；資料夾名稱是可讀的 `storage_key`。`MeetingStore._find_meeting_dir()` 掃描所有資料夾以將 UUID 對應到目錄。

### 工作佇列協定
- 工作以 Redis string 儲存在 `meeting:job:<uuid>`
- 佇列是 Redis list `meeting:jobs` — `LPUSH` 入隊、`BRPOP` 消費
- 工作 payload：`{job_id, meeting_id, attempt}` — worker 失敗後重試一次（attempt 0 → 1）

### 摘要 pipeline
- 超過 `SUMMARY_CHUNK_CHARS`（預設 6000）的逐字稿會分段處理
- 每段透過 Ollama `/api/chat` 獨立摘要（`format: json`）
- 各段結果由第二次 Ollama 呼叫合併；若合併失敗則退回程式化去重
- Prompt 強制 JSON 格式：`{overview, key_points[], decisions[], risks[], open_questions[], todos[]}`
- 所有 prompt 使用繁體中文

## 設定

所有設定透過環境變數（參見 `.env.example`）。重點項目：

- `OLLAMA_BASE_URL` — 支援基底 URL（`http://host:11434`）與完整端點（`http://host:11434/api/chat`）
- `WHISPER_MODEL_SIZE` / `WHISPER_DEVICE` / `WHISPER_COMPUTE_TYPE` — 本地 ASR 調整
- `RETENTION_DAYS` — worker 刪除超過此天數的 `audio/` 與 `intermediate/`（預設 30）

## 開發備忘

- Python 依賴由 `uv` 管理（Docker 映像從 `ghcr.io/astral-sh/uv` 安裝）
- 專案未設定測試框架或 linter
- Docker 映像額外安裝 `ffmpeg` 處理音訊
- 音訊上傳大小上限：300 MB（`max_upload_size_mb`）
- API readiness 檢查（`/health/ready`）會探測 Redis、資料目錄、Ollama 可達性
