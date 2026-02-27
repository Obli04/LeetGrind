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

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

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
    if (response.data.errors) {
      console.log("GraphQL errors:", JSON.stringify(response.data.errors));
    }
    return response.data.data;
  } catch (error: any) {
    console.log(
      "GraphQL request error:",
      error?.response?.status,
      error?.message?.slice(0, 100),
    );
    console.log(
      "Response data:",
      error?.response?.data?.slice?.(0, 500) || error?.response?.data,
    );
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
    console.log(`Loaded ${savedProblems.length} cached problems from store`);
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
    console.log("Extracted username:", username);

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

  if (cachedProblems && hasExistingCache) {
    if (hasValidCookie && cachedCookieForCache !== cookie) {
      console.log(
        "Cookie changed or user logged in, refreshing to get solved status...",
      );
      refreshProblemsInBackground(cookie);
    } else if (hasValidCookie) {
      console.log(
        "Returning cached problems, triggering background refresh for status update...",
      );
      refreshProblemsInBackground(cookie);
    }

    console.log(
      "Returning cached problems:",
      cachedProblems.length,
      "solved status:",
      cachedProblems.filter((p) => p.status === "AC").length,
    );
    mainWindow?.webContents.send("leetcode:problemsLoaded", cachedProblems);
    return cachedProblems;
  }

  if (isFetchingProblems) {
    console.log("Already fetching problems, waiting...");
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
    console.log("Fetching all problems with leetcode-query...");

    mainWindow?.webContents.send("leetcode:problemsProgress", {
      phase: "counting",
      progress: 0,
    });

    const lc = await getLeetCode(cookie);
    const problemsData: any = await lc.problems();

    console.log("Problems data type:", typeof problemsData);
    console.log(
      "Problems data keys:",
      problemsData?.stat_status_pairs ? "stat_status_pairs" : "array",
    );

    const arr = problemsData?.stat_status_pairs || problemsData || [];
    console.log(
      "First problem raw:",
      JSON.stringify(arr[0] || "none").substring(0, 500),
    );

    const allProblems = arr.map((p: any) => ({
      id: p.stat?.frontend_question_id || p.id || 0,
      questionFrontendId: String(p.stat?.frontend_question_id || p.id || ""),
      title: p.stat?.question__title || "",
      titleSlug: p.stat?.question__title_slug || "",
      difficulty: p.difficulty || "Medium",
      topicTags: p.topicTags || [],
      isPaidOnly: p.paid_only || false,
      status: p.status || null,
      solutionNum: 0,
      acceptanceRate:
        p.stat?.total_acs && p.stat?.total_submissions
          ? p.stat.total_acs / p.stat.total_submissions
          : 0,
    }));

    cachedProblems = allProblems;
    cachedProblemCount = allProblems.length;
    store.set("problems", allProblems);
    store.set("problemCount", allProblems.length);

    mainWindow?.webContents.send("leetcode:problemsLoaded", cachedProblems);
    return cachedProblems;
  } catch (error: any) {
    console.error("Failed to get problems:", error?.message);
    return [];
  } finally {
    isFetchingProblems = false;
  }
});

async function refreshProblemsInBackground(cookie: string) {
  try {
    console.log("Refreshing problems with leetcode-query...");

    const lc = await getLeetCode(cookie);
    const problemsData: any = await lc.problems();

    console.log("Refresh - problems type:", typeof problemsData);
    console.log("Refresh - is array:", Array.isArray(problemsData));
    console.log(
      "Refresh - keys:",
      problemsData?.keys ? Object.keys(problemsData) : "no keys",
    );
    if (problemsData?.stat_status_pairs) {
      console.log(
        "Refresh - has stat_status_pairs:",
        problemsData.stat_status_pairs.length,
      );
    }

    const arr = problemsData?.stat_status_pairs || problemsData;
    if (!Array.isArray(arr)) {
      console.error("Problems data is not an array:", arr);
      return;
    }

    const allProblems = arr.map((p: any) => ({
      id: p.stat?.frontend_question_id || p.id || 0,
      questionFrontendId: String(p.stat?.frontend_question_id || p.id || ""),
      title: p.stat?.question__title || "",
      titleSlug: p.stat?.question__title_slug || "",
      difficulty: p.difficulty || "Medium",
      topicTags: p.topicTags || [],
      isPaidOnly: p.paid_only || false,
      status: p.status || null,
      solutionNum: 0,
      acceptanceRate:
        p.stat?.total_acs && p.stat?.total_submissions
          ? p.stat.total_acs / p.stat.total_submissions
          : 0,
    }));

    cachedProblems = allProblems;
    cachedProblemCount = allProblems.length;
    store.set("problems", allProblems);
    store.set("problemCount", allProblems.length);

    mainWindow?.webContents.send("leetcode:problemsLoaded", cachedProblems);
    console.log(
      "Background refresh complete, solved:",
      allProblems.filter((p) => p.status === "AC").length,
    );
  } catch (error) {
    console.error("Background refresh failed:", error);
  }
}

ipcMain.handle("leetcode:clearProblemsCache", async () => {
  cachedProblems = null;
  cachedProblemCount = 0;
  store.delete("problems");
  store.delete("problemCount");
  console.log("Problems cache cleared");
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
    console.log("Fetching daily problem...");
    const lc = await getLeetCode(cookie);
    const daily = await lc.daily();
    console.log("Daily response:", JSON.stringify(daily).substring(0, 500));
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
        return JSON.parse(calendarStr);
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
    const langSlug = lang === 'python3' ? 'python3' : lang

    if (!csrfToken) {
      console.error('No CSRF token provided. Please add it in Settings.')
      return null
    }

    console.log('Submitting code with hidden browser window...')

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

      console.log('Loading problem page...')
      await submitWindow.loadURL(`https://leetcode.com/problems/${questionSlug}/`)
      await new Promise(resolve => setTimeout(resolve, 800))

      console.log('Submitting code...')
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

      console.log('Submit result:', JSON.stringify(submitResult).slice(0, 500))

      if (submitResult.error || !submitResult.ok || !submitResult.data?.submission_id) {
        submitWindow.close()
        console.error('Submit failed:', submitResult)
        return null
      }

      const submissionId = submitResult.data.submission_id
      console.log('Submission ID:', submissionId)
      console.log('Polling for results...')

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

        console.log(`Poll attempt ${attempts}:`, JSON.stringify(checkResult).slice(0, 300))

        if (checkResult.error) {
          console.error('Polling error:', checkResult.error)
          continue
        }

        const state = checkResult.data?.state

        if (state === 'SUCCESS') {
          console.log('Submission completed!')
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
          console.log('Submission failed')
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

        console.log('Still processing...')
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
