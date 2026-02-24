export interface Problem {
  id: number
  title: string
  titleSlug: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  acceptanceRate: number
  topicTags: TopicTag[]
  isPaidOnly: boolean
  status: string | null
  solutionNum: number
  questionFrontendId: string
}

export interface TopicTag {
  id: string
  name: string
  slug: string
  __typename: string
}

export interface Submission {
  id: number
  title: string
  titleSlug: string
  status: string
  statusDisplay: string
  lang: string
  langVerbose: string
  runtime: string
  memory: string
  timestamp: number
  url: string
}

export interface ProblemDetail {
  questionId: string
  title: string
  titleSlug: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  content: string
  sampleTestCase: string
  exampleTestcases: string
  constraints: string[]
  topicTags: TopicTag[]
  codeSnippets: CodeSnippet[]
  similarQuestions: SimilarQuestion[]
}

export interface CodeSnippet {
  lang: string
  langSlug: string
  code: string
}

export interface SimilarQuestion {
  title: string
  titleSlug: string
  difficulty: string
  url: string
}

export interface SubmissionDetail {
  id: number
  code: string
  runtime: number
  runtimeDisplay: string
  runtimePercentile: number
  memory: number
  memoryDisplay: string
  memoryPercentile: number
  totalCorrect: number
  totalTestcases: number
  statusCode: number
  lang: { name: string; verboseName: string }
}

export const leetCodeApi = {
  async validateCookie(cookie: string): Promise<{ valid: boolean; cookie: string; username?: string; reason?: string }> {
    return window.electronAPI.leetcode.validateCookie(cookie)
  },

  async getProblems(cookie: string): Promise<Problem[]> {
    return window.electronAPI.leetcode.getProblems(cookie)
  },

  async getProblemDetail(titleSlug: string, cookie: string): Promise<ProblemDetail> {
    return window.electronAPI.leetcode.getProblemDetail(titleSlug, cookie)
  },

  async getDailyProblem(cookie: string): Promise<Problem> {
    return window.electronAPI.leetcode.getDailyProblem(cookie)
  },

  async getRandomProblem(cookie: string): Promise<Problem> {
    const problems = await this.getProblems(cookie)
    if (!problems || problems.length === 0) {
      throw new Error('No problems available')
    }
    const randomIndex = Math.floor(Math.random() * problems.length)
    return problems[randomIndex]
  },

  async getSubmissions(cookie: string, limit = 20, offset = 0): Promise<Submission[]> {
    return window.electronAPI.leetcode.getSubmissions(cookie, limit, offset)
  },

  async getSubmissionDetail(cookie: string, submissionId: number): Promise<SubmissionDetail | null> {
    return window.electronAPI.leetcode.getSubmissionDetail(cookie, submissionId)
  },

  async getUserProfile(cookie: string) {
    return window.electronAPI.leetcode.getUserProfile(cookie)
  },
}
