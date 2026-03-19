import { useEffect, useRef } from 'react'

const LAYER_CONFIG = {
  keyword:  { label: 'Keyword',  icon: '🔑', color: '#3b82f6', border: 'border-[#3b82f6]', bar: 'bg-[#3b82f6]' },
  semantic: { label: 'Semantic', icon: '🧠', color: '#8b5cf6', border: 'border-[#8b5cf6]', bar: 'bg-[#8b5cf6]' },
  bloom:    { label: 'Bloom',    icon: '🌸', color: '#f59e0b', border: 'border-[#f59e0b]', bar: 'bg-[#f59e0b]' },
  theme:    { label: 'Theme',    icon: '🎯', color: '#10b981', border: 'border-[#10b981]', bar: 'bg-[#10b981]' },
}

function AnimatedBar({ value, barClass }) {
  const barRef = useRef(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    el.style.width = '0%'
    void el.getBoundingClientRect()
    el.style.transition = 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
    el.style.width = `${Math.min(Math.max(value * 100, 0), 100)}%`
  }, [value])

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#252538]">
      <div ref={barRef} className={`h-full rounded-full ${barClass}`} style={{ width: '0%' }} />
    </div>
  )
}

export default function LayerBreakdown({ layers = {} }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Object.keys(LAYER_CONFIG).map((key) => {
        const { label, icon, border, bar } = LAYER_CONFIG[key]
        const score = layers[key] ?? 0
        return (
          <div
            key={key}
            className={`rounded-lg border border-[#252538] bg-[#12121a] p-4 border-b-2 ${border}`}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              <span className="text-sm font-medium text-white">{label}</span>
            </div>
            <AnimatedBar value={score} barClass={bar} />
            <span className="mt-2 block text-right text-sm font-semibold text-white">
              {Number(score).toFixed(3)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
