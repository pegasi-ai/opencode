import z from "zod"
import { eq, desc } from "drizzle-orm"
import { Database } from "../storage/db"
import { AivEventTable, AivStateTable } from "./aiv.sql"
import { Identifier } from "../id/id"
import type { SessionID } from "../session/schema"

/**
 * AIV persistence layer.
 *
 * Provides durable storage for agent intent events and state snapshots.
 * Designed to be called by the in-memory state manager (Agent 2/5) to
 * persist events as they flow through the bus, and to serve historical
 * timeline queries that in-memory state cannot answer.
 */
export namespace AivPersistence {
  // --- Shared type definitions (aligned with Agent 2 + Agent 5) ---

  export const WorkType = z.enum(["bug-fix", "refactor", "feature", "test", "dependency", "config", "docs", "unknown"])
  export type WorkType = z.infer<typeof WorkType>

  export const LocationType = z.enum([
    "frontend",
    "api",
    "service",
    "database",
    "infrastructure",
    "tests",
    "config",
    "unknown",
  ])
  export type LocationType = z.infer<typeof LocationType>

  export const StrategyChange = z.object({
    from: WorkType,
    to: WorkType,
    timestamp: z.number(),
  })
  export type StrategyChange = z.infer<typeof StrategyChange>

  // --- Event types matching Agent 5's bus events ---

  export const AivEventType = z.enum([
    "aiv.intent.updated",
    "aiv.strategy.changed",
    "aiv.scope.changed",
    "aiv.cleared",
  ])
  export type AivEventType = z.infer<typeof AivEventType>

  // --- Input/output schemas ---

  export const EventInput = z
    .object({
      sessionID: z.string(),
      type: AivEventType,
      summary: z.string().optional(),
      workType: WorkType.optional(),
      location: LocationType.optional(),
      scopeFiles: z.number().int().optional(),
      scopeModules: z.number().int().optional(),
      previousWorkType: WorkType.optional(),
      newWorkType: WorkType.optional(),
    })
    .meta({ ref: "AivEventInput" })

  export const EventInfo = z
    .object({
      id: z.string(),
      sessionID: z.string(),
      type: z.string(),
      summary: z.string().nullable(),
      workType: z.string().nullable(),
      location: z.string().nullable(),
      scopeFiles: z.number().nullable(),
      scopeModules: z.number().nullable(),
      previousWorkType: z.string().nullable(),
      newWorkType: z.string().nullable(),
      timeCreated: z.number(),
    })
    .meta({ ref: "AivEvent" })

  export const StateInput = z
    .object({
      sessionID: z.string(),
      summary: z.string().optional(),
      workType: WorkType,
      location: LocationType,
      scopeFiles: z.number().int(),
      scopeModules: z.number().int(),
      strategyChanges: StrategyChange.array(),
    })
    .meta({ ref: "AivStateInput" })

  export const StateInfo = z
    .object({
      sessionID: z.string(),
      summary: z.string().nullable(),
      workType: z.string(),
      location: z.string(),
      scopeFiles: z.number(),
      scopeModules: z.number(),
      strategyChanges: StrategyChange.array().nullable(),
      timeCreated: z.number(),
      timeUpdated: z.number(),
    })
    .meta({ ref: "AivState" })

  // --- Persistence functions ---

  /** Append an event to the log. Called by the state manager on each bus event. */
  export function appendEvent(input: z.infer<typeof EventInput>) {
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
  }

  /** Upsert the materialized state snapshot for a session. Called after in-memory state updates. */
  export function upsertState(input: z.infer<typeof StateInput>) {
    return Database.transaction((tx) => {
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
  }

  /** Get the event timeline for a session, most recent first. */
  export function timeline(sessionID: string, limit = 100) {
    return Database.use((db) => {
      const rows = db
        .select()
        .from(AivEventTable)
        .where(eq(AivEventTable.session_id, sessionID as SessionID))
        .orderBy(desc(AivEventTable.time_created))
        .limit(limit)
        .all()

      return rows.map((r) => ({
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
      }))
    })
  }

  /** Get persisted state for a session (for recovery or history). */
  export function getState(sessionID: string) {
    return Database.use((db) => {
      const row = db
        .select()
        .from(AivStateTable)
        .where(eq(AivStateTable.session_id, sessionID as SessionID))
        .get()

      if (!row) return null

      return {
        sessionID: row.session_id,
        summary: row.summary,
        workType: row.work_type,
        location: row.location,
        scopeFiles: row.scope_files,
        scopeModules: row.scope_modules,
        strategyChanges: row.strategy_changes,
        timeCreated: row.time_created,
        timeUpdated: row.time_updated,
      }
    })
  }

  /** List all persisted states, most recently updated first. */
  export function listStates() {
    return Database.use((db) => {
      const rows = db.select().from(AivStateTable).orderBy(desc(AivStateTable.time_updated)).all()

      return rows.map((row) => ({
        sessionID: row.session_id,
        summary: row.summary,
        workType: row.work_type,
        location: row.location,
        scopeFiles: row.scope_files,
        scopeModules: row.scope_modules,
        strategyChanges: row.strategy_changes,
        timeCreated: row.time_created,
        timeUpdated: row.time_updated,
      }))
    })
  }

  /** Remove persisted state and events for a session. */
  export function clear(sessionID: string) {
    return Database.transaction((tx) => {
      tx.delete(AivStateTable)
        .where(eq(AivStateTable.session_id, sessionID as SessionID))
        .run()
      tx.delete(AivEventTable)
        .where(eq(AivEventTable.session_id, sessionID as SessionID))
        .run()
    })
  }
}
