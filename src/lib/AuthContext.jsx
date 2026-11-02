import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiMe } from '../lib/api'
import { dbClearAll } from '../data/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('timora-token'))
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('timora-guest') === 'true')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Guest mode: skip API auth
    if (isGuest) {
      setUser({ id: 'guest', username: '预览模式', email: '' })
      setLoading(false)
      return
    }

    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    apiMe(token)
      .then(data => {
        setUser(data.user)
      })
      .catch(() => {
        setToken(null)
        setUser(null)
        localStorage.removeItem('timora-token')
      })
      .finally(() => setLoading(false))
  }, [token, isGuest])

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem('timora-token', newToken)
    localStorage.removeItem('timora-guest')
    setToken(newToken)
    setIsGuest(false)
    setUser(newUser)
  }, [])

  const enterGuest = useCallback(async () => {
    // Clear any previous user's data from IndexedDB
    try { await dbClearAll() } catch (e) { console.warn('[guest] clear failed:', e) }
    localStorage.setItem('timora-guest', 'true')
    localStorage.removeItem('timora-token')
    setIsGuest(true)
    setToken(null)
    setUser({ id: 'guest', username: '预览模式', email: '' })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('timora-token')
    localStorage.removeItem('timora-guest')
    setToken(null)
    setIsGuest(false)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, token, loading, isGuest,
      login, logout, enterGuest,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
