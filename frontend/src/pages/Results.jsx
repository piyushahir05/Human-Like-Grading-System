import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getResult, deleteResult } from '../api/client'
import ScoreRing from '../components/ScoreRing'
import BloomBadge from '../components/BloomBadge'
import LayerBreakdown from '../components/LayerBreakdown'
import KeywordPanel from '../components/KeywordPanel'
import FeedbackPanel from '../components/FeedbackPanel'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function pctColor(pct) {
  if (pct >= 75) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
  if (pct >= 50) return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
  return 'bg-red-500/20 text-red-400 border-red-500/40'
}

function SectionHeading({ children }) {
  return (
    <h2 className="font-['DM_Serif_Display'] text-xl text-white mb-4">{children}</h2>
  )
}

function Section({ children }) {
  return (
    <div className="rounded-xl border border-[#252538] bg-[#12121a] p-6">
      {children}
    </div>
  )
}

export default function Results() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [answerOpen, setAnswerOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)

    getResult(id)
      .then((res) => {
        if (!cancelled) setResult(res.data)
      })
      .catch((err) => {
        if (!cancelled) {
          if (err?.response?.status === 404) setNotFound(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  async function handleDelete() {
    if (!window.confirm('Delete this result? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteResult(id)
      navigate('/')
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete result. Please try again.')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#7c6cff] border-t-transparent" />
      </main>
    )
  }

  if (notFound || !result) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-lg text-[#7070a0]">Result not found.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-lg border border-[#252538] px-4 py-2 text-sm text-white transition hover:border-[#7c6cff]"
        >
          ← Back to Dashboard
        </button>
      </main>
    )
  }

  const pct = result.percentage ?? 0
  const showLangBadge = result.language_detected === 'hi' || result.language_detected === 'mr'
  const langLabel = result.language_detected === 'hi' ? 'Hindi' : 'Marathi'

  return (
    <main className="mx-auto max-w-[900px] space-y-6 px-4 py-8 pb-28 md:pb-8">

      {/* ── SECTION 1: Score Hero Card ── */}
      <div className="relative overflow-hidden rounded-xl border border-[#252538] bg-[#12121a] p-6">
        {/* Purple glow top-right */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #7c6cff 0%, transparent 70%)' }}
        />

        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* Left 40% — ScoreRing */}
          <div className="flex shrink-0 justify-center sm:w-2/5">
            <ScoreRing
              score={result.final_score}
              maxScore={result.max_marks}
              size={160}
            />
          </div>

          {/* Right 60% — metadata */}
          <div className="flex flex-col gap-2 sm:w-3/5">
            <h1 className="font-['DM_Serif_Display'] text-3xl text-white leading-tight">
              {result.student_name}
            </h1>
            <p className="text-sm text-[#7070a0]">{result.subject}</p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <BloomBadge level={result.bloom_level} />

              {/* Percentage badge */}
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${pctColor(pct)}`}
              >
                {Number(pct).toFixed(1)}%
              </span>

              {/* Language badge */}
              {showLangBadge && (
                <span className="rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-1 text-xs font-medium text-[#f59e0b]">
                  🌐 {langLabel}
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-[#7070a0]">
              Graded on {formatDate(result.graded_at)}
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Layer Breakdown ── */}
      <Section>
        <SectionHeading>Layer Scores</SectionHeading>
        <LayerBreakdown layers={result.layers} />
      </Section>

      {/* ── SECTION 3: Keywords ── */}
      <Section>
        <SectionHeading>Keyword Analysis</SectionHeading>
        <KeywordPanel
          found={result.keywords_found}
          missing={result.keywords_missing}
        />
        <div className="mt-4 text-xs text-[#7070a0]">
          Depth Score:{' '}
          <span className="font-semibold text-white">{Number(result.depth_score ?? 0).toFixed(3)}</span>
        </div>
      </Section>

      {/* ── SECTION 4: Theme Coverage ── */}
      <Section>
        <SectionHeading>Theme Analysis</SectionHeading>

        {result.themes_covered.length > 0 && (
          <div className="mb-3">
            <p className="mb-2 text-xs font-semibold text-[#10b981]">Covered Themes</p>
            <div className="flex flex-wrap gap-2">
              {result.themes_covered.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[#10b981]/40 bg-[#10b981]/10 px-3 py-1 text-xs font-medium text-[#10b981]"
                >
                  ✓ {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {result.themes_missing.length === 0 ? (
          <p className="text-sm text-[#10b981]">✅ All expected themes covered</p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold text-[#ef4444]">Missing Themes</p>
            <div className="flex flex-wrap gap-2">
              {result.themes_missing.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-1 text-xs font-medium text-[#ef4444]"
                >
                  ✗ {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── SECTION 5: Bloom's Analysis ── */}
      <Section>
        <SectionHeading>Bloom&apos;s Analysis</SectionHeading>
        <FeedbackPanel
          reasoning={result.bloom_reasoning}
          feedback={result.feedback}
        />
      </Section>

      {/* ── SECTION 6: Answer Comparison (collapsible) ── */}
      <div className="rounded-xl border border-[#252538] bg-[#12121a]">
        <button
          onClick={() => setAnswerOpen((o) => !o)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <span className="font-['DM_Serif_Display'] text-lg text-white">Answer Comparison</span>
          <span
            className="text-[#7070a0] transition-transform duration-200"
            style={{ transform: answerOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ▾
          </span>
        </button>

        {answerOpen && (
          <div className="space-y-4 border-t border-[#252538] px-6 py-4">
            {/* Question */}
            <div>
              <p className="mb-1 text-xs font-semibold text-[#7070a0]">Question</p>
              <p className="italic text-sm text-[#7070a0]">{result.question || '—'}</p>
            </div>

            {/* Model Answer */}
            <div>
              <p className="mb-1 text-xs font-semibold text-[#7070a0]">Model Answer</p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[#252538] bg-[#0a0a0f] px-4 py-3 text-sm text-[#e8e8f0]">
                {result.model_answer || '—'}
              </div>
            </div>

            {/* Student Answer */}
            <div>
              <p className="mb-1 text-xs font-semibold text-[#7070a0]">Student Answer</p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[#252538] bg-[#0a0a0f] px-4 py-3 text-sm text-[#e8e8f0]">
                {result.student_answer || '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 7: Action Buttons ── */}
      <div className="fixed bottom-0 left-0 right-0 flex gap-3 border-t border-[#252538] bg-[#0a0a0f] px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0">
        <button
          onClick={() => navigate('/grade')}
          className="flex-1 rounded-lg border border-[#252538] px-4 py-2 text-sm font-medium text-white transition hover:border-[#7c6cff] md:flex-none"
        >
          ← Grade Another Answer
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex-1 rounded-lg border border-[#252538] px-4 py-2 text-sm font-medium text-white transition hover:border-[#7c6cff] md:flex-none"
        >
          📋 View All Results
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50 md:flex-none"
        >
          {deleting ? 'Deleting…' : '🗑 Delete Result'}
        </button>
      </div>
    </main>
  )
}
