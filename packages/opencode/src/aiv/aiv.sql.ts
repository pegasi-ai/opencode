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
    /** e.g. "intent.changed", "work.started", "work.completed", "strategy.changed" */
    type: text().notNull(),
    /** Current intent description */
    intent: text(),
    /** Work type: bug_fix, refactor, feature, test, dependency, config */
    work_type: text(),
    /** Location: frontend, api, service, database, infrastructure, tests */
    location: text(),
    /** Number of files affected */
    scope_files: integer(),
    /** Number of modules affected */
    scope_modules: integer(),
    /** Previous work type (for strategy changes) */
    previous_work_type: text(),
    /** Arbitrary metadata */
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
    ...Timestamps,
  },
  (table) => [
    index("aiv_event_session_idx").on(table.session_id),
    index("aiv_event_session_time_idx").on(table.session_id, table.time_created),
    index("aiv_event_type_idx").on(table.type),
  ],
)

/** Current work state per session (upserted on each event) */
export const AivStateTable = sqliteTable("aiv_state", {
  session_id: text()
    .$type<SessionID>()
    .primaryKey()
    .references(() => SessionTable.id, { onDelete: "cascade" }),
  intent: text(),
  work_type: text(),
  location: text(),
  scope_files: integer().notNull().default(0),
  scope_modules: integer().notNull().default(0),
  strategy_changes: integer().notNull().default(0),
  ...Timestamps,
})
