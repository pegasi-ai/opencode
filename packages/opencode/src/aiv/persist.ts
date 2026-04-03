import { Log } from "@/util/log"
import type { AivSchema } from "./schema"

const log = Log.create({ service: "aiv" })

/**
 * Persistence hooks for the AIV state manager.
 *
 * When Agent 3's AivPersistence module is available, register it here
 * via `setPersistence()`. The state manager calls these on every update.
 * If no persistence layer is registered, calls are silently skipped
 * (memory-only mode).
 */

interface PersistenceAdapter {
  appendEvent(input: {
    sessionID: string
    type: string
    summary?: string
    workType?: string
    location?: string
    scopeFiles?: number
    scopeModules?: number
    previousWorkType?: string
    newWorkType?: string
  }): void

  upsertState(input: {
    sessionID: string
    summary?: string
    workType: string
    location: string
    scopeFiles: number
    scopeModules: number
    strategyChanges: Array<{ from: string; to: string; timestamp: number }>
  }): void

  clear(sessionID: string): void
}

let adapter: PersistenceAdapter | null = null

/** Register the persistence adapter (called once Agent 3's module is available). */
export function setPersistence(impl: PersistenceAdapter) {
  adapter = impl
  log.info("AIV persistence adapter registered")
}

export function persistEvent(
  type: "aiv.intent.updated" | "aiv.strategy.changed" | "aiv.scope.changed" | "aiv.cleared",
  sessionID: string,
  intent: AivSchema.Intent,
  strategyChange?: { from: string; to: string },
) {
  if (!adapter) return
  try {
    adapter.appendEvent({
      sessionID,
      type,
      summary: intent.summary || undefined,
      workType: intent.workType,
      location: intent.location,
      scopeFiles: intent.scope.files,
      scopeModules: intent.scope.modules,
      previousWorkType: strategyChange?.from,
      newWorkType: strategyChange?.to,
    })
  } catch (e) {
    log.error("failed to persist AIV event", { error: e })
  }
}

export function persistState(sessionID: string, intent: AivSchema.Intent) {
  if (!adapter) return
  try {
    adapter.upsertState({
      sessionID,
      summary: intent.summary || undefined,
      workType: intent.workType,
      location: intent.location,
      scopeFiles: intent.scope.files,
      scopeModules: intent.scope.modules,
      strategyChanges: intent.strategyChanges,
    })
  } catch (e) {
    log.error("failed to persist AIV state", { error: e })
  }
}

export function persistClear(sessionID: string) {
  if (!adapter) return
  try {
    adapter.clear(sessionID)
  } catch (e) {
    log.error("failed to clear persisted AIV data", { error: e })
  }
}
