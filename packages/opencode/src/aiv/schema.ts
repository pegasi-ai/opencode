import z from "zod"
import { SessionID } from "@/session/schema"

export namespace AivSchema {
  export const WorkType = z
    .enum(["bug-fix", "refactor", "feature", "test", "dependency", "config", "docs", "unknown"])
    .meta({ ref: "AivWorkType" })
  export type WorkType = z.infer<typeof WorkType>

  export const Location = z
    .enum(["frontend", "api", "service", "database", "infrastructure", "tests", "config", "unknown"])
    .meta({ ref: "AivLocation" })
  export type Location = z.infer<typeof Location>

  export const Scope = z
    .object({
      files: z.number().int().min(0),
      modules: z.number().int().min(0),
    })
    .meta({ ref: "AivScope" })
  export type Scope = z.infer<typeof Scope>

  export const StrategyChange = z
    .object({
      from: WorkType,
      to: WorkType,
      timestamp: z.number(),
    })
    .meta({ ref: "AivStrategyChange" })
  export type StrategyChange = z.infer<typeof StrategyChange>

  export const Intent = z
    .object({
      sessionID: SessionID.zod,
      summary: z.string(),
      workType: WorkType,
      location: Location,
      scope: Scope,
      strategyChanges: StrategyChange.array(),
      timestamp: z.number(),
    })
    .meta({ ref: "AivIntent" })
  export type Intent = z.infer<typeof Intent>

  export const empty = (sessionID: string): Intent => ({
    sessionID: sessionID as SessionID,
    summary: "",
    workType: "unknown",
    location: "unknown",
    scope: { files: 0, modules: 0 },
    strategyChanges: [],
    timestamp: Date.now(),
  })
}
