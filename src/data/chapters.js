import { dbGetAllChapters, dbGetChapter, dbAddChapter, dbPutChapter, dbDeleteChapter } from './db'
import { uid } from './milestones'
import {
  apiGetChapters, apiGetChapter, apiCreateChapter, apiUpdateChapter, apiDeleteChapter,
  apiRestoreChapters,
} from '../lib/api'
import { isApiAvailable, withRetry } from '../lib/sync'

export function buildChapter({
  title,
  start,
  end = null,
  color,
  description               = '',
  defaultMemberVisibility   = 'shown',
  parentChapterId           = null,
}) {
  const now = new Date().toISOString()
  return {
    id:                     uid(),
    title:                  title.trim(),
    start:                  start instanceof Date ? start.toISOString() : new Date(start).toISOString(),
    end:                    end === null ? null : (end instanceof Date ? end.toISOString() : new Date(end).toISOString()),
    color,
    description,
    defaultMemberVisibility,
    parentChapterId,
    milestoneIds:           [],
    created_at:             now,
    updated_at:             now,
  }
}

export async function createChapter(data) {
  const chapter = buildChapter(data)
  await dbAddChapter(chapter)
  if (isApiAvailable()) {
    withRetry(() => apiCreateChapter(chapter), 'createChapter').catch(err =>
      console.warn('[sync] createChapter failed (queued):', err)
    )
  }
  return chapter
}

export async function getChapter(id) {
  return dbGetChapter(id)
}

export async function listChapters() {
  return dbGetAllChapters()
}

export async function updateChapter(id, updates, existing) {
  const chapter = {
    ...existing,
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  }
  // Ensure milestoneIds is a proper array (from string if localStorage restored)
  if (typeof chapter.milestoneIds === 'string') {
    chapter.milestoneIds = JSON.parse(chapter.milestoneIds);
  }
  await dbPutChapter(chapter)
  if (isApiAvailable()) {
    withRetry(() => apiUpdateChapter(id, chapter), 'updateChapter').catch(err =>
      console.warn('[sync] updateChapter failed (queued):', err)
    )
  }
  return chapter
}

export async function deleteChapter(id) {
  await dbDeleteChapter(id)
  if (isApiAvailable()) {
    await withRetry(() => apiDeleteChapter(id), 'deleteChapter').catch(err => {
      if (err?.status !== 404) console.warn('[sync] deleteChapter failed:', err)
    })
  }
}

// Adds milestoneId to chapter.milestoneIds; no-op if already present.
export async function addMilestoneToChapter(chapterId, milestoneId) {
  const chapter = await dbGetChapter(chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
  if (chapter.milestoneIds.includes(milestoneId)) return chapter
  const updated = {
    ...chapter,
    milestoneIds: [...chapter.milestoneIds, milestoneId],
    updated_at:   new Date().toISOString(),
  }
  await dbPutChapter(updated)
  if (isApiAvailable()) {
    withRetry(() => apiUpdateChapter(chapterId, updated), 'addMilestoneToChapter').catch(err =>
      console.warn('[sync] addMilestoneToChapter failed:', err)
    )
  }
  return updated
}

// Removes milestoneId from chapter.milestoneIds; no-op if not present.
export async function removeMilestoneFromChapter(chapterId, milestoneId) {
  const chapter = await dbGetChapter(chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
  const updated = {
    ...chapter,
    milestoneIds: chapter.milestoneIds.filter(id => id !== milestoneId),
    updated_at:   new Date().toISOString(),
  }
  await dbPutChapter(updated)
  if (isApiAvailable()) {
    withRetry(() => apiUpdateChapter(chapterId, updated), 'removeMilestoneFromChapter').catch(err =>
      console.warn('[sync] removeMilestoneFromChapter failed:', err)
    )
  }
  return updated
}

// Returns the milestoneIds array for a chapter.
export async function getMilestonesInChapter(chapterId) {
  const chapter = await dbGetChapter(chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
  return chapter.milestoneIds
}

// Returns all chapters that contain the given milestoneId.
export async function getChaptersForMilestone(milestoneId) {
  const chapters = await dbGetAllChapters()
  return chapters.filter(chapter => chapter.milestoneIds.includes(milestoneId))
}

// Merge chapters from server into local (add/update, never delete)
export async function mergeChapters(items) {
  for (const chapter of items) {
    const c = typeof chapter.milestoneIds === 'string'
      ? { ...chapter, milestoneIds: JSON.parse(chapter.milestoneIds) }
      : chapter
    await dbPutChapter(c)
  }
}

// Replaces all chapter records (used by backup restore).
export async function restoreChapters(items) {
  const existing = await dbGetAllChapters()
  for (const chapter of existing) await dbDeleteChapter(chapter.id)
  for (const chapter of items) {
    if (typeof chapter.milestoneIds === 'string') {
      chapter.milestoneIds = JSON.parse(chapter.milestoneIds);
    }
    await dbPutChapter(chapter)
  }
  if (isApiAvailable()) {
    withRetry(() => apiRestoreChapters(items), 'restoreChapters').catch(err =>
      console.warn('[sync] restoreChapters failed:', err)
    )
  }
  return items
}
