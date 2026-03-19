import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getResults, deleteResult } from '../api/client'
import BloomBadge from '../components/BloomBadge'

const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']
const PAGE_SIZE = 10
const DEFAULT_MAX_MARKS = 10

const COLUMNS = [
  { key: 'id',        label: '#',        numeric: true  },
  { key: 'student',   label: 'Student',  numeric: false },
  { key: 'subject',   label: 'Subject',  numeric: false },
  { key: 'score',     label: 'Score',    numeric: true  },
  { key: 'pct',       label: '%',        numeric: true  },
  { key: 'bloom',     label: 'Bloom',    numeric: false },
  { key: 'keyword',   label: 'Keyword',  numeric: true  },
  { key: 'semantic',  label: 'Semantic', numeric: true  },
  { key: 'bloomScore',label: 'Bloom %',  numeric: true  },
  { key: 'theme',     label: 'Theme',    numeric: true  },
  { key: 'date',      label: 'Date',     numeric: false },
]

function pctColor(pct) {
  if (pct >= 75) return 'text-emerald-400'
  if (pct >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mm = months[d.getMonth()]
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd} ${mm} ${yyyy} ${hh}:${min}`
}

function getColValue(r, key) {
  const pct = r.max_marks ? (r.final_score / r.max_marks) * 100 : 0
  switch (key) {
    case 'id':         return r.id ?? 0
    case 'student':    return r.student_name ?? ''
    case 'subject':    return r.subject ?? ''
    case 'score':      return r.final_score ?? 0
    case 'pct':        return pct
    case 'bloom':      return r.bloom_level ?? ''
    case 'keyword':    return r.layers?.keyword ?? 0
    case 'semantic':   return r.layers?.semantic ?? 0
    case 'bloomScore': return r.layers?.bloom ?? 0
    case 'theme':      return r.layers?.theme ?? 0
    case 'date':       return r.graded_at ? new Date(r.graded_at).getTime() : 0
    default:           return ''
  }
}

function exportCSV(results) {
  const headers = [
    'ID', 'Student', 'Subject', 'Score', 'Max Marks', 'Percentage',
    'Bloom Level', 'Keyword Score', 'Semantic Score', 'Bloom Score', 'Theme Score', 'Date',
  ]
  const rows = results.map((r) => {
    const pct = r.max_marks ? ((r.final_score / r.max_marks) * 100).toFixed(1) : '0'
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
    return [
      r.id,
      esc(r.student_name),
      esc(r.subject),
      r.final_score ?? 0,
      r.max_marks ?? 0,
      pct,
      r.bloom_level ?? '',
      r.layers?.keyword != null ? Math.round(r.layers.keyword * 100) : 0,
      r.layers?.semantic != null ? Math.round(r.layers.semantic * 100) : 0,
      r.layers?.bloom != null ? Math.round(r.layers.bloom * 100) : 0,
      r.layers?.theme != null ? Math.round(r.layers.theme * 100) : 0,
      r.graded_at ?? '',
    ].join(',')
  })
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'hlgs_results.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
  if (currentPage <= 3) return [1, 2, 3, 4, '...', totalPages]
  if (currentPage >= totalPages - 2) return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

function SortIcon({ colKey, sortColumn, sortDirection }) {
  if (sortColumn !== colKey)
    return <span className="ml-1 opacity-30">↕</span>
  return <span className="ml-1 text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
}

export default function History() {
  const navigate = useNavigate()

  const [results, setResults]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [bloomFilter, setBloomFilter]   = useState('')
  const [minScore, setMinScore]         = useState('')
  const [sortColumn, setSortColumn]     = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [currentPage, setCurrentPage]   = useState(1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getResults()
      .then((res) => { if (!cancelled) setResults(res.data) })
      .catch((err) => {
        console.error('History fetch error:', err)
        if (!cancelled) setError('Failed to load grading history. Please try again.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function handleSort(colKey) {
    if (sortColumn === colKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(colKey)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

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

  const filteredResults = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return results.filter((r) => {
      const searchOk =
        !q ||
        r.student_name?.toLowerCase().includes(q) ||
        r.subject?.toLowerCase().includes(q)
      const bloomOk = !bloomFilter || r.bloom_level === bloomFilter
      const pct = r.max_marks ? (r.final_score / r.max_marks) * 100 : 0
      const minOk = !minScore || pct >= Number(minScore)
      return searchOk && bloomOk && minOk
    })
  }, [results, searchQuery, bloomFilter, minScore])

  const sortedResults = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortColumn)
    return [...filteredResults].sort((a, b) => {
      const aVal = getColValue(a, sortColumn)
      const bVal = getColValue(b, sortColumn)
      let cmp
      if (sortColumn === 'date' || col?.numeric) {
        cmp = (aVal ?? 0) - (bVal ?? 0)
      } else {
        cmp = String(aVal).localeCompare(String(bVal))
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [filteredResults, sortColumn, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedResults.length / PAGE_SIZE))
  const safePage   = Math.min(currentPage, totalPages)
  const pageStart  = (safePage - 1) * PAGE_SIZE
  const pageEnd    = Math.min(pageStart + PAGE_SIZE, sortedResults.length)
  const pageResults = sortedResults.slice(pageStart, pageEnd)

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

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      {/* ── SECTION 1: Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-['DM_Serif_Display'] text-3xl text-white">Grading History</h1>
          <span className="rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
            {results.length}
          </span>
        </div>
        <button
          onClick={() => exportCSV(results)}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-white transition hover:border-accent hover:text-accent"
        >
          Export CSV
        </button>
      </div>

      {/* ── SECTION 2: Search & Filters ── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Search by student or subject…"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder-textMuted outline-none focus:border-accent"
        />
        <select
          value={bloomFilter}
          onChange={(e) => { setBloomFilter(e.target.value); setCurrentPage(1) }}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-accent"
        >
          <option value="">All Bloom Levels</option>
          {BLOOM_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>{lvl}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Min % score"
          value={minScore}
          min={0}
          max={100}
          onChange={(e) => { setMinScore(e.target.value); setCurrentPage(1) }}
          className="w-36 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder-textMuted outline-none focus:border-accent"
        />
      </div>

      {/* ── SECTION 3: Sortable Table ── */}
      {sortedResults.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface">
          <p className="text-textMuted">No grading history yet.</p>
          <Link to="/grade" className="text-sm text-accent hover:underline">
            Grade your first answer →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2 text-left text-xs text-textMuted">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="cursor-pointer select-none whitespace-nowrap px-4 py-3 hover:text-white"
                  >
                    {col.label}
                    <SortIcon colKey={col.key} sortColumn={sortColumn} sortDirection={sortDirection} />
                  </th>
                ))}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageResults.map((r) => {
                const pct = r.max_marks ? (r.final_score / r.max_marks) * 100 : 0
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border bg-surface transition-colors last:border-0 hover:bg-surface2"
                  >
                    <td className="px-4 py-3 text-textMuted">{r.id}</td>
                    <td className="px-4 py-3 text-white">{r.student_name}</td>
                    <td className="px-4 py-3 text-textMuted">{r.subject}</td>
                    <td className="px-4 py-3 font-medium text-white">
                      {r.final_score != null
                        ? `${Number(r.final_score).toFixed(1)} / ${r.max_marks ?? DEFAULT_MAX_MARKS}`
                        : '—'}
                    </td>
                    <td className={`px-4 py-3 font-medium ${pctColor(pct)}`}>
                      {r.max_marks ? `${Math.round(pct)}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <BloomBadge level={r.bloom_level} />
                    </td>
                    <td className="px-4 py-3 text-textMuted">
                      {r.layers?.keyword != null ? `${Math.round(r.layers.keyword * 100)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-textMuted">
                      {r.layers?.semantic != null ? `${Math.round(r.layers.semantic * 100)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-textMuted">
                      {r.layers?.bloom != null ? `${Math.round(r.layers.bloom * 100)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-textMuted">
                      {r.layers?.theme != null ? `${Math.round(r.layers.theme * 100)}%` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-textMuted">{formatDate(r.graded_at)}</td>
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SECTION 4: Pagination ── */}
      {sortedResults.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-textMuted">
            Showing {pageStart + 1}–{pageEnd} of {sortedResults.length} results
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={safePage === 1}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-white transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            {getPageNumbers(safePage, totalPages).map((page, i) =>
              page === '...' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-textMuted">…</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    safePage === page
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-border bg-surface text-white hover:border-accent'
                  }`}
                >
                  {page}
                </button>
              ),
            )}
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={safePage === totalPages}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-white transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
