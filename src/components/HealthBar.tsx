"use client";

import type { HealthStatus } from "@/types";

type HealthBarProps = {
  health: HealthStatus;
};

export default function HealthBar({ health }: HealthBarProps) {
  const statusClass = health.status === "ok" ? "health-ok" : health.status === "loading" ? "health-loading" : "health-error";

  return (
    <div className={`health ${statusClass}`} role="status" aria-live="polite">
      <strong>API：</strong>
      {health.detail}
    </div>
  );
}
