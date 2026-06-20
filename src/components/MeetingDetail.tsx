import type { Meeting, MeetingResult, TodoPatch } from "@/types";

type MeetingDetailProps = {
  meeting: Meeting | null;
  result: MeetingResult | null;
  onPatchTodo: (todoId: string, patch: TodoPatch) => void;
};

export default function MeetingDetail({
  meeting,
  result,
  onPatchTodo,
}: MeetingDetailProps) {
  if (!meeting) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[#181a21] p-8 text-center">
        <p className="text-sm text-zinc-600">請先建立會議並完成錄音。</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[#181a21] p-8 text-center">
        <p className="text-sm text-zinc-600">讀取中...</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <article className="rounded-xl border border-white/[0.06] bg-[#181a21] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-600">
          摘要
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-zinc-200">
          {result.summary?.overview || "尚未產生摘要"}
        </p>

        <h4 className="mt-5 text-sm font-semibold uppercase tracking-wider text-zinc-600">
          重點
        </h4>
        <ul className="mt-3 space-y-1.5">
          {(result.summary?.key_points || []).map((item, index) => (
            <li key={`kp-${index}`} className="flex gap-2 text-sm text-zinc-300">
              <span className="text-violet-400">•</span>
              {item}
            </li>
          ))}
          {(result.summary?.key_points || []).length === 0 && (
            <li className="text-sm text-zinc-600">目前沒有重點。</li>
          )}
        </ul>
      </article>

      <article className="rounded-xl border border-white/[0.06] bg-[#181a21] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-600">
          TODO
        </h3>
        <ul className="mt-3 space-y-2">
          {(result.todos || []).map((todo) => (
            <li
              key={todo.id}
              className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-[#0d0e12] px-3 py-2"
            >
              <label className="flex shrink-0 items-center">
                <input
                  type="checkbox"
                  checked={!!todo.done}
                  onChange={(e) => onPatchTodo(todo.id, { done: e.target.checked })}
                  aria-label={`標記「${todo.text}」為${todo.done ? "未完成" : "已完成"}`}
                  className="h-4 w-4 rounded border-white/[0.1] bg-transparent accent-violet-500"
                />
              </label>
              <input
                type="text"
                defaultValue={todo.text}
                onBlur={(e) => {
                  const nextText = e.target.value.trim();
                  if (nextText && nextText !== todo.text) {
                    onPatchTodo(todo.id, { text: nextText });
                  }
                }}
                aria-label={`編輯待辦事項：${todo.text}`}
                className="flex-1 border-none bg-transparent text-sm text-zinc-200 outline-none"
              />
            </li>
          ))}
          {(result.todos || []).length === 0 && (
            <li className="text-sm text-zinc-600">目前沒有待辦。</li>
          )}
        </ul>
      </article>
    </div>
  );
}