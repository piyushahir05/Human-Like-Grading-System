export default function ScoreRing({ score = 0, max = 100 }) {
  const pct = Math.round((score / max) * 100)
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-accent">
        <span className="text-2xl font-semibold text-white">{pct}%</span>
      </div>
      <span className="mt-2 text-xs text-textMuted">
        {score} / {max}
      </span>
    </div>
  )
}
