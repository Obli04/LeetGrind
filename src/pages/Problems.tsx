import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Search, 
  Filter, 
  ChevronDown,
  CheckCircle2,
  Circle,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Shuffle,
  Bookmark,
  BookmarkCheck
} from 'lucide-react'
import { useStore } from '../store'
import { leetCodeApi } from '../services/leetcode'
import ProgressToast from '../components/ProgressToast'

type Difficulty = 'All' | 'Easy' | 'Medium' | 'Hard'
type Status = 'All' | 'Solved' | 'Unsolved' | 'Bookmarked'

const PROBLEMS_PER_PAGE = 50

export default function Problems() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { settings, problems, setProblems, addProblemsBatch, isProblemSolved, toggleBookmark, isProblemBookmarked } = useStore()
  
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [difficulty, setDifficulty] = useState<Difficulty>('All')
  const [status, setStatus] = useState<Status>('All')
  const [showFilters, setShowFilters] = useState(false)
  const [loadProgress, setLoadProgress] = useState({ phase: 'counting' as 'counting' | 'fetching' | 'complete' | 'error', progress: 0, count: 0 })

  const handleDaily = async () => {
    try {
      const problem = await leetCodeApi.getDailyProblem(settings.cookie)
      navigate(`/problems/${problem.titleSlug}`)
    } catch (error) {
      console.error('Failed to fetch daily problem:', error)
    }
  }

  const handleRandom = async () => {
    try {
      const problem = await leetCodeApi.getRandomProblem(settings.cookie)
      navigate(`/problems/${problem.titleSlug}`)
    } catch (error) {
      console.error('Failed to fetch random problem:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search) {
      setSearchParams({ search })
    } else {
      setSearchParams({})
    }
  }
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let cleanupBatch: (() => void) | undefined
    let cleanupLoaded: (() => void) | undefined
    let cleanupProgress: (() => void) | undefined

    const fetchProblems = async () => {
      try {
        cleanupProgress = window.electronAPI.leetcode.onProblemsProgress((data) => {
          setLoadProgress({ 
            phase: data.phase as any, 
            progress: data.progress, 
            count: data.count || 0 
          })
        })
        
        cleanupBatch = window.electronAPI.leetcode.onProblemsBatch((data) => {
          addProblemsBatch(data.problems)
        })
        
        cleanupLoaded = window.electronAPI.leetcode.onProblemsLoaded((allProblems) => {
          setProblems(allProblems)
          setLoading(false)
          setLoadProgress({ phase: 'complete', progress: 100, count: allProblems.length })
        })
        
        await leetCodeApi.getProblems(settings.cookie)
      } catch (error) {
        console.error('Failed to fetch problems:', error)
        setLoadProgress({ phase: 'error', progress: 0, count: 0 })
      }
    }
    
    if (problems.length > 0) {
      setLoading(false)
    } else {
      fetchProblems()
    }

    return () => {
      cleanupBatch?.()
      cleanupLoaded?.()
      cleanupProgress?.()
    }
  }, [settings.cookie])

  const filteredProblems = useMemo(() => {
    return problems.filter(p => {
      const matchesSearch = !search || 
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.questionFrontendId && p.questionFrontendId.toString().includes(search)) ||
        (p.topicTags && p.topicTags.some((tag: any) => tag.name.toLowerCase().includes(search.toLowerCase())))
      
      const matchesDifficulty = difficulty === 'All' || p.difficulty?.toLowerCase() === difficulty.toLowerCase()
      const solvedData = isProblemSolved(p.titleSlug)
      const isSolvedByApi = p.status === 'AC' || p.status === 'ac'
      const isSolved = solvedData !== undefined || isSolvedByApi
      const isUnsolved = !isSolved
      const isBookmarked = isProblemBookmarked(p.titleSlug)
      const matchesStatus = status === 'All' || 
        (status === 'Solved' && isSolved) ||
        (status === 'Unsolved' && isUnsolved) ||
        (status === 'Bookmarked' && isBookmarked)
      
      return matchesSearch && matchesDifficulty && matchesStatus
    })
  }, [problems, search, difficulty, status, isProblemSolved, isProblemBookmarked])

  const paginatedProblems = useMemo(() => {
    const start = (currentPage - 1) * PROBLEMS_PER_PAGE
    return filteredProblems.slice(start, start + PROBLEMS_PER_PAGE)
  }, [filteredProblems, currentPage])

  const totalPages = Math.ceil(filteredProblems.length / PROBLEMS_PER_PAGE)

  useEffect(() => {
    setCurrentPage(1)
  }, [search, difficulty, status])

  const clearFilters = () => {
    setSearch('')
    setDifficulty('All')
    setStatus('All')
    setSearchParams({})
    setCurrentPage(1)
  }

  const getDifficultyColor = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return { bg: 'rgba(76, 175, 80, 0.2)', text: '#4CAF50' }
      case 'medium':
        return { bg: 'rgba(255, 152, 0, 0.2)', text: '#FF9800' }
      case 'hard':
        return { bg: 'rgba(229, 57, 53, 0.2)', text: '#E53935' }
      default:
        return { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)' }
    }
  }

  const showLoading = loading && problems.length === 0

  if (showLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div 
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--text-secondary)' }}>Loading problems...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div 
        className="p-4 border-b"
        style={{ 
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border)'
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleDaily}
            className="flex items-center gap-2 px-3 py-2 rounded-btn text-sm font-medium transition-all duration-150 hover:scale-105"
            style={{ 
              backgroundColor: 'var(--accent-primary)',
              color: 'white'
            }}
          >
            <Calendar size={16} />
            Daily
          </button>

          <button
            onClick={handleRandom}
            className="flex items-center gap-2 px-3 py-2 rounded-btn text-sm font-medium transition-all duration-150 hover:scale-105"
            style={{ 
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)'
            }}
          >
            <Shuffle size={16} />
            Random
          </button>

          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2"
              size={18}
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or ID..."
              className="w-full pl-10 pr-4 py-2 rounded-btn text-sm outline-none"
              style={{ 
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)'
              }}
            />
          </form>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-btn text-sm transition-all duration-150"
            style={{ 
              backgroundColor: showFilters ? 'var(--accent-muted)' : 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)'
            }}
          >
            <Filter size={16} />
            Filters
            <ChevronDown size={14} className={showFilters ? 'rotate-180' : ''} />
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Difficulty:</span>
              <div className="flex gap-1">
                {(['All', 'Easy', 'Medium', 'Hard'] as Difficulty[]).map(d => {
                  const colors = d === 'All' ? { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)' } : getDifficultyColor(d)
                  return (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-150"
                      style={{ 
                        backgroundColor: difficulty === d ? colors.text : colors.bg,
                        color: difficulty === d ? 'white' : colors.text
                      }}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status:</span>
              <div className="flex gap-1">
                {(['All', 'Solved', 'Unsolved', 'Bookmarked'] as Status[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-150"
                    style={{ 
                      backgroundColor: status === s ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: status === s ? 'white' : 'var(--text-secondary)'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {(difficulty !== 'All' || status !== 'All' || search) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm transition-all duration-150 hover:scale-105"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Showing {filteredProblems.length} of {problems.length} problems
          </div>

          <div className="space-y-2">
            {paginatedProblems.map((problem, idx) => {
              const diffColors = getDifficultyColor(problem.difficulty)
              const solvedData = isProblemSolved(problem.titleSlug)
              const isSolved = solvedData !== undefined || problem.status === 'AC' || problem.status === 'ac'
              const isBookmarked = isProblemBookmarked(problem.titleSlug)
              return (
                <div
                  key={problem.questionFrontendId || problem.titleSlug || idx}
                  onClick={() => navigate(`/problems/${problem.titleSlug}`)}
                  className="flex items-center gap-4 p-4 rounded-card cursor-pointer transition-all duration-150 hover:scale-[1.01]"
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div className="w-8 flex items-center justify-center">
                    {isSolved ? (
                      <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                    ) : (
                      <Circle size={20} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>

                  <div 
                    className="w-8 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleBookmark(problem.titleSlug)
                    }}
                  >
                    {isBookmarked ? (
                      <BookmarkCheck size={20} style={{ color: 'var(--accent-primary)' }} />
                    ) : (
                      <Bookmark size={20} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>

                  <div className="w-16 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {problem.questionFrontendId}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {problem.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {problem.topicTags.slice(0, 3).map((tag, idx) => (
                        <span 
                          key={tag.id || tag.slug || idx}
                          className="px-2 py-0.5 rounded text-xs"
                          style={{ 
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div 
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: diffColors.bg,
                      color: diffColors.text
                    }}
                  >
                    {problem.difficulty}
                  </div>
                </div>
              )
            })}
          </div>

          {filteredProblems.length === 0 && (
            <div className="text-center py-12">
              <p style={{ color: 'var(--text-muted)' }}>No problems found matching your criteria.</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-btn disabled:opacity-50"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)'
                }}
              >
                <ChevronLeft size={18} style={{ color: 'var(--text-primary)' }} />
              </button>
              <span style={{ color: 'var(--text-secondary)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-btn disabled:opacity-50"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)'
                }}
              >
                <ChevronRight size={18} style={{ color: 'var(--text-primary)' }} />
              </button>
            </div>
          )}
        </div>
      </div>
      
      <ProgressToast 
        progress={loadProgress.progress} 
        phase={loadProgress.phase}
        count={loadProgress.count}
      />
    </div>
  )
}
