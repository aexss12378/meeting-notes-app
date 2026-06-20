const recordingModes = [
  {
    title: "會議錄音",
    description: "麥克風、系統音訊",
    subtext: "Zoom、Meet、Teams",
    status: "目前可用",
    active: true,
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  },
  {
    title: "錄製螢幕",
    description: "完整桌面畫面",
    subtext: "Full desktop focus",
    status: "稍後加入",
    active: false,
    icon: "M3 4h18v14H3zM3 10h18M7 14h6",
  },
  {
    title: "錄製視窗",
    description: "單一應用程式",
    subtext: "Single app focus",
    status: "稍後加入",
    active: false,
    icon: "M3 3h18v18H3zM3 9h18M9 9v12",
  },
  {
    title: "純音訊",
    description: "只錄聲音來源",
    subtext: "Mic & system audio",
    status: "稍後加入",
    active: false,
    icon: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4",
  },
];

export default function RecordingModeCards() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
          錄音模式
        </h2>
        <span className="text-xs text-zinc-700">目前使用會議錄音</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {recordingModes.map((mode) => (
          <button
            key={mode.title}
            type="button"
            disabled={!mode.active}
            className={`group min-h-[140px] rounded-xl border p-4 text-left transition ${
              mode.active
                ? "border-violet-400/40 bg-gradient-to-br from-violet-500/30 via-violet-500/15 to-fuchsia-500/10 shadow-lg shadow-violet-950/20"
                : "border-white/[0.06] bg-[#181a21] opacity-60 hover:border-white/[0.1] hover:bg-white/[0.02]"
            }`}
          >
            <div
              className={`mb-4 grid h-9 w-9 place-items-center rounded-lg ${
                mode.active ? "bg-white/15 text-white" : "bg-white/[0.03] text-zinc-600"
              }`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={mode.icon} />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-100">{mode.title}</h3>
            <p className="mt-1 text-xs text-zinc-500">{mode.description}</p>
            <p className="mt-1 text-[11px] text-zinc-700">{mode.subtext}</p>
            <p
              className={`mt-4 text-[11px] ${
                mode.active ? "text-violet-200" : "text-zinc-700"
              }`}
            >
              {mode.status}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}