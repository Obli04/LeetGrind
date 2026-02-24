import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  ExternalLink, 
  Copy, 
  Check, 
  FolderOpen,
  Code,
  Tag,
  Link
} from 'lucide-react'
import { useStore } from '../store'
import { leetCodeApi, ProblemDetail } from '../services/leetcode'

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
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    const fetchProblem = async () => {
      if (!slug) return
      try {
        const data = await leetCodeApi.getProblemDetail(slug, settings.cookie)
        console.log('Problem detail:', JSON.stringify(data).substring(0, 500))
        setProblem(data)
      } catch (error) {
        console.error('Failed to fetch problem:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProblem()
  }, [slug, settings.cookie])

  const currentCode = problem?.codeSnippets?.find(
    s => s.langSlug === selectedLang || s.lang?.toLowerCase() === selectedLang
  )?.code || ''

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenInEditor = async () => {
    if (!problem || !settings.rootFolder) {
      navigate('/settings')
      return
    }

    setOpening(true)
    try {
      const folderPath = await window.electronAPI.fs.createProblemFiles(
        settings.rootFolder,
        parseInt(problem.questionId),
        problem.title,
        currentCode,
        selectedLang
      )
      await window.electronAPI.editor.open(folderPath, settings.editor)
    } catch (error) {
      console.error('Failed to open in editor:', error)
    } finally {
      setOpening(false)
    }
  }

  const handleOpenInBrowser = () => {
    window.electronAPI.shell.openExternal(`https://leetcode.com/problems/${slug}`)
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
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {problem.title}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Problem #{problem.questionId}
            </p>
          </div>

          <div 
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ 
              backgroundColor: problem.difficulty === 'Easy' ? 'rgba(76, 175, 80, 0.2)' : 
                problem.difficulty === 'Medium' ? 'rgba(255, 152, 0, 0.2)' : 'rgba(229, 57, 53, 0.2)',
              color: problem.difficulty === 'Easy' ? '#4CAF50' : 
                problem.difficulty === 'Medium' ? '#FF9800' : '#E53935'
            }}
          >
            {problem.difficulty}
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
          className="p-4 rounded-card mb-6"
          style={{ 
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)'
          }}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Description
          </h2>
          <div 
            className="prose prose-invert max-w-none text-sm"
            style={{ color: 'var(--text-secondary)' }}
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
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Code size={18} />
              Code
            </h2>
            
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
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="relative">
            <pre className="p-4 rounded-card text-sm font-mono overflow-x-auto code-block" 
              style={{ 
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)'
              }}
            >
              {currentCode || '// No code template available for this language'}
            </pre>
            
            {currentCode && (
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
            )}
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleOpenInEditor}
            disabled={opening || !settings.rootFolder}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-btn font-medium transition-all duration-150 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: 'var(--accent-primary)',
              color: 'white'
            }}
          >
            <FolderOpen size={18} />
            {opening ? 'Opening...' : 'Open in Editor'}
          </button>
          
          {!settings.rootFolder && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--warning)' }}>
              Set your root folder in Settings first
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
