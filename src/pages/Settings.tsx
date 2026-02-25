import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FolderOpen, 
  Code, 
  Palette, 
  KeyRound, 
  Save,
  LogOut,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { useStore, Theme, Editor } from '../store'
import { leetCodeApi } from '../services/leetcode'

const EDITORS: { value: Editor; label: string; icon: string }[] = [
  { value: 'zed', label: 'Zed', icon: '⚡' },
  { value: 'code', label: 'VS Code', icon: '💙' },
  { value: 'vim', label: 'Vim', icon: '🌀' },
  { value: 'hx', label: 'Helix', icon: '🦋' },
  { value: 'idea', label: 'IntelliJ IDEA', icon: '💚' },
]

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'python3', label: 'Python3' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'scala', label: 'Scala' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'dart', label: 'Dart' },
  { value: 'racket', label: 'Racket' },
  { value: 'elixir', label: 'Elixir' },
  { value: 'erlang', label: 'Erlang' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { settings, setSettings, setAuthenticated } = useStore()
  
  const [rootFolder, setRootFolder] = useState(settings.rootFolder)
  const [editor, setEditor] = useState<Editor>(settings.editor)
  const [defaultLang, setDefaultLang] = useState(settings.defaultLanguage)
  const [theme, setTheme] = useState<Theme>(settings.theme)
  const [cookie, setCookie] = useState(settings.cookie)
  const [csrfToken, setCsrfToken] = useState(settings.csrfToken)
  const [showCookie, setShowCookie] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSelectFolder = async () => {
    const folder = await window.electronAPI.dialog.selectFolder()
    if (folder) {
      setRootFolder(folder)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    
    try {
      if (cookie !== settings.cookie) {
        const isValid = await leetCodeApi.validateCookie(cookie)
        if (!isValid) {
          setMessage({ type: 'error', text: 'Invalid cookie. Please check and try again.' })
          setSaving(false)
          return
        }
        await window.electronAPI.store.set('cookie', cookie)
      }

      await setSettings({
        rootFolder,
        editor,
        defaultLanguage: defaultLang,
        theme,
        cookie,
        csrfToken
      })

      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings.' })
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await window.electronAPI.store.delete('cookie')
    setSettings({ cookie: '' })
    setAuthenticated(false)
    navigate('/login')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        Settings
      </h1>

      <div className="space-y-6">
        <SettingsSection 
          icon={Palette}
          title="Appearance"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Theme</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Choose between dark and light mode
              </p>
            </div>
            <div className="flex gap-2">
              {(['dark', 'light'] as Theme[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className="px-4 py-2 rounded-btn text-sm font-medium capitalize transition-all duration-150"
                  style={{ 
                    backgroundColor: theme === t ? 'var(--accent-primary)' : 'var(--surface)',
                    color: theme === t ? 'white' : 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection 
          icon={FolderOpen}
          title="Workspace"
        >
          <div>
            <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Root Folder</p>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              The folder where your LeetCode projects will be created
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={rootFolder}
                onChange={(e) => setRootFolder(e.target.value)}
                placeholder="Select a folder..."
                className="flex-1 px-3 py-2 rounded-btn text-sm outline-none"
                style={{ 
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)'
                }}
              />
              <button
                onClick={handleSelectFolder}
                className="px-4 py-2 rounded-btn text-sm transition-all duration-150"
                style={{ 
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)'
                }}
              >
                Browse
              </button>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection 
          icon={Code}
          title="Editor"
        >
          <div>
            <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Default Editor</p>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              The editor to open your projects in
            </p>
            <div className="grid grid-cols-2 gap-2">
              {EDITORS.map(e => (
                <button
                  key={e.value}
                  onClick={() => setEditor(e.value)}
                  className="flex items-center gap-2 px-4 py-3 rounded-btn text-sm font-medium transition-all duration-150"
                  style={{ 
                    backgroundColor: editor === e.value ? 'var(--accent-muted)' : 'var(--surface)',
                    color: editor === e.value ? 'var(--accent-hover)' : 'var(--text-primary)',
                    border: `1px solid ${editor === e.value ? 'var(--accent-primary)' : 'var(--border)'}`
                  }}
                >
                  <span>{e.icon}</span>
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Default Language</p>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              The default programming language for new problems
            </p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(l => (
                <button
                  key={l.value}
                  onClick={() => setDefaultLang(l.value)}
                  className="px-3 py-1.5 rounded-btn text-sm transition-all duration-150"
                  style={{ 
                    backgroundColor: defaultLang === l.value ? 'var(--accent-primary)' : 'var(--surface)',
                    color: defaultLang === l.value ? 'white' : 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection 
          icon={KeyRound}
          title="Authentication"
        >
          <div>
            <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>LeetCode Cookie</p>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              Update your LeetCode session cookie
            </p>
            <div className="relative">
              <input
                type={showCookie ? 'text' : 'password'}
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="Enter your LEETCODE_SESSION cookie"
                className="w-full px-3 py-2 pr-10 rounded-btn text-sm outline-none font-mono"
                style={{ 
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)'
                }}
              />
              <button
                type="button"
                onClick={() => setShowCookie(!showCookie)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                {showCookie ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>CSRF Token (Optional)</p>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              Required for submitting code. Get it from browser DevTools → Application → Cookies
            </p>
            <input
              type="text"
              value={csrfToken}
              onChange={(e) => setCsrfToken(e.target.value)}
              placeholder="Enter your CSRF token"
              className="w-full px-3 py-2 rounded-btn text-sm outline-none font-mono"
              style={{ 
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)'
              }}
            />
          </div>
        </SettingsSection>

        {message && (
          <div 
            className="flex items-center gap-2 p-3 rounded-btn"
            style={{ 
              backgroundColor: message.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
              color: message.type === 'success' ? 'var(--success)' : 'var(--error)'
            }}
          >
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-btn font-medium transition-all duration-150 hover:scale-[1.02] disabled:opacity-50"
            style={{ 
              backgroundColor: 'var(--accent-primary)',
              color: 'white'
            }}
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-btn font-medium transition-all duration-150 hover:scale-[1.02]"
            style={{ 
              backgroundColor: 'var(--surface)',
              color: 'var(--error)',
              border: '1px solid var(--border)'
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsSection({ 
  icon: Icon, 
  title, 
  children 
}: { 
  icon: React.ElementType, 
  title: string, 
  children: React.ReactNode 
}) {
  return (
    <div 
      className="p-6 rounded-card"
      style={{ 
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)'
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent-muted)' }}
        >
          <Icon size={20} style={{ color: 'var(--accent-hover)' }} />
        </div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}
