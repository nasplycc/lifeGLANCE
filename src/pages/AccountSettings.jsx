import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { apiAccountSendCode, apiChangeUsername, apiChangePassword, apiChangeEmail } from '../lib/api'

export default function AccountSettings({ onClose }) {
  const { user, logout } = useAuth()

  // Username change
  const [newUsername, setNewUsername] = useState(user?.username || '')
  const [usernamePassword, setUsernamePassword] = useState('')
  const [usernameMsg, setUsernameMsg] = useState(null)
  const [usernameLoading, setUsernameLoading] = useState(false)

  // Password change
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwCode, setPwCode] = useState('')
  const [pwMsg, setPwMsg] = useState(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwCodeSent, setPwCodeSent] = useState(false)
  const [pwCooldown, setPwCooldown] = useState(0)

  // Email change
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailMsg, setEmailMsg] = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [emailCooldown, setEmailCooldown] = useState(0)

  const timerRef = useRef(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startCooldown(setter) {
    setter(60)
    const iv = setInterval(() => {
      setter(prev => {
        if (prev <= 1) { clearInterval(iv); return 0 }
        return prev - 1
      })
    }, 1000)
    return iv
  }

  // ── Username ─────────────────────────────────────────────────────────
  async function handleChangeUsername(e) {
    e.preventDefault()
    if (!newUsername.trim() || !usernamePassword) return
    setUsernameMsg(null)
    setUsernameLoading(true)
    try {
      const result = await apiChangeUsername(newUsername.trim(), usernamePassword)
      setUsernameMsg({ type: 'success', text: '✅ 用户名修改成功，请重新登录' })
      setTimeout(() => { logout(); onClose() }, 2000)
    } catch (err) {
      setUsernameMsg({ type: 'error', text: err.message || '修改失败' })
    } finally {
      setUsernameLoading(false)
    }
  }

  // ── Password ─────────────────────────────────────────────────────────
  async function handleSendPwCode() {
    setPwMsg(null)
    try {
      await apiAccountSendCode('reset_password')
      setPwCodeSent(true)
      startCooldown(setPwCooldown)
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || '验证码发送失败' })
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (!oldPassword || !newPassword || !confirmPassword || !pwCode) return
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: '两次输入的新密码不一致' })
      return
    }
    setPwMsg(null)
    setPwLoading(true)
    try {
      await apiChangePassword(oldPassword, newPassword, pwCode)
      setPwMsg({ type: 'success', text: '✅ 密码修改成功，请重新登录' })
      setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPwCode('')
      setTimeout(() => { logout(); onClose() }, 2000)
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || '修改失败' })
    } finally {
      setPwLoading(false)
    }
  }

  // ── Email ────────────────────────────────────────────────────────────
  async function handleSendEmailCode() {
    if (!newEmail.trim() || emailCooldown > 0) return
    setEmailMsg(null)
    try {
      await apiAccountSendCode('change_email', newEmail.trim())
      setEmailCodeSent(true)
      startCooldown(setEmailCooldown)
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.message || '验证码发送失败' })
    }
  }

  async function handleChangeEmail(e) {
    e.preventDefault()
    if (!newEmail.trim() || !emailCode) return
    setEmailMsg(null)
    setEmailLoading(true)
    try {
      await apiChangeEmail(newEmail.trim(), emailCode)
      setEmailMsg({ type: 'success', text: '✅ 邮箱修改成功' })
      setNewEmail(''); setEmailCode('')
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.message || '修改失败' })
    } finally {
      setEmailLoading(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet settings-sheet">
        <div className="sheet-header">
          <span className="sheet-title">账号设置</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>

        {/* Current info */}
        <div className="settings-section">
          <div className="settings-label">当前账号</div>
          <div className="settings-you-row">
            <span className="settings-you-label">用户名</span>
            <span className="settings-you-value">{user?.username}</span>
          </div>
          <div className="settings-you-row">
            <span className="settings-you-label">邮箱</span>
            <span className="settings-you-value">{user?.email || '未绑定'}</span>
          </div>
        </div>

        {/* Change username */}
        <div className="settings-section">
          <div className="settings-label">修改用户名</div>
          <form onSubmit={handleChangeUsername} className="settings-form">
            <input className="settings-input" type="text" placeholder="新用户名"
              value={newUsername} onChange={e => setNewUsername(e.target.value)} maxLength={30} />
            <input className="settings-input" type="password" placeholder="当前密码（确认身份）"
              value={usernamePassword} onChange={e => setUsernamePassword(e.target.value)} />
            {usernameMsg && <p className={`settings-msg ${usernameMsg.type}`}>{usernameMsg.text}</p>}
            <button className="btn btn-filled" style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
              type="submit" disabled={usernameLoading || !newUsername.trim() || !usernamePassword}>
              {usernameLoading ? '修改中…' : '修改用户名'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="settings-section">
          <div className="settings-label">修改密码</div>
          <form onSubmit={handleChangePassword} className="settings-form">
            <input className="settings-input" type="password" placeholder="当前密码"
              value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
            <input className="settings-input" type="password" placeholder="新密码（至少 6 位）"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} />
            <input className="settings-input" type="password" placeholder="确认新密码"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} />
            <div className="auth-input-row">
              <input className="settings-input auth-input-email" type="text" placeholder="邮箱验证码"
                value={pwCode} onChange={e => setPwCode(e.target.value)} maxLength={6} inputMode="numeric" />
              <button type="button" className="btn auth-code-btn"
                disabled={pwCooldown > 0} onClick={handleSendPwCode}>
                {pwCooldown > 0 ? `${pwCooldown}s` : pwCodeSent ? '重新发送' : '获取验证码'}
              </button>
            </div>
            {pwMsg && <p className={`settings-msg ${pwMsg.type}`}>{pwMsg.text}</p>}
            <button className="btn btn-filled" style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
              type="submit" disabled={pwLoading || !oldPassword || !newPassword || !confirmPassword || !pwCode}>
              {pwLoading ? '修改中…' : '修改密码'}
            </button>
          </form>
        </div>

        {/* Change email */}
        <div className="settings-section">
          <div className="settings-label">修改邮箱</div>
          <form onSubmit={handleChangeEmail} className="settings-form">
            <div className="auth-input-row">
              <input className="settings-input auth-input-email" type="email" placeholder="新邮箱"
                value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              <button type="button" className="btn auth-code-btn"
                disabled={emailCooldown > 0 || !newEmail.trim()} onClick={handleSendEmailCode}>
                {emailCooldown > 0 ? `${emailCooldown}s` : emailCodeSent ? '重新发送' : '获取验证码'}
              </button>
            </div>
            <input className="settings-input" type="text" placeholder="邮箱验证码"
              value={emailCode} onChange={e => setEmailCode(e.target.value)} maxLength={6} inputMode="numeric" />
            {emailMsg && <p className={`settings-msg ${emailMsg.type}`}>{emailMsg.text}</p>}
            <button className="btn btn-filled" style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
              type="submit" disabled={emailLoading || !newEmail.trim() || !emailCode}>
              {emailLoading ? '修改中…' : '修改邮箱'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
