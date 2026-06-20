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
    <div className="mx-auto max-w-2xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">摘要 API</h1>
        <p className="mt-1 text-sm text-zinc-500">
          錄音完成後會用這裡的設定產生摘要。
        </p>
      </header>

      <div className="rounded-xl border border-white/[0.06] bg-[#181a21] p-6">
        <div className="grid gap-5">
          <label className="grid gap-2">
            <span className="text-xs font-medium text-zinc-500">端點網址</span>
            <input
              type="text"
              value={settings.apiUrl}
              onChange={(e) => onApiUrlChange(e.target.value)}
              placeholder="http://localhost:11434"
              className="h-11 rounded-lg border border-white/[0.08] bg-[#0d0e12] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-medium text-zinc-500">模型名稱</span>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="qwen3:14b"
              className="h-11 rounded-lg border border-white/[0.08] bg-[#0d0e12] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-medium text-zinc-500">API Key</span>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="h-11 rounded-lg border border-white/[0.08] bg-[#0d0e12] px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20"
            />
          </label>
        </div>
      </div>
    </div>
  );
}