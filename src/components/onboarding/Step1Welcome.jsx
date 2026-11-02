import React, { useState, useEffect } from 'react'
import { useTypewriter } from '../../utils/typewriter'
import TimoraLogo from '../ui/TimoraLogo'

const TAGLINE = '让时光看得见-by时光(≧ω≦)'

export default function Step1Welcome({ onBegin, onSkip }) {
  // Phase: 'life' → 'glance' → 'tagline' → 'cta'
  const [phase, setPhase] = useState('life')

  const lifeTyped   = useTypewriter('时光', { active: phase === 'life',   delay: 55, jitter: 40 })
  const glanceTyped = useTypewriter('墙',   { active: phase === 'glance', delay: 55, jitter: 40 })
  const taglineTyped = useTypewriter(TAGLINE,  { active: phase === 'tagline', delay: 30, jitter: 20, startDelay: 200 })

  useEffect(() => {
    if (lifeTyped.done   && phase === 'life')    setTimeout(() => setPhase('glance'),  120)
  }, [lifeTyped.done])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (glanceTyped.done && phase === 'glance')  setTimeout(() => setPhase('tagline'), 300)
  }, [glanceTyped.done]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (taglineTyped.done && phase === 'tagline') setTimeout(() => setPhase('cta'), 400)
  }, [taglineTyped.done]) // eslint-disable-line react-hooks/exhaustive-deps

  const showCta = phase === 'cta'

  return (
    <div className="onboarding-step" style={{ alignItems: 'flex-start' }}>
      {/* Logo animation */}
      <div style={{ lineHeight: 1 }}>
        <div className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <TimoraLogo compact size="lg" />
          <span className="logo-life">
            {phase === 'life' ? lifeTyped.displayed : '时光'}
            {phase === 'life' && <span className="cursor" />}
          </span>
          <span className="logo-glance">
            {phase === 'glance' ? glanceTyped.displayed : phase !== 'life' ? '墙' : ''}
            {phase === 'glance' && <span className="cursor" />}
          </span>
        </div>

        {/* Tagline */}
        <div className="logo-tagline" style={{ minHeight: '1.4rem' }}>
          {phase !== 'life' && phase !== 'glance' && (
            <>
              {taglineTyped.displayed}
              {phase === 'tagline' && <span className="cursor" />}
            </>
          )}
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          marginTop: '1rem',
          opacity: showCta ? 1 : 0,
          transform: showCta ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}
      >
        <button className="btn" onClick={onBegin}>
          开始 →
        </button>
      </div>

      <button className="skip-link" onClick={onSkip}>
        跳过
      </button>
    </div>
  )
}
