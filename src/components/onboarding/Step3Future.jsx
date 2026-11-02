import React, { useState } from 'react'
import TypewriterText from '../ui/TypewriterText'
import { buildDateFromParts } from '../../utils/dates'

const PROMPT = "未来你最期待的一件事是什么？"

const MONTHS = [
  '1月','2月','3月','4月','5月','6月',
  '7月','8月','9月','10月','11月','12月',
]

export default function Step3Future({ onSubmit, onSkip, pastMilestone }) {
  const [promptDone, setPromptDone] = useState(false)
  const [title, setTitle] = useState('')
  const [month, setMonth] = useState('1')
  const [year,  setYear]  = useState('')
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')

  const thisYear = new Date().getFullYear()
  const canSubmit = title.trim() && year.length >= 4 && Number(year) >= thisYear

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setError('')

    const date = buildDateFromParts(month, year, 'month')
    if (date <= new Date()) {
      setError('请填写未来的事件。')
      return
    }

    setBusy(true)
    try {
      await onSubmit({ title: title.trim(), date, date_precision: 'month', category: 'personal' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding-step">
      <div>
        <div className="progress-dots">
          <div className="progress-dot done" />
          <div className="progress-dot done" />
          <div className="progress-dot active" />
          <div className="progress-dot" />
        </div>
        <div className="onboarding-eyebrow" style={{ marginTop: '0.5rem' }}>
          第 3 步，共 4 步 — 你的未来
        </div>
      </div>

      <div className="onboarding-prompt">
        <TypewriterText
          text={PROMPT}
          options={{ delay: 22, jitter: 18 }}
          onDone={() => setPromptDone(true)}
          hideCursorWhenDone
          playSound
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="onboarding-inputs"
        style={{
          opacity: promptDone ? 1 : 0,
          transform: promptDone ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
          pointerEvents: promptDone ? 'all' : 'none',
        }}
      >
        <div>
          <label className="field-label">事件名称</label>
          <input
            className="input"
            type="text"
            placeholder="例如：去日本旅行"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoComplete="off"
            maxLength={80}
          />
        </div>

        <div className="field-row">
          <div style={{ flex: 2 }}>
            <label className="field-label">月份</label>
            <select
              className="input"
              value={month}
              onChange={e => setMonth(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">年份</label>
            <input
              className="input"
              type="number"
              placeholder={thisYear + 1}
              value={year}
              onChange={e => setYear(e.target.value)}
              min={thisYear}
            />
          </div>
        </div>

        <div className="onboarding-helper">大概日期即可</div>

        {error && (
          <div style={{ fontSize: '0.78rem', color: '#E85D75' }}>{error}</div>
        )}

        <div className="onboarding-actions">
          <button type="submit" className="btn" disabled={!canSubmit || busy}>
            {busy ? '正在放置…' : '放到时间线上 →'}
          </button>
        </div>
      </form>

      <button className="skip-link" onClick={onSkip}>跳过</button>
    </div>
  )
}
