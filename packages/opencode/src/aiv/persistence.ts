import { eq, desc } from "drizzle-orm"
import { Database } from "@/storage/db"
import { AivEventTable, AivStateTable } from "./aiv.sql"
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import type { SessionID } from "@/session/schema"
import type { AivSchema } from "./schema"

const log = Log.create({ service: "aiv-persistence" })

/**
 * Persistence layer for AIV events and state.
 * Called by the in-memory state manager (AivState) to durably store
 * events and state snapshots.
 */
export namespace AivPersistence {
  /** Append an event to the log. */
  export function appendEvent(input: {
    sessionID: string
    type: string
    summary?: string
    workType?: string
    location?: string
    scopeFiles?: number
    scopeModules?: number
    previousWorkType?: string
    newWorkType?: string
  }) {
    try {
      return Database.transaction((tx) => {
        const id = Identifier.ascending("event")
        tx.insert(AivEventTable)
          .values({
            id,
            session_id: input.sessionID as SessionID,
            type: input.type,
            summary: input.summary ?? null,
            work_type: input.workType ?? null,
            location: input.location ?? null,
            scope_files: input.scopeFiles ?? null,
            scope_modules: input.scopeModules ?? null,
            previous_work_type: input.previousWorkType ?? null,
            new_work_type: input.newWorkType ?? null,
          })
          .run()
        return { id }
      })
    } catch (e) {
      log.error("failed to append event", { error: e })
      return undefined
    }
  }

  /** Upsert the materialized state snapshot for a session. */
  export function upsertState(input: {
    sessionID: string
    summary?: string
    workType: string
    location: string
    scopeFiles: number
    scopeModules: number
    strategyChanges: AivSchema.StrategyChange[]
  }) {
    try {
      Database.transaction((tx) => {
        const existing = tx
          .select()
          .from(AivStateTable)
          .where(eq(AivStateTable.session_id, input.sessionID as SessionID))
          .get()

        if (existing) {
          tx.update(AivStateTable)
            .set({
              summary: input.summary ?? existing.summary,
              work_type: input.workType,
              location: input.location,
              scope_files: input.scopeFiles,
              scope_modules: input.scopeModules,
              strategy_changes: input.strategyChanges,
            })
            .where(eq(AivStateTable.session_id, input.sessionID as SessionID))
            .run()
        } else {
          tx.insert(AivStateTable)
            .values({
              session_id: input.sessionID as SessionID,
              summary: input.summary ?? null,
              work_type: input.workType,
              location: input.location,
              scope_files: input.scopeFiles,
              scope_modules: input.scopeModules,
              strategy_changes: input.strategyChanges,
            })
            .run()
        }
      })
    } catch (e) {
      log.error("failed to upsert state", { error: e })
    }
  }

  /** Get the event timeline for a session, most recent first. */
  export function timeline(sessionID: string, limit = 100) {
    return Database.use((db) =>
      db
        .select()
        .from(AivEventTable)
        .where(eq(AivEventTable.session_id, sessionID as SessionID))
        .orderBy(desc(AivEventTable.time_created))
        .limit(limit)
        .all()
        .map((r) => ({
          id: r.id,
          sessionID: r.session_id,
          type: r.type,
          summary: r.summary,
          workType: r.work_type,
          location: r.location,
          scopeFiles: r.scope_files,
          scopeModules: r.scope_modules,
          previousWorkType: r.previous_work_type,
          newWorkType: r.new_work_type,
          timeCreated: r.time_created,
        })),
    )
  }

  /** Remove persisted state and events for a session. */
  export function clear(sessionID: string) {
    try {
      Database.transaction((tx) => {
        tx.delete(AivStateTable)
          .where(eq(AivStateTable.session_id, sessionID as SessionID))
          .run()
        tx.delete(AivEventTable)
          .where(eq(AivEventTable.session_id, sessionID as SessionID))
          .run()
      })
    } catch (e) {
      log.error("failed to clear state", { error: e })
    }
  }
}
