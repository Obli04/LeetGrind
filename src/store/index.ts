import { create } from 'zustand'
import { Problem } from '../services/leetcode'

export type Theme = 'dark' | 'light'
export type Editor = 'code' | 'zed' | 'vim' | 'hx' | 'idea'
export type Language = 'python' | 'python3' | 'java' | 'cpp' | 'c' | 'javascript' | 'typescript' | 'go' | 'rust' | 'csharp' | 'ruby' | 'php' | 'scala' | 'swift' | 'kotlin' | 'dart' | 'racket' | 'elixir' | 'erlang'

export interface Settings {
  theme: Theme
  defaultLanguage: string
  rootFolder: string
  editor: Editor
  cookie: string
  csrfToken: string
}

interface AppState {
  isAuthenticated: boolean
  settings: Settings
  currentProblem: number | null
  sidebarCollapsed: boolean
  problems: Problem[]
  
  setAuthenticated: (value: boolean) => void
  setSettings: (settings: Partial<Settings>) => void
  setCurrentProblem: (id: number | null) => void
  setSidebarCollapsed: (value: boolean) => void
  setProblems: (problems: Problem[]) => void
  addProblemsBatch: (batch: Problem[]) => void
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
}

const defaultSettings: Settings = {
  theme: 'dark',
  defaultLanguage: 'python',
  rootFolder: '',
  editor: 'zed',
  cookie: '',
  csrfToken: '',
}

export const useStore = create<AppState>((set, get) => ({
  isAuthenticated: false,
  settings: defaultSettings,
  currentProblem: null,
  sidebarCollapsed: false,
  problems: [],

  setAuthenticated: (value) => set({ isAuthenticated: value }),
  
  setSettings: async (newSettings) => {
    const current = get().settings
    const updated = { ...current, ...newSettings }
    set({ settings: updated })
    await window.electronAPI.store.set('settings', updated)
  },
  
  setCurrentProblem: (id) => set({ currentProblem: id }),
  setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
  
  setProblems: (problems) => set({ problems }),
  
  addProblemsBatch: (batch) => set((state) => ({ 
    problems: [...state.problems, ...batch] 
  })),

  loadSettings: async () => {
    try {
      const saved = await window.electronAPI.store.get('settings') as Settings | null
      const cookie = await window.electronAPI.store.get('cookie') as string | null
      if (saved) {
        set({ settings: { ...defaultSettings, ...saved, cookie: cookie || '' } })
      }
      set({ isAuthenticated: !!cookie })
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  },

  saveSettings: async () => {
    const { settings } = get()
    await window.electronAPI.store.set('settings', settings)
  },
}))
