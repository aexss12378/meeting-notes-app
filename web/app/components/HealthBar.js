"use client";

export default function HealthBar({ health }) {
  return (
    <div className={`health health-${health.status}`} role="status" aria-live="polite">
      <strong>API：</strong>
      {health.detail}
    </div>
  );
}