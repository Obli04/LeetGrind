import { create } from 'zustand'
import { Problem } from '../services/leetcode'

export type Theme = 'dark' | 'light'
export type Editor = 'code' | 'zed' | 'vim' | 'hx' | 'idea'
export type Language = 'python' | 'python3' | 'java' | 'cpp' | 'c' | 'javascript' | 'typescript' | 'go' | 'rust' | 'csharp' | 'ruby' | 'php' | 'scala' | 'swift' | 'kotlin' | 'dart' | 'racket' | 'elixir' | 'erlang' | 'mysql' | 'mssql' | 'oraclesql'

export interface Settings {
  theme: Theme
  defaultLanguage: string
  rootFolder: string
  editor: Editor
  cookie: string
  csrfToken: string
}

export interface SolvedProblem {
  titleSlug: string
  runtime: string
  memory: string
  runtimePercentile?: number
  memoryPercentile?: number
  solvedAt: number
}

export interface BookmarkedProblem {
  titleSlug: string
  bookmarkedAt: number
}

interface AppState {
  isAuthenticated: boolean
  settings: Settings
  currentProblem: number | null
  sidebarCollapsed: boolean
  problems: Problem[]
  solvedProblems: SolvedProblem[]
  bookmarkedProblems: BookmarkedProblem[]
  
  setAuthenticated: (value: boolean) => void
  setSettings: (settings: Partial<Settings>) => void
  setCurrentProblem: (id: number | null) => void
  setSidebarCollapsed: (value: boolean) => void
  setProblems: (problems: Problem[]) => void
  addProblemsBatch: (batch: Problem[]) => void
  addSolvedProblem: (problem: SolvedProblem) => void
  isProblemSolved: (titleSlug: string) => SolvedProblem | undefined
  toggleBookmark: (titleSlug: string) => void
  isProblemBookmarked: (titleSlug: string) => boolean
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
  loadSolvedProblems: () => Promise<void>
  loadBookmarkedProblems: () => Promise<void>
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
  solvedProblems: [],
  bookmarkedProblems: [],

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

  addSolvedProblem: async (problem) => {
    const current = get().solvedProblems
    const existing = current.find(p => p.titleSlug === problem.titleSlug)
    if (existing) {
      const updated = current.map(p => 
        p.titleSlug === problem.titleSlug ? problem : p
      )
      set({ solvedProblems: updated })
      await window.electronAPI.store.set('solvedProblems', updated)
    } else {
      const updated = [...current, problem]
      set({ solvedProblems: updated })
      await window.electronAPI.store.set('solvedProblems', updated)
    }
  },

  isProblemSolved: (titleSlug) => {
    return get().solvedProblems.find(p => p.titleSlug === titleSlug)
  },

  toggleBookmark: async (titleSlug) => {
    const current = get().bookmarkedProblems
    const existing = current.find(p => p.titleSlug === titleSlug)
    if (existing) {
      const updated = current.filter(p => p.titleSlug !== titleSlug)
      set({ bookmarkedProblems: updated })
      await window.electronAPI.store.set('bookmarkedProblems', updated)
    } else {
      const updated = [...current, { titleSlug, bookmarkedAt: Date.now() }]
      set({ bookmarkedProblems: updated })
      await window.electronAPI.store.set('bookmarkedProblems', updated)
    }
  },

  isProblemBookmarked: (titleSlug) => {
    return get().bookmarkedProblems.some(p => p.titleSlug === titleSlug)
  },

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

  loadSolvedProblems: async () => {
    try {
      const saved = await window.electronAPI.store.get('solvedProblems') as SolvedProblem[] | null
      if (saved) {
        set({ solvedProblems: saved })
      }
    } catch (error) {
      console.error('Failed to load solved problems:', error)
    }
  },

  loadBookmarkedProblems: async () => {
    try {
      const saved = await window.electronAPI.store.get('bookmarkedProblems') as BookmarkedProblem[] | null
      if (saved) {
        set({ bookmarkedProblems: saved })
      }
    } catch (error) {
      console.error('Failed to load bookmarked problems:', error)
    }
  },
}))
