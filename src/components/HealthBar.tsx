import type { HealthStatus } from "@/types";

type HealthBarProps = {
  health: HealthStatus;
};

export default function HealthBar({ health }: HealthBarProps) {
  const isError = health.status === "error";
  const isLoading = health.status === "loading";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
        isError
          ? "border-rose-400/20 bg-rose-500/5 text-rose-300"
          : isLoading
            ? "border-sky-400/20 bg-sky-500/5 text-sky-300"
            : "border-emerald-400/20 bg-emerald-500/5 text-emerald-300"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isError
            ? "bg-rose-400"
            : isLoading
              ? "bg-sky-400"
              : "bg-emerald-400"
        }`}
      />
      {health.detail}
    </div>
  );
}