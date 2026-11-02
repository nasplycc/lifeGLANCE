export const DEFAULT_CATEGORIES = [
  { id: 'personal',  label: '个人',  color: '#9370DB' },
  { id: 'family',    label: '家庭',    color: '#9370DB' },
  { id: 'travel',    label: '旅行',    color: '#C8A96E' },
  { id: 'career',    label: '事业',    color: '#4A90D9' },
  { id: 'home',      label: '家居',      color: '#38B2AC' },
  { id: 'health',    label: '健康',    color: '#E85D75' },
  { id: 'education', label: '教育', color: '#5CAD6E' },
]

// Kept for onboarding and other static imports
export const CATEGORIES = DEFAULT_CATEGORIES

export const CATEGORY_COLOR = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c.color])
)

export function categoryColor(category) {
  return CATEGORY_COLOR[category] ?? '#C8A96E'
}

const CAT_KEY = 'lifeglance-categories'

export function loadCategories() {
  try {
    const raw = localStorage.getItem(CAT_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_CATEGORIES
}

export function saveCategories(cats) {
  localStorage.setItem(CAT_KEY, JSON.stringify(cats))
}
