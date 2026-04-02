import type { AivSchema } from "./schema"

/**
 * Heuristic classifiers that derive intent metadata from tool calls and file paths.
 * These run synchronously on every tool/part update to keep the AIV state current.
 *
 * Design principles (per coordination plan):
 * - Use file path structure, not just extensions (.ts is NOT always frontend)
 * - Use word-boundary regex, not substring matching
 * - Check more specific patterns before general ones
 * - Weight signals — "fix" in a commit-like message is stronger than in a variable name
 */

// Ordered most-specific first. First match wins.
const LOCATION_PATTERNS: Array<[RegExp, AivSchema.Location]> = [
  // Tests — check before other categories since test files live everywhere
  [/\.(test|spec)\.\w+$/i, "tests"],
  [/\/__tests__\//i, "tests"],
  [/\/test\//i, "tests"],

  // Database — specific directory/file patterns
  [/\.sql$/i, "database"],
  [/\/migration\//i, "database"],
  [/\/storage\//i, "database"],
  [/\/drizzle\//i, "database"],
  [/\bsession\.sql\b/i, "database"],

  // Infrastructure — deployment and build
  [/\/infra\//i, "infrastructure"],
  [/\/deploy\//i, "infrastructure"],
  [/\bDockerfile\b/i, "infrastructure"],
  [/\/\.github\//i, "infrastructure"],
  [/\/nix\//i, "infrastructure"],
  [/\bsst\.config/i, "infrastructure"],
  [/\/containers\//i, "infrastructure"],

  // Config — specific config files (before general patterns)
  [/\btsconfig\b/i, "config"],
  [/\bpackage\.json$/i, "config"],
  [/\bturbo\.json$/i, "config"],
  [/\.config\.\w+$/i, "config"],
  [/\.\benv\b/i, "config"],
  [/\.(ya?ml|toml|ini)$/i, "config"],

  // API/Server — directory-based, not extension-based
  [/\/server\/routes?\//i, "api"],
  [/\/server\/middleware\//i, "api"],
  [/\/src\/server\//i, "api"],
  [/\/api\//i, "api"],
  [/\/routes?\//i, "api"],

  // Frontend — directory patterns are stronger than extensions
  [/\/components?\//i, "frontend"],
  [/\/pages?\//i, "frontend"],
  [/\/views?\//i, "frontend"],
  [/\/layouts?\//i, "frontend"],
  [/\/packages\/app\//i, "frontend"],
  [/\/packages\/ui\//i, "frontend"],
  [/\/packages\/web\//i, "frontend"],
  [/\.(css|scss|less)$/i, "frontend"],
  [/\.(jsx|tsx)$/i, "frontend"],
  // .ts alone is NOT frontend — it could be backend, service, etc.

  // Service — core business logic
  [/\/services?\//i, "service"],
  [/\/workers?\//i, "service"],
  [/\/jobs?\//i, "service"],
  [/\/src\/session\//i, "service"],
  [/\/src\/agent\//i, "service"],
  [/\/src\/provider\//i, "service"],
  [/\/src\/bus\//i, "service"],
]

// Work type signals with weights. Higher weight = stronger signal.
// We score all matches and pick the highest-weighted type.
const WORK_TYPE_SIGNALS: Array<{ pattern: RegExp; type: AivSchema.WorkType; weight: number }> = [
  // Bug fix — strong signals
  { pattern: /\bfix(es|ed|ing)?\b/i, type: "bug-fix", weight: 3 },
  { pattern: /\bbug\b/i, type: "bug-fix", weight: 4 },
  { pattern: /\bhotfix\b/i, type: "bug-fix", weight: 5 },
  { pattern: /\bpatch\b/i, type: "bug-fix", weight: 2 },
  { pattern: /\bresolve\b/i, type: "bug-fix", weight: 2 },
  { pattern: /\bbroken\b/i, type: "bug-fix", weight: 3 },

  // Refactor
  { pattern: /\brefactor(s|ed|ing)?\b/i, type: "refactor", weight: 4 },
  { pattern: /\brestructure\b/i, type: "refactor", weight: 4 },
  { pattern: /\bclean\s?up\b/i, type: "refactor", weight: 3 },
  { pattern: /\brename(s|d)?\b/i, type: "refactor", weight: 3 },
  { pattern: /\bsimplify\b/i, type: "refactor", weight: 3 },
  { pattern: /\bextract\b/i, type: "refactor", weight: 2 },
  { pattern: /\breorganize\b/i, type: "refactor", weight: 3 },

  // Feature
  { pattern: /\bfeat(ure)?\b/i, type: "feature", weight: 4 },
  { pattern: /\bimplement(s|ed|ing)?\b/i, type: "feature", weight: 3 },
  { pattern: /\bintroduce\b/i, type: "feature", weight: 3 },
  { pattern: /\bbuild\b/i, type: "feature", weight: 2 },
  { pattern: /\bcreate\b/i, type: "feature", weight: 2 },
  { pattern: /\badd(s|ed|ing)?\b/i, type: "feature", weight: 2 },

  // Test
  { pattern: /\btest(s|ed|ing)?\b/i, type: "test", weight: 3 },
  { pattern: /\bspec\b/i, type: "test", weight: 3 },
  { pattern: /\bcoverage\b/i, type: "test", weight: 3 },
  { pattern: /\bmock(s|ed|ing)?\b/i, type: "test", weight: 2 },

  // Dependency
  { pattern: /\bdependenc(y|ies)\b/i, type: "dependency", weight: 4 },
  { pattern: /\bupgrade\b/i, type: "dependency", weight: 3 },
  { pattern: /\bbump\b/i, type: "dependency", weight: 4 },
  { pattern: /\bnpm\s+install\b/i, type: "dependency", weight: 3 },
  { pattern: /\bbun\s+add\b/i, type: "dependency", weight: 3 },

  // Config
  { pattern: /\bconfigur(e|ation|ing)\b/i, type: "config", weight: 3 },
  { pattern: /\bsetting(s)?\b/i, type: "config", weight: 2 },
  { pattern: /\benv(ironment)?\b/i, type: "config", weight: 2 },

  // Docs
  { pattern: /\bdoc(s|umentation)?\b/i, type: "docs", weight: 3 },
  { pattern: /\breadme\b/i, type: "docs", weight: 4 },
  { pattern: /\bjsdoc\b/i, type: "docs", weight: 3 },
]

export function classifyLocation(filePath: string): AivSchema.Location {
  for (const [pattern, location] of LOCATION_PATTERNS) {
    if (pattern.test(filePath)) return location
  }
  return "unknown"
}

export function classifyWorkType(text: string): AivSchema.WorkType {
  const scores = new Map<AivSchema.WorkType, number>()
  for (const { pattern, type, weight } of WORK_TYPE_SIGNALS) {
    if (pattern.test(text)) {
      scores.set(type, (scores.get(type) ?? 0) + weight)
    }
  }

  let best: AivSchema.WorkType = "unknown"
  let bestScore = 0
  for (const [type, score] of scores) {
    if (score > bestScore) {
      bestScore = score
      best = type
    }
  }
  return best
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

export function classifyLocations(paths: string[]): AivSchema.Location[] {
  const locations = new Set<AivSchema.Location>()
  for (const p of paths) {
    locations.add(classifyLocation(p))
  }
  locations.delete("unknown")
  return locations.size > 0 ? [...locations] : ["unknown"]
}

export function countModules(paths: string[]): number {
  const modules = new Set<string>()
  for (const p of paths) {
    const parts = p.replace(/^\//, "").split("/").filter(Boolean)
    if (parts.length >= 2) {
      modules.add(parts.slice(0, 2).join("/"))
    } else if (parts.length === 1) {
      modules.add(parts[0])
    }
  }
  return modules.size
}
