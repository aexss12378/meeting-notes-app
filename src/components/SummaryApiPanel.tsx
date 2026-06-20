"use client";

import type { SummaryApiSettings } from "@/types";

type SummaryApiPanelProps = {
  settings: SummaryApiSettings;
  onApiUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
};

export default function SummaryApiPanel({
  settings,
  onApiUrlChange,
  onModelChange,
  onApiKeyChange,
}: SummaryApiPanelProps) {
  return (
    <section className="card max-w-2xl">
      <h1>摘要 API</h1>
      <p>錄音完成後會用這裡的設定產生摘要。</p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm text-zinc-300">
          端點網址
          <input
            className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            value={settings.apiUrl}
            onChange={(event) => onApiUrlChange(event.target.value)}
            placeholder="http://localhost:11434"
          />
        </label>

        <label className="grid gap-2 text-sm text-zinc-300">
          模型名稱
          <input
            className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            value={settings.model}
            onChange={(event) => onModelChange(event.target.value)}
            placeholder="qwen3:14b"
          />
        </label>

        <label className="grid gap-2 text-sm text-zinc-300">
          API key
          <input
            className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            value={settings.apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            placeholder="sk-..."
            type="password"
          />
        </label>
      </div>
    </section>
  );
}
