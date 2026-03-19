const COLOR_MAP = {
  Remember:   { bg: 'bg-[#6b7280]', text: 'text-white',         dot: 'bg-white/70' },
  Understand: { bg: 'bg-[#3b82f6]', text: 'text-white',         dot: 'bg-white/70' },
  Apply:      { bg: 'bg-[#8b5cf6]', text: 'text-white',         dot: 'bg-white/70' },
  Analyze:    { bg: 'bg-[#f59e0b]', text: 'text-white',         dot: 'bg-white/70' },
  Evaluate:   { bg: 'bg-[#ef4444]', text: 'text-white',         dot: 'bg-white/70' },
  Create:     { bg: 'bg-[#10b981]', text: 'text-white',         dot: 'bg-white/70' },
}

const FALLBACK = { bg: 'bg-surface2', text: 'text-textMuted', dot: 'bg-textMuted/50' }

export default function BloomBadge({ level }) {
  const colors = COLOR_MAP[level] ?? FALLBACK
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {level}
    </span>
  )
}
