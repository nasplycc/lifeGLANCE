import React, { useState, useEffect } from 'react'
import TypewriterText from '../ui/TypewriterText'
import { useCountUp } from '../../utils/typewriter'
import { getYearsMonths } from '../../utils/dates'

const PROMPT = "让时光看得见-by时光(≧ω≦)"

export default function Step4Reveal({ onComplete, onSkip, pastMilestone, futureMilestone }) {
  const [phase, setPhase] = useState('typing') // typing → row1 → row2 → cta

  // Derived time distances
  const pastInfo   = pastMilestone   ? getYearsMonths(pastMilestone.date)   : null
  const futureInfo = futureMilestone ? getYearsMonths(futureMilestone.date) : null

  // Count-up values
  const pastYears   = useCountUp(pastInfo?.years   ?? 0, { active: phase !== 'typing', duration: 1100 })
  const pastMonths  = useCountUp(pastInfo?.months  ?? 0, { active: phase !== 'typing', duration: 900,  delay: 800 })
  const futureYears  = useCountUp(futureInfo?.years  ?? 0, { active: phase === 'row2' || phase === 'cta', duration: 1100 })
  const futureMonths = useCountUp(futureInfo?.months ?? 0, { active: phase === 'row2' || phase === 'cta', duration: 900, delay: 800 })
  const futureDays   = useCountUp(futureInfo?.days   ?? 0, { active: phase === 'row2' || phase === 'cta', duration: 1100 })

  function handleTypingDone() {
    setTimeout(() => setPhase('row1'), 600)
  }

  useEffect(() => {
    if (phase === 'row1') setTimeout(() => setPhase('row2'), 1400)
  }, [phase])

  useEffect(() => {
    if (phase === 'row2') setTimeout(() => setPhase('cta'), 1400)
  }, [phase])

  const formatFutureTime = () => {
    if (!futureInfo) return '—'
    if (futureInfo.years > 0) {
      return futureInfo.months > 0
        ? `还有${futureYears}年${futureMonths}个月`
        : `还有${futureYears}年`
    }
    return `还有${futureDays}天`
  }

  const formatPastTime = () => {
    if (!pastInfo) return '—'
    if (pastInfo.years > 0) {
      return pastInfo.months > 0
        ? `${pastYears}年${pastMonths}个月前`
        : `${pastYears}年前`
    }
    return `${pastInfo.days}天前`
  }

  return (
    <div className="onboarding-step">
      <div>
        <div className="progress-dots">
          <div className="progress-dot done" />
          <div className="progress-dot done" />
          <div className="progress-dot done" />
          <div className="progress-dot active" />
        </div>
        <div className="onboarding-eyebrow" style={{ marginTop: '0.5rem' }}>
          第 4 步，共 4 步 — 你的时间线
        </div>
      </div>

      <div className="onboarding-prompt">
        <TypewriterText
          text={PROMPT}
          options={{ delay: 40, jitter: 20, startDelay: 300 }}
          onDone={handleTypingDone}
          hideCursorWhenDone
          playSound
        />
      </div>

      {/* Stat rows */}
      <div className="stat-reveal-rows">
        {/* Past stat */}
        <div className={`stat-reveal-row ${phase !== 'typing' ? 'visible' : ''}`}>
          <div className="stat-reveal-label">回望过去</div>
          <div className="stat-reveal-value">
            {pastMilestone
              ? <>{pastMilestone.title} — <em>{formatPastTime()}</em></>
              : <span style={{ color: 'var(--text-muted)' }}>尚未添加过去的事件</span>
            }
          </div>
        </div>

        {/* Future stat */}
        <div className={`stat-reveal-row ${phase === 'row2' || phase === 'cta' ? 'visible' : ''}`}>
          <div className="stat-reveal-label">展望未来</div>
          <div className="stat-reveal-value">
            {futureMilestone
              ? <>{futureMilestone.title} — <em>{formatFutureTime()}</em></>
              : <span style={{ color: 'var(--text-muted)' }}>尚未添加未来的事件</span>
            }
          </div>
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          opacity:    phase === 'cta' ? 1 : 0,
          transform:  phase === 'cta' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <button className="btn btn-filled" onClick={onComplete}>
          打开我的时间线 →
        </button>
        <button className="skip-link" onClick={onSkip}>
          跳过
        </button>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: "'Open Sans', sans-serif" }}>
          按 <kbd style={{ fontSize: '0.85em', padding: '0.1em 0.35em', borderRadius: 3, border: '1px solid var(--border)', color: 'var(--text-dim)' }}>?</kbd> 查看键盘快捷键
        </div>
      </div>
    </div>
  )
}
