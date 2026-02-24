import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  },
  leetcode: {
    validateCookie: (cookie: string) => ipcRenderer.invoke('leetcode:validateCookie', cookie),
    getProblems: (cookie: string) => ipcRenderer.invoke('leetcode:getProblems', cookie),
    clearProblemsCache: () => ipcRenderer.invoke('leetcode:clearProblemsCache'),
    getProblemDetail: (titleSlug: string, cookie: string) => ipcRenderer.invoke('leetcode:getProblemDetail', titleSlug, cookie),
    getDailyProblem: (cookie: string) => ipcRenderer.invoke('leetcode:getDailyProblem', cookie),
    getUserProfile: (cookie: string) => ipcRenderer.invoke('leetcode:getUserProfile', cookie),
    getSubmissions: (cookie: string, limit?: number, offset?: number) => ipcRenderer.invoke('leetcode:getSubmissions', cookie, limit, offset),
    getSubmissionDetail: (cookie: string, submissionId: number) => ipcRenderer.invoke('leetcode:getSubmissionDetail', cookie, submissionId),
    onProblemsBatch: (callback: (data: { problems: any[], hasMore: boolean, total: number }) => void) => {
      const handler = (_event: any, data: any) => callback(data)
      ipcRenderer.on('leetcode:problemsBatch', handler)
      return () => ipcRenderer.removeListener('leetcode:problemsBatch', handler)
    },
    onProblemsLoaded: (callback: (problems: any[]) => void) => {
      const handler = (_event: any, problems: any[]) => callback(problems)
      ipcRenderer.on('leetcode:problemsLoaded', handler)
      return () => ipcRenderer.removeListener('leetcode:problemsLoaded', handler)
    },
  },
  editor: {
    open: (folderPath: string, editor: string) => ipcRenderer.invoke('editor:open', folderPath, editor),
  },
  fs: {
    createProblemFiles: (rootPath: string, problemId: number, problemTitle: string, code: string, lang: string) =>
      ipcRenderer.invoke('fs:createProblemFiles', rootPath, problemId, problemTitle, code, lang),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
})
