export default function KeywordPanel({ matched = [], missing = [] }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-semibold text-white">Keywords</h3>
      <div className="flex flex-wrap gap-2">
        {matched.map((kw) => (
          <span key={kw} className="rounded bg-accent3/10 px-2 py-0.5 text-xs text-accent3">
            {kw}
          </span>
        ))}
        {missing.map((kw) => (
          <span key={kw} className="rounded bg-accent2/10 px-2 py-0.5 text-xs text-accent2">
            {kw}
          </span>
        ))}
      </div>
    </div>
  )
}
