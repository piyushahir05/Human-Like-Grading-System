const DEFAULTS = { keyword: 20, semantic: 30, bloom: 30, theme: 20 }

const LABELS = {
  keyword:  'Keyword',
  semantic: 'Semantic',
  bloom:    'Bloom',
  theme:    'Theme',
}

export default function WeightSliders({ weights = DEFAULTS, onChange }) {
  const total = Object.values(weights).reduce((sum, v) => sum + Number(v), 0)
  const isValid = total === 100

  function handleChange(key, value) {
    onChange?.({ ...weights, [key]: Number(value) })
  }

  function handleReset() {
    onChange?.({ ...DEFAULTS })
  }

  return (
    <div className="space-y-4">
      {Object.keys(DEFAULTS).map((key) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-[120px] shrink-0 text-sm text-textMuted">{LABELS[key]}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={weights[key] ?? 0}
            onChange={(e) => handleChange(key, e.target.value)}
            className="flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[#252538] [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#7c6cff] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#7c6cff] [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[#252538]"
          />
          <span className="w-12 text-right text-sm font-medium text-white">
            {weights[key] ?? 0}%
          </span>
        </div>
      ))}

      {/* Total */}
      <div className="flex items-center justify-between border-t border-[#252538] pt-3">
        <span className="text-sm text-textMuted">Total</span>
        <span className={`text-sm font-semibold ${isValid ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
          {total}% &mdash; {isValid ? '✓ Valid' : 'Must equal 100%'}
        </span>
      </div>

      {/* Reset button */}
      <button
        onClick={handleReset}
        className="mt-1 rounded-md border border-[#252538] px-4 py-1.5 text-xs text-textMuted transition-colors hover:border-[#7c6cff] hover:text-white"
      >
        Reset to defaults
      </button>
    </div>
  )
}
