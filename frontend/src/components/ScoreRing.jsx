import { useEffect, useRef } from 'react'

export default function ScoreRing({ score = 0, maxScore = 100, size = 160 }) {
  const strokeWidth = size * 0.075
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const ringRef = useRef(null)

  useEffect(() => {
    const ratio = Math.min(Math.max(score / maxScore, 0), 1)
    const targetOffset = circumference * (1 - ratio)

    const el = ringRef.current
    if (!el) return

    // Start from full circle (hidden), then animate to target
    el.style.transition = 'none'
    el.style.strokeDashoffset = String(circumference)
    void el.getBoundingClientRect() // force reflow
    el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
    el.style.strokeDashoffset = String(targetOffset)
  }, [score, maxScore, circumference])

  const gradientId = 'scoreRingGradient'
  const cx = size / 2
  const cy = size / 2
  const fontSize = Math.round(size * 0.2)
  const subFontSize = Math.round(size * 0.1)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        {/* Background ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#252538"
          strokeWidth={strokeWidth}
        />
        {/* Animated progress ring */}
        <circle
          ref={ringRef}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>
      {/* Center text (counter-rotated so it reads correctly) */}
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-bold text-white" style={{ fontSize }}>
          {typeof score === 'number' ? score.toFixed(1) : score}
        </span>
        <span className="text-textMuted" style={{ fontSize: subFontSize }}>
          /{maxScore}
        </span>
      </div>
    </div>
  )
}
