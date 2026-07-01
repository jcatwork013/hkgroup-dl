// Thẻ chỉ số cho dashboard affiliate. Số dùng .num (tabular-nums) để thẳng cột.
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "gold" | "forest";
}) {
  const valueColor =
    tone === "gold" ? "text-gold-600" : tone === "forest" ? "text-forest-700" : "text-ink";
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p>
      <p className={`num mt-2 text-2xl font-bold ${valueColor}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink/40">{hint}</p> : null}
    </div>
  );
}
