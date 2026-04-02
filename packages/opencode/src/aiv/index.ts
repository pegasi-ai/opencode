import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { SessionID } from "@/session/schema"
import z from "zod"

export namespace AIV {
  // --- Core enums ---

  export const WorkType = z
    .enum(["bug-fix", "refactor", "feature", "test", "dependency", "config", "docs", "unknown"])
    .meta({ ref: "AIVWorkType" })
  export type WorkType = z.infer<typeof WorkType>

  export const Location = z
    .enum(["frontend", "api", "service", "database", "infrastructure", "tests", "config", "unknown"])
    .meta({ ref: "AIVLocation" })
  export type Location = z.infer<typeof Location>

  // --- Composite types ---

  export const Scope = z
    .object({
      files: z.number().describe("Number of files touched"),
      modules: z.number().describe("Number of distinct modules touched"),
    })
    .meta({ ref: "AIVScope" })
  export type Scope = z.infer<typeof Scope>

  export const Direction = z
    .object({
      previous: WorkType.nullable().describe("Previous work type before the change"),
      current: WorkType.describe("Current work type"),
      changedAt: z.number().nullable().describe("Timestamp of last strategy change"),
    })
    .meta({ ref: "AIVDirection" })
  export type Direction = z.infer<typeof Direction>

  export const WorkState = z
    .object({
      sessionID: SessionID.zod,
      intent: z.string().describe("Current objective of the agent"),
      workType: WorkType,
      location: Location,
      locations: Location.array().describe("All locations touched in this session"),
      scope: Scope,
      direction: Direction,
      active: z.boolean().describe("Whether the agent is currently working"),
      time: z.object({
        started: z.number().describe("When the current work began"),
        updated: z.number().describe("Last state update"),
      }),
    })
    .meta({ ref: "AIVWorkState" })
  export type WorkState = z.infer<typeof WorkState>

  // --- Events ---

  export const Event = {
    Updated: BusEvent.define(
      "aiv.updated",
      z.object({
        sessionID: SessionID.zod,
        state: WorkState,
      }),
    ),
  }

  // --- Internal state ---

  const states = new Map<string, WorkState>()

  // --- Classification logic ---

  const WORK_TYPE_KEYWORDS: Record<WorkType, string[]> = {
    "bug-fix": ["fix", "bug", "patch", "hotfix", "repair", "resolve", "issue", "error", "broken"],
    refactor: ["refactor", "restructure", "reorganize", "clean up", "simplify", "extract", "rename", "move"],
    feature: ["add", "implement", "create", "build", "new", "feature", "introduce"],
    test: ["test", "spec", "assert", "expect", "coverage", "mock", "stub"],
    dependency: ["upgrade", "dependency", "package", "install", "bump", "update dep", "npm", "bun add"],
    config: ["config", "setting", "env", "environment", "ci", "cd", "pipeline", "yaml", "toml", "json config"],
    docs: ["doc", "readme", "comment", "jsdoc", "tsdoc", "documentation"],
    unknown: [],
  }

  const LOCATION_PATTERNS: Record<Location, RegExp[]> = {
    frontend: [/\bapp\//, /\bweb\//, /\bui\//, /\.tsx$/, /\.jsx$/, /\.css$/, /\.scss$/, /components?\//],
    api: [/\bserver\//, /\broutes?\//, /\bapi\//, /\bendpoints?\//, /\bhono/],
    service: [/\bservice\//, /\bsrc\//, /\blib\//, /\bcore\//, /\butil\//],
    database: [/\.sql/, /\bmigration\//, /\bstorage\//, /\bdb\//, /drizzle/],
    infrastructure: [/\binfra\//, /\bdeploy\//, /\bci\//, /Dockerfile/, /\.github\//, /sst\.config/],
    tests: [/\.test\./, /\.spec\./, /\btest\//, /\b__tests__\//],
    config: [/\.config\./, /\.env/, /tsconfig/, /package\.json$/, /turbo\.json/],
    unknown: [],
  }

  export function classifyWorkType(text: string): WorkType {
    const lower = text.toLowerCase()
    let best: WorkType = "unknown"
    let bestScore = 0
    for (const [type, keywords] of Object.entries(WORK_TYPE_KEYWORDS) as [WorkType, string[]][]) {
      const score = keywords.filter((kw) => lower.includes(kw)).length
      if (score > bestScore) {
        bestScore = score
        best = type
      }
    }
    return best
  }

  export function classifyLocation(filePath: string): Location {
    for (const [location, patterns] of Object.entries(LOCATION_PATTERNS) as [Location, RegExp[]][]) {
      if (location === "unknown") continue
      if (patterns.some((p) => p.test(filePath))) return location
    }
    return "unknown"
  }

  export function classifyLocations(filePaths: string[]): Location[] {
    const locations = new Set<Location>()
    for (const fp of filePaths) {
      locations.add(classifyLocation(fp))
    }
    locations.delete("unknown")
    return locations.size > 0 ? [...locations] : ["unknown"]
  }

  function dominantLocation(filePaths: string[]): Location {
    const counts = new Map<Location, number>()
    for (const fp of filePaths) {
      const loc = classifyLocation(fp)
      counts.set(loc, (counts.get(loc) ?? 0) + 1)
    }
    let best: Location = "unknown"
    let bestCount = 0
    for (const [loc, count] of counts) {
      if (count > bestCount) {
        bestCount = count
        best = loc
      }
    }
    return best
  }

  function countModules(filePaths: string[]): number {
    const modules = new Set<string>()
    for (const fp of filePaths) {
      // Extract top-level directory as module identifier
      const parts = fp.split("/").filter(Boolean)
      if (parts.length >= 2) {
        modules.add(parts.slice(0, 2).join("/"))
      } else if (parts.length === 1) {
        modules.add(parts[0])
      }
    }
    return modules.size
  }

  // --- State management ---

  function makeDefaultState(sessionID: SessionID): WorkState {
    const now = Date.now()
    return {
      sessionID,
      intent: "Starting...",
      workType: "unknown",
      location: "unknown",
      locations: [],
      scope: { files: 0, modules: 0 },
      direction: { previous: null, current: "unknown", changedAt: null },
      active: true,
      time: { started: now, updated: now },
    }
  }

  export function ingestMessage(input: {
    sessionID: SessionID
    text?: string
    files?: string[]
    toolName?: string
    active?: boolean
  }) {
    const existing = states.get(input.sessionID) ?? makeDefaultState(input.sessionID)
    const now = Date.now()

    // Update intent from text
    if (input.text) {
      // Take first meaningful line as intent summary
      const lines = input.text.split("\n").filter((l) => l.trim().length > 0)
      if (lines.length > 0) {
        existing.intent = lines[0].slice(0, 200)
      }
    }

    // Classify work type from text
    if (input.text) {
      const newType = classifyWorkType(input.text)
      if (newType !== "unknown" && newType !== existing.workType) {
        // Strategy change detected
        if (existing.workType !== "unknown") {
          existing.direction = {
            previous: existing.workType,
            current: newType,
            changedAt: now,
          }
        } else {
          existing.direction = {
            previous: null,
            current: newType,
            changedAt: null,
          }
        }
        existing.workType = newType
      }
    }

    // Update location and scope from files
    if (input.files && input.files.length > 0) {
      const allFiles = new Set([...input.files])
      existing.location = dominantLocation(input.files)
      existing.locations = classifyLocations(input.files)
      existing.scope = {
        files: allFiles.size,
        modules: countModules(input.files),
      }
    }

    // Update active status
    if (input.active !== undefined) {
      existing.active = input.active
    }

    existing.time.updated = now

    states.set(input.sessionID, existing)
    Bus.publish(Event.Updated, { sessionID: input.sessionID, state: existing })

    return existing
  }

  // --- Queries ---

  export function get(sessionID: SessionID): WorkState | undefined {
    return states.get(sessionID)
  }

  export function list(): WorkState[] {
    return [...states.values()]
  }

  export function remove(sessionID: SessionID) {
    states.delete(sessionID)
  }
}
