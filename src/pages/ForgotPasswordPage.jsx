import React, { useState, useRef, useEffect } from 'react'
import { apiSendCode, apiResetPassword } from '../lib/api'
import TimoraLogo from '../components/ui/TimoraLogo'

export default function ForgotPasswordPage({ onReset, onBack }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [codeLoading, setCodeLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: email, 2: code + new password
  const timerRef = useRef(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startCooldown() {
    setCooldown(60)
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  async function handleSendCode() {
    if (!email.trim() || cooldown > 0) return
    setError(null)
    setCodeLoading(true)
    try {
      await apiSendCode(email.trim(), 'reset_password')
      setCodeSent(true)
      setStep(2)
      startCooldown()
    } catch (err) {
      setError(err.message || '验证码发送失败')
    } finally {
      setCodeLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !code.trim() || !newPassword || !confirm) return
    if (newPassword !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    if (newPassword.length < 6) {
      setError('密码至少需要 6 个字符')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const result = await apiResetPassword(email.trim(), code.trim(), newPassword)
      setSuccess('✅ 密码重置成功，正在登录…')
      setTimeout(() => {
        onReset(result.token, result.user)
      }, 1500)
    } catch (err) {
      setError(err.message || '密码重置失败')
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
        <h2 className="auth-title">找回密码</h2>

        {step === 1 ? (
          <div className="auth-form">
            <input
              className="auth-input"
              type="email"
              placeholder="请输入注册邮箱"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
            />
            {error && <p className="auth-error">{error}</p>}
            <button
              className="btn btn-filled auth-btn"
              disabled={codeLoading || !email.trim() || cooldown > 0}
              onClick={handleSendCode}
            >
              {codeLoading ? '发送中…' : cooldown > 0 ? `${cooldown} 秒后重试` : '发送验证码'}
            </button>
            <button className="btn auth-back-btn" onClick={onBack}>
              返回登录
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-sent-info">
              验证码已发送至 <strong>{email}</strong>
              <button type="button" className="auth-link" onClick={() => { setStep(1); setCodeSent(false); setCode('') }}>
                更换邮箱
              </button>
            </div>
            <div className="auth-input-row">
              <input
                className="auth-input auth-input-email"
                type="text"
                placeholder="邮箱验证码"
                value={code}
                onChange={e => setCode(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                autoFocus
              />
              <button
                type="button"
                className="btn auth-code-btn"
                disabled={cooldown > 0}
                onClick={handleSendCode}
              >
                {cooldown > 0 ? `${cooldown}s` : '重新发送'}
              </button>
            </div>
            <input
              className="auth-input"
              type="password"
              placeholder="新密码（至少 6 位）"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              minLength={6}
            />
            <input
              className="auth-input"
              type="password"
              placeholder="确认新密码"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              minLength={6}
            />
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}
            <button
              className="btn btn-filled auth-btn"
              type="submit"
              disabled={loading || !code.trim() || !newPassword || !confirm}
            >
              {loading ? '重置中…' : '重置密码'}
            </button>
            <button type="button" className="btn auth-back-btn" onClick={onBack}>
              返回登录
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
