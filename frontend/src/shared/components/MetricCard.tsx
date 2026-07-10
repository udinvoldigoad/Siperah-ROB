import type { Metric } from "../types/domain";

export function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className={`metric-card ${metric.tone ?? "neutral"}`}>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      {metric.note && <small>{metric.note}</small>}
    </article>
  );
}
