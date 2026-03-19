import { useState } from 'react'

export default function FeedbackPanel({ feedback = '', reasoning = '' }) {
  const [reasoningOpen, setReasoningOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(feedback).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      {/* Bloom's Reasoning — collapsible */}
      <div className="rounded-lg border border-[#252538] bg-[#12121a]">
        <button
          onClick={() => setReasoningOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-semibold text-white">🌸 Bloom's Reasoning</span>
          <span className="text-textMuted transition-transform duration-200" style={{ transform: reasoningOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▾
          </span>
        </button>
        {reasoningOpen && (
          <div className="border-t border-[#252538] px-4 py-3">
            <p className="text-sm text-textMuted leading-relaxed">
              {reasoning || '—'}
            </p>
          </div>
        )}
      </div>

      {/* Student Feedback — always visible */}
      <div className="rounded-lg border border-[#252538] bg-[#12121a]">
        <div className="px-4 py-3 border-b border-[#252538] flex items-center justify-between">
          <span className="text-sm font-semibold text-white">💬 Student Feedback</span>
          <button
            onClick={handleCopy}
            className="rounded-md border border-[#252538] px-3 py-1 text-xs text-textMuted transition-colors hover:border-[#7c6cff] hover:text-white"
          >
            {copied ? 'Copied!' : 'Copy Feedback'}
          </button>
        </div>
        <div className="border-l-4 border-[#7c6cff] bg-[#7c6cff]/5 mx-4 my-3 rounded-r-md px-4 py-3">
          <p className="text-sm text-[#e8e8f0] leading-relaxed">
            {feedback || '—'}
          </p>
        </div>
      </div>
    </div>
  )
}
