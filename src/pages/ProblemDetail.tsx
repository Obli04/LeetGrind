import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { leetCodeApi, ProblemDetail, SubmitResult } from '../services/leetcode'
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  FolderOpen,
  Tag,
  Link,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  MemoryStick,
  Clock,
  AlertCircle
} from 'lucide-react'
import { useStore } from '../store'

const EDITOR_INFO: Record<string, { name: string; color: string }> = {
  code: { name: 'VS Code', color: '#007ACC' },
  zed: { name: 'Zed', color: '#000000' },
  vim: { name: 'Vim', color: '#019633' },
  hx: { name: 'Helix', color: '#8F00FF' },
  idea: { name: 'IntelliJ', color: '#087CFA' },
}

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

interface SimilarQuestion {
  title: string
  titleSlug: string
  difficulty: string
  url: string
}

export default function ProblemDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { settings } = useStore()

  const [problem, setProblem] = useState<ProblemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedLang, setSelectedLang] = useState<string>(settings.defaultLanguage)
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)

  useEffect(() => {
    const fetchProblem = async () => {
      if (!slug) return
      try {
        const data = await leetCodeApi.getProblemDetail(slug, settings.cookie)
        console.log('Problem detail:', JSON.stringify(data).substring(0, 500))
        setProblem(data)

        const initialCode = data?.codeSnippets?.find(
          s => s.langSlug === settings.defaultLanguage || s.lang?.toLowerCase() === settings.defaultLanguage
        )?.code || ''
        setCode(initialCode)
      } catch (error) {
        console.error('Failed to fetch problem:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProblem()
  }, [slug, settings.cookie, settings.defaultLanguage])

  useEffect(() => {
    const loadCode = async () => {
      if (!problem) return

      const ext = selectedLang === 'python' ? 'py' : selectedLang === 'python3' ? 'py' :
        selectedLang === 'java' ? 'java' : selectedLang === 'cpp' ? 'cpp' :
        selectedLang === 'javascript' ? 'js' : selectedLang === 'typescript' ? 'ts' :
        selectedLang === 'go' ? 'go' : selectedLang === 'rust' ? 'rs' :
        selectedLang === 'csharp' ? 'cs' : selectedLang === 'c' ? 'c' : 'txt'

      const folderName = `${problem.questionId}-${problem.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      const fullPath = settings.rootFolder
        ? `${settings.rootFolder}/${folderName}/solution.${ext}`
        : null

      if (fullPath) {
        try {
          const fileContent = await window.electronAPI.fs.readFile(fullPath)
          if (fileContent) {
            setCode(fileContent)
            return
          }
        } catch {}
      }

      if (problem.codeSnippets) {
        const snippet = problem.codeSnippets.find(
          s => s.langSlug === selectedLang || s.lang?.toLowerCase() === selectedLang
        )
        if (snippet) {
          setCode(snippet.code)
        }
      }
    }

    loadCode()

    const handleFocus = () => loadCode()
    window.addEventListener('focus', handleFocus)
    const pollInterval = setInterval(loadCode, 2000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(pollInterval)
    }
  }, [problem, selectedLang, settings.rootFolder])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenInEditor = async () => {
    if (!problem || !settings.rootFolder) {
      navigate('/settings')
      return
    }

    try {
      const ext = selectedLang === 'python' ? 'py' : selectedLang === 'python3' ? 'py' :
        selectedLang === 'java' ? 'java' : selectedLang === 'cpp' ? 'cpp' :
        selectedLang === 'javascript' ? 'js' : selectedLang === 'typescript' ? 'ts' :
        selectedLang === 'go' ? 'go' : selectedLang === 'rust' ? 'rs' :
        selectedLang === 'csharp' ? 'cs' : selectedLang === 'c' ? 'c' : 'txt'

      const folderName = `${problem.questionId}-${problem.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      const fullPath = `${settings.rootFolder}/${folderName}/solution.${ext}`

      const existingCode = await window.electronAPI.fs.readFile(fullPath)
      const codeToSave = existingCode || code

      const folderPath = await window.electronAPI.fs.createProblemFiles(
        settings.rootFolder,
        parseInt(problem.questionId),
        problem.title,
        codeToSave,
        selectedLang
      )
      await window.electronAPI.editor.open(folderPath, settings.editor)
    } catch (error) {
      console.error('Failed to open in editor:', error)
    }
  }

  const handleOpenInBrowser = () => {
    window.electronAPI.shell.openExternal(`https://leetcode.com/problems/${slug}`)
  }

  const handleSubmitCode = async () => {
    if (!problem || !slug) return

    setSubmitting(true)
    setSubmitResult(null)

    try {
      const result = await leetCodeApi.submitCode(slug, problem.questionId, code, selectedLang, settings.cookie, settings.csrfToken)

      if (result) {
        setSubmitResult(result)
        setSubmitting(false)
      } else {
        setSubmitting(false)
        alert('Failed to submit code. Check console for details.')
      }
    } catch (error: any) {
      console.error('Submit error:', error)
      setSubmitting(false)
      alert('Failed to submit code: ' + error?.message)
    }
  }

  const getSimilarQuestions = (): SimilarQuestion[] => {
    if (!problem?.similarQuestions) return []
    if (Array.isArray(problem.similarQuestions)) {
      return problem.similarQuestions.slice(0, 5)
    }
    if (typeof problem.similarQuestions === 'string') {
      try {
        return JSON.parse(problem.similarQuestions).slice(0, 5)
      } catch {
        return []
      }
    }
    return []
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--text-secondary)' }}>Loading problem...</p>
        </div>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p style={{ color: 'var(--text-muted)' }}>Problem not found</p>
        <button
          onClick={() => navigate('/problems')}
          className="mt-4 px-4 py-2 rounded-btn text-sm"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'white'
          }}
        >
          Back to Problems
        </button>
      </div>
    )
  }

  const similarQuestions = getSimilarQuestions()

  return (
    <div className="h-full flex">
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/problems')}
            className="p-2 rounded-btn transition-all duration-150 hover:scale-105"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)'
            }}
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
              {problem.title}
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: problem.difficulty === 'Easy' ? 'rgba(76, 175, 80, 0.2)' :
                    problem.difficulty === 'Medium' ? 'rgba(255, 152, 0, 0.2)' : 'rgba(229, 57, 53, 0.2)',
                  color: problem.difficulty === 'Easy' ? '#4CAF50' :
                    problem.difficulty === 'Medium' ? '#FF9800' : '#E53935'
                }}
              >
                {problem.difficulty}
              </span>
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Problem #{problem.questionId}
            </p>
          </div>

          <button
            onClick={handleOpenInBrowser}
            className="flex items-center gap-2 px-3 py-2 rounded-btn text-sm transition-all duration-150 hover:scale-105"
            style={{
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)'
            }}
          >
            <ExternalLink size={16} />
            LeetCode
          </button>
        </div>

        {problem.topicTags && problem.topicTags.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <Tag size={16} style={{ color: 'var(--text-muted)' }} />
            {problem.topicTags.map((tag: any) => (
              <span
                key={tag.id || tag.slug || tag.name}
                className="px-2 py-1 rounded text-xs"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)'
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <div
          className="p-4 rounded-card mb-6 overflow-auto"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            maxWidth: '100%'
          }}
        >
          <h2 className="text-lg font-semibold mb-3 min-w-fit" style={{ color: 'var(--text-primary)' }}>
            Description
          </h2>
          <div
            className="prose prose-invert max-w-none text-sm min-w-fit"
            style={{ color: 'var(--text-secondary)', maxWidth: '100%', overflowWrap: 'break-word' }}
            dangerouslySetInnerHTML={{ __html: problem.content || '' }}
          />
        </div>

        {problem.constraints && problem.constraints.length > 0 && (
          <div
            className="p-4 rounded-card mb-6"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)'
            }}
          >
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Constraints
            </h2>
            <ul className="list-disc list-inside space-y-1">
              {problem.constraints.map((c: string, i: number) => (
                <li key={i} className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {similarQuestions.length > 0 && (
          <div
            className="p-4 rounded-card"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)'
            }}
          >
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Link size={18} />
              Similar Problems
            </h2>
            <div className="space-y-2">
              {similarQuestions.map((q, i) => (
                <button
                  key={q.url || i}
                  onClick={() => navigate(`/problems/${q.titleSlug}`)}
                  className="flex items-center justify-between p-2 rounded text-sm transition-all duration-150 hover:scale-[1.01] w-full"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{q.title}</span>
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: q.difficulty === 'Easy' ? 'rgba(76, 175, 80, 0.2)' :
                        q.difficulty === 'Medium' ? 'rgba(255, 152, 0, 0.2)' : 'rgba(229, 57, 53, 0.2)',
                      color: q.difficulty === 'Easy' ? '#4CAF50' :
                        q.difficulty === 'Medium' ? '#FF9800' : '#E53935'
                    }}
                  >
                    {q.difficulty}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className="w-[500px] border-l flex flex-col"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border)'
        }}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="px-3 py-1.5 rounded-btn text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)'
            }}
          >
            {LANGUAGES.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="relative">
            <textarea
              value={code}
              readOnly
              className="w-full h-96 p-4 rounded-card text-sm font-mono outline-none resize-none"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)'
              }}
              spellCheck={false}
              placeholder="Write your code here..."
            />

            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-2 rounded transition-all duration-150"
              style={{
                backgroundColor: 'var(--surface)',
                color: copied ? 'var(--success)' : 'var(--text-muted)'
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>

          {submitResult && (
            <div
              className="mt-4 p-4 rounded-card"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)'
              }}
            >
              {submitResult.state === 'SUCCESS' && submitResult.statusCode === 10 && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
                    <div>
                      <h3 className="font-semibold text-lg" style={{ color: 'var(--success)' }}>
                        Accepted!
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {submitResult.totalCorrect} / {submitResult.totalTestcases} test cases passed
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div
                      className="p-3 rounded-card"
                      style={{ backgroundColor: 'var(--bg-tertiary)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Runtime</span>
                      </div>
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {submitResult.runtime}
                      </p>
                      {submitResult.runtimePercentile && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Beats {submitResult.runtimePercentile.toFixed(1)}%
                        </p>
                      )}
                    </div>

                    <div
                      className="p-3 rounded-card"
                      style={{ backgroundColor: 'var(--bg-tertiary)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <MemoryStick size={14} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Memory</span>
                      </div>
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {submitResult.memory}
                      </p>
                      {submitResult.memoryPercentile && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Beats {submitResult.memoryPercentile.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {submitResult.compileError && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle size={24} style={{ color: 'var(--error)' }} />
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--error)' }}>
                      Compilation Error
                    </h3>
                  </div>
                  <pre
                    className="p-3 rounded-card text-xs overflow-auto max-h-48"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--error)',
                      fontFamily: 'monospace'
                    }}
                  >
                    {submitResult.compileError}
                  </pre>
                </>
              )}

              {submitResult.state === 'SUCCESS' && submitResult.statusCode !== 10 && !submitResult.compileError && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle size={24} style={{ color: 'var(--error)' }} />
                    <div>
                      <h3 className="font-semibold text-lg" style={{ color: 'var(--error)' }}>
                        {submitResult.status}
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {submitResult.totalCorrect} / {submitResult.totalTestcases} test cases passed
                      </p>
                    </div>
                  </div>

                  {submitResult.lastTestcase && (
                    <div className="space-y-2 mt-4">
                      <div>
                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                          Last Test Case:
                        </p>
                        <pre
                          className="p-2 rounded text-xs overflow-auto"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {submitResult.lastTestcase}
                        </pre>
                      </div>

                      {submitResult.expectedOutput && (
                        <div>
                          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                            Expected:
                          </p>
                          <pre
                            className="p-2 rounded text-xs overflow-auto"
                            style={{
                              backgroundColor: 'var(--bg-tertiary)',
                              color: 'var(--success)'
                            }}
                          >
                            {submitResult.expectedOutput}
                          </pre>
                        </div>
                      )}

                      {submitResult.codeOutput && (
                        <div>
                          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                            Your Output:
                          </p>
                          <pre
                            className="p-2 rounded text-xs overflow-auto"
                            style={{
                              backgroundColor: 'var(--bg-tertiary)',
                              color: 'var(--error)'
                            }}
                          >
                            {submitResult.codeOutput}
                          </pre>
                        </div>
                      )}

                      {submitResult.stdOutput && (
                        <div>
                          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                            Stdout:
                          </p>
                          <pre
                            className="p-2 rounded text-xs overflow-auto"
                            style={{
                              backgroundColor: 'var(--bg-tertiary)',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            {submitResult.stdOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {submitResult.runtimeError && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                        Runtime Error:
                      </p>
                      <pre
                        className="p-2 rounded text-xs overflow-auto"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--error)'
                        }}
                      >
                        {submitResult.runtimeError}
                      </pre>
                    </div>
                  )}
                </>
              )}

              {submitResult.state === 'TIMEOUT' && (
                <div className="flex items-center gap-2">
                  <AlertCircle size={24} style={{ color: 'var(--text-muted)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Submission is taking longer than expected. Check the Submissions page for results.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
          {settings.rootFolder && (
            <button
              onClick={handleOpenInEditor}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-btn font-medium transition-all duration-150 hover:scale-[1.02]"
              style={{
                backgroundColor: EDITOR_INFO[settings.editor]?.color || 'var(--surface)',
                color: 'white'
              }}
            >
              <FolderOpen size={20} />
              Open in {EDITOR_INFO[settings.editor]?.name || settings.editor}
            </button>
          )}
          <button
            onClick={handleSubmitCode}
            disabled={submitting || !code || !settings.csrfToken}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-btn font-medium transition-all duration-150 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'white'
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={18} />
                Submit Solution
              </>
            )}
          </button>

          {!settings.csrfToken && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--warning)' }}>
              Set CSRF token in Settings to enable submissions
            </p>
          )}
          {settings.csrfToken && !settings.rootFolder && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--warning)' }}>
              Set your root folder in Settings to open problems in your editor
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
