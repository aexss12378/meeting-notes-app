import type { ActiveTab } from "@/types";

type SidebarProps = {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
};

const navItems: { id: ActiveTab; label: string; icon: string }[] = [
  { id: "home", label: "首頁", icon: "M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" },
  { id: "recordings", label: "錄音紀錄", icon: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4" },
  { id: "tags", label: "標籤", icon: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" },
  { id: "summaryApi", label: "摘要 API", icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
  { id: "search", label: "搜尋", icon: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#0d0e12]">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500 text-sm font-bold text-white shadow-lg shadow-violet-950/40">
          M
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">會議記錄</p>
          <p className="text-[11px] text-zinc-600">本機工作區</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                active
                  ? "bg-violet-500/15 text-zinc-100"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
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
                className={active ? "text-violet-400" : "text-zinc-600"}
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] px-5 py-4">
        <p className="text-[11px] text-zinc-700">Meeting Notes v0.1.0</p>
      </div>
    </aside>
  );
}