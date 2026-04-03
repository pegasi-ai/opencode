import type { AgentState, WorkType, SystemLocation } from "./types"

const INTENTS = [
  { summary: "Fixing null pointer in auth middleware", detail: "The session token validator throws when the token is expired" },
  { summary: "Refactoring database connection pool", detail: "Extracting shared pool logic into a reusable module" },
  { summary: "Adding rate limiting to API endpoints", detail: "Implementing sliding window rate limiter for public routes" },
  { summary: "Writing integration tests for user service", detail: "Covering the signup and login flows end-to-end" },
  { summary: "Upgrading React to v19", detail: "Updating peer dependencies and fixing breaking changes" },
  { summary: "Updating CI pipeline configuration", detail: "Adding parallel test execution and caching" },
]

const SCENARIOS: Array<{
  workType: WorkType
  locations: SystemLocation[]
  scope: { files: number; modules: number; services: number }
  intentIndex: number
}> = [
  { workType: "bug-fix", locations: ["api", "service"], scope: { files: 3, modules: 1, services: 1 }, intentIndex: 0 },
  { workType: "refactor", locations: ["database", "service"], scope: { files: 8, modules: 3, services: 2 }, intentIndex: 1 },
  { workType: "feature", locations: ["api", "frontend"], scope: { files: 5, modules: 2, services: 1 }, intentIndex: 2 },
  { workType: "test", locations: ["tests", "service"], scope: { files: 4, modules: 1, services: 1 }, intentIndex: 3 },
  { workType: "dependency", locations: ["frontend", "infrastructure"], scope: { files: 12, modules: 5, services: 3 }, intentIndex: 4 },
  { workType: "config", locations: ["infrastructure"], scope: { files: 2, modules: 1, services: 1 }, intentIndex: 5 },
]

export function createMockDataSource(onUpdate: (state: AgentState) => void) {
  let scenarioIndex = 0
  let strategyChanges: AgentState["strategyChanges"] = []

  function tick() {
    const prev = SCENARIOS[(scenarioIndex - 1 + SCENARIOS.length) % SCENARIOS.length]
    const current = SCENARIOS[scenarioIndex]

    if (scenarioIndex > 0 && prev.workType !== current.workType) {
      strategyChanges = [
        ...strategyChanges.slice(-4),
        {
          from: prev.workType,
          to: current.workType,
          timestamp: Date.now(),
        },
      ]
    }

    const state: AgentState = {
      intent: INTENTS[current.intentIndex],
      workType: current.workType,
      locations: current.locations,
      scope: current.scope,
      strategyChanges,
      updatedAt: Date.now(),
    }

    onUpdate(state)
    scenarioIndex = (scenarioIndex + 1) % SCENARIOS.length
  }

  tick()
  const interval = setInterval(tick, 4000)

  return () => clearInterval(interval)
}
