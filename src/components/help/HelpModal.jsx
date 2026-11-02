import React, { useMemo, useState, useEffect } from 'react'
import { version as VERSION } from '../../../package.json'

const SHORTCUTS = [
  { keys: ['←', '→'],        desc: '切换过去/未来里程碑'   },
  { keys: ['↑', '↓'],        desc: '缩小/放大'                     },
  { keys: ['1–9'],            desc: '自定义缩放到 N 年'            },
  { keys: ['C'],              desc: '自定义缩放（聚焦输入框）'         },
  { keys: ['T'],              desc: '回到今天'                     },
  { keys: ['P'],              desc: '过去视图'                         },
  { keys: ['A'],              desc: '全部视图'                          },
  { keys: ['F'],              desc: '未来视图'                       },
  { keys: ['⌘Z', 'Ctrl+Z'],  desc: '撤销'                              },
  { keys: ['⌘⇧Z', 'Ctrl+Y'], desc: '重做'                              },
  { keys: ['M'],              desc: '静音/取消静音'               },
  { keys: ['n'],              desc: '新建里程碑'                     },
  { keys: ['⇧N'],            desc: '新建章节'                       },
  { keys: ['E'],              desc: '导出图片'                      },
  { keys: ['/'],              desc: '搜索里程碑'                 },
  { keys: ['S'],              desc: '设置'                          },
  { keys: ['?'],              desc: '帮助'                              },
  { keys: ['Esc'],            desc: '关闭弹窗/退出章节/退出输入' },
]

function fmtBytes(n) {
  if (n == null) return '—'
  if (n < 1024)        return `${n} B`
  if (n < 1024 ** 2)   return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3)   return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

// localStorage — synchronous, just settings/prefs (a few KB)
function useLocalStorageSize() {
  return useMemo(() => {
    try {
      const bytes = Object.keys(localStorage).reduce(
        (sum, k) => sum + (localStorage.getItem(k)?.length ?? 0) * 2, 0
      )
      return fmtBytes(bytes)
    } catch { return '—' }
  }, [])
}

// IndexedDB — async via Storage API; where milestones + media blobs live
function useIndexedDBEstimate() {
  const [est, setEst] = useState(null)
  useEffect(() => {
    if (!navigator.storage?.estimate) return
    navigator.storage.estimate()
      .then(({ usage, quota }) => setEst({ usage, quota }))
      .catch(() => {})
  }, [])
  return est
}

export default function HelpModal({ onClose }) {
  const localSize = useLocalStorageSize()
  const idbEst    = useIndexedDBEstimate()

  return (
    <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet help-sheet">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="sheet-header">
          <span className="sheet-title">帮助</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Keyboard shortcuts ──────────────────────────────────────────── */}
        <div className="settings-section">
          <div className="settings-label">键盘快捷键</div>
          <table className="help-shortcuts-table">
            <tbody>
              {SHORTCUTS.map(({ keys, desc }) => (
                <tr key={desc}>
                  <td className="help-keys">
                    {keys.map(k => <kbd key={k} className="help-kbd">{k}</kbd>)}
                  </td>
                  <td className="help-desc">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="help-footer">
          <div className="help-footer-storage">
            <span className="help-footer-meta">
              数据库
              <span className="help-footer-value">
                {idbEst ? `${fmtBytes(idbEst.usage)} 已使用` : '…'}
              </span>
              {idbEst && (
                <>
                  <span className="help-footer-dim"> / </span>
                  <span className="help-footer-value">{fmtBytes(idbEst.quota)} 可用</span>
                </>
              )}
            </span>
            <span className="help-footer-meta">
              本地存储
              <span className="help-footer-value">{localSize}</span>
              <span className="help-footer-dim">（仅设置）</span>
            </span>
          </div>
          <span className="help-footer-meta help-footer-version">v{VERSION}</span>
        </div>

      </div>
    </div>
  )
}
