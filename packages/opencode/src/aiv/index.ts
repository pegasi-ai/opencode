import z from "zod"
import { eq, desc } from "drizzle-orm"
import { Database } from "../storage/db"
import { AivEventTable, AivStateTable } from "./aiv.sql"
import { Identifier } from "../id/id"
import { Bus } from "../bus"
import { BusEvent } from "../bus/bus-event"
import type { SessionID } from "../session/schema"

export namespace Aiv {
  // --- Zod schemas for validation and API docs ---

  export const WorkType = z.enum(["bug_fix", "refactor", "feature", "test", "dependency", "config"])
  export type WorkType = z.infer<typeof WorkType>

  export const Location = z.enum(["frontend", "api", "service", "database", "infrastructure", "tests"])
  export type Location = z.infer<typeof Location>

  export const EventType = z.enum(["intent.changed", "work.started", "work.completed", "strategy.changed"])
  export type EventType = z.infer<typeof EventType>

  export const EventInput = z
    .object({
      sessionID: z.string(),
      type: EventType,
      intent: z.string().optional(),
      workType: WorkType.optional(),
      location: Location.optional(),
      scopeFiles: z.number().int().optional(),
      scopeModules: z.number().int().optional(),
      previousWorkType: WorkType.optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .meta({ ref: "AivEventInput" })

  export const EventInfo = z
    .object({
      id: z.string(),
      sessionID: z.string(),
      type: z.string(),
      intent: z.string().nullable(),
      workType: z.string().nullable(),
      location: z.string().nullable(),
      scopeFiles: z.number().nullable(),
      scopeModules: z.number().nullable(),
      previousWorkType: z.string().nullable(),
      metadata: z.record(z.string(), z.unknown()).nullable(),
      timeCreated: z.number(),
    })
    .meta({ ref: "AivEvent" })

  export const StateInfo = z
    .object({
      sessionID: z.string(),
      intent: z.string().nullable(),
      workType: z.string().nullable(),
      location: z.string().nullable(),
      scopeFiles: z.number(),
      scopeModules: z.number(),
      strategyChanges: z.number(),
      timeCreated: z.number(),
      timeUpdated: z.number(),
    })
    .meta({ ref: "AivState" })

  // --- Bus events ---

  export const Event = {
    Updated: BusEvent.define(
      "aiv.updated",
      z.object({
        sessionID: z.string(),
      }),
    ),
  }

  // --- Persistence functions ---

  export function append(input: z.infer<typeof EventInput>) {
    return Database.transaction((tx) => {
      const id = Identifier.ascending("event")

      // Insert append-only event
      tx.insert(AivEventTable)
        .values({
          id,
          session_id: input.sessionID as SessionID,
          type: input.type,
          intent: input.intent ?? null,
          work_type: input.workType ?? null,
          location: input.location ?? null,
          scope_files: input.scopeFiles ?? null,
          scope_modules: input.scopeModules ?? null,
          previous_work_type: input.previousWorkType ?? null,
          metadata: input.metadata ?? null,
        })
        .run()

      // Upsert current state
      const strategyIncrement = input.type === "strategy.changed" ? 1 : 0
      const existing = tx
        .select()
        .from(AivStateTable)
        .where(eq(AivStateTable.session_id, input.sessionID as SessionID))
        .get()

      if (existing) {
        tx.update(AivStateTable)
          .set({
            intent: input.intent ?? existing.intent,
            work_type: input.workType ?? existing.work_type,
            location: input.location ?? existing.location,
            scope_files: input.scopeFiles ?? existing.scope_files,
            scope_modules: input.scopeModules ?? existing.scope_modules,
            strategy_changes: existing.strategy_changes + strategyIncrement,
          })
          .where(eq(AivStateTable.session_id, input.sessionID as SessionID))
          .run()
      } else {
        tx.insert(AivStateTable)
          .values({
            session_id: input.sessionID as SessionID,
            intent: input.intent ?? null,
            work_type: input.workType ?? null,
            location: input.location ?? null,
            scope_files: input.scopeFiles ?? 0,
            scope_modules: input.scopeModules ?? 0,
            strategy_changes: strategyIncrement,
          })
          .run()
      }

      Database.effect(() => {
        Bus.publish(Event.Updated, { sessionID: input.sessionID })
      })

      return { id }
    })
  }

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
        intent: r.intent,
        workType: r.work_type,
        location: r.location,
        scopeFiles: r.scope_files,
        scopeModules: r.scope_modules,
        previousWorkType: r.previous_work_type,
        metadata: r.metadata,
        timeCreated: r.time_created,
      }))
    })
  }

  export function state(sessionID: string) {
    return Database.use((db) => {
      const row = db
        .select()
        .from(AivStateTable)
        .where(eq(AivStateTable.session_id, sessionID as SessionID))
        .get()

      if (!row) return null

      return {
        sessionID: row.session_id,
        intent: row.intent,
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

  export function listStates() {
    return Database.use((db) => {
      const rows = db.select().from(AivStateTable).orderBy(desc(AivStateTable.time_updated)).all()

      return rows.map((row) => ({
        sessionID: row.session_id,
        intent: row.intent,
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
}
