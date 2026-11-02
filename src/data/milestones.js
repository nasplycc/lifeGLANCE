import { dbGetAll, dbAdd, dbPut, dbDelete, dbGetPhoto, dbDeletePhoto, dbDeleteMedia } from './db'
import { categoryColor } from '../utils/colors'
import {
  apiCreateMilestone, apiUpdateMilestone, apiDeleteMilestone, apiDeleteSeries,
  apiRestoreMilestones, apiUploadMedia, apiDeleteMedia, apiMediaUrl,
} from '../lib/api'
import { isApiAvailable, withRetry } from '../lib/sync'

export function uid() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export function buildMilestone({
  title,
  date,           // Date object or ISO string
  date_precision = 'month',
  category       = 'personal',
  color,
  note           = '',
  has_photo      = false,
  media_type     = null,   // null | 'audio' | 'video'
  url            = '',
  recurrence     = null,   // null | 'annual'
  recurrence_id  = null,   // UUID shared across instances of a series
  mainTimelineVisibility = 'inherit',
}) {
  const dateObj = date instanceof Date ? date : new Date(date)
  const today   = new Date()
  const now     = new Date().toISOString()

  return {
    id:             uid(),
    title:          title.trim(),
    date:           dateObj.toISOString(),
    date_precision,
    direction:      dateObj < today ? 'past' : 'future',
    category,
    color:          color || categoryColor(category),
    note,
    has_photo,
    media_type,
    url,
    recurrence,
    recurrence_id,
    mainTimelineVisibility,
    created_at:     now,
    updated_at:     now,
  }
}

export async function loadMilestones() {
  return dbGetAll()
}

export async function addMilestone(data) {
  const m = buildMilestone(data)
  await dbAdd(m)
  if (isApiAvailable()) {
    try {
      await withRetry(() => apiCreateMilestone(m), 'createMilestone')
    } catch (err) {
      console.warn('[sync] createMilestone failed:', err)
    }
  }
  return m
}

export async function updateMilestone(id, updates, existing) {
  const dateObj = updates.date instanceof Date
    ? updates.date
    : new Date(updates.date || existing.date)

  const today   = new Date()
  const now     = new Date().toISOString()

  const { photo_uri: _discard, ...safeUpdates } = updates

  const m = {
    ...existing,
    ...safeUpdates,
    id,
    date:      dateObj.toISOString(),
    direction: dateObj < today ? 'past' : 'future',
    color:     updates.color || categoryColor(updates.category || existing.category),
    updated_at: now,
  }
  await dbPut(m)
  if (isApiAvailable()) {
    withRetry(() => apiUpdateMilestone(id, m), 'updateMilestone').catch(err =>
      console.warn('[sync] updateMilestone failed:', err)
    )
  }
  return m
}

export async function deleteMilestone(id) {
  await dbDelete(id)
  await dbDeletePhoto(id)
  try { await dbDeleteMedia(id) } catch {}
  try { await dbDeleteMedia(`${id}-audio`) } catch {}
  try { await dbDeleteMedia(`${id}-video`) } catch {}
  if (isApiAvailable()) {
    await withRetry(() => apiDeleteMilestone(id), 'deleteMilestone').catch(err => {
      if (err?.status !== 404) console.warn('[sync] deleteMilestone failed:', err)
    })
  }
}

export async function restoreMilestones(items) {
  const existing = await dbGetAll()
  const newIds = new Set(items.map(m => m.id))
  // Only delete media for milestones that no longer exist on server
  for (const m of existing) {
    if (!newIds.has(m.id)) {
      await dbDeletePhoto(m.id)
      try { await dbDeleteMedia(m.id) } catch {}
      // Delete media entries (audio/video) —keys are `${milestoneId}-audio` or `${milestoneId}-video`
      try { await dbDeleteMedia(`${m.id}-audio`) } catch {}
      try { await dbDeleteMedia(`${m.id}-video`) } catch {}
    }
    await dbDelete(m.id)
  }
  const clean = items.map(({ photo_uri: _discard, ...m }) => ({
    mainTimelineVisibility: 'inherit',
    ...m,
    // Ensure has_photo is a boolean
    has_photo:  m.has_photo === true || m.has_photo === 1,
    media_type: m.media_type || null,
  }))
  for (const m of clean) await dbPut(m)
  if (isApiAvailable()) {
    withRetry(() => apiRestoreMilestones(clean), 'restoreMilestones').catch(err =>
      console.warn('[sync] restoreMilestones failed:', err)
    )
  }
  return clean
}

// Merge milestones from server into local (add/update, never delete)
// Unlike restoreMilestones, this preserves existing local data that isn't in the incoming set.
export async function mergeMilestones(items) {
  const localItems = await dbGetAll()
  const localById = new Map(localItems.map(m => [m.id, m]))

  for (const m of items) {
    const local = localById.get(m.id)
    const localPhoto = local?.has_photo ? await dbGetPhoto(m.id) : null
    const localTime = local?.updated_at ? Date.parse(local.updated_at) : 0
    const serverTime = m.updated_at ? Date.parse(m.updated_at) : 0

    if (local && localTime > serverTime) {
      await dbPut({
        ...local,
        has_photo: !!(local.has_photo || localPhoto),
        media_type: local.media_type || null,
      })
      continue
    }

    const clean = {
      mainTimelineVisibility: 'inherit',
      ...m,
      has_photo:  m.has_photo === true || m.has_photo === 1 || !!localPhoto,
      media_type: m.media_type || null,
    }
    await dbPut(clean)
  }
}

// Upload media to server after storing locally
export async function uploadMediaToServer(milestoneId, kind, blob) {
  if (!isApiAvailable()) return false;
  try {
    const file = new File([blob], `${milestoneId}-${kind}`, { type: blob.type });
    await withRetry(() => apiUploadMedia(milestoneId, kind, file), 'uploadMedia', 5);
    return true;
  } catch (err) {
    console.warn('[sync] uploadMedia failed:', err);
    return false;
  }
}
