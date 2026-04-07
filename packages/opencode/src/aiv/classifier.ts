import type { AivSchema } from "./schema"

/**
 * Classifier for AIV work types and locations.
 *
 * Design decisions per coordination plan:
 * - Word-boundary regex (\b) instead of substring matching
 * - Weighted signals: strong signals (commit-style keywords) beat weak ones (variable names)
 * - Specific patterns before general ones
 * - File path structure, not just extensions (.ts is NOT always frontend)
 * - Tested against actual opencode file paths
 */

// --- Location classification ---

// Ordered most-specific to least-specific. First match wins.
const LOCATION_RULES: Array<[RegExp, AivSchema.Location]> = [
  // Tests — check before other categories since test files live everywhere
  [/\.(test|spec)\.[tj]sx?$/i, "tests"],
  [/\/__tests__\//i, "tests"],
  [/\/test\//i, "tests"],

  // Database — SQL files and storage layer
  [/\.sql(\.[tj]s)?$/i, "database"],
  [/\/migration\//i, "database"],
  [/\/storage\//i, "database"],
  [/\/drizzle/i, "database"],
  [/drizzle\.config/i, "database"],

  // Infrastructure — deploy, CI, containerization (before config, since .yml/.yaml overlap)
  [/\/infra\//i, "infrastructure"],
  [/\/deploy\//i, "infrastructure"],
  [/\.github\//i, "infrastructure"],
  [/Dockerfile/i, "infrastructure"],
  [/docker-compose/i, "infrastructure"],
  [/\/nix\//i, "infrastructure"],
  [/flake\.(nix|lock)$/i, "infrastructure"],
  [/sst\.config/i, "infrastructure"],
  [/\/containers?\//i, "infrastructure"],

  // Config — settings files (before frontend, since config files have .json/.yaml extensions)
  [/tsconfig.*\.json$/i, "config"],
  [/package\.json$/i, "config"],
  [/turbo\.json$/i, "config"],
  [/\.env(\..+)?$/i, "config"],
  [/\.(ya?ml|toml|ini)$/i, "config"],
  [/\/config\//i, "config"],
  [/bunfig/i, "config"],

  // Frontend — UI components, styles, pages
  [/\.(css|scss|less)$/i, "frontend"],
  [/\.tsx$/i, "frontend"],
  [/\.jsx$/i, "frontend"],
  [/\/components?\//i, "frontend"],
  [/\/pages?\//i, "frontend"],
  [/\/views?\//i, "frontend"],
  [/\/layouts?\//i, "frontend"],
  [/\/app\//i, "frontend"],
  [/\/web\//i, "frontend"],
  [/\/ui\//i, "frontend"],
  [/\/storybook\//i, "frontend"],
  [/\/cli\/cmd\/tui\//i, "frontend"],

  // API — server routes, middleware, handlers
  [/\/server\//i, "api"],
  [/\/routes?\//i, "api"],
  [/\/api\//i, "api"],
  [/\/controllers?\//i, "api"],
  [/\/handlers?\//i, "api"],
  [/\/middleware\//i, "api"],

  // Service — core business logic (catch-all for /src/ files not matched above)
  [/\/services?\//i, "service"],
  [/\/workers?\//i, "service"],
  [/\/jobs?\//i, "service"],
  [/\/queue\//i, "service"],
  [/\/lib\//i, "service"],
  [/\/core\//i, "service"],
  [/\/src\/[^/]+\.[tj]s$/i, "service"],
  [/\/src\/[^/]+\/[^/]+\.[tj]s$/i, "service"],
  [/\/util\//i, "service"],
]

// --- Work type classification ---

type WeightedSignal = {
  pattern: RegExp
  type: AivSchema.WorkType
  weight: number
}

// Higher weight = stronger signal. Score is sum of matched weights per type.
const WORK_TYPE_SIGNALS: WeightedSignal[] = [
  // Bug fix — strong signals
  { pattern: /\bfix(es|ed|ing)?\b/i, type: "bug-fix", weight: 3 },
  { pattern: /\bbug\b/i, type: "bug-fix", weight: 4 },
  { pattern: /\bhotfix\b/i, type: "bug-fix", weight: 5 },
  { pattern: /\bpatch\b/i, type: "bug-fix", weight: 2 },
  { pattern: /\brepair\b/i, type: "bug-fix", weight: 3 },
  { pattern: /\bresolve[ds]?\b/i, type: "bug-fix", weight: 2 },
  { pattern: /\bbroken\b/i, type: "bug-fix", weight: 3 },
  { pattern: /\bregression\b/i, type: "bug-fix", weight: 4 },

  // Refactor — strong signals
  { pattern: /\brefactor(s|ed|ing)?\b/i, type: "refactor", weight: 5 },
  { pattern: /\brestructure\b/i, type: "refactor", weight: 4 },
  { pattern: /\bclean\s?up\b/i, type: "refactor", weight: 3 },
  { pattern: /\bsimplif(y|ies|ied)\b/i, type: "refactor", weight: 3 },
  { pattern: /\bextract\b/i, type: "refactor", weight: 2 },
  { pattern: /\brename[ds]?\b/i, type: "refactor", weight: 3 },
  { pattern: /\breorganize\b/i, type: "refactor", weight: 4 },

  // Feature — strong signals
  { pattern: /\bfeat(ure)?\b/i, type: "feature", weight: 5 },
  { pattern: /\bimplement(s|ed|ing)?\b/i, type: "feature", weight: 3 },
  { pattern: /\bintroduce[ds]?\b/i, type: "feature", weight: 4 },
  { pattern: /\bbuild(s|ing)?\b/i, type: "feature", weight: 2 },
  { pattern: /\bcreate[ds]?\b/i, type: "feature", weight: 2 },
  { pattern: /\badd(s|ed|ing)?\b/i, type: "feature", weight: 2 },

  // Test
  { pattern: /\btest(s|ed|ing)?\b/i, type: "test", weight: 3 },
  { pattern: /\bspec\b/i, type: "test", weight: 3 },
  { pattern: /\bcoverage\b/i, type: "test", weight: 4 },
  { pattern: /\bmock(s|ed|ing)?\b/i, type: "test", weight: 2 },

  // Dependency
  { pattern: /\bupgrade[ds]?\b/i, type: "dependency", weight: 3 },
  { pattern: /\bbump(s|ed|ing)?\b/i, type: "dependency", weight: 4 },
  { pattern: /\bdependenc(y|ies)\b/i, type: "dependency", weight: 5 },
  { pattern: /\bpackage\.json\b/i, type: "dependency", weight: 3 },
  { pattern: /\bnpm\s+(install|update|add)\b/i, type: "dependency", weight: 4 },
  { pattern: /\bbun\s+add\b/i, type: "dependency", weight: 4 },

  // Config
  { pattern: /\bconfig(uration)?\b/i, type: "config", weight: 3 },
  { pattern: /\bsetting(s)?\b/i, type: "config", weight: 2 },
  { pattern: /\benvironment\b/i, type: "config", weight: 2 },
  { pattern: /\bpipeline\b/i, type: "config", weight: 2 },
  { pattern: /\btsconfig\b/i, type: "config", weight: 4 },
  { pattern: /\beslint\b/i, type: "config", weight: 3 },
  { pattern: /\bprettier\b/i, type: "config", weight: 3 },

  // Docs
  { pattern: /\bdoc(s|umentation)?\b/i, type: "docs", weight: 4 },
  { pattern: /\breadme\b/i, type: "docs", weight: 5 },
  { pattern: /\bjsdoc\b/i, type: "docs", weight: 4 },
  { pattern: /\bcomment(s|ed|ing)?\b/i, type: "docs", weight: 2 },
]

export function classifyLocation(filePath: string): AivSchema.Location {
  for (const [pattern, location] of LOCATION_RULES) {
    if (pattern.test(filePath)) return location
  }
  return "unknown"
}

export function classifyWorkType(text: string): AivSchema.WorkType {
  const scores = new Map<AivSchema.WorkType, number>()

  for (const signal of WORK_TYPE_SIGNALS) {
    if (signal.pattern.test(text)) {
      scores.set(signal.type, (scores.get(signal.type) ?? 0) + signal.weight)
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

export function classifyAllLocations(paths: string[]): AivSchema.Location[] {
  const locations = new Set<AivSchema.Location>()
  for (const p of paths) {
    const loc = classifyLocation(p)
    if (loc !== "unknown") locations.add(loc)
  }
  return locations.size > 0 ? [...locations] : ["unknown"]
}

export function countModules(paths: string[]): number {
  const modules = new Set<string>()
  for (const p of paths) {
    const parts = p.replace(/^\//, "").split("/")
    if (parts.length >= 2) {
      modules.add(parts.slice(0, 2).join("/"))
    }
  }
  return modules.size
}
