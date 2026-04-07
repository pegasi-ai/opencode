import type { AgentState, WorkType, SystemLocation } from "./types"

const INTENTS = [
  { summary: "Fixing null pointer in auth middleware" },
  { summary: "Refactoring database connection pool" },
  { summary: "Adding rate limiting to API endpoints" },
  { summary: "Writing integration tests for user service" },
  { summary: "Upgrading React to v19" },
  { summary: "Updating CI pipeline configuration" },
]

const SCENARIOS: Array<{
  workType: WorkType
  locations: SystemLocation[]
  scope: { files: number; modules: number }
  intentIndex: number
}> = [
  { workType: "bug-fix", locations: ["api", "service"], scope: { files: 3, modules: 1 }, intentIndex: 0 },
  { workType: "refactor", locations: ["database", "service"], scope: { files: 8, modules: 3 }, intentIndex: 1 },
  { workType: "feature", locations: ["api", "frontend"], scope: { files: 5, modules: 2 }, intentIndex: 2 },
  { workType: "test", locations: ["tests", "service"], scope: { files: 4, modules: 1 }, intentIndex: 3 },
  { workType: "dependency", locations: ["frontend", "infrastructure"], scope: { files: 12, modules: 5 }, intentIndex: 4 },
  { workType: "config", locations: ["infrastructure"], scope: { files: 2, modules: 1 }, intentIndex: 5 },
]

export function createMockDataSource(onUpdate: (states: Map<string, AgentState>) => void) {
  let scenarioIndex = 0
  let strategyChanges: AgentState["strategyChanges"] = []
  const sessionID = "mock-session-1"

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
      sessionID,
      intent: INTENTS[current.intentIndex],
      workType: current.workType,
      locations: current.locations,
      scope: current.scope,
      strategyChanges,
      active: true,
      updatedAt: Date.now(),
    }

    const states = new Map<string, AgentState>()
    states.set(sessionID, state)
    onUpdate(states)
    scenarioIndex = (scenarioIndex + 1) % SCENARIOS.length
  }

  tick()
  const interval = setInterval(tick, 4000)

  return () => clearInterval(interval)
}
