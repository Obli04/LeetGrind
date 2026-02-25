import { useEffect, useState } from 'react'
import { 
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  MemoryStick,
  Loader2
} from 'lucide-react'
import { useStore } from '../store'
import { leetCodeApi, Submission, SubmissionDetail } from '../services/leetcode'

const SUBMISSIONS_PER_PAGE = 20

export default function Submissions() {
  const { settings } = useStore()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetchSubmissions()
  }, [settings.cookie, currentPage])

  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      const offset = (currentPage - 1) * SUBMISSIONS_PER_PAGE
      const subs = await leetCodeApi.getSubmissions(settings.cookie, SUBMISSIONS_PER_PAGE, offset)
      setSubmissions(subs)
      setTotalCount(subs.length === SUBMISSIONS_PER_PAGE ? offset + SUBMISSIONS_PER_PAGE + 50 : offset + subs.length)
    } catch (error) {
      console.error('Failed to fetch submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = async (submission: Submission) => {
    setDetailLoading(true)
    try {
      const detail = await leetCodeApi.getSubmissionDetail(settings.cookie, submission.id)
      setSelectedSubmission(detail)
    } catch (error) {
      console.error('Failed to fetch submission detail:', error)
    } finally {
      setDetailLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    if (status === 'AC') {
      return <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
    }
    return <XCircle size={16} style={{ color: 'var(--error)' }} />
  }

  const getStatusColor = (status: string) => {
    return status === 'AC' ? 'var(--success)' : 'var(--error)'
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalPages = Math.ceil(totalCount / SUBMISSIONS_PER_PAGE)

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div 
          className="p-4 border-b"
          style={{ 
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border)'
          }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Submissions
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Showing {submissions.length} submissions
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12">
              <p style={{ color: 'var(--text-muted)' }}>No submissions yet. Start solving problems!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center gap-4 p-4 rounded-card cursor-pointer transition-all duration-150 hover:scale-[1.01]"
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)'
                  }}
                  onClick={() => handleViewDetail(submission)}
                >
                  <div className="w-8">
                    {getStatusIcon(submission.status)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {submission.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: getStatusColor(submission.status) }}>
                        {submission.statusDisplay}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {submission.langVerbose}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{submission.runtime || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MemoryStick size={14} />
                      <span>{submission.memory || '-'}</span>
                    </div>
                  </div>

                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(submission.timestamp)}
                  </div>
                </div>
              ))}
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

      {selectedSubmission && (
        <div 
          className="w-96 border-l flex flex-col overflow-hidden"
          style={{ 
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border)'
          }}
        >
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Submission Details</h3>
            <button
              onClick={() => setSelectedSubmission(null)}
              className="p-1 rounded hover:bg-black/10"
              style={{ color: 'var(--text-muted)' }}
            >
              <XCircle size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedSubmission.statusCode === 10 ? (
                      <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                    ) : (
                      <XCircle size={20} style={{ color: 'var(--error)' }} />
                    )}
                    <span 
                      className="font-medium"
                      style={{ color: selectedSubmission.statusCode === 10 ? 'var(--success)' : 'var(--error)' }}
                    >
                      {selectedSubmission.statusCode === 10 ? 'Accepted' : `Failed (${selectedSubmission.statusCode})`}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {selectedSubmission.totalCorrect} / {selectedSubmission.totalTestcases} test cases passed
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div 
                    className="p-3 rounded-card"
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Runtime</span>
                    </div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {selectedSubmission.runtimeDisplay}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {selectedSubmission.runtimePercentile?.toFixed(1)}% faster
                    </p>
                  </div>

                  <div 
                    className="p-3 rounded-card"
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <MemoryStick size={14} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Memory</span>
                    </div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {selectedSubmission.memoryDisplay}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {selectedSubmission.memoryPercentile?.toFixed(1)}% less
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    Language
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {selectedSubmission.lang?.verboseName || 'Unknown'}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    Submitted Code
                  </h4>
                  <pre 
                    className="p-3 rounded-card text-xs overflow-auto max-h-64"
                    style={{ 
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'monospace'
                    }}
                  >
                    {selectedSubmission.code}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
