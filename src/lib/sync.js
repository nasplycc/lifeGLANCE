// Sync layer: bridges IndexedDB (local cache) with the backend API.
// When the API is reachable, every CRUD operation also syncs to the server.
// When offline, data stays in IndexedDB and will sync when connectivity returns.

import { apiExportSync, apiImportSync, apiStorage, setAuthToken, getAuthToken } from '../lib/api'
import { dbPutPhoto, dbGetPhoto, dbGetMedia, dbGetAll } from '../data/db'
import { loadMilestones, mergeMilestones, uploadMediaToServer } from '../data/milestones'
import { mergeChapters } from '../data/chapters'

let _apiAvailable = false
let _lastSyncTime = null  // ISO string of last successful sync
let _serverStats = null   // cached { milestones, chapters, mediaBytes }

export function setApiAvailable(v) { _apiAvailable = v }
export function isApiAvailable() { return _apiAvailable }

export function getLastSyncTime() { return _lastSyncTime }
export function setLastSyncTime(t) { _lastSyncTime = t }

export function getServerStats() { return _serverStats }

function canDecodeImage(blob) {
  if (!blob?.type?.startsWith('image/')) return Promise.resolve(false)
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    const cleanup = (ok) => {
      URL.revokeObjectURL(url)
      resolve(ok)
    }
    img.onload = () => cleanup(true)
    img.onerror = () => cleanup(false)
    img.src = url
  })
}

// Sync photos from server for milestones that have them (non-blocking)
export async function syncPhotosFromServer(milestones) {
  const token = getAuthToken()
  let synced = 0
  let failed = 0
  const hasPhotoMs = milestones.filter(m => m.has_photo)
  console.log(`[sync] photo sync start: ${hasPhotoMs.length} milestones with has_photo, token=${token ? 'yes' : 'NO'}`)
  for (const m of hasPhotoMs) {
    try {
      const headers = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const url = `/api/media/${m.id}/photo`
      const resp = await fetch(url, { headers, cache: 'no-store' })
      if (resp.ok) {
        const blob = await resp.blob()
        console.log(`[sync] photo ${m.id}: downloaded ${blob.size} bytes (${blob.type})`)
        if (blob.size > 0) {
          if (!(await canDecodeImage(blob))) {
            console.warn(`[sync] photo ${m.id}: downloaded blob is not a decodable image`)
            failed++
            continue
          }
          await dbPutPhoto(m.id, blob, blob.type)
          // Verify write
          const verify = await dbGetPhoto(m.id)
          console.log(`[sync] photo ${m.id}: IDB verify = ${verify ? verify.blob.size + ' bytes' : 'NULL!'}`)
          synced++
        } else {
          console.warn(`[sync] photo ${m.id}: server returned empty blob`)
          failed++
        }
      } else {
        console.warn(`[sync] photo ${m.id}: HTTP ${resp.status}`)
        failed++
      }
    } catch (err) {
      console.warn('[sync] photo ${m.id}: exception', err)
      failed++
    }
  }
  console.log(`[sync] photo sync done: ${synced} ok, ${failed} failed`)
  if (synced > 0) {
    window.dispatchEvent(new CustomEvent('photos-synced', { detail: { count: synced } }))
  }
}

// Pull server → local (merge into IndexedDB, never delete local data)
export async function pullFromServer() {
  if (!_apiAvailable) throw new Error('API not available')
  console.log('[sync] pullFromServer: fetching from server…')
  const serverData = await apiExportSync()
  const msCount = serverData.milestones?.length || 0
  const chCount = serverData.chapters?.length || 0
  console.log(`[sync] pullFromServer: server has ${msCount} milestones, ${chCount} chapters`)

  // Merge (not replace): server items are added/updated but local-only data is preserved.
  await mergeMilestones(serverData.milestones || [])
  await mergeChapters(serverData.chapters || [])
  await syncPhotosFromServer(serverData.milestones || [])
  // Verify
  const verify = await dbGetAll()
  console.log(`[sync] pullFromServer: IndexedDB now has ${verify.length} milestones after merge`)
  _lastSyncTime = new Date().toISOString()
  _serverStats = { milestones: msCount, chapters: chCount }
  return serverData
}

// Push local → server (merge into server DB, never delete server data)
export async function pushToServer() {
  if (!_apiAvailable) throw new Error('API not available')
  const milestones = await loadMilestones()
  if (milestones.length === 0) {
    throw new Error('本地没有数据可推送')
  }

  // First pull server data to merge with local
  console.log('[sync] pushToServer: fetching server data first for merge…')
  const serverData = await apiExportSync()
  const serverMilestones = serverData.milestones || []
  const serverChapters = serverData.chapters || []

  // Merge: combine local and server milestones, local wins on conflict (same id)
  const serverMap = new Map(serverMilestones.map(m => [m.id, m]))
  for (const lm of milestones) {
    serverMap.set(lm.id, lm)
  }
  const mergedMilestones = Array.from(serverMap.values())

  // Same for chapters
  const { listChapters } = await import('../data/chapters')
  const localChapters = await listChapters()
  const serverChapterMap = new Map(serverChapters.map(c => [c.id, c]))
  for (const lc of localChapters) {
    serverChapterMap.set(lc.id, lc)
  }
  const mergedChapters = Array.from(serverChapterMap.values())

  console.log(`[sync] pushToServer: merged ${milestones.length} local + ${serverMilestones.length} server = ${mergedMilestones.length} milestones`)
  const payload = {
    milestones: mergedMilestones.map(({ photo_uri: _discard, ...m }) => ({
      ...m,
      has_photo: !!m.has_photo,
    })),
    chapters: mergedChapters.map(c => ({
      ...c,
      milestoneIds: Array.isArray(c.milestoneIds) ? c.milestoneIds : [],
    })),
  }
  await apiImportSync(payload)
  console.log('[sync] pushToServer: merged milestones pushed, now uploading media…')

  // Upload local media blobs after the metadata import. This repairs cases where
  // a milestone row reached the server before its blob upload completed.
  let mediaCount = 0
  for (const m of milestones) {
    if (m.has_photo) {
      try {
        const photo = await dbGetPhoto(m.id)
        if (photo) {
          if (!(await canDecodeImage(photo.blob))) {
            console.warn('[sync] pushToServer: local photo is not decodable for', m.id)
            continue
          }
          await uploadMediaToServer(m.id, 'photo', photo.blob)
          mediaCount++
        }
      } catch (err) {
        console.warn('[sync] pushToServer: photo upload failed for', m.id, err)
      }
    }

    if (m.media_type === 'audio' || m.media_type === 'video') {
      try {
        const media = await dbGetMedia(m.id) || await dbGetMedia(`${m.id}-${m.media_type}`)
        if (media) {
          await uploadMediaToServer(m.id, m.media_type, media.blob)
          mediaCount++
        }
      } catch (err) {
        console.warn('[sync] pushToServer: media upload failed for', m.id, err)
      }
    }
  }

  for (const m of mergedMilestones) {
    if (m.has_photo && !milestones.some(local => local.id === m.id)) {
      try {
        const photo = await dbGetPhoto(m.id)
        if (photo) {
          if (!(await canDecodeImage(photo.blob))) {
            console.warn('[sync] pushToServer: merged local photo is not decodable for', m.id)
            continue
          }
          await uploadMediaToServer(m.id, 'photo', photo.blob)
          mediaCount++
        }
      } catch (err) {
        console.warn('[sync] pushToServer: merged photo upload failed for', m.id, err)
      }
    }
    if ((m.media_type === 'audio' || m.media_type === 'video') && !milestones.some(local => local.id === m.id)) {
      try {
        const media = await dbGetMedia(m.id) || await dbGetMedia(`${m.id}-${m.media_type}`)
        if (media) {
          await uploadMediaToServer(m.id, m.media_type, media.blob)
          mediaCount++
        }
      } catch (err) {
        console.warn('[sync] pushToServer: merged media upload failed for', m.id, err)
      }
    }
  }

  console.log(`[sync] pushToServer: done (${mediaCount} media blobs uploaded)`)
  _lastSyncTime = new Date().toISOString()
  _serverStats = {
    milestones: mergedMilestones.length,
    chapters: mergedChapters.length,
  }
  return payload
}

// Full bidirectional sync: merge local ↔ server in both directions
export async function fullSync() {
  if (!_apiAvailable) throw new Error('API not available')
  
  // Always pull server data first and merge into local
  const serverData = await apiExportSync()
  await mergeMilestones(serverData.milestones || [])
  await mergeChapters(serverData.chapters || [])
  await syncPhotosFromServer(serverData.milestones || [])

  // Then push merged local data back to server (merge, don't replace)
  const localMilestones = await loadMilestones()
  if (localMilestones.length > 0) {
    await pushToServer()
    const mergedMsCount = serverData.milestones?.length || 0
    const total = Math.max(localMilestones.length, mergedMsCount)
    return { direction: 'merge', count: total }
  }

  return { direction: 'none', count: 0 }
}

// Refresh server stats without syncing
export async function refreshServerStats() {
  if (!_apiAvailable) {
    _serverStats = null
    return null
  }
  try {
    _serverStats = await apiStorage()
    return _serverStats
  } catch {
    _serverStats = null
    return null
  }
}

// Retry with exponential backoff (up to 3 tries)
export async function withRetry(fn, label = 'api', retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err
      if (err?.status === 404 || err?.status === 400) throw err
      await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, i), 16000)))
    }
  }
}
