export interface ElectronAPI {
  store: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    delete: (key: string) => Promise<void>
  }
  dialog: {
    selectFolder: () => Promise<string | null>
  }
  leetcode: {
    validateCookie: (cookie: string) => Promise<{ valid: boolean; cookie: string; username?: string; reason?: string }>
    getProblems: (cookie: string) => Promise<any[]>
    clearProblemsCache: () => Promise<void>
    getProblemDetail: (titleSlug: string, cookie: string) => Promise<any>
    getDailyProblem: (cookie: string) => Promise<any>
    getUserProfile: (cookie: string) => Promise<any>
    getSubmissions: (cookie: string, limit?: number, offset?: number) => Promise<any[]>
    getSubmissionDetail: (cookie: string, submissionId: number) => Promise<any>
    getSubmissionCalendar: (cookie: string) => Promise<Record<string, number>>
    submitCode: (questionSlug: string, questionId: string, code: string, lang: string, cookie: string, csrfToken: string) => Promise<any>
    onProblemsBatch: (callback: (data: { problems: any[], hasMore: boolean, total: number }) => void) => () => void
    onProblemsLoaded: (callback: (problems: any[]) => void) => () => void
    onProblemsProgress: (callback: (data: { phase: string; progress: number; count?: number }) => void) => () => void
  }
  editor: {
    open: (folderPath: string, editor: string) => Promise<boolean>
  }
  fs: {
    createProblemFiles: (
      rootPath: string,
      problemId: number,
      problemTitle: string,
      code: string,
      lang: string
    ) => Promise<string>
    readFile: (filePath: string) => Promise<string | null>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
