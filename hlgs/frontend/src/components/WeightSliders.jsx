export default function WeightSliders({ weights = {}, onChange }) {
  return (
    <div className="space-y-3">
      {Object.entries(weights).map(([key, value]) => (
        <div key={key}>
          <label className="mb-1 flex justify-between text-xs text-textMuted">
            <span>{key}</span>
            <span>{value}</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={value}
            onChange={(e) => onChange?.(key, parseFloat(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
      ))}
    </div>
  )
}
