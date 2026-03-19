export default function KeywordPanel({ found = [], missing = [] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Found */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#10b981]">✅ Keywords Found</h3>
        {found.length === 0 ? (
          <span className="text-textMuted">—</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {found.map((kw) => (
              <span
                key={kw}
                className="rounded-full border border-[#10b981]/40 bg-[#10b981]/10 px-3 py-1 text-xs font-medium text-[#10b981]"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Missing */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#ef4444]">❌ Keywords Missing</h3>
        {missing.length === 0 ? (
          <span className="text-textMuted">—</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {missing.map((kw) => (
              <span
                key={kw}
                className="rounded-full border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-1 text-xs font-medium text-[#ef4444]"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
