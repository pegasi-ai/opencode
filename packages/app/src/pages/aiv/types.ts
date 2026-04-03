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
  "bug-fix": { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/40", glow: "#ef4444" },
  refactor: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/40", glow: "#a855f7" },
  feature: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40", glow: "#10b981" },
  test: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/40", glow: "#3b82f6" },
  dependency: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40", glow: "#f59e0b" },
  config: { bg: "bg-slate-500/15", text: "text-slate-400", border: "border-slate-500/40", glow: "#64748b" },
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
  "bug-fix": "#ef4444",
  refactor: "#a855f7",
  feature: "#10b981",
  test: "#3b82f6",
  dependency: "#f59e0b",
  config: "#64748b",
}
