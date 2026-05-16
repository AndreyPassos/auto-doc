import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface NavItem {
  to: string
  label: string
  roles: ('operator' | 'manager' | 'admin')[]
}

const navItems: NavItem[] = [
  { to: '/documents', label: 'Documentos', roles: ['operator', 'manager', 'admin'] },
  { to: '/reports', label: 'Relatórios', roles: ['manager', 'admin'] },
  { to: '/admin', label: 'Usuários', roles: ['admin'] },
]

export function Layout() {
  const { user, logout } = useAuth()

  const visibleLinks = navItems.filter(
    (item) => user && item.roles.includes(user.role),
  )

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-white shadow-md">
        {/* Logo / Brand */}
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-semibold text-gray-800">AutoDoc</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info + Logout */}
        <div className="border-t p-4">
          {user && (
            <div className="mb-3">
              <p className="truncate text-sm font-medium text-gray-800">{user.name}</p>
              <p className="text-xs capitalize text-gray-500">{user.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
