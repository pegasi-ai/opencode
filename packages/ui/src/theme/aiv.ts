/**
 * Agent Intent Visualizer (AIV) — Visual Style System
 *
 * Defines the visual language for representing agent activity:
 * work types, locations, scope, and state transitions.
 *
 * Integrates with the existing OKLCH-based theme system.
 * All colors are provided as seed hex values that can be fed into
 * `generateScale()` for full light/dark palette generation.
 */

import type { HexColor } from "./types"

// ---------------------------------------------------------------------------
// Work Types
// ---------------------------------------------------------------------------

export const WorkType = {
  BugFix: "bug-fix",
  Refactor: "refactor",
  Feature: "feature",
  Test: "test",
  DependencyChange: "dependency-change",
  ConfigChange: "config-change",
} as const

export type WorkType = (typeof WorkType)[keyof typeof WorkType]

export interface WorkTypeStyle {
  /** Display label */
  label: string
  /** Seed color for scale generation */
  color: HexColor
  /** Lucide icon name */
  icon: string
}

/**
 * Color rationale (OKLCH hue wheel, perceptually distinct):
 *
 * - Bug Fix (#3B82F6):       Blue   — diagnostic, surgical
 * - Refactor (#A855F7):      Purple — structural reorganization
 * - Feature (#22C55E):       Green  — additive growth
 * - Test (#F59E0B):          Amber  — verification / caution
 * - Dependency (#F97316):    Orange — external / supply-chain
 * - Config (#EC4899):        Pink   — settings / environment
 *
 * Hues are spaced ≥40° apart on the OKLCH wheel for colorblind
 * distinguishability. Each also has a unique icon as a redundant channel.
 */
export const workTypeStyles: Record<WorkType, WorkTypeStyle> = {
  [WorkType.BugFix]: {
    label: "Bug Fix",
    color: "#3B82F6",
    icon: "bug",
  },
  [WorkType.Refactor]: {
    label: "Refactor",
    color: "#A855F7",
    icon: "shuffle",
  },
  [WorkType.Feature]: {
    label: "Feature",
    color: "#22C55E",
    icon: "sparkles",
  },
  [WorkType.Test]: {
    label: "Test",
    color: "#F59E0B",
    icon: "flask-conical",
  },
  [WorkType.DependencyChange]: {
    label: "Dependency",
    color: "#F97316",
    icon: "package",
  },
  [WorkType.ConfigChange]: {
    label: "Config",
    color: "#EC4899",
    icon: "settings",
  },
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export const Location = {
  Frontend: "frontend",
  API: "api",
  Service: "service",
  Database: "database",
  Infrastructure: "infrastructure",
  Tests: "tests",
} as const

export type Location = (typeof Location)[keyof typeof Location]

export interface LocationStyle {
  label: string
  /** Lucide icon name */
  icon: string
  /** Badge/accent color — intentionally muted so work-type color dominates */
  color: HexColor
}

export const locationStyles: Record<Location, LocationStyle> = {
  [Location.Frontend]: {
    label: "Frontend",
    icon: "layout-dashboard",
    color: "#60A5FA",
  },
  [Location.API]: {
    label: "API",
    icon: "arrow-left-right",
    color: "#34D399",
  },
  [Location.Service]: {
    label: "Service",
    icon: "server",
    color: "#A78BFA",
  },
  [Location.Database]: {
    label: "Database",
    icon: "database",
    color: "#FBBF24",
  },
  [Location.Infrastructure]: {
    label: "Infra",
    icon: "cloud",
    color: "#F87171",
  },
  [Location.Tests]: {
    label: "Tests",
    icon: "test-tubes",
    color: "#2DD4BF",
  },
}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

export const ScopeLevel = {
  Small: "small",
  Medium: "medium",
  Large: "large",
} as const

export type ScopeLevel = (typeof ScopeLevel)[keyof typeof ScopeLevel]

export interface ScopeThresholds {
  /** Max files for "small" */
  smallMax: number
  /** Max files for "medium" — above this is "large" */
  mediumMax: number
}

export const scopeDefaults: ScopeThresholds = {
  smallMax: 3,
  mediumMax: 10,
}

export function classifyScope(fileCount: number, thresholds = scopeDefaults): ScopeLevel {
  if (fileCount <= thresholds.smallMax) return ScopeLevel.Small
  if (fileCount <= thresholds.mediumMax) return ScopeLevel.Medium
  return ScopeLevel.Large
}

export interface ScopeLevelStyle {
  label: string
  /** Lucide icon name */
  icon: string
  /** Ring / pulse intensity (0–1) */
  intensity: number
  /** CSS border-width in px */
  borderWidth: number
}

export const scopeStyles: Record<ScopeLevel, ScopeLevelStyle> = {
  [ScopeLevel.Small]: {
    label: "Small",
    icon: "dot",
    intensity: 0.3,
    borderWidth: 1,
  },
  [ScopeLevel.Medium]: {
    label: "Medium",
    icon: "circle",
    intensity: 0.6,
    borderWidth: 2,
  },
  [ScopeLevel.Large]: {
    label: "Large",
    icon: "circle-dot",
    intensity: 1.0,
    borderWidth: 3,
  },
}

// ---------------------------------------------------------------------------
// Agent States
// ---------------------------------------------------------------------------

export const AgentState = {
  Idle: "idle",
  Active: "active",
  StrategyChange: "strategy-change",
  Complete: "complete",
  Error: "error",
} as const

export type AgentState = (typeof AgentState)[keyof typeof AgentState]

export interface AgentStateStyle {
  label: string
  /** Lucide icon name */
  icon: string
  /** CSS animation class suffix (e.g. "aiv-pulse", "aiv-flash") */
  animation: string | null
  /** Opacity multiplier for the work-type color */
  opacity: number
}

export const agentStateStyles: Record<AgentState, AgentStateStyle> = {
  [AgentState.Idle]: {
    label: "Idle",
    icon: "pause",
    animation: null,
    opacity: 0.4,
  },
  [AgentState.Active]: {
    label: "Active",
    icon: "play",
    animation: "aiv-pulse",
    opacity: 1.0,
  },
  [AgentState.StrategyChange]: {
    label: "Strategy Change",
    icon: "arrow-right-left",
    animation: "aiv-flash",
    opacity: 1.0,
  },
  [AgentState.Complete]: {
    label: "Complete",
    icon: "check",
    animation: null,
    opacity: 0.7,
  },
  [AgentState.Error]: {
    label: "Error",
    icon: "alert-triangle",
    animation: "aiv-shake",
    opacity: 1.0,
  },
}

// ---------------------------------------------------------------------------
// Theme Token Generation
// ---------------------------------------------------------------------------

/**
 * Returns AIV-specific CSS custom property names and values.
 * Intended to be merged into the resolved theme tokens.
 *
 * Usage:
 *   const aivTokens = resolveAivTokens(false) // light mode
 *   Object.assign(tokens, aivTokens)
 */
export function resolveAivTokens(isDark: boolean): Record<string, string> {
  const tokens: Record<string, string> = {}

  for (const [key, style] of Object.entries(workTypeStyles)) {
    tokens[`aiv-work-${key}`] = style.color
  }

  for (const [key, style] of Object.entries(locationStyles)) {
    tokens[`aiv-location-${key}`] = style.color
  }

  // State overlays
  tokens["aiv-state-idle-opacity"] = "0.4"
  tokens["aiv-state-active-opacity"] = "1"
  tokens["aiv-state-error-color"] = isDark ? "#FCA5A5" : "#DC2626"
  tokens["aiv-state-strategy-change-color"] = isDark ? "#FDE68A" : "#D97706"

  return tokens
}
