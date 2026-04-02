import { Bus } from "@/bus"
import { Log } from "@/util/log"
import { SessionID } from "@/session/schema"
import { MessageV2 } from "@/session/message-v2"
import { Session } from "@/session"
import { AivSchema } from "./schema"
import { AivEvent } from "./events"
import { classifyLocationFromPaths, classifyLocations, classifyWorkType, countModules } from "./classifier"
import { persistEvent, persistState, persistClear } from "./persist"

const log = Log.create({ service: "aiv" })

/**
 * In-memory state for all active AIV intents, keyed by sessionID.
 * This is the single source of truth that routes query and SSE streams read from.
 */
const intents = new Map<SessionID, AivSchema.Intent>()
const touchedFiles = new Map<SessionID, Set<string>>()

export namespace AivState {
  export function get(sessionID: SessionID): AivSchema.Intent {
    return intents.get(sessionID) ?? AivSchema.empty(sessionID)
  }

  export function list(): Map<SessionID, AivSchema.Intent> {
    return new Map(intents)
  }

  export function clear(sessionID: SessionID) {
    intents.delete(sessionID)
    touchedFiles.delete(sessionID)
    Bus.publish(AivEvent.Cleared, { sessionID })
    persistClear(sessionID)
  }

  function getOrCreateFiles(sessionID: SessionID): Set<string> {
    let files = touchedFiles.get(sessionID)
    if (!files) {
      files = new Set()
      touchedFiles.set(sessionID, files)
    }
    return files
  }

  function updateIntent(sessionID: SessionID, partial: Partial<AivSchema.Intent>) {
    const prev = intents.get(sessionID) ?? AivSchema.empty(sessionID)
    const next: AivSchema.Intent = {
      ...prev,
      ...partial,
      sessionID,
      timestamp: Date.now(),
    }

    // Detect strategy change
    let strategyChange: { from: string; to: string } | undefined
    if (prev.workType !== "unknown" && next.workType !== "unknown" && prev.workType !== next.workType) {
      const change: AivSchema.StrategyChange = {
        from: prev.workType,
        to: next.workType,
        timestamp: Date.now(),
      }
      next.strategyChanges = [...prev.strategyChanges, change]
      strategyChange = { from: change.from, to: change.to }
      Bus.publish(AivEvent.StrategyChanged, { sessionID, change })
      persistEvent("aiv.strategy.changed", sessionID, next, strategyChange)
    }

    // Detect scope change
    if (prev.scope.files !== next.scope.files || prev.scope.modules !== next.scope.modules) {
      Bus.publish(AivEvent.ScopeChanged, { sessionID, scope: next.scope })
      persistEvent("aiv.scope.changed", sessionID, next)
    }

    intents.set(sessionID, next)
    Bus.publish(AivEvent.IntentUpdated, { sessionID, intent: next })

    // Persist to database (no-op if persistence adapter isn't registered)
    persistEvent("aiv.intent.updated", sessionID, next, strategyChange)
    persistState(sessionID, next)
  }

  /**
   * Process a tool part update to derive intent signals.
   */
  function handleToolPart(sessionID: SessionID, part: MessageV2.ToolPart) {
    const files = getOrCreateFiles(sessionID)

    // Extract file paths from tool input across all states
    const input = "input" in part.state ? part.state.input : {}
    if (input) {
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === "string" && isFilePath(value)) {
          files.add(value)
        }
        if (key === "files" && Array.isArray(value)) {
          for (const f of value) {
            if (typeof f === "string" && isFilePath(f)) files.add(f)
          }
        }
      }
    }

    const allPaths = [...files]
    const location = classifyLocationFromPaths(allPaths)
    const locations = classifyLocations(allPaths)

    // Derive work type from tool name + title context
    const toolText = `${part.tool}: ${"title" in part.state && typeof part.state.title === "string" ? part.state.title : ""}`
    const workType = classifyWorkType(toolText)

    const scope: AivSchema.Scope = {
      files: files.size,
      modules: countModules(allPaths),
    }

    updateIntent(sessionID, {
      location,
      locations,
      scope,
      ...(workType !== "unknown" ? { workType } : {}),
    })
  }

  /**
   * Process a text part to extract intent summary and work type signals.
   */
  function handleTextPart(sessionID: SessionID, text: string) {
    const summary = text.length > 200 ? text.slice(0, 200) + "..." : text
    const workType = classifyWorkType(text)
    updateIntent(sessionID, {
      summary,
      ...(workType !== "unknown" ? { workType } : {}),
    })
  }

  /**
   * Process a patch part to update scope from file list.
   */
  function handlePatchPart(sessionID: SessionID, patchFiles: string[]) {
    const files = getOrCreateFiles(sessionID)
    for (const f of patchFiles) files.add(f)

    const allPaths = [...files]
    updateIntent(sessionID, {
      location: classifyLocationFromPaths(allPaths),
      locations: classifyLocations(allPaths),
      scope: {
        files: files.size,
        modules: countModules(allPaths),
      },
    })
  }

  /**
   * Initialize subscriptions to the bus to derive AIV state from system events.
   * Returns an unsubscribe function to tear down all listeners.
   */
  export function subscribe(): () => void {
    log.info("initializing AIV state subscriptions")
    const unsubs: (() => void)[] = []

    // Track part updates — handle text, tool, patch, step-start, step-finish
    unsubs.push(
      Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
        const { sessionID, part } = event.properties
        try {
          switch (part.type) {
            case "text":
              handleTextPart(sessionID, (part as MessageV2.TextPart).text)
              break
            case "tool":
              handleToolPart(sessionID, part as MessageV2.ToolPart)
              break
            case "patch":
              handlePatchPart(sessionID, (part as MessageV2.PatchPart).files)
              break
            case "step-start":
              updateIntent(sessionID, { active: true })
              break
            case "step-finish":
              updateIntent(sessionID, { active: false })
              break
          }
        } catch (e) {
          log.error("aiv part handler error", { error: e, partType: part.type })
        }
      }),
    )

    // Track diffs for scope updates
    unsubs.push(
      Bus.subscribe(Session.Event.Diff, (event) => {
        try {
          const { sessionID, diff } = event.properties
          const diffFiles = diff.map((d) => d.file)
          if (diffFiles.length > 0) {
            handlePatchPart(sessionID, diffFiles)
          }
        } catch (e) {
          log.error("aiv diff handler error", { error: e })
        }
      }),
    )

    // Clear intent when session is deleted
    unsubs.push(
      Bus.subscribe(Session.Event.Deleted, (event) => {
        try {
          clear(event.properties.sessionID)
        } catch (e) {
          log.error("aiv delete handler error", { error: e })
        }
      }),
    )

    log.info("AIV state subscriptions initialized")

    return () => {
      for (const unsub of unsubs) unsub()
      log.info("AIV state subscriptions torn down")
    }
  }
}

function isFilePath(value: string): boolean {
  return /^[./].*\.\w+$/.test(value) || value.includes("/")
}
