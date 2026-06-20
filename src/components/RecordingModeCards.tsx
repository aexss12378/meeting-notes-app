"use client";

const recordingModes = [
  {
    title: "會議錄音",
    description: "麥克風、系統音訊",
    status: "目前可用",
    active: true,
    marker: "●",
  },
  {
    title: "錄製螢幕",
    description: "完整桌面畫面",
    status: "稍後加入",
    active: false,
    marker: "▣",
  },
  {
    title: "錄製視窗",
    description: "單一應用程式",
    status: "稍後加入",
    active: false,
    marker: "□",
  },
  {
    title: "純音訊",
    description: "只錄聲音來源",
    status: "稍後加入",
    active: false,
    marker: "○",
  },
];

export default function RecordingModeCards() {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-[0.18em] text-zinc-500">錄音模式</h2>
        <span className="text-xs text-zinc-500">目前使用會議錄音</span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {recordingModes.map((mode) => (
          <button
            key={mode.title}
            className={`group min-h-36 rounded-xl border p-4 text-left transition ${
              mode.active
                ? "border-violet-400/60 bg-gradient-to-br from-violet-500/45 via-violet-500/25 to-fuchsia-500/20 shadow-lg shadow-violet-950/30"
                : "border-white/10 bg-[#1a1c22] opacity-75 hover:border-white/20 hover:bg-white/[0.04]"
            }`}
            disabled={!mode.active}
            type="button"
          >
            <div
              className={`mb-4 grid h-9 w-9 place-items-center rounded-lg ${
                mode.active ? "bg-white/20 text-white" : "bg-white/5 text-zinc-500"
              }`}
              aria-hidden="true"
            >
              {mode.marker}
            </div>
            <h3 className="text-base font-semibold text-zinc-100">{mode.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{mode.description}</p>
            <p className={`mt-4 text-xs ${mode.active ? "text-violet-100" : "text-zinc-600"}`}>{mode.status}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
