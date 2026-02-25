import { useEffect, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface ProgressToastProps {
  progress: number
  phase: 'counting' | 'fetching' | 'complete' | 'error'
  count?: number
  onComplete?: () => void
}

export default function ProgressToast({ progress, phase, count, onComplete }: ProgressToastProps) {
  const [visible, setVisible] = useState(false)
  const [currentProgress, setCurrentProgress] = useState(0)
  const [showCount, setShowCount] = useState(false)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (progress > 0 || phase !== 'counting') {
      setVisible(true)
    }
  }, [progress, phase])

  useEffect(() => {
    const animate = () => {
      setCurrentProgress(prev => {
        const diff = progress - prev
        if (Math.abs(diff) < 1) return progress
        return prev + diff * 0.15
      })
      animRef.current = requestAnimationFrame(animate)
    }
    
    animRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current)
      }
    }
  }, [progress])

  useEffect(() => {
    if (phase === 'fetching' && count && count > 100) {
      setShowCount(true)
    } else {
      setShowCount(false)
    }
  }, [phase, count])

  useEffect(() => {
    if (phase === 'complete') {
      const timer = setTimeout(() => {
        setVisible(false)
        onComplete?.()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [phase, onComplete])

  if (!visible && phase !== 'counting') return null

  const getMessage = () => {
    switch (phase) {
      case 'counting':
        return 'Counting problems...'
      case 'fetching':
        return showCount ? `Loading problems... (${count}+)` : `Loading problems...`
      case 'complete':
        return 'Problems loaded!'
      case 'error':
        return 'Failed to load problems'
      default:
        return 'Loading...'
    }
  }

  const isComplete = phase === 'complete'
  const isError = phase === 'error'

  return (
    <div
      className="fixed bottom-6 right-6 z-50 transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg"
        style={{
          backgroundColor: isComplete 
            ? 'rgba(76, 175, 80, 0.9)' 
            : isError 
              ? 'rgba(229, 57, 53, 0.9)'
              : 'rgba(30, 30, 30, 0.95)',
          border: isComplete 
            ? '1px solid rgba(76, 175, 80, 0.5)' 
            : isError
              ? '1px solid rgba(229, 57, 53, 0.5)'
              : '1px solid rgba(255, 255, 255, 0.1)',
          minWidth: '220px',
        }}
      >
        {!isComplete && !isError && (
          <Loader2 
            size={18} 
            className="animate-spin" 
            style={{ color: 'white' }} 
          />
        )}
        
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: 'white' }}>
            {getMessage()}
          </p>
          
          {!isComplete && !isError && (
            <div className="mt-2">
              <div 
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
              >
                <div 
                  className="h-full rounded-full transition-all duration-100"
                  style={{ 
                    width: `${currentProgress}%`,
                    backgroundColor: 'var(--accent-primary)'
                  }}
                />
              </div>
              <p className="text-xs mt-1" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {Math.round(currentProgress)}%
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
