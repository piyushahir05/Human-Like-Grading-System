import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/grade', label: 'Grade Answer' },
  { to: '/history', label: 'History' },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  const linkClass = ({ isActive }) =>
    isActive
      ? 'text-sm font-medium text-white border-b-2 border-[#7c6cff] pb-0.5'
      : 'text-sm font-medium text-textMuted transition-colors hover:text-white'

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-50 border-b border-[#252538] bg-[#12121a]"
      style={{ height: '64px' }}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <div className="flex flex-col leading-tight">
          <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-xl font-bold text-transparent">
            HLGS
          </span>
          <span className="font-mono text-[10px] text-textMuted">AI Grading Engine</span>
        </div>

        {/* Desktop links */}
        <ul className="hidden gap-8 md:flex">
          {links.map(({ to, label }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className={linkClass}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Hamburger button */}
        <button
          className="flex flex-col gap-1.5 md:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <span
            className={`block h-0.5 w-6 bg-white transition-transform duration-200 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`}
          />
          <span
            className={`block h-0.5 w-6 bg-white transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`}
          />
          <span
            className={`block h-0.5 w-6 bg-white transition-transform duration-200 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-[#252538] bg-[#12121a] px-6 py-4 md:hidden">
          <ul className="flex flex-col gap-4">
            {links.map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={linkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  )
}
