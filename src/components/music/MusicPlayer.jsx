import React, { useState, useRef, useEffect, useCallback } from 'react'

const MUSIC_PUBLIC_API = '/api/music/public'

const DEFAULT_TRACKS = [
  { id: 'lofi-1', title: '午后阳光', url: '/music/lofi-1.mp3' },
  { id: 'lofi-2', title: '月光海岸', url: '/music/lofi-2.mp3' },
]

const PLAY_MODES = [
  { key: 'sequential', icon: '─', label: '顺序播放' },
  { key: 'single',     icon: '●', label: '单曲循环' },
  { key: 'shuffle',    icon: '◎', label: '随机播放' },
  { key: 'reverse',    icon: '↺', label: '倒序播放' },
]

function mapTracks(apiTracks) {
  const serverTracks = (apiTracks || []).map(t => ({
    id: t.id,
    title: t.title,
    artist: t.artist || '',
    url: `/api/music/${t.id}/stream`,
  }))
  // Always include default tracks, server tracks go after
  return [...DEFAULT_TRACKS, ...serverTracks]
}

export default function MusicPlayer() {
  const [tracks, setTracks] = useState(DEFAULT_TRACKS)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playMode, setPlayMode] = useState(0)
  const [volume, setVolume] = useState(0.25)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [showPanel, setShowPanel] = useState(false)
  const [trackReady, setTrackReady] = useState(false)
  const audioRef = useRef(null)
  const playModeRef = useRef(playMode)
  const tracksRef = useRef(tracks)

  const mode = PLAY_MODES[playMode]
  const track = tracks[currentIndex]

  useEffect(() => { playModeRef.current = playMode }, [playMode])
  useEffect(() => { tracksRef.current = tracks }, [tracks])

  // Load tracks from server on mount
  // Fetch tracks from server
  const fetchTracks = useCallback(() => {
    fetch(MUSIC_PUBLIC_API)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const mapped = mapTracks(data)
        setTracks(mapped)
      })
      .catch(() => {
        // keep DEFAULT_TRACKS
      })
  }, [])

  useEffect(() => { fetchTracks() }, [fetchTracks])

  // Refresh when music library changes (from SettingsModal upload/delete)
  useEffect(() => {
    const handler = () => fetchTracks()
    window.addEventListener('music-library-changed', handler)
    return () => window.removeEventListener('music-library-changed', handler)
  }, [fetchTracks])

  // Load track when index or track URL changes (DON'T auto-play, let user click play)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    audio.src = track.url
    audio.volume = volume
    audio.load()
    setTrackReady(false)
    setCurrentTime(0)
    setTotalTime(0)
  }, [currentIndex, track?.url])

  // Audio event listeners (attached once, use refs for dynamic values)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onCanPlay = () => setTrackReady(true)
    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setTotalTime(audio.duration || 0)
    const onPause = () => setIsPlaying(false)
    const onPlay = () => setIsPlaying(true)
    const onEnded = () => {
      const pm = playModeRef.current
      const ts = tracksRef.current
      if (pm === 1) {
        audio.currentTime = 0
        audio.play()
        return
      }
      if (pm === 2) {
        setCurrentIndex(Math.floor(Math.random() * ts.length))
      } else if (pm === 3) {
        setCurrentIndex(i => (i - 1 + ts.length) % ts.length)
      } else {
        setCurrentIndex(i => (i + 1) % ts.length)
      }
    }

    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('play', onPlay)
    return () => {
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('play', onPlay)
    }
  }, [])

  // When index changes, if was playing, auto-play new track
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !isPlaying) return
    const tryPlay = () => {
      audio.play().catch(() => setIsPlaying(false))
      audio.removeEventListener('canplay', tryPlay)
    }
    audio.addEventListener('canplay', tryPlay)
    return () => audio.removeEventListener('canplay', tryPlay)
  }, [currentIndex])

  const handleNext = useCallback(() => {
    const ts = tracks
    if (mode.key === 'shuffle') {
      setCurrentIndex(Math.floor(Math.random() * ts.length))
    } else if (mode.key === 'reverse') {
      setCurrentIndex(i => (i - 1 + ts.length) % ts.length)
    } else {
      setCurrentIndex(i => (i + 1) % ts.length)
    }
  }, [mode, tracks])

  const handlePrev = useCallback(() => {
    const ts = tracks
    if (mode.key === 'shuffle') {
      setCurrentIndex(Math.floor(Math.random() * ts.length))
    } else if (mode.key === 'reverse') {
      setCurrentIndex(i => (i + 1) % ts.length)
    } else {
      setCurrentIndex(i => (i - 1 + ts.length) % ts.length)
    }
  }, [mode, tracks])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(() => setIsPlaying(false))
    }
  }, [isPlaying])

  const handleProgressClick = useCallback((e) => {
    const audio = audioRef.current
    if (!audio || !totalTime) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = pct * totalTime
  }, [totalTime])

  const cycleMode = useCallback(() => {
    setPlayMode(p => (p + 1) % PLAY_MODES.length)
  }, [])

  const selectTrack = useCallback((i) => {
    setCurrentIndex(i)
    setIsPlaying(true)
    setShowPanel(false)
  }, [])

  const fmtTime = (s) => {
    if (!s || isNaN(s)) return '0:00'
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  const progress = totalTime ? (currentTime / totalTime) * 100 : 0

  return (
    <>
      <audio ref={audioRef} preload="auto" />

      <div className="music-bar">
        <button className="music-bar-btn music-bar-mode" onClick={cycleMode} title={mode.label}>
          {mode.icon}
        </button>
        <button className="music-bar-btn" onClick={handlePrev} title="上一首">⏮</button>
        <button className="music-bar-btn music-bar-play" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <button className="music-bar-btn" onClick={handleNext} title="下一首">⏭</button>

        <div className="music-bar-info" onClick={() => setShowPanel(!showPanel)}>
          <span className="music-bar-title">{track?.title}</span>
        </div>

        <div className="music-bar-progress" onClick={handleProgressClick}>
          <div className="music-bar-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <span className="music-bar-time">{fmtTime(currentTime)}</span>
      </div>

      {showPanel && (
        <div className="music-panel-overlay" onClick={() => setShowPanel(false)}>
          <div className="music-panel" onClick={e => e.stopPropagation()}>
            <div className="music-panel-header">
              <span className="music-panel-title">播放列表</span>
              <button className="music-panel-close" onClick={() => setShowPanel(false)}>✕</button>
            </div>
            <div className="music-panel-list">
              {tracks.map((t, i) => (
                <div key={t.id}
                  className={`music-panel-item ${i === currentIndex ? 'active' : ''}`}
                  onClick={() => selectTrack(i)}>
                  <span className="music-panel-idx">{i + 1}</span>
                  <span className="music-panel-name">{t.title}</span>
                  {t.artist && <span className="music-panel-artist">{t.artist}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
