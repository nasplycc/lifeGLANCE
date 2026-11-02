import React, { useState, useEffect } from 'react'
import { isApiAvailable, getLastSyncTime, getServerStats, pushToServer, pullFromServer, refreshServerStats, setLastSyncTime } from '../../lib/sync'

function fmtBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function fmtTime(iso) {
  if (!iso) return '从未'
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SyncModal({ onClose, onSyncStatusChange }) {
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [serverStats, setServerStats] = useState(getServerStats())

  const apiOnline = isApiAvailable()
  const lastSync = getLastSyncTime()

  useEffect(() => {
    if (apiOnline) {
      refreshServerStats().then(setServerStats).catch(() => {})
    }
  }, [apiOnline])

  async function handleSync() {
    if (syncing || !isApiAvailable()) return
    if (!window.confirm('注意！本地数据将覆盖服务器内容，确定继续？')) return
    setSyncing(true)
    setSyncMsg('同步中…')
    try {
      const result = await pushToServer()
      const stats = await refreshServerStats()
      setServerStats(stats)
      setLastSyncTime(new Date().toISOString())
      const count = result.milestones?.length || 0
      setSyncMsg(`✅ 已推送 ${count} 个里程碑到服务器`)
      setTimeout(() => setSyncMsg(null), 3000)
      if (onSyncStatusChange) onSyncStatusChange('synced')
    } catch (err) {
      setSyncMsg('❌ 同步失败：' + (err.message || '连接错误'))
      setTimeout(() => setSyncMsg(null), 4000)
    } finally {
      setSyncing(false)
    }
  }

  async function handlePull() {
    if (syncing || !isApiAvailable()) return
    setSyncing(true)
    setSyncMsg('从服务器拉取…')
    try {
      const data = await pullFromServer()
      const msCount = data.milestones?.length || 0
      const chCount = data.chapters?.length || 0
      setLastSyncTime(new Date().toISOString())
      if (msCount > 0 || chCount > 0) {
        setSyncMsg(`✅ 已从服务器拉取 ${msCount} 个里程碑，${chCount} 个章节`)
        setTimeout(() => {
          setSyncMsg(null)
          onClose()
          window.location.reload()
        }, 1500)
      } else {
        setSyncMsg('⚠️ 服务器上没有数据')
        setTimeout(() => setSyncMsg(null), 4000)
      }
    } catch (err) {
      setSyncMsg('❌ 拉取失败：' + (err.message || '连接错误'))
      setTimeout(() => setSyncMsg(null), 4000)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet sync-sheet">
        <div className="sheet-header">
          <span className="sheet-title">☁ 云同步</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-section">
          {apiOnline ? (
            <>
              <div className="settings-sync-status">
                <span className="sync-dot synced" /> 服务器已连接
                {lastSync && (
                  <span className="settings-sync-last">上次同步：{fmtTime(lastSync)}</span>
                )}
              </div>
              {serverStats && (
                <div className="settings-sync-stats">
                  <div className="settings-sync-stat-item">服务器数据：</div>
                  <div className="settings-sync-stat-item">· 里程碑：{serverStats.milestones} 个</div>
                  <div className="settings-sync-stat-item">· 章节：{serverStats.chapters} 个</div>
                  <div className="settings-sync-stat-item">· 媒体：{fmtBytes(serverStats.mediaBytes)}</div>
                </div>
              )}
              <div className="settings-sync-actions">
                <button className="btn btn-filled"
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem', flex: 1 }}
                  onClick={handleSync}>
                  {syncing ? '同步中…' : '推送本地到服务器'}
                </button>
                <button className="btn"
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem', flex: 1 }}
                  onClick={handlePull}>
                  从服务器拉取
                </button>
              </div>
              {syncMsg && <p className="settings-sync-msg">{syncMsg}</p>}
            </>
          ) : (
            <div className="settings-sync-status">
              <span className="sync-dot offline" /> 离线 — 数据仅保存在本地浏览器
              <p className="settings-note" style={{ marginTop: '0.4rem' }}>
                启动后端服务器后，数据将自动同步到服务器，换设备也能访问。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
