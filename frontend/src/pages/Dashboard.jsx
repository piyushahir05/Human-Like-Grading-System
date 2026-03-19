import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { getStats, getResults, deleteResult } from '../api/client'
import BloomBadge from '../components/BloomBadge'

const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']

function pct(value) {
  return `${Math.round((value ?? 0) * 100)}%`
}

function scoreColor(ratio) {
  if (ratio >= 0.7) return 'text-emerald-400'
  if (ratio >= 0.4) return 'text-amber-400'
  return 'text-red-400'
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function mostCommonBloom(distribution = {}) {
  return Object.entries(distribution).reduce(
    (best, [level, count]) => (count > best.count ? { level, count } : best),
    { level: '—', count: -1 },
  ).level
}

const CHART_BUCKETS = ['0-3', '3-5', '5-7', '7-10']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white shadow-lg">
      <p className="font-medium">{label}</p>
      <p className="text-accent">{payload[0].value} answer{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [bloomFilter, setBloomFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([getStats(), getResults()])
      .then(([statsRes, resultsRes]) => {
        if (!cancelled) {
          setStats(statsRes.data)
          setResults(resultsRes.data)
        }
      })
      .catch((err) => {
        console.error('Dashboard fetch error:', err)
        if (!cancelled) setError('Failed to load dashboard data. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const nameOk = !search || r.student_name?.toLowerCase().includes(search.toLowerCase())
      const subjectOk =
        !subjectFilter || r.subject?.toLowerCase().includes(subjectFilter.toLowerCase())
      const bloomOk = !bloomFilter || r.bloom_level === bloomFilter
      return nameOk && subjectOk && bloomOk
    })
  }, [results, search, subjectFilter, bloomFilter])

  const uniqueSubjectsCount = useMemo(
    () => new Set(results.map((r) => r.subject).filter(Boolean)).size,
    [results],
  )

  const chartData = useMemo(
    () =>
      CHART_BUCKETS.map((bucket) => ({
        bucket,
        count: stats?.score_distribution?.[bucket] ?? 0,
      })),
    [stats],
  )

  async function handleDelete(id) {
    if (!window.confirm('Delete this result? This cannot be undone.')) return
    try {
      await deleteResult(id)
      setResults((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      console.error('Delete result error:', err)
      alert('Failed to delete result. Please try again.')
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-red-400">{error}</p>
      </main>
    )
  }

  const topBloom = mostCommonBloom(stats?.bloom_distribution)

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      {/* ── SECTION 1: Stats Bar ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Total Graded */}
        <div className="rounded-xl border border-border bg-surface px-5 py-4">
          <p className="text-xs text-textMuted">Total Graded</p>
          <p className="mt-1 text-2xl font-bold text-accent">{stats?.total_graded ?? 0}</p>
        </div>

        {/* Average Score */}
        <div className="rounded-xl border border-border bg-surface px-5 py-4">
          <p className="text-xs text-textMuted">Average Score</p>
          <p className="mt-1 text-2xl font-bold text-accent">
            {stats?.average_score != null ? `${stats.average_score}%` : '—'}
          </p>
        </div>

        {/* Most Common Bloom Level */}
        <div className="rounded-xl border border-border bg-surface px-5 py-4">
          <p className="text-xs text-textMuted">Top Bloom Level</p>
          <div className="mt-1.5">
            {topBloom !== '—' ? <BloomBadge level={topBloom} /> : <p className="text-textMuted">—</p>}
          </div>
        </div>

        {/* Subjects Graded */}
        <div className="rounded-xl border border-border bg-surface px-5 py-4">
          <p className="text-xs text-textMuted">Subjects Graded</p>
          <p className="mt-1 text-2xl font-bold text-accent">{uniqueSubjectsCount}</p>
        </div>
      </div>

      {/* ── SECTION 2: Header Row ── */}
      <div className="flex items-center justify-between">
        <h2 className="font-['DM_Serif_Display'] text-2xl text-white">Recent Results</h2>
        <button
          onClick={() => navigate('/grade')}
          className="rounded-lg bg-gradient-to-r from-[#7c6cff] to-[#a855f7] px-4 py-2 text-sm font-medium text-white shadow transition hover:opacity-90"
        >
          Grade New Answer
        </button>
      </div>

      {/* ── SECTION 3: Filter Bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Search by student name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder-textMuted outline-none focus:border-accent"
        />
        <input
          type="text"
          placeholder="Filter by subject…"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder-textMuted outline-none focus:border-accent"
        />
        <select
          value={bloomFilter}
          onChange={(e) => setBloomFilter(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-accent"
        >
          <option value="">All Bloom Levels</option>
          {BLOOM_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>
      </div>

      {/* ── SECTION 4: Results Table ── */}
      {filteredResults.length === 0 ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-border bg-surface">
          <p className="text-textMuted">No results yet. Grade your first answer!</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2 text-left text-xs text-textMuted">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Bloom Level</th>
                <th className="px-4 py-3">Keyword</th>
                <th className="px-4 py-3">Semantic</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border bg-surface transition-colors last:border-0 hover:bg-surface2"
                >
                  <td className="px-4 py-3 text-white">{r.student_name}</td>
                  <td className="px-4 py-3 text-textMuted">{r.subject}</td>
                  <td className="px-4 py-3 font-medium text-white">
                    {r.final_score != null
                      ? `${Number(r.final_score).toFixed(1)} / ${r.max_marks ?? 10}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <BloomBadge level={r.bloom_level} />
                  </td>
                  <td className={`px-4 py-3 font-medium ${scoreColor(r.layers?.keyword ?? 0)}`}>
                    {pct(r.layers?.keyword)}
                  </td>
                  <td className={`px-4 py-3 font-medium ${scoreColor(r.layers?.semantic ?? 0)}`}>
                    {pct(r.layers?.semantic)}
                  </td>
                  <td className="px-4 py-3 text-textMuted">{formatDate(r.graded_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/results/${r.id}`)}
                        className="rounded-md border border-accent px-2.5 py-1 text-xs text-accent transition hover:bg-accent hover:text-white"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="rounded-md border border-red-500/50 px-2.5 py-1 text-xs text-red-400 transition hover:bg-red-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SECTION 5: Score Distribution Chart ── */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="mb-4 text-sm font-medium text-textMuted">Score Distribution</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barCategoryGap="30%">
            <XAxis
              dataKey="bucket"
              tick={{ fill: '#7070a0', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: '#7070a0', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,108,255,0.08)' }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill="url(#purpleGrad)" />
              ))}
            </Bar>
            <defs>
              <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c6cff" stopOpacity={1} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.7} />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </main>
  )
}
