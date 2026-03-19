import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/grade', label: 'Grade' },
  { to: '/history', label: 'History' },
]

export default function Navbar() {
  return (
    <nav className="border-b border-border bg-surface px-6 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <span className="font-['DM_Serif_Display'] text-xl text-accent">HLGS</span>
        <ul className="flex gap-6">
          {links.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  isActive
                    ? 'text-sm font-medium text-accent'
                    : 'text-sm font-medium text-textMuted transition-colors hover:text-white'
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
