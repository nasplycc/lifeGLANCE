import React from 'react'

/**
 * Timora Logo — 时光墙
 *
 * 沙漏图标 + "时光墙" 一行排列
 *
 * Props:
 *  - size: 'sm' | 'md' | 'lg'  (默认 'md')
 *  - compact: boolean  (仅图标，无文字)
 *  - className: string
 */

const ICON_SIZES = { sm: 18, md: 28, lg: 42 }

export default function TimoraLogo({ size = 'md', compact, className, ...rest }) {
  const iconSize = ICON_SIZES[size] || 28

  const icon = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      {/* 沙漏外框 */}
      <path
        d="M6 3 L6 10 Q6 14 14 14 Q22 14 22 10 L22 3 M6 25 L6 18 Q6 14 14 14 Q22 14 22 18 L22 25"
        stroke="#C8A96E"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 上方沙粒（流下的沙子） */}
      <circle cx="11" cy="7" r="1" fill="#38B2AC" opacity="0.7" />
      <circle cx="14" cy="6" r="1.2" fill="#38B2AC" opacity="0.6" />
      <circle cx="17" cy="7.5" r="0.8" fill="#38B2AC" opacity="0.5" />
      {/* 下方沙粒（堆积的沙子） */}
      <circle cx="11" cy="21" r="1" fill="#3D3580" opacity="0.7" />
      <circle cx="14" cy="22" r="1.2" fill="#3D3580" opacity="0.6" />
      <circle cx="17" cy="21" r="0.8" fill="#3D3580" opacity="0.5" />
      {/* 流沙（中间下落的沙子） */}
      <line x1="14" y1="14" x2="14" y2="18" stroke="#C8A96E" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      {/* 中心圆点（当下） */}
      <circle cx="14" cy="14" r="2" fill="#C8A96E" />
      <circle cx="14" cy="14" r="4" fill="#C8A96E" opacity="0.12" />
    </svg>
  )

  if (compact) {
    return (
      <span className={`logo ${className || ''}`} {...rest}>
        {icon}
      </span>
    )
  }

  const isSm = size === 'sm'

  return (
    <span
      className={`logo ${className || ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: isSm ? 5 : 8 }}
      {...rest}
    >
      {icon}
      <span
        style={{
          fontSize: isSm ? '1rem' : '1.5rem',
          fontWeight: 500,
          letterSpacing: '0.1em',
          color: '#E8E0D0',
          whiteSpace: 'nowrap',
        }}
      >
        时光墙
      </span>
    </span>
  )
}
