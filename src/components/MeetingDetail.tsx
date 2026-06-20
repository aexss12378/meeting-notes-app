"use client";

import type { Meeting, MeetingResult, TodoPatch } from "@/types";

type MeetingDetailProps = {
  meeting: Meeting | null;
  result: MeetingResult | null;
  onPatchTodo: (todoId: string, patch: TodoPatch) => void;
};

export default function MeetingDetail({ meeting, result, onPatchTodo }: MeetingDetailProps) {
  if (!meeting) {
    return (
      <div>
        <h2>摘要與 TODO</h2>
        <p className="hint">請先建立會議並完成錄音。</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div>
        <h2>摘要與 TODO</h2>
        <p className="hint">讀取中...</p>
      </div>
    );
  }

  return (
    <>
      <article className="summary">
        <h3>Summary</h3>
        <p>{result.summary?.overview || "尚未產生摘要"}</p>

        <h4>Key Points</h4>
        <ul>
          {(result.summary?.key_points || []).map((item, index) => (
            <li key={`kp-${index}`}>{item}</li>
          ))}
          {(result.summary?.key_points || []).length === 0 && <li>目前沒有重點。</li>}
        </ul>
      </article>

      <article className="todos">
        <h3>TODO</h3>
        <ul>
          {(result.todos || []).map((todo) => (
            <li key={todo.id} className="todo-item">
              <label>
                <input
                  type="checkbox"
                  checked={!!todo.done}
                  onChange={(e) => onPatchTodo(todo.id, { done: e.target.checked })}
                  aria-label={`標記「${todo.text}」為${todo.done ? "未完成" : "已完成"}`}
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
              />
            </li>
          ))}
          {(result.todos || []).length === 0 && <li>目前沒有待辦。</li>}
        </ul>
      </article>
    </>
  );
}
