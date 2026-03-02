import { app, BrowserWindow, ipcMain, shell, dialog, net } from "electron";
import { join } from "path";
import Store from "electron-store";
import { exec } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { LeetCode, Credential } from "leetcode-query";
import axios from "axios";

const store = new Store();

let cachedCredential: Credential | null = null;
let cachedCookie: string | null = null;
let cachedCookieForCache: string | null = null;
let leetcode: LeetCode | null = null;
let cachedProblems: any[] | null = null;
let cachedProblemCount: number = 0;
let isFetchingProblems = false;
const PROBLEMS_PAGE_SIZE = 100;
const MIN_COMPLETE_CACHE_SIZE = 3500;

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

function extractProblemsArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.stat_status_pairs)) return payload.stat_status_pairs;
  if (Array.isArray(payload?.problemsetQuestionList?.questions)) {
    return payload.problemsetQuestionList.questions;
  }
  if (Array.isArray(payload?.questions)) return payload.questions;
  return [];
}

function normalizeProblem(p: any) {
  const difficultyLevel =
    p.difficulty && typeof p.difficulty === "object" ? p.difficulty.level : null;
  const normalizedDifficulty =
    typeof p.difficulty === "string"
      ? p.difficulty
      : difficultyLevel === 1
        ? "Easy"
        : difficultyLevel === 2
          ? "Medium"
          : difficultyLevel === 3
            ? "Hard"
            : "Medium";

  return {
    id:
      p.stat?.frontend_question_id ||
      p.id ||
      p.questionFrontendId ||
      p.frontendQuestionId ||
      0,
    questionFrontendId: String(
      p.stat?.frontend_question_id ||
        p.id ||
        p.questionFrontendId ||
        p.frontendQuestionId ||
        "",
    ),
    title: p.stat?.question__title || p.title || "",
    titleSlug: p.stat?.question__title_slug || p.titleSlug || "",
    difficulty: normalizedDifficulty,
    topicTags: p.topicTags || [],
    isPaidOnly: p.paid_only ?? p.isPaidOnly ?? p.paidOnly ?? false,
    status: p.status || null,
    solutionNum: p.solutionNum || (p.hasSolution ? 1 : 0),
    acceptanceRate:
      typeof p.acRate === "number"
        ? p.acRate
        : p.stat?.total_acs && p.stat?.total_submissions
          ? p.stat.total_acs / p.stat.total_submissions
          : 0,
  };
}

async function fetchAllProblems(
  lc: LeetCode,
  options?: {
    onCount?: (total: number) => void;
    onBatch?: (batch: any[], hasMore: boolean, total: number) => void;
    onProgress?: (progress: number, count: number) => void;
  },
): Promise<any[]> {
  const allProblems: any[] = [];
  let offset = 0;
  let total = 0;
  while (true) {
    let page: any = null;
    let problems: any[] = [];
    let attempts = 0;

    while (attempts < 3) {
      attempts += 1;
      page = await lc.problems({
        offset,
        limit: PROBLEMS_PAGE_SIZE,
      });
      problems = extractProblemsArray(page);

      if (problems.length > 0) {
        break;
      }

      const hasExpectedMore = total > 0 && offset < total;
      if (!hasExpectedMore) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (total === 0) {
      total = Number(page?.total || page?.totalNum || problems.length || 0);
      options?.onCount?.(total);
    }

    if (!problems.length) {
      break;
    }

    const normalizedBatch = problems.map((problem: any) =>
      normalizeProblem(problem),
    );
    allProblems.push(...normalizedBatch);

    offset += problems.length;
    const hasMore =
      typeof page?.hasMore === "boolean"
        ? page.hasMore
        : problems.length === PROBLEMS_PAGE_SIZE;

    options?.onBatch?.(normalizedBatch, hasMore, total);

    const progress =
      total > 0 ? Math.min(99, Math.round((allProblems.length / total) * 100)) : 0;
    options?.onProgress?.(progress, allProblems.length);

    if (!hasMore) {
      break;
    }
  }

  const deduped = new Map<string, any>();
  for (const problem of allProblems) {
    const key =
      problem.titleSlug || String(problem.questionFrontendId || problem.id || "");
    deduped.set(key, problem);
  }

  return Array.from(deduped.values());
}

async function fetchGraphQL(
  query: string,
  variables: any,
  cookie: string,
): Promise<any> {
  const csrfToken = cookie.match(/csrftoken=([^;]+)/)?.[1] || "";

  try {
    const response = await axios.post(
      LEETCODE_GRAPHQL,
      { query, variables },
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "X-Csrftoken": csrfToken,
          Referer: "https://leetcode.com",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 30000,
      },
    );
    return response.data.data;
  } catch (error: any) {
    console.error("GraphQL request failed:", error?.message);
    throw error;
  }
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, "LeetGrind.png")
    : join(__dirname, "../public/LeetGrind.png");

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: "#0D0D0D",
    icon: iconPath,
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (
    process.env.NODE_ENV === "development" ||
    process.env.VITE_DEV_SERVER_URL
  ) {
    mainWindow.loadURL(
      process.env.VITE_DEV_SERVER_URL || "http://localhost:5173",
    );
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  const savedProblems = store.get("problems") as any[] | null;
  const savedCount = store.get("problemCount") as number | null;

  if (savedProblems && savedProblems.length > 0) {
    cachedProblems = savedProblems;
    cachedProblemCount = savedCount || savedProblems.length;
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

async function getLeetCode(cookie: string): Promise<LeetCode> {
  if (leetcode && cachedCookie === cookie && cachedCredential) {
    return leetcode;
  }

  const credential = new Credential();
  await credential.init(cookie);
  cachedCredential = credential;
  cachedCookie = cookie;
  leetcode = new LeetCode(credential);
  return leetcode;
}

ipcMain.handle("store:get", (_event, key: string) => {
  return store.get(key);
});

ipcMain.handle("store:set", (_event, key: string, value: unknown) => {
  store.set(key, value);
});

ipcMain.handle("store:delete", (_event, key: string) => {
  store.delete(key);
});

ipcMain.handle("dialog:selectFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

function getUsernameFromCookie(cookie: string): {
  username: string;
  avatar: string;
} {
  try {
    let token = cookie;

    const match = cookie.match(/LEETCODE_SESSION=([^;]+)/);
    if (match) {
      token = match[1];
    }

    const parts = token.split(".");
    if (parts.length < 2) return { username: "User", avatar: "" };

    const payload = parts[1];
    const decoded = Buffer.from(payload, "base64").toString();
    const data = JSON.parse(decoded);
    return {
      username: data.username || data.user_username || "User",
      avatar: data.avatar || "",
    };
  } catch {
    return { username: "User", avatar: "" };
  }
}

ipcMain.handle("leetcode:validateCookie", async (_event, cookie: string) => {
  try {
    const username = getUsernameFromCookie(cookie);

    return { valid: true, cookie, username };
  } catch (error: any) {
    console.error("Cookie validation error:", error);
    return {
      valid: false,
      cookie,
      reason: error?.message || error?.toString() || "Unknown error",
    };
  }
});

ipcMain.handle("leetcode:getProblems", async (_event, cookie: string) => {
  const hasValidCookie = cookie && cookie.length > 20;
  const hasExistingCache = cachedProblems && cachedProblems.length > 0;
  const hasLikelyCompleteCache =
    !!cachedProblems && cachedProblems.length >= MIN_COMPLETE_CACHE_SIZE;

  if (cachedProblems && hasExistingCache && hasLikelyCompleteCache) {
    if (hasValidCookie && cachedCookieForCache !== cookie) {
      refreshProblemsInBackground(cookie);
    } else if (hasValidCookie) {
      refreshProblemsInBackground(cookie);
    }

    mainWindow?.webContents.send("leetcode:problemsLoaded", cachedProblems);
    return cachedProblems;
  }

  if (cachedProblems && hasExistingCache && !hasLikelyCompleteCache) {
    cachedProblems = null;
    cachedProblemCount = 0;
    store.delete("problems");
    store.delete("problemCount");
  }

  if (isFetchingProblems) {
    while (isFetchingProblems) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (cachedProblems) {
      mainWindow?.webContents.send("leetcode:problemsLoaded", cachedProblems);
      return cachedProblems;
    }
  }

  cachedCookieForCache = cookie;
  isFetchingProblems = true;

  try {
    mainWindow?.webContents.send("leetcode:problemsProgress", {
      phase: "counting",
      progress: 0,
    });

    const lc = await getLeetCode(cookie);
    const allProblems = await fetchAllProblems(lc, {
      onCount: (_total) => {
        mainWindow?.webContents.send("leetcode:problemsProgress", {
          phase: "fetching",
          progress: 0,
          count: 0,
        });
      },
      onBatch: (batch, hasMore, total) => {
        mainWindow?.webContents.send("leetcode:problemsBatch", {
          problems: batch,
          hasMore,
          total,
        });
      },
      onProgress: (progress, count) => {
        mainWindow?.webContents.send("leetcode:problemsProgress", {
          phase: "fetching",
          progress,
          count,
        });
      },
    });

    cachedProblems = allProblems;
    cachedProblemCount = allProblems.length;
    store.set("problems", allProblems);
    store.set("problemCount", allProblems.length);

    mainWindow?.webContents.send("leetcode:problemsProgress", {
      phase: "complete",
      progress: 100,
      count: allProblems.length,
    });
    mainWindow?.webContents.send("leetcode:problemsLoaded", cachedProblems);
    return cachedProblems;
  } catch (error: any) {
    console.error("Failed to get problems:", error?.message);
    mainWindow?.webContents.send("leetcode:problemsProgress", {
      phase: "error",
      progress: 0,
      count: 0,
    });
    return [];
  } finally {
    isFetchingProblems = false;
  }
});

async function refreshProblemsInBackground(cookie: string) {
  try {
    const lc = await getLeetCode(cookie);
    const allProblems = await fetchAllProblems(lc);

    cachedProblems = allProblems;
    cachedProblemCount = allProblems.length;
    store.set("problems", allProblems);
    store.set("problemCount", allProblems.length);

    mainWindow?.webContents.send("leetcode:problemsLoaded", cachedProblems);
  } catch (error) {
    console.error("Background refresh failed:", error);
  }
}

ipcMain.handle("leetcode:clearProblemsCache", async () => {
  cachedProblems = null;
  cachedProblemCount = 0;
  store.delete("problems");
  store.delete("problemCount");
});

ipcMain.handle(
  "leetcode:getProblemDetail",
  async (_event, titleSlug: string, cookie: string) => {
    try {
      const lc = await getLeetCode(cookie);
      const problem = await lc.problem(titleSlug);
      return problem;
    } catch (error: any) {
      console.error("Failed to get problem detail:", error?.message);
      return null;
    }
  },
);

ipcMain.handle("leetcode:getDailyProblem", async (_event, cookie: string) => {
  try {
    const lc = await getLeetCode(cookie);
    const daily = await lc.daily();
    return {
      id: 0,
      questionFrontendId: daily.question?.questionFrontendId,
      title: daily.question?.title,
      titleSlug: daily.question?.titleSlug,
      difficulty: daily.question?.difficulty,
      topicTags: daily.question?.topicTags || [],
      isPaidOnly: daily.question?.isPaidOnly,
      status: daily.question?.status,
      solutionNum: daily.question?.solution,
      acceptanceRate: 0,
    };
  } catch (error: any) {
    console.error("Failed to get daily problem:", error?.message);
    return null;
  }
});

ipcMain.handle("leetcode:getUserProfile", async (_event, cookie: string) => {
  try {
    const { username: cookieUsername, avatar: cookieAvatar } =
      getUsernameFromCookie(cookie);

    const lc = await getLeetCode(cookie);

    const whoami = await lc.whoami();

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
      };
    }

    const userProfile = await lc.user(whoami.username);
    const matchedUser = userProfile?.matchedUser;
    const submitStats = matchedUser?.submitStats;
    const acSubmissionNum = submitStats?.acSubmissionNum || [];

    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;
    let totalSubmissions = 0;

    for (const stat of acSubmissionNum) {
      if (stat.difficulty === "Easy") easySolved = stat.count;
      if (stat.difficulty === "Medium") mediumSolved = stat.count;
      if (stat.difficulty === "Hard") hardSolved = stat.count;
    }

    const totalSubmissionNum = submitStats?.totalSubmissionNum || [];
    for (const stat of totalSubmissionNum) {
      totalSubmissions += stat.count;
    }

    return {
      username: whoami.username,
      avatar:
        whoami.avatar || cookieAvatar || matchedUser?.profile?.userAvatar || "",
      ranking: matchedUser?.profile?.ranking || 0,
      reputation: matchedUser?.profile?.reputation || 0,
      totalQuestions: userProfile?.allQuestionsCount?.[0]?.count || 0,
      totalSubmissions,
      easySolved,
      mediumSolved,
      hardSolved,
    };
  } catch (error: any) {
    console.error(
      "Failed to get user profile:",
      error?.message,
      error?.response?.data,
    );
    const { username, avatar } = getUsernameFromCookie(cookie);
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
    };
  }
});

ipcMain.handle(
  "leetcode:getSubmissionCalendar",
  async (_event, cookie: string) => {
    try {
      const { username: cookieUsername } = getUsernameFromCookie(cookie);
      if (!cookieUsername || cookieUsername === "User") {
        return {};
      }

      const query = `
      query matchedUser($username: String!) {
        matchedUser(username: $username) {
          submissionCalendar
        }
      }
    `;

      const data: any = await fetchGraphQL(
        query,
        { username: cookieUsername },
        cookie,
      );
      const calendarStr = data?.matchedUser?.submissionCalendar;

      if (calendarStr) {
        const parsed = JSON.parse(calendarStr);
        return parsed;
      }
      return {};
    } catch (error: any) {
      console.error("Failed to get submission calendar:", error?.message);
      return {};
    }
  },
);

ipcMain.handle(
  "leetcode:getSubmissions",
  async (_event, cookie: string, limit = 20, offset = 0) => {
    try {
      const lc = await getLeetCode(cookie);
      const submissions = await lc.submissions({ limit, offset });
      return submissions;
    } catch (error: any) {
      console.error("Failed to get submissions:", error?.message);
      return [];
    }
  },
);

ipcMain.handle(
  "leetcode:getSubmissionDetail",
  async (_event, cookie: string, submissionId: number) => {
    try {
      const lc = await getLeetCode(cookie);
      const detail = await lc.submission(submissionId);
      return detail;
    } catch (error: any) {
      console.error("Failed to get submission detail:", error?.message);
      return null;
    }
  },
);

ipcMain.handle('leetcode:submitCode', async (_event, questionSlug: string, questionId: string, code: string, lang: string, cookie: string, csrfToken: string) => {
  try {
    const langSlug = lang === 'sql' ? 'mysql' : lang

    if (!csrfToken) {
      console.error('No CSRF token provided. Please add it in Settings.')
      return null
    }

    const submitWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:leetcode'
      }
    })

    try {
      await submitWindow.webContents.session.clearStorageData({
        storages: ['cookies']
      })

      let sessionValue = cookie
      if (cookie.includes('LEETCODE_SESSION=')) {
        const match = cookie.match(/LEETCODE_SESSION=([^;]+)/)
        sessionValue = match ? match[1] : cookie
      }

      await submitWindow.webContents.session.cookies.set({
        url: 'https://leetcode.com',
        name: 'LEETCODE_SESSION',
        value: sessionValue.trim(),
        domain: '.leetcode.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax'
      })

      await submitWindow.webContents.session.cookies.set({
        url: 'https://leetcode.com',
        name: 'csrftoken',
        value: csrfToken.trim(),
        domain: '.leetcode.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'lax'
      })

      if (cookie.includes(';')) {
        const cookies = cookie.split(';').map(c => c.trim())
        for (const cookieStr of cookies) {
          if (cookieStr.startsWith('LEETCODE_SESSION=') || cookieStr.startsWith('csrftoken=')) continue

          const eqIndex = cookieStr.indexOf('=')
          if (eqIndex === -1) continue

          const name = cookieStr.substring(0, eqIndex).trim()
          const value = cookieStr.substring(eqIndex + 1).trim()

          if (name && value) {
            await submitWindow.webContents.session.cookies.set({
              url: 'https://leetcode.com',
              name: name,
              value: value,
              domain: '.leetcode.com',
              path: '/',
              secure: true,
              httpOnly: false,
              sameSite: 'lax'
            })
          }
        }
      }

      await submitWindow.loadURL(`https://leetcode.com/problems/${questionSlug}/`)
      await new Promise(resolve => setTimeout(resolve, 800))

      const submitResult = await submitWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            const response = await fetch('/problems/${questionSlug}/submit/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Csrftoken': '${csrfToken}',
                'X-Requested-With': 'XMLHttpRequest'
              },
              credentials: 'include',
              body: JSON.stringify({
                lang: '${langSlug}',
                question_id: '${questionId}',
                typed_code: ${JSON.stringify(code)}
              })
            })

            const text = await response.text()
            let data
            try {
              data = JSON.parse(text)
            } catch (e) {
              data = { error: 'Failed to parse JSON', text: text.substring(0, 200) }
            }

            return {
              status: response.status,
              ok: response.ok,
              data
            }
          } catch (error) {
            return { error: error.message }
          }
        })()
      `)

      if (submitResult.error || !submitResult.ok || !submitResult.data?.submission_id) {
        submitWindow.close()
        console.error('Submit failed:', submitResult)
        return null
      }

      const submissionId = submitResult.data.submission_id

      let attempts = 0
      const maxAttempts = 40

      while (attempts < maxAttempts) {
        const delay = 300
        await new Promise(resolve => setTimeout(resolve, delay))
        attempts++

        const checkResult = await submitWindow.webContents.executeJavaScript(`
          (async () => {
            try {
              const response = await fetch('/submissions/detail/${submissionId}/check/', {
                method: 'GET',
                credentials: 'include'
              })

              const data = await response.json()
              return { ok: response.ok, data }
            } catch (error) {
              return { error: error.message }
            }
          })()
        `)

        if (checkResult.error) {
          console.error('Polling error:', checkResult.error)
          continue
        }

        const state = checkResult.data?.state

        if (state === 'SUCCESS') {
          submitWindow.close()

          return {
            submissionId: submissionId,
            state: state,
            status: checkResult.data.status_msg,
            statusCode: checkResult.data.status_code,
            runtime: checkResult.data.status_runtime || checkResult.data.display_runtime || checkResult.data.runtime,
            memory: checkResult.data.memory ? `${(Number(checkResult.data.memory) / 1024 / 1024).toFixed(1)} MB` : '0 MB',
            runtimePercentile: checkResult.data.runtime_percentile,
            memoryPercentile: checkResult.data.memory_percentile,
            totalCorrect: checkResult.data.total_correct,
            totalTestcases: checkResult.data.total_testcases,
            compileError: checkResult.data.compile_error || checkResult.data.full_compile_error,
            runtimeError: checkResult.data.runtime_error || checkResult.data.full_runtime_error,
            lastTestcase: checkResult.data.last_testcase || checkResult.data.input,
            expectedOutput: checkResult.data.expected_output,
            codeOutput: checkResult.data.code_output,
            stdOutput: checkResult.data.std_output_list?.join('\n') || checkResult.data.std_output,
            fullData: checkResult.data
          }
        }

        if (state === 'FAILURE') {
          submitWindow.close()

          return {
            submissionId: submissionId,
            state: state,
            status: checkResult.data.status_msg || 'Failed',
            statusCode: checkResult.data.status_code,
            compileError: checkResult.data.compile_error || checkResult.data.full_compile_error,
            runtimeError: checkResult.data.runtime_error || checkResult.data.full_runtime_error,
            fullData: checkResult.data
          }
        }

        if (state === 'FAILURE') {
          submitWindow.close()

          return {
            submissionId: submissionId,
            state: 'FAILURE',
            status: checkResult.data.status_msg || 'Failed',
            statusCode: checkResult.data.status_code,
            totalCorrect: checkResult.data.total_correct,
            totalTestcases: checkResult.data.total_testcases,
            lastTestcase: checkResult.data.last_testcase || checkResult.data.input,
            expectedOutput: checkResult.data.expected_output,
            codeOutput: checkResult.data.code_output,
            stdOutput: checkResult.data.std_output_list?.join('\n') || checkResult.data.std_output,
          }
        }
      }

      submitWindow.close()
      console.error('Polling timeout after', maxAttempts, 'attempts')
      return {
        submissionId: submissionId,
        state: 'TIMEOUT',
        status: 'Timeout waiting for results'
      }

    } catch (error: any) {
      console.error('Submit error:', error?.message)
      submitWindow.close()
      return null
    }
  } catch (error: any) {
    console.error('Submit error:', error?.message)
    return null
  }
})


ipcMain.handle(
  "editor:open",
  async (_event, folderPath: string, editor: string) => {
    return new Promise((resolve, reject) => {
      const command =
        editor === "code"
          ? `code "${folderPath}"`
          : editor === "zed"
            ? `zed "${folderPath}"`
            : editor === "vim"
              ? `vim "${folderPath}"`
              : editor === "hx"
                ? `hx "${folderPath}"`
                : `code "${folderPath}"`;

      exec(command, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  },
);

ipcMain.handle(
  "fs:createProblemFiles",
  async (
    _event,
    rootPath: string,
    problemId: number,
    problemTitle: string,
    code: string,
    lang: string,
  ) => {
    const ext =
      lang === "python"
        ? "py"
        : lang === "java"
          ? "java"
          : lang === "cpp"
            ? "cpp"
            : lang === "javascript"
              ? "js"
              : lang === "typescript"
                ? "ts"
                : lang === "go"
                  ? "go"
                  : lang === "rust"
                    ? "rs"
                    : lang === "csharp"
                      ? "cs"
                      : lang === "c"
                        ? "c"
                        : lang === "ruby"
                          ? "rb"
                          : lang === "php"
                            ? "php"
                            : lang === "scala"
                              ? "scala"
                              : lang === "swift"
                                ? "swift"
                                : lang === "kotlin"
                                  ? "kt"
                                  : lang === "dart"
                                    ? "dart"
                                    : lang === "racket"
                                      ? "rkt"
                                      : lang === "elixir"
                                        ? "ex"
                                        : lang === "erlang"
                                          ? "erl"
                                          : lang === "mysql"
                                            ? "sql"
                                            : lang === "mssql"
                                              ? "sql"
                                              : lang === "oraclesql"
                                                ? "sql"
                                                : lang === "sql"
                                                  ? "sql"
                                          : lang === "python3"
                                            ? "py"
                                            : "txt";
    const folderName = `${problemId}-${problemTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const fullPath = join(rootPath, folderName);

    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }

    writeFileSync(join(fullPath, `solution.${ext}`), code);
    writeFileSync(
      join(fullPath, "notes.md"),
      `# ${problemTitle}\n\n## Notes\n\n`,
    );

    return fullPath;
  },
);

ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
  try {
    if (existsSync(filePath)) {
      const { readFileSync } = await import("fs");
      return readFileSync(filePath, "utf-8");
    }
    return null;
  } catch (error) {
    console.error("Failed to read file:", error);
    return null;
  }
});

ipcMain.handle("shell:openExternal", async (_event, url: string) => {
  await shell.openExternal(url);
});
