import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import WeightSliders from '../components/WeightSliders'
import BloomBadge from '../components/BloomBadge'
import { gradeAnswer } from '../api/client'

// ── Bloom level heuristic ─────────────────────────────────────────────────────
const BLOOM_VERBS = {
  Remember:   ['define', 'list', 'recall', 'identify', 'name', 'recognise', 'recognize', 'state', 'describe', 'match', 'select', 'memorise', 'memorize'],
  Understand: ['explain', 'summarize', 'summarise', 'paraphrase', 'classify', 'compare', 'discuss', 'interpret', 'predict', 'outline', 'restate', 'translate'],
  Apply:      ['apply', 'use', 'demonstrate', 'solve', 'execute', 'implement', 'show', 'calculate', 'complete', 'construct', 'perform', 'produce'],
  Analyze:    ['analyze', 'analyse', 'differentiate', 'organize', 'organise', 'relate', 'contrast', 'examine', 'test', 'distinguish', 'break', 'infer', 'deduce'],
  Evaluate:   ['evaluate', 'judge', 'justify', 'critique', 'assess', 'recommend', 'prioritise', 'prioritize', 'defend', 'argue', 'support', 'appraise', 'weigh'],
  Create:     ['create', 'design', 'construct', 'produce', 'develop', 'plan', 'compose', 'generate', 'build', 'formulate', 'devise', 'invent'],
}

const BLOOM_ORDER = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']

function estimateBloom(text) {
  if (!text.trim()) return null
  const words = text.toLowerCase().match(/\b\w+\b/g) ?? []
  const counts = {}
  for (const level of BLOOM_ORDER) {
    counts[level] = words.filter((w) => BLOOM_VERBS[level].includes(w)).length
  }
  // highest level that has at least one verb hit wins; fallback to Remember
  for (let i = BLOOM_ORDER.length - 1; i >= 0; i--) {
    if (counts[BLOOM_ORDER[i]] > 0) return BLOOM_ORDER[i]
  }
  return 'Remember'
}

// ── Pipeline layers ────────────────────────────────────────────────────────────
const PIPELINE_LAYERS = [
  'Preprocessing',
  'Keyword Scoring',
  'Semantic Similarity',
  "Bloom's Level (Claude API)",
  'Theme & Depth',
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function GradeAnswer() {
  const navigate = useNavigate()

  // Form fields
  const [studentName, setStudentName] = useState('')
  const [subject, setSubject]         = useState('')
  const [maxMarks, setMaxMarks]       = useState(10)
  const [question, setQuestion]       = useState('')
  const [modelAnswer, setModelAnswer] = useState('')
  const [studentAnswer, setStudentAnswer] = useState('')

  // Weights (integers 0–100)
  const [weights, setWeights] = useState({ keyword: 20, semantic: 30, bloom: 30, theme: 20 })

  // Status
  const [isLoading, setIsLoading]     = useState(false)
  const [error, setError]             = useState('')
  const [currentLayer, setCurrentLayer] = useState(0)

  // Debounced Bloom estimate
  const [bloomEstimate, setBloomEstimate] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setBloomEstimate(estimateBloom(studentAnswer))
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [studentAnswer])

  // Pipeline animation
  useEffect(() => {
    if (!isLoading) {
      setCurrentLayer(0)
      return
    }
    setCurrentLayer(1)
    const interval = setInterval(() => {
      setCurrentLayer((prev) => {
        if (prev >= PIPELINE_LAYERS.length) {
          clearInterval(interval)
          return prev
        }
        return prev + 1
      })
    }, 1500)
    return () => clearInterval(interval)
  }, [isLoading])

  // Derived values
  const weightTotal   = Object.values(weights).reduce((s, v) => s + Number(v), 0)
  const anyFieldEmpty =
    !studentName.trim() || !subject.trim() || !question.trim() ||
    !modelAnswer.trim() || !studentAnswer.trim()
  const isDisabled = anyFieldEmpty || weightTotal !== 100 || isLoading

  const wordCount = studentAnswer.trim() ? studentAnswer.trim().split(/\s+/).length : 0
  const charCount = studentAnswer.length

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (isDisabled) return
    setError('')
    setIsLoading(true)
    try {
      const payload = {
        student_name:   studentName.trim(),
        subject:        subject.trim(),
        max_marks:      Number(maxMarks),
        question:       question.trim(),
        model_answer:   modelAnswer.trim(),
        student_answer: studentAnswer.trim(),
        weights: {
          keyword:  weights.keyword  / 100,
          semantic: weights.semantic / 100,
          bloom:    weights.bloom    / 100,
          theme:    weights.theme    / 100,
        },
      }
      const { data } = await gradeAnswer(payload)
      navigate(`/results/${data.id}`)
    } catch (err) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        'An error occurred while grading. Please try again.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Common input class ───────────────────────────────────────────────────────
  const inputCls =
    'w-full rounded-lg border border-[#252538] bg-[#12121a] px-3 py-2 text-sm text-white ' +
    'placeholder-[#7070a0] outline-none focus:border-[#7c6cff] transition-colors'

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-col gap-8 lg:flex-row">

        {/* ── LEFT COLUMN (60%) ─────────────────────────────────────────────── */}
        <div className="lg:w-[60%]">
          <h1 className="mb-6 font-['DM_Serif_Display'] text-3xl text-white">Grade an Answer</h1>

          {isLoading ? (
            /* ── Pipeline animation ─────────────────────────────────────────── */
            <div className="rounded-xl border border-[#252538] bg-[#12121a] p-8">
              <h2 className="mb-6 text-sm font-medium text-[#7070a0] uppercase tracking-widest">
                Processing
              </h2>
              <ol className="space-y-5">
                {PIPELINE_LAYERS.map((label, idx) => {
                  const layerNum = idx + 1
                  const isDone   = currentLayer > layerNum
                  const isActive = currentLayer === layerNum
                  return (
                    <li key={label} className="flex items-center gap-4">
                      {/* Dot indicator */}
                      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                        {isDone ? (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#10b981] text-white text-[9px] font-bold">
                            ✓
                          </span>
                        ) : isActive ? (
                          <>
                            <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-[#7c6cff] opacity-60" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#7c6cff]" />
                          </>
                        ) : (
                          <span className="h-3 w-3 rounded-full bg-[#252538]" />
                        )}
                      </span>

                      {/* Label */}
                      <span
                        className={`text-sm transition-colors ${
                          isDone
                            ? 'text-[#10b981]'
                            : isActive
                            ? 'font-medium text-white'
                            : 'text-[#7070a0]'
                        }`}
                      >
                        Layer {layerNum}: {label}
                      </span>
                    </li>
                  )
                })}
              </ol>

              <p className="mt-8 text-center text-sm italic text-[#7070a0]">
                Analysing answer…
              </p>
            </div>
          ) : (
            /* ── Input form ─────────────────────────────────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Row 1: Student Name + Subject */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs text-[#7070a0]">Student Name</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    className={inputCls}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs text-[#7070a0]">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Biology"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Row 2: Max Marks */}
              <div>
                <label className="mb-1.5 block text-xs text-[#7070a0]">Max Marks</label>
                <input
                  type="number"
                  min={1}
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(parseInt(e.target.value, 10) || 1)}
                  className={`${inputCls} w-32`}
                />
              </div>

              {/* Row 3: Question */}
              <div>
                <label className="mb-1.5 block text-xs text-[#7070a0]">Question</label>
                <textarea
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Enter the exam question..."
                  className={inputCls}
                />
              </div>

              {/* Row 4: Model Answer */}
              <div>
                <label className="mb-1.5 block text-xs text-[#7070a0]">Model Answer</label>
                <textarea
                  rows={5}
                  value={modelAnswer}
                  onChange={(e) => setModelAnswer(e.target.value)}
                  placeholder="Enter the teacher's ideal answer..."
                  className={inputCls}
                />
              </div>

              {/* Row 5: Student Answer */}
              <div>
                <label className="mb-1.5 block text-xs text-[#7070a0]">Student Answer</label>
                <textarea
                  rows={5}
                  value={studentAnswer}
                  onChange={(e) => setStudentAnswer(e.target.value)}
                  placeholder="Enter the student's answer..."
                  className={inputCls}
                />
              </div>

              {/* Weight Sliders */}
              <div className="rounded-xl border border-[#252538] bg-[#12121a] p-5">
                <h2 className="mb-4 text-sm font-medium text-[#7070a0]">Scoring Weights</h2>
                <WeightSliders weights={weights} onChange={setWeights} />
              </div>

              {/* Error message */}
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              {/* Grade button */}
              <button
                type="submit"
                disabled={isDisabled}
                style={isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white transition ${
                  isDisabled
                    ? 'bg-[#7c6cff]'
                    : 'bg-gradient-to-r from-[#7c6cff] to-[#a855f7] shadow hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(124,108,255,0.45)]'
                }`}
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Grading…
                  </>
                ) : (
                  'Grade Answer'
                )}
              </button>
            </form>
          )}
        </div>

        {/* ── RIGHT COLUMN (40%) ────────────────────────────────────────────── */}
        <div className="space-y-5 lg:w-[40%]">

          {/* Word / character count */}
          <div className="rounded-xl border border-[#252538] bg-[#12121a] p-5">
            <h2 className="mb-3 text-sm font-medium text-[#7070a0]">Live Preview</h2>
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-[#7070a0]">Words</p>
                <p className="mt-0.5 text-2xl font-bold text-[#7c6cff]">{wordCount}</p>
              </div>
              <div>
                <p className="text-xs text-[#7070a0]">Characters</p>
                <p className="mt-0.5 text-2xl font-bold text-[#7c6cff]">{charCount}</p>
              </div>
            </div>
          </div>

          {/* Estimated Bloom level */}
          <div className="rounded-xl border border-[#252538] bg-[#12121a] p-5">
            <h2 className="mb-3 text-sm font-medium text-[#7070a0]">Estimated Bloom Level</h2>
            {bloomEstimate ? (
              <BloomBadge level={bloomEstimate} />
            ) : (
              <p className="text-sm text-[#7070a0]">Start typing to estimate…</p>
            )}
            <p className="mt-2 text-xs text-[#7070a0]">
              Based on verbs detected in the student's answer.
            </p>
          </div>

          {/* Tips box */}
          <div className="rounded-xl border border-[#252538] bg-[#12121a] p-5">
            <h2 className="mb-3 text-sm font-medium text-white">Tips for better answers:</h2>
            <ul className="space-y-2">
              {[
                "Use words like 'because', 'therefore' to show reasoning",
                'Address multiple themes from the question',
                'Explain concepts in your own words, not just facts',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-sm text-[#7070a0]">
                  <span className="mt-0.5 text-[#7c6cff]">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
