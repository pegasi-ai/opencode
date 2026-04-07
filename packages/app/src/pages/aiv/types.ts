export type WorkType =
  | "bug-fix"
  | "refactor"
  | "feature"
  | "test"
  | "dependency"
  | "config"
  | "docs"
  | "unknown"

export type SystemLocation =
  | "frontend"
  | "api"
  | "service"
  | "database"
  | "infrastructure"
  | "tests"
  | "config"
  | "unknown"

export interface AgentIntent {
  summary: string
  detail?: string
}

export interface ScopeMetrics {
  files: number
  modules: number
}

export interface StrategyChange {
  from: WorkType
  to: WorkType
  timestamp: number
}

export interface AgentState {
  sessionID: string
  intent: AgentIntent
  workType: WorkType
  locations: SystemLocation[]
  scope: ScopeMetrics
  strategyChanges: StrategyChange[]
  active: boolean
  updatedAt: number
}

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected"

/**
 * Colors use CSS custom properties from Agent 4's visual style system (aiv.css).
 * Tailwind classes are used as fallbacks for cases where CSS vars aren't loaded.
 * The `glow` field is the raw hex for SVG filters.
 */
const KNOWN_WORK_TYPE_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  "bug-fix": { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/40", glow: "#3b82f6" },
  refactor: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/40", glow: "#a855f7" },
  feature: { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/40", glow: "#22c55e" },
  test: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40", glow: "#f59e0b" },
  dependency: { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/40", glow: "#f97316" },
  config: { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/40", glow: "#ec4899" },
  docs: { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/40", glow: "#06b6d4" },
  unknown: { bg: "bg-gray-500/15", text: "text-gray-400", border: "border-gray-500/40", glow: "#6b7280" },
}

const FALLBACK_COLORS = { bg: "bg-gray-500/15", text: "text-gray-400", border: "border-gray-500/40", glow: "#6b7280" }

export function getWorkTypeColors(workType: string) {
  return KNOWN_WORK_TYPE_COLORS[workType] ?? FALLBACK_COLORS
}

const KNOWN_WORK_TYPE_LABELS: Record<string, string> = {
  "bug-fix": "Bug Fix",
  refactor: "Refactor",
  feature: "Feature",
  test: "Test",
  dependency: "Dependency",
  config: "Config",
  docs: "Docs",
  unknown: "Unknown",
}

export function getWorkTypeLabel(workType: string) {
  return KNOWN_WORK_TYPE_LABELS[workType] ?? workType
}

const KNOWN_LOCATION_LABELS: Record<string, string> = {
  frontend: "Frontend",
  api: "API",
  service: "Service",
  database: "Database",
  infrastructure: "Infrastructure",
  tests: "Tests",
  config: "Config",
  unknown: "Unknown",
}

export function getLocationLabel(location: string) {
  return KNOWN_LOCATION_LABELS[location] ?? location
}

const KNOWN_SVG_COLORS: Record<string, string> = {
  "bug-fix": "#3b82f6",
  refactor: "#a855f7",
  feature: "#22c55e",
  test: "#f59e0b",
  dependency: "#f97316",
  config: "#ec4899",
  docs: "#06b6d4",
  unknown: "#6b7280",
}

export function getWorkTypeSvgColor(workType: string) {
  return KNOWN_SVG_COLORS[workType] ?? "#6b7280"
}
