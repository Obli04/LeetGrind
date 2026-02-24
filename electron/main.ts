import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { exec } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { LeetCode, Credential } from 'leetcode-query'
import axios from 'axios'

const store = new Store()

let cachedCredential: Credential | null = null
let cachedCookie: string | null = null
let leetcode: LeetCode | null = null
let cachedProblems: any[] | null = null
let isFetchingProblems = false

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql'

async function fetchGraphQL(query: string, variables: any, cookie: string): Promise<any> {
  const csrfToken = cookie.match(/csrftoken=([^;]+)/)?.[1] || ''
  
  try {
    const response = await axios.post(
      LEETCODE_GRAPHQL,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookie,
          'X-Csrftoken': csrfToken,
          'Referer': 'https://leetcode.com',
        }
      }
    )
    if (response.data.errors) {
      console.log('GraphQL errors:', JSON.stringify(response.data.errors))
    }
    return response.data.data
  } catch (error: any) {
    console.log('GraphQL request error:', error?.response?.status, error?.message)
    console.log('Response data:', error?.response?.data)
    throw error
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0D0D0D',
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

async function getLeetCode(cookie: string): Promise<LeetCode> {
  if (leetcode && cachedCookie === cookie && cachedCredential) {
    return leetcode
  }
  
  const credential = new Credential()
  await credential.init(cookie)
  cachedCredential = credential
  cachedCookie = cookie
  leetcode = new LeetCode(credential)
  return leetcode
}

ipcMain.handle('store:get', (_event, key: string) => {
  return store.get(key)
})

ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
  store.set(key, value)
})

ipcMain.handle('store:delete', (_event, key: string) => {
  store.delete(key)
})

ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

function getUsernameFromCookie(cookie: string): { username: string; avatar: string } {
  try {
    let token = cookie
    
    const match = cookie.match(/LEETCODE_SESSION=([^;]+)/)
    if (match) {
      token = match[1]
    }
    
    const parts = token.split('.')
    if (parts.length < 2) return { username: 'User', avatar: '' }
    
    const payload = parts[1]
    const decoded = Buffer.from(payload, 'base64').toString()
    const data = JSON.parse(decoded)
    return {
      username: data.username || data.user_username || 'User',
      avatar: data.avatar || ''
    }
  } catch {
    return { username: 'User', avatar: '' }
  }
}

ipcMain.handle('leetcode:validateCookie', async (_event, cookie: string) => {
  try {
    const username = getUsernameFromCookie(cookie)
    console.log('Extracted username:', username)
    
    return { valid: true, cookie, username }
  } catch (error: any) {
    console.error('Cookie validation error:', error)
    return { valid: false, cookie, reason: error?.message || error?.toString() || 'Unknown error' }
  }
})

ipcMain.handle('leetcode:getProblems', async (_event, cookie: string) => {
  if (cachedProblems) {
    console.log('Returning cached problems:', cachedProblems.length)
    mainWindow?.webContents.send('leetcode:problemsLoaded', cachedProblems)
    return cachedProblems
  }
  
  if (isFetchingProblems) {
    console.log('Already fetching problems, waiting...')
    while (isFetchingProblems) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (cachedProblems) {
      mainWindow?.webContents.send('leetcode:problemsLoaded', cachedProblems)
      return cachedProblems
    }
  }
  
  isFetchingProblems = true
  
  try {
    console.log('Fetching all problems with custom GraphQL...')
    
    const allProblems: any[] = []
    let offset = 0
    const limit = 100
    
    const query = `
      query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int) {
        problemsetQuestionListV2(categorySlug: $categorySlug, limit: $limit, skip: $skip) {
          questions {
            titleSlug
            title
            difficulty
            topicTags { name slug }
            paidOnly
            status
            acRate
          }
          hasMore
        }
      }
    `
    
    while (true) {
      console.log(`Fetching with offset=${offset}...`)
      
      const data: any = await fetchGraphQL(query, { skip: offset, limit, categorySlug: null }, cookie)
      const questions = data?.problemsetQuestionListV2?.questions || []
      const hasMore = data?.problemsetQuestionListV2?.hasMore ?? true
      
      console.log(`Got ${questions.length} problems (hasMore: ${hasMore})`)
      
      if (questions.length === 0) break
      
      const batch = questions.map((p: any, index: number) => ({
        id: offset + index + 1,
        questionFrontendId: p.frontendQuestionId,
        title: p.title,
        titleSlug: p.titleSlug,
        difficulty: p.difficulty,
        topicTags: p.topicTags || [],
        isPaidOnly: p.isPaidOnly,
        status: p.status,
        solutionNum: 0,
        acceptanceRate: p.acRate || 0,
      }))
      
      allProblems.push(...batch)
      mainWindow?.webContents.send('leetcode:problemsBatch', { problems: batch, hasMore, total: offset + questions.length })
      offset += limit
      
      if (!hasMore) break
    }
    
    console.log(`Total problems: ${allProblems.length}`)
    
    cachedProblems = allProblems
    return cachedProblems
  } catch (error: any) {
    console.error('Failed to get problems:', error?.message)
    return []
  } finally {
    isFetchingProblems = false
  }
})

ipcMain.handle('leetcode:clearProblemsCache', async () => {
  cachedProblems = null
  console.log('Problems cache cleared')
})

ipcMain.handle('leetcode:getProblemDetail', async (_event, titleSlug: string, cookie: string) => {
  try {
    const lc = await getLeetCode(cookie)
    const problem = await lc.problem(titleSlug)
    return problem
  } catch (error: any) {
    console.error('Failed to get problem detail:', error?.message)
    return null
  }
})

ipcMain.handle('leetcode:getDailyProblem', async (_event, cookie: string) => {
  try {
    console.log('Fetching daily problem...')
    const lc = await getLeetCode(cookie)
    const daily = await lc.daily()
    console.log('Daily response:', JSON.stringify(daily).substring(0, 500))
    return {
      id: 0,
      questionFrontendId: daily.question?.questionFrontendId,
      title: daily.question?.title,
      titleSlug: daily.question?.titleSlug,
      difficulty: daily.question?.difficulty,
      topicTags: daily.question?.topicTags || [],
      isPaidOnly: daily.question?.isPaidOnly,
      status: daily.question?.status,
      solutionNum: daily.question?.solutionNum,
      acceptanceRate: 0,
    }
  } catch (error: any) {
    console.error('Failed to get daily problem:', error?.message)
    return null
  }
})

ipcMain.handle('leetcode:getUserProfile', async (_event, cookie: string) => {
  try {
    const { username: cookieUsername, avatar: cookieAvatar } = getUsernameFromCookie(cookie)
    
    const lc = await getLeetCode(cookie)
    
    const whoami = await lc.whoami()
    
    if (!whoami.isSignedIn) {
      return {
        username: cookieUsername,
        avatar: cookieAvatar,
        ranking: 0,
        reputation: 0,
        totalQuestions: 0,
        totalSubmissions: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
      }
    }
    
    const userProfile = await lc.user(whoami.username)
    const matchedUser = userProfile?.matchedUser
    const submitStats = matchedUser?.submitStats
    const acSubmissionNum = submitStats?.acSubmissionNum || []
    
    let easySolved = 0
    let mediumSolved = 0
    let hardSolved = 0
    let totalSubmissions = 0
    
    for (const stat of acSubmissionNum) {
      if (stat.difficulty === 'Easy') easySolved = stat.count
      if (stat.difficulty === 'Medium') mediumSolved = stat.count
      if (stat.difficulty === 'Hard') hardSolved = stat.count
    }
    
    const totalSubmissionNum = submitStats?.totalSubmissionNum || []
    for (const stat of totalSubmissionNum) {
      totalSubmissions += stat.count
    }
    
    return {
      username: whoami.username,
      avatar: whoami.avatar || cookieAvatar || matchedUser?.profile?.userAvatar || '',
      ranking: matchedUser?.profile?.ranking || 0,
      reputation: matchedUser?.profile?.reputation || 0,
      totalQuestions: userProfile?.allQuestionsCount?.[0]?.count || 0,
      totalSubmissions,
      easySolved,
      mediumSolved,
      hardSolved,
    }
  } catch (error: any) {
    console.error('Failed to get user profile:', error?.message, error?.response?.data)
    const { username, avatar } = getUsernameFromCookie(cookie)
    return {
      username,
      avatar,
      ranking: 0,
      reputation: 0,
      totalQuestions: 0,
      totalSubmissions: 0,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0,
    }
  }
})

ipcMain.handle('leetcode:getSubmissions', async (_event, cookie: string, limit = 20, offset = 0) => {
  try {
    const lc = await getLeetCode(cookie)
    const submissions = await lc.submissions({ limit, offset })
    return submissions
  } catch (error: any) {
    console.error('Failed to get submissions:', error?.message)
    return []
  }
})

ipcMain.handle('leetcode:getSubmissionDetail', async (_event, cookie: string, submissionId: number) => {
  try {
    const lc = await getLeetCode(cookie)
    const detail = await lc.submission(submissionId)
    return detail
  } catch (error: any) {
    console.error('Failed to get submission detail:', error?.message)
    return null
  }
})

ipcMain.handle('editor:open', async (_event, folderPath: string, editor: string) => {
  return new Promise((resolve, reject) => {
    const command = editor === 'code' 
      ? `code "${folderPath}"`
      : editor === 'zed'
      ? `zed "${folderPath}"`
      : editor === 'vim'
      ? `vim "${folderPath}"`
      : editor === 'hx'
      ? `hx "${folderPath}"`
      : `code "${folderPath}"`

    exec(command, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve(true)
      }
    })
  })
})

ipcMain.handle('fs:createProblemFiles', async (_event, rootPath: string, problemId: number, problemTitle: string, code: string, lang: string) => {
  const ext = lang === 'python' ? 'py' : lang === 'java' ? 'java' : lang === 'cpp' ? 'cpp' : lang === 'javascript' ? 'js' : lang === 'typescript' ? 'ts' : lang === 'go' ? 'go' : lang === 'rust' ? 'rs' : lang === 'csharp' ? 'cs' : lang === 'c' ? 'c' : lang === 'ruby' ? 'rb' : lang === 'php' ? 'php' : lang === 'scala' ? 'scala' : lang === 'swift' ? 'swift' : lang === 'kotlin' ? 'kt' : lang === 'dart' ? 'dart' : lang === 'racket' ? 'rkt' : lang === 'elixir' ? 'ex' : lang === 'erlang' ? 'erl' : lang === 'python3' ? 'py' : 'txt'
  const folderName = `${problemId}-${problemTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const fullPath = join(rootPath, folderName)

  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true })
  }

  writeFileSync(join(fullPath, `solution.${ext}`), code)
  writeFileSync(join(fullPath, 'notes.md'), `# ${problemTitle}\n\n## Notes\n\n`)

  return fullPath
})

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  await shell.openExternal(url)
})
