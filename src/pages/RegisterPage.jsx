import React, { useState, useRef, useEffect } from 'react'
import { apiRegister, apiSendCode } from '../lib/api'
import TimoraLogo from '../components/ui/TimoraLogo'

export default function RegisterPage({ onRegister, onSwitchToLogin }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [codeLoading, setCodeLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startCooldown() {
    setCooldown(60)
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function handleSendCode() {
    if (!email.trim() || cooldown > 0) return
    setError(null)
    setCodeLoading(true)
    try {
      await apiSendCode(email.trim(), 'register')
      setCodeSent(true)
      startCooldown()
    } catch (err) {
      setError(err.message || '验证码发送失败')
    } finally {
      setCodeLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !email.trim() || !code.trim() || !password || !confirm) return
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await apiRegister(username.trim(), email.trim(), code.trim(), password)
      onRegister(token, user)
    } catch (err) {
      setError(err.message || '注册失败')
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
        <h2 className="auth-title">注册</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            className="auth-input"
            type="text"
            placeholder="用户名（2-30 个字符）"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            maxLength={30}
          />
          <div className="auth-input-row">
            <input
              className="auth-input auth-input-email"
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <button
              type="button"
              className="btn auth-code-btn"
              disabled={codeLoading || cooldown > 0 || !email.trim()}
              onClick={handleSendCode}
            >
              {codeLoading ? '…' : cooldown > 0 ? `${cooldown}s` : codeSent ? '重新发送' : '获取验证码'}
            </button>
          </div>
          <input
            className="auth-input"
            type="text"
            placeholder="邮箱验证码"
            value={code}
            onChange={e => setCode(e.target.value)}
            maxLength={6}
            inputMode="numeric"
          />
          <input
            className="auth-input"
            type="password"
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={6}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="确认密码"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            minLength={6}
          />
          {error && <p className="auth-error">{error}</p>}
          <button
            className="btn btn-filled auth-btn"
            type="submit"
            disabled={loading || !username.trim() || !email.trim() || !code.trim() || !password || !confirm}
          >
            {loading ? '注册中…' : '注册'}
          </button>
        </form>
        <p className="auth-switch">
          已有账号？
          <button className="auth-link" onClick={onSwitchToLogin}>登录</button>
        </p>
      </div>
    </div>
  )
}
