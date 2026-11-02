import {
  createChapter, getChapter, listChapters, updateChapter, deleteChapter,
  addMilestoneToChapter, removeMilestoneFromChapter,
  getMilestonesInChapter, getChaptersForMilestone,
} from './chapters'
import { loadMilestones } from './milestones'
import { apiHealth, apiExportSync, apiImportSync } from '../lib/api'
import { setApiAvailable } from '../lib/sync'

export function registerDevtools() {
  window.lg = {
    help() {
      console.log(`
时光墙 Phase 1 devtools  (window.lg)
─────────────────────────────────────────
Chapter CRUD
  lg.createChapter({ title, start, end, color, description?, defaultMemberVisibility?, parentChapterId? })
  lg.getChapter(id)
  lg.listChapters()
  lg.updateChapter(id, { ...fields })
  lg.deleteChapter(id)

Membership
  lg.addMilestoneToChapter(chapterId, milestoneId)
  lg.removeMilestoneFromChapter(chapterId, milestoneId)
  lg.getMilestonesInChapter(chapterId)
  lg.getChaptersForMilestone(milestoneId)

Migration
  lg.checkMigration()

Sync (v1.6+)
  lg.apiCheck()      - test backend connectivity
  lg.apiExport()     - dump server data to console
  lg.apiImport()     - push local data to server
  lg.apiImportForce() - push and replace server data

All functions return Promises; await them or check the console.
      `.trim())
    },

    async createChapter(fields) {
      const chapter = await createChapter(fields)
      console.log('[lg.createChapter] written to IDB:', chapter)
      return chapter
    },

    async getChapter(id) {
      const chapter = await getChapter(id)
      console.log('[lg.getChapter] read from IDB:', chapter)
      return chapter
    },

    async listChapters() {
      const chapters = await listChapters()
      console.log('[lg.listChapters] read from IDB:', chapters)
      return chapters
    },

    async updateChapter(id, updates) {
      const existing = await getChapter(id)
      if (!existing) { console.error('[lg.updateChapter] chapter not found:', id); return null }
      const chapter = await updateChapter(id, updates, existing)
      console.log('[lg.updateChapter] written to IDB:', chapter)
      return chapter
    },

    async deleteChapter(id) {
      await deleteChapter(id)
      console.log('[lg.deleteChapter] deleted chapter id:', id)
    },

    async addMilestoneToChapter(chapterId, milestoneId) {
      const chapter = await addMilestoneToChapter(chapterId, milestoneId)
      console.log('[lg.addMilestoneToChapter] chapter milestoneIds:', chapter.milestoneIds)
      return chapter
    },

    async removeMilestoneFromChapter(chapterId, milestoneId) {
      const chapter = await removeMilestoneFromChapter(chapterId, milestoneId)
      console.log('[lg.removeMilestoneFromChapter] chapter milestoneIds:', chapter.milestoneIds)
      return chapter
    },

    async getMilestonesInChapter(chapterId) {
      const ids = await getMilestonesInChapter(chapterId)
      console.log('[lg.getMilestonesInChapter] milestoneIds:', ids)
      return ids
    },

    async getChaptersForMilestone(milestoneId) {
      const chapters = await getChaptersForMilestone(milestoneId)
      console.log('[lg.getChaptersForMilestone] chapters:', chapters)
      return chapters
    },

    async checkMigration() {
      const milestones = await loadMilestones()
      console.log('[lg.checkMigration] total milestones:', milestones.length)
      if (milestones.length > 0) {
        const sample = milestones[0]
        console.log('[lg.checkMigration] sample milestone.mainTimelineVisibility:', sample.mainTimelineVisibility)
        console.log('[lg.checkMigration] sample milestone:', sample)
        const allHaveField = milestones.every(m => 'mainTimelineVisibility' in m)
        console.log('[lg.checkMigration] all milestones have mainTimelineVisibility:', allHaveField)
      } else {
        console.log('[lg.checkMigration] no milestones found — new install')
      }
      return milestones
    },

    // ── Sync tools ───────────────────────────────────────────────────
    async apiCheck() {
      const ok = await apiHealth()
      console.log(`[lg.apiCheck] backend reachable: ${ok}`)
      setApiAvailable(ok)
      return ok
    },

    async apiExport() {
      const data = await apiExportSync()
      console.log('[lg.apiExport] server data:', data)
      return data
    },

    async apiImport() {
      const milestones = await loadMilestones()
      const chapters   = await listChapters()
      const payload = { milestones, chapters }
      const result = await apiImportSync(payload)
      console.log('[lg.apiImport] pushed:', result)
      return result
    },

    async apiImportForce() {
      await this.apiImport()
      console.log('[lg.apiImportForce] done — server now matches local')
    },
  }

  console.log('[时光墙 devtools] window.lg ready — run lg.help() for usage')
}
