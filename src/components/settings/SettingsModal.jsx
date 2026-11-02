import React, { useRef, useState, useEffect } from 'react'
import { saveCategories } from '../../utils/colors'
import { isMuted, setMuted } from '../../utils/audio'
import { apiGetAllMusic, apiUploadMusic, apiDeleteMusic, apiStorage, apiClearUserData } from '../../lib/api'


const TEXT_SIZES_ALL = ['small', 'normal', 'big', 'bigger']
const TEXT_SIZE_LABELS = { small: '小', normal: '中', big: '大', bigger: '更大' }

const COLOR_PALETTE = [
  '#9370DB', '#A78BFA', '#6366F1', '#3D3580',
  '#4A90D9', '#60A5FA', '#38B2AC', '#34D399',
  '#5CAD6E', '#C8A96E', '#FB923C', '#D4A800',
  '#E85D75', '#F472B6', '#E879F9', '#F87171',
]

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function SettingsModal({
  textSize, onTextSizeChange,
  categories, onCategoriesChange,
  clustering, onClusteringChange,
  birthday, onBirthdayChange,
  milestones, chapters,
  onExportImage, onSaveBackup, onRestoreFile, onImportIcsFile,
  onClose,
  ultraCompact = false,
  isGuest = false,
  user = null,
}) {
  const [newLabel,  setNewLabel]  = useState('')
  const [newColor,  setNewColor]  = useState(COLOR_PALETTE[0])
  const [soundOn,   setSoundOn]   = useState(() => !isMuted())
  const fileRef    = useRef(null)
  const icsFileRef = useRef(null)

  // ── Music management state (admin only) ──────────────────────────────
  const [musicList,  setMusicList]  = useState([])
  const [musicTitle, setMusicTitle] = useState('')
  const [uploading,  setUploading]  = useState(false)
  const [musicFile,  setMusicFile]  = useState(null)
  const musicFileRef = useRef(null)
  const isAdmin = user?.username === 'jaben'

  // ── Server storage state ───────────────────────────────────────────
  const [storage, setStorage] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)

  useEffect(() => {
    if (isGuest) return
    apiStorage().then(setStorage).catch(() => {})
  }, [isGuest])

  async function handleClearServerData() {
    if (!clearConfirm) { setClearConfirm(true); return }
    setClearing(true)
    try {
      await apiClearUserData()
      setStorage({ milestones: 0, chapters: 0, mediaBytes: 0, musicTracks: storage?.musicTracks || 0 })
      setClearConfirm(false)
    } catch (err) {
      console.error('Clear failed:', err)
    } finally {
      setClearing(false)
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
  }

  useEffect(() => {
    if (!isAdmin) return
    apiGetAllMusic().then(setMusicList).catch(() => {})
  }, [isAdmin])

  async function handleMusicUpload() {
    if (!musicFile || !musicTitle.trim()) return
    setUploading(true)
    try {
      const result = await apiUploadMusic(musicFile, musicTitle.trim())
      setMusicList(prev => [result, ...prev])
      setMusicTitle('')
      setMusicFile(null)
      if (musicFileRef.current) musicFileRef.current.value = ''
      window.dispatchEvent(new Event('music-library-changed'))
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  async function handleMusicDelete(id) {
    try {
      await apiDeleteMusic(id)
      setMusicList(prev => prev.filter(m => m.id !== id))
      window.dispatchEvent(new Event('music-library-changed'))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  // ── End music management ────────────────────────────────────────────

  const usedIds = new Set(milestones.map(m => m.category))

  function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    const id  = slugify(label) + '-' + Math.random().toString(36).slice(2, 6)
    const cat = { id, label: label.toLowerCase(), color: newColor }
    const updated = [...categories, cat]
    saveCategories(updated)
    onCategoriesChange(updated)
    setNewLabel('')
  }

  function handleDelete(id) {
    const updated = categories.filter(c => c.id !== id)
    saveCategories(updated)
    onCategoriesChange(updated)
  }

  async function handleFileChange(e) {
    await onRestoreFile(e)
    onClose()
  }

  async function handleIcsFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    await onImportIcsFile(file)
    onClose()
  }



  return (
    <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet settings-sheet">
        <div className="sheet-header">
          <span className="sheet-title">设置</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Text size ─────────────────────────────────────────────────── */}
        <div className="settings-section">
          <div className="settings-label">字号</div>
          {ultraCompact ? (
            <div className="settings-note">当前屏幕高度不足，无法调整字号</div>
          ) : (
            <div className="zoom-tabs">
              {TEXT_SIZES_ALL.map(s => (
                <button key={s}
                  className={`zoom-tab ${textSize === s ? 'active' : ''}`}
                  onClick={() => onTextSizeChange(s)}>{TEXT_SIZE_LABELS[s]}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── Display ───────────────────────────────────────────────────── */}
        <div className="settings-section">
          <div className="settings-label">显示</div>
          <label className="settings-toggle-row">
            <span className="settings-toggle-label">自动聚合邻近里程碑</span>
            <input type="checkbox" className="settings-toggle"
              checked={clustering}
              onChange={e => onClusteringChange(e.target.checked)} />
          </label>
          <label className="settings-toggle-row">
            <span className="settings-toggle-label">音效</span>
            <input type="checkbox" className="settings-toggle"
              checked={soundOn}
              onChange={e => { setSoundOn(e.target.checked); setMuted(!e.target.checked) }} />
          </label>
        </div>

        {/* ── Categories ────────────────────────────────────────────────── */}
        <div className="settings-section">
          <div className="settings-label">分类</div>

          <div className="settings-cat-list">
            {categories.map(cat => {
              const inUse = usedIds.has(cat.id)
              return (
                <div key={cat.id} className="settings-cat-row">
                  <div className="settings-cat-dot" style={{ background: cat.color }} />
                  <span className="settings-cat-name">{cat.label}</span>
                  {inUse && <span className="settings-cat-inuse">使用中</span>}
                  <button
                    className="settings-cat-del"
                    disabled={inUse}
                    title={inUse ? '无法删除 — 分类正在使用' : '删除分类'}
                    onClick={() => handleDelete(cat.id)}
                  >✕</button>
                </div>
              )
            })}
          </div>

          <div className="settings-cat-add">
            <div className="settings-cat-add-row">
              <input
                className="input input-sm"
                placeholder="新分类名称"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                maxLength={30}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button
                className="btn btn-filled"
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem', flexShrink: 0 }}
                disabled={!newLabel.trim()}
                onClick={handleAdd}
              >添加</button>
            </div>
            <div className="settings-palette">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  className={`settings-swatch ${newColor === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── You ───────────────────────────────────────────────────────── */}
        <div className="settings-section">
          <div className="settings-label">个人信息</div>
          <div className="settings-you-row">
            <span className="settings-you-label">生日</span>
            <input
              type="date"
              className="settings-birthday-input"
              value={birthday}
              max={(() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}` })()}
              onChange={e => onBirthdayChange(e.target.value)}
            />
          </div>
        </div>



        {/* ── Music Management (admin only) ────────────────────────────── */}
        {isAdmin && (
          <div className="settings-section">
            <div className="settings-label">背景音乐管理</div>

            <div className="settings-music-upload">
              <input
                ref={musicFileRef}
                type="file"
                accept="audio/*"
                className="music-upload-input"
                style={{ flex: 1 }}
                onChange={e => setMusicFile(e.target.files[0])}
              />
              <input
                className="input input-sm"
                placeholder="歌曲名"
                value={musicTitle}
                onChange={e => setMusicTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMusicUpload()}
                maxLength={100}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button
                className="btn btn-filled"
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem', flexShrink: 0 }}
                disabled={!musicFile || !musicTitle.trim() || uploading}
                onClick={handleMusicUpload}
              >{uploading ? '上传中…' : '上传'}</button>
            </div>

            <div className="settings-music-list">
              {musicList.length === 0 ? (
                <div className="settings-note">暂无背景音乐</div>
              ) : (
                musicList.map(m => (
                  <div key={m.id} className="settings-music-row">
                    <span className="settings-music-title">{m.title}{m.artist ? ` — ${m.artist}` : ''}</span>
                    <button className="settings-music-del" onClick={() => handleMusicDelete(m.id)}>✕</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Data / backup ─────────────────────────────────────────────── */}
        <div className="settings-section">
          <div className="settings-label">数据</div>
          <div className="settings-backup-row">
            <button className="btn"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
              onClick={onExportImage}>导出图片</button>
            <button className="btn"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
              onClick={onSaveBackup}>保存备份</button>
            <button className="btn"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
              onClick={() => fileRef.current?.click()}>从文件恢复</button>
            <button className="btn"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
              onClick={() => icsFileRef.current?.click()}>导入 .ics</button>
            <input ref={fileRef} type="file" accept=".json"
              style={{ display: 'none' }} onChange={handleFileChange} />
            <input ref={icsFileRef} type="file" accept=".ics"
              style={{ display: 'none' }} onChange={handleIcsFileChange} />
          </div>
          <p className="settings-note" style={{ marginTop: '0.5rem' }}>
            .ics 导入仅支持全天事件。有时事件将被跳过 — 导入对话框会显示被跳过的数量。
          </p>
        </div>

        {/* ── Server data ───────────────────────────────────────────────── */}
        {!isGuest && storage && (
          <div className="settings-section">
            <div className="settings-label">服务器数据</div>
            <div className="settings-storage-grid">
              <div className="settings-storage-item">
                <span className="settings-storage-value">{storage.milestones}</span>
                <span className="settings-storage-unit">里程碑</span>
              </div>
              <div className="settings-storage-item">
                <span className="settings-storage-value">{storage.chapters}</span>
                <span className="settings-storage-unit">章节</span>
              </div>
              <div className="settings-storage-item">
                <span className="settings-storage-value">{formatBytes(storage.mediaBytes)}</span>
                <span className="settings-storage-unit">媒体文件</span>
              </div>
              <div className="settings-storage-item">
                <span className="settings-storage-value">{storage.musicTracks || 0}</span>
                <span className="settings-storage-unit">音乐</span>
              </div>
            </div>
            <button
              className={`btn ${clearConfirm ? 'btn-danger' : ''}`}
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem', marginTop: '0.6rem' }}
              disabled={clearing || storage.milestones === 0}
              onClick={handleClearServerData}
            >
              {clearing ? '清空中…' : clearConfirm ? '确认清空？此操作不可撤销' : '清空服务器数据'}
            </button>
            {clearConfirm && (
              <button className="btn" style={{ fontSize: '0.7rem', padding: '0.3rem 0.7rem', marginLeft: '0.5rem' }}
                onClick={() => setClearConfirm(false)}>取消</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
