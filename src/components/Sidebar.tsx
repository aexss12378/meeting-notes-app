"use client";

import type { ActiveTab, NavItem } from "@/types";

type SidebarProps = {
  activeTab: ActiveTab;
  items: NavItem[];
  onTabChange: (tab: ActiveTab) => void;
};

export default function Sidebar({ activeTab, items, onTabChange }: SidebarProps) {
  return (
    <aside className="rounded-xl border border-white/[0.08] bg-[#14151b]/90 p-3 shadow-2xl shadow-black/20 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-48">
      <div className="mb-7 flex items-center gap-3 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500 text-sm font-bold text-white shadow-lg shadow-violet-950/40">
          M
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">會議記錄</p>
          <p className="text-xs text-zinc-500">本機工作區</p>
        </div>
      </div>

      <nav className="grid gap-1 text-sm text-zinc-400" aria-label="主要導覽">
        {items.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                active ? "bg-violet-500/20 text-zinc-100" : "hover:bg-white/[0.04] hover:text-zinc-100"
              }`}
              onClick={() => onTabChange(item.id)}
              type="button"
            >
              <span
                className={`h-2 w-2 rounded-full ${active ? "bg-violet-400" : "bg-zinc-700"}`}
                aria-hidden="true"
              />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
