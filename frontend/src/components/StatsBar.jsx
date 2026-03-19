export default function StatsBar({ stats = {} }) {
  return (
    <div className="flex gap-6">
      {Object.entries(stats).map(([label, value]) => (
        <div key={label} className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-xs text-textMuted">{label}</p>
          <p className="mt-1 text-lg font-semibold text-white">{value}</p>
        </div>
      ))}
    </div>
  )
}
