import type { AivSchema } from "./schema"

/**
 * Heuristic classifiers that derive intent metadata from tool calls and file paths.
 * These run synchronously on every tool/part update to keep the AIV state current.
 */

const LOCATION_PATTERNS: Array<[RegExp, AivSchema.Location]> = [
  [/\.(tsx?|jsx?|css|scss|svelte|vue|html)$/i, "frontend"],
  [/\/(components?|pages?|views?|layouts?|app)\//i, "frontend"],
  [/\/src\/server\//i, "api"],
  [/\/(api|routes?|controllers?|handlers?|middleware)\//i, "api"],
  [/\/(services?|workers?|jobs?|queue)\//i, "service"],
  [/\.(sql|migration)$/i, "database"],
  [/\/(db|database|storage|migration|drizzle)\//i, "database"],
  [/\/(infra|deploy|docker|k8s|terraform|nix)\//i, "infrastructure"],
  [/\.(test|spec)\.(tsx?|jsx?|py|go|rs)$/i, "tests"],
  [/\/__tests__\//i, "tests"],
  [/\.(json|ya?ml|toml|ini|env)$/i, "config"],
  [/\/(config|\.config)\//i, "config"],
]

const WORK_TYPE_SIGNALS: Array<[RegExp, AivSchema.WorkType]> = [
  [/\bfix(es|ed|ing)?\b/i, "bug-fix"],
  [/\bbug\b/i, "bug-fix"],
  [/\berror\b/i, "bug-fix"],
  [/\brefactor(s|ed|ing)?\b/i, "refactor"],
  [/\bclean\s?up\b/i, "refactor"],
  [/\brename\b/i, "refactor"],
  [/\bfeat(ure)?\b/i, "feature"],
  [/\badd(s|ed|ing)?\b/i, "feature"],
  [/\bimplement\b/i, "feature"],
  [/\btest(s|ed|ing)?\b/i, "test"],
  [/\b(dep|dependency|dependencies|upgrade|bump)\b/i, "dependency"],
  [/\bpackage\.json\b/i, "dependency"],
  [/\b(config|configuration|setting)\b/i, "config"],
  [/\b(doc|docs|documentation|readme)\b/i, "docs"],
]

export function classifyLocation(filePath: string): AivSchema.Location {
  for (const [pattern, location] of LOCATION_PATTERNS) {
    if (pattern.test(filePath)) return location
  }
  return "unknown"
}

export function classifyWorkType(text: string): AivSchema.WorkType {
  for (const [pattern, workType] of WORK_TYPE_SIGNALS) {
    if (pattern.test(text)) return workType
  }
  return "unknown"
}

export function classifyLocationFromPaths(paths: string[]): AivSchema.Location {
  const counts = new Map<AivSchema.Location, number>()
  for (const p of paths) {
    const loc = classifyLocation(p)
    counts.set(loc, (counts.get(loc) ?? 0) + 1)
  }

  let best: AivSchema.Location = "unknown"
  let bestCount = 0
  for (const [loc, count] of counts) {
    if (loc !== "unknown" && count > bestCount) {
      best = loc
      bestCount = count
    }
  }
  return best
}

export function countModules(paths: string[]): number {
  const modules = new Set<string>()
  for (const p of paths) {
    // Extract top-level directory as a rough "module" identifier
    const parts = p.replace(/^\//, "").split("/")
    if (parts.length >= 2) {
      modules.add(parts.slice(0, 2).join("/"))
    }
  }
  return modules.size
}
