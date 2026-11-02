import React, { useState } from 'react'
import { apiLogin } from '../lib/api'
import TimoraLogo from '../components/ui/TimoraLogo'

export default function LoginPage({ onLogin, onSwitchToRegister, onGuest, onForgot }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await apiLogin(username.trim(), password)
      onLogin(token, user)
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <TimoraLogo size="lg" />
        </div>
        <h2 className="auth-title">登录</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            className="auth-input"
            type="text"
            placeholder="用户名或邮箱"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            maxLength={30}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && <p className="auth-error">{error}</p>}
          <button
            className="btn btn-filled auth-btn"
            type="submit"
            disabled={loading || !username.trim() || !password}
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
        <div className="auth-links-row">
          <button className="auth-link" onClick={onSwitchToRegister}>注册账号</button>
          <span className="auth-links-sep">·</span>
          <button className="auth-link" onClick={onForgot}>忘记密码</button>
        </div>
        <div className="auth-divider" />
        <button className="btn auth-guest-btn" onClick={onGuest}>
          <span className="auth-guest-icon">▶</span>
          <span className="auth-guest-text">免注册预览</span>
          <span className="auth-guest-hint">数据仅存本地浏览器</span>
        </button>
      </div>
    </div>
  )
}
