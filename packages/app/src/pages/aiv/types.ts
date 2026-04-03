export type WorkType = "bug-fix" | "refactor" | "feature" | "test" | "dependency" | "config"

export type SystemLocation = "frontend" | "api" | "service" | "database" | "infrastructure" | "tests"

export interface AgentIntent {
  summary: string
  detail?: string
}

export interface ScopeMetrics {
  files: number
  modules: number
  services: number
}

export interface StrategyChange {
  from: WorkType
  to: WorkType
  timestamp: number
  reason?: string
}

export interface AgentState {
  intent: AgentIntent
  workType: WorkType
  locations: SystemLocation[]
  scope: ScopeMetrics
  strategyChanges: StrategyChange[]
  updatedAt: number
}

export const WORK_TYPE_COLORS: Record<WorkType, { bg: string; text: string; border: string; glow: string }> = {
  "bug-fix": { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/40", glow: "#3B82F6" },
  refactor: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/40", glow: "#A855F7" },
  feature: { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/40", glow: "#22C55E" },
  test: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40", glow: "#F59E0B" },
  dependency: { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/40", glow: "#F97316" },
  config: { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/40", glow: "#EC4899" },
}

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  "bug-fix": "Bug Fix",
  refactor: "Refactor",
  feature: "Feature",
  test: "Test",
  dependency: "Dependency",
  config: "Config",
}

export const LOCATION_LABELS: Record<SystemLocation, string> = {
  frontend: "Frontend",
  api: "API",
  service: "Service",
  database: "Database",
  infrastructure: "Infrastructure",
  tests: "Tests",
}

export const WORK_TYPE_SVG_COLORS: Record<WorkType, string> = {
  "bug-fix": "#3B82F6",
  refactor: "#A855F7",
  feature: "#22C55E",
  test: "#F59E0B",
  dependency: "#F97316",
  config: "#EC4899",
}
