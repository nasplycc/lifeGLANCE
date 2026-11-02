/**
 * Minimal Web Audio synthesis for 时光墙.
 * AudioContext is created lazily on the first user gesture (call init()).
 * All play functions are no-ops when muted or before init().
 */

let ctx           = null
let ambientNodes  = []
let ambientActive = false
let melodyTimer   = null
let _muted        = localStorage.getItem('lifeglance-sound') === 'off'

// ── Context ───────────────────────────────────────────────────────────────────

/** Call from a user-gesture handler (click/keydown) to unlock the AudioContext. */
export function init() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch { /* browser doesn't support Web Audio */ }
  } else if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

function getCtx() {
  if (!ctx || ctx.state === 'closed') return null
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// ── Mute ─────────────────────────────────────────────────────────────────────

export function isMuted()     { return _muted }
export function setMuted(val) {
  _muted = !!val
  localStorage.setItem('lifeglance-sound', _muted ? 'off' : 'on')
  if (_muted) _fadeOutAmbient()
}
export function toggleMuted() { setMuted(!_muted); return _muted }

// ── Primitive: single sine tone with envelope ─────────────────────────────────

function tone(freq, duration, peak = 0.09, type = 'sine', delaySec = 0) {
  if (_muted) return
  const c = getCtx()
  if (!c) return
  const osc  = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.value = freq
  const t0 = c.currentTime + delaySec
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

// ── Typewriter key click ──────────────────────────────────────────────────────
// A short frequency-swept sine: starts at ~1500–2000 Hz and drops to ~20%
// of that over 11 ms — mimics the physics of a key strike (high-frequency
// contact transient that immediately settles). No noise = no fart.

export function playKeyClick() {
  if (_muted) return
  const c = getCtx()
  if (!c) return
  const t0        = c.currentTime
  const startFreq = 1500 + Math.random() * 500   // slight per-key variation
  const osc  = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(startFreq, t0)
  osc.frequency.exponentialRampToValueAtTime(startFreq * 0.2, t0 + 0.011)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(0.08, t0 + 0.001)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.014)
  osc.start(t0)
  osc.stop(t0 + 0.02)
}

// ── Piano note (used by melody + chime) ──────────────────────────────────────
// Fundamental sine + 2nd harmonic at 28 % for body. Fast attack, long decay.

function playPianoNote(freq, vel = 0.07, decaySec = 1.8) {
  if (_muted) return
  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime
  ;[[1, vel], [2, vel * 0.28]].forEach(([mult, peak]) => {
    const osc  = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = 'sine'
    osc.frequency.value = freq * mult
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decaySec)
    osc.start(t0)
    osc.stop(t0 + decaySec + 0.05)
  })
}

// ── Milestone save chime ──────────────────────────────────────────────────────
// C major triad arpeggio played as piano notes: C5 → E5 → G5

export function playChime() {
  playPianoNote(523.25, 0.10, 1.1)
  setTimeout(() => playPianoNote(659.25, 0.07, 0.95), 70)
  setTimeout(() => playPianoNote(783.99, 0.05, 0.80), 140)
}

// ── Edit save ─────────────────────────────────────────────────────────────────

export function playEditSave() {
  playPianoNote(523.25, 0.07, 0.7)
}

// ── Navigation tick ───────────────────────────────────────────────────────────
// Lower pitch = past (going back); higher = future (going forward).

export function playNavTick(goingForward = false) {
  tone(goingForward ? 587.33 : 369.99, 0.13, 0.045, 'sine', 0)
}

// ── Onboarding ambient ────────────────────────────────────────────────────────
// Disabled: ambient music removed, only operation sounds remain

export function startAmbient() { /* disabled */ }
export function stopAmbient() { /* disabled */ }

// ── Chapter drill-in / drill-out ──────────────────────────────────────────────
// Drill-in: ascending frequency sweep (180 → 520 Hz) + arrival piano note.
// Drill-out: descending sweep (520 → 180 Hz) + lower landing note.

export function playDrillIn() {
  if (_muted) return
  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime
  const osc  = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(180, t0)
  osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.26)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(0.11, t0 + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32)
  osc.start(t0)
  osc.stop(t0 + 0.35)
  // Landing note
  setTimeout(() => playPianoNote(523.25, 0.06, 0.7), 220)
}

export function playDrillOut() {
  if (_muted) return
  const c = getCtx()
  if (!c) return
  const t0 = c.currentTime
  const osc  = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(520, t0)
  osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.26)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(0.11, t0 + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32)
  osc.start(t0)
  osc.stop(t0 + 0.35)
  // Landing note
  setTimeout(() => playPianoNote(261.63, 0.06, 0.7), 220)
}
