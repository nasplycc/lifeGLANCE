import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import TimoraLogo from './components/ui/TimoraLogo'
import { setAuthToken } from './lib/api'
import ParticleBackground from './components/particles/ParticleBackground'
import MusicPlayer       from './components/music/MusicPlayer'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import Onboarding from './components/onboarding/Onboarding'
import TimelineView from './components/timeline/TimelineView'
import { initDB, dbGetAll, dbClearAll } from './data/db'
import { apiHealth } from './lib/api'
import { setApiAvailable, setLastSyncTime, fullSync } from './lib/sync'

function AppContent() {
  const { user, token, loading: authLoading, login, logout, enterGuest, isAuthenticated, isGuest } = useAuth()
  const [screen, setScreen] = useState('loading')
  const [milestones, setMilestones] = useState([])
  const [authPage, setAuthPage] = useState('login') // 'login' | 'register'
  const [portraitWarn, setPortraitWarn] = useState(
    () => window.matchMedia('(orientation: portrait) and (max-width: 1024px)').matches
  )

  // Keep API token in sync
  useEffect(() => {
    setAuthToken(token)
  }, [token])

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 1024px)')
    const handler = (e) => setPortraitWarn(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Main bootstrap �?runs after auth is resolved
  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      setScreen('auth')
      return
    }

    async function bootstrap() {
      try {
        await initDB()
        navigator.storage?.persist?.()

        // Guest mode: skip all API calls, use IndexedDB only
        if (isGuest) {
          setApiAvailable(false)
          const all = await dbGetAll()
          setMilestones(all)
          setScreen(all.length === 0 ? 'onboarding' : 'timeline')
          return
        }

        // IndexedDB is browser-local. Scope it to the signed-in account so one
        // user's cached data cannot be pushed into another user's server data.
        if (user?.id) {
          const lastUserId = localStorage.getItem('timora-last-user-id')
          if (lastUserId && lastUserId !== user.id) {
            await dbClearAll()
          }
          localStorage.setItem('timora-last-user-id', user.id)
        }

        const apiOk = await apiHealth()
        setApiAvailable(apiOk)
        console.log(`[boot] API available: ${apiOk}`)

        if (apiOk) {
          try {
            const result = await fullSync()
            console.log(`[boot] Sync completed: ${result.direction}, ${result.count} milestones`)
            setLastSyncTime(new Date().toISOString())
          } catch (err) {
            console.warn('[boot] Server sync failed, falling back to local:', err)
          }
        }

        // Fallback: load from local IndexedDB
        const all = await dbGetAll()
        setMilestones(all)
        setScreen(all.length === 0 ? 'onboarding' : 'timeline')
      } catch (err) {
        console.error('Boot failed:', err)
        try {
          const all = await dbGetAll()
          setMilestones(all)
        } catch {}
        setScreen('timeline')
      }
    }

    bootstrap()
  }, [authLoading, isAuthenticated, isGuest, user?.id])

  function handleLogin(newToken, newUser) {
    login(newToken, newUser)
    // bootstrap will run via useEffect
  }

  function handleOnboardingComplete(initial) {
    setMilestones(initial)
    setScreen('timeline')
  }

  // ── Portrait warning overlay
  const portraitOverlay = portraitWarn ? (
    <div className="portrait-overlay">
      <TimoraLogo size="lg" />
      <div className="portrait-rotate-icon">?</div>
      <div className="portrait-message">
        ?????<br />???????
      </div>
    </div>
  ) : null

  // ── Screen router
  if (authLoading || screen === 'loading') {
    return (
      <>
        <ParticleBackground />
        <div className="app-loading">
          <span className="cursor" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
        </div>
        {portraitOverlay}
      </>
    )
  }

  if (screen === 'auth') {
    return (
      <>
        <ParticleBackground />
        <MusicPlayer />
        {authPage === 'login' ? (
          <LoginPage
            onLogin={handleLogin}
            onSwitchToRegister={() => setAuthPage('register')}
            onGuest={enterGuest}
            onForgot={() => setAuthPage('forgot')}
          />
        ) : authPage === 'register' ? (
          <RegisterPage
            onRegister={handleLogin}
            onSwitchToLogin={() => setAuthPage('login')}
          />
        ) : (
          <ForgotPasswordPage
            onReset={handleLogin}
            onBack={() => setAuthPage('login')}
          />
        )}
        {portraitOverlay}
      </>
    )
  }

  if (screen === 'onboarding') {
    return (
      <>
        <ParticleBackground />
        <MusicPlayer />
        <Onboarding onComplete={handleOnboardingComplete} />
        {portraitOverlay}
      </>
    )
  }

  return (
    <>
      <ParticleBackground />
      <MusicPlayer />
      <TimelineView
        milestones={milestones}
        setMilestones={setMilestones}
        user={user}
        onLogout={logout}
        isGuest={isGuest}
      />
      {portraitOverlay}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
