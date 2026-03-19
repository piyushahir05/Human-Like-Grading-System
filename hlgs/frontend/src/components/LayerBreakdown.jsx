export default function LayerBreakdown({ layers = [] }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">Score Breakdown</h3>
      <ul className="space-y-2">
        {layers.map(({ name, score }) => (
          <li key={name} className="flex items-center justify-between text-sm">
            <span className="text-textMuted">{name}</span>
            <span className="font-medium text-white">{score}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
