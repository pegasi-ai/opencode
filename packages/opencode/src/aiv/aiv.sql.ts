import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { SessionTable } from "../session/session.sql"
import { Timestamps } from "../storage/schema.sql"
import type { SessionID } from "../session/schema"

/** Append-only log of agent activity events */
export const AivEventTable = sqliteTable(
  "aiv_event",
  {
    id: text().primaryKey(),
    session_id: text()
      .$type<SessionID>()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    /** Bus event type: aiv.intent.updated, aiv.strategy.changed, aiv.scope.changed, aiv.cleared */
    type: text().notNull(),
    /** Intent summary text */
    summary: text(),
    /** Work type: bug-fix, refactor, feature, test, dependency, config, docs, unknown */
    work_type: text(),
    /** Location: frontend, api, service, database, infrastructure, tests, config, unknown */
    location: text(),
    /** Number of files affected */
    scope_files: integer(),
    /** Number of modules affected */
    scope_modules: integer(),
    /** Previous work type (for strategy changes) */
    previous_work_type: text(),
    /** New work type (for strategy changes) */
    new_work_type: text(),
    ...Timestamps,
  },
  (table) => [
    index("aiv_event_session_time_idx").on(table.session_id, table.time_created),
  ],
)

/** Materialized current state per session (upserted from in-memory state) */
export const AivStateTable = sqliteTable(
  "aiv_state",
  {
    session_id: text()
      .$type<SessionID>()
      .primaryKey()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    summary: text(),
    work_type: text().notNull().default("unknown"),
    location: text().notNull().default("unknown"),
    scope_files: integer().notNull().default(0),
    scope_modules: integer().notNull().default(0),
    strategy_changes: text({ mode: "json" }).$type<{ from: string; to: string; timestamp: number }[]>(),
    ...Timestamps,
  },
  (table) => [index("aiv_state_time_updated_idx").on(table.time_updated)],
)
