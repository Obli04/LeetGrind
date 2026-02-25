import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { 
  Home as HomeIcon, 
  List, 
  Send,
  Settings as SettingsIcon,
  Sun,
  Moon
} from 'lucide-react'
import { useStore } from '../store'

const sidebarItems = [
  { icon: HomeIcon, label: 'Home', path: '/' },
  { icon: List, label: 'Problems', path: '/problems' },
  { icon: Send, label: 'Submissions', path: '/submissions' },
  { icon: SettingsIcon, label: 'Settings', path: '/settings' },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { settings, setSettings } = useStore()

  const toggleTheme = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark'
    setSettings({ theme: newTheme })
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div 
        className="flex flex-col items-center py-4 border-r"
        style={{ 
          width: '64px', 
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border)'
        }}
      >
        <div className="mb-8">
          <img 
            src="/LeetGrind.png" 
            alt="LeetGUI" 
            className="w-10 h-10 rounded-lg"
          />
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          {sidebarItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path || 
              (path === '/problems' && location.pathname.startsWith('/problems/'))
            
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                title={label}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150 hover:scale-105"
                style={{
                  backgroundColor: isActive ? 'var(--accent-muted)' : 'transparent',
                  color: isActive ? 'var(--accent-hover)' : 'var(--text-secondary)'
                }}
              >
                <Icon size={20} />
              </button>
            )
          })}
        </nav>

        <button
          onClick={toggleTheme}
          title={settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150 hover:scale-105"
          style={{ color: 'var(--text-secondary)' }}
        >
          {settings.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <main className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Outlet />
      </main>
    </div>
  )
}
