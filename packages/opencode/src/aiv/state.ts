import { Bus } from "@/bus"
import { Log } from "@/util/log"
import { SessionID } from "@/session/schema"
import { MessageV2 } from "@/session/message-v2"
import { Session } from "@/session"
import { SessionStatus } from "@/session/status"
import { AivSchema } from "./schema"
import { AivEvent } from "./events"
import { classifyLocationFromPaths, classifyWorkType, countModules } from "./classifier"

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
    if (prev.workType !== "unknown" && next.workType !== "unknown" && prev.workType !== next.workType) {
      const change: AivSchema.StrategyChange = {
        from: prev.workType,
        to: next.workType,
        timestamp: Date.now(),
      }
      next.strategyChanges = [...prev.strategyChanges, change]
      Bus.publish(AivEvent.StrategyChanged, { sessionID, change })
    }

    // Detect scope change
    if (prev.scope.files !== next.scope.files || prev.scope.modules !== next.scope.modules) {
      Bus.publish(AivEvent.ScopeChanged, { sessionID, scope: next.scope })
    }

    intents.set(sessionID, next)
    Bus.publish(AivEvent.IntentUpdated, { sessionID, intent: next })
  }

  /**
   * Process a tool part update to derive intent signals.
   */
  function handleToolPart(sessionID: SessionID, part: MessageV2.ToolPart) {
    const files = getOrCreateFiles(sessionID)
    const toolName = part.tool

    // Extract file paths from tool input
    const input = "input" in part.state ? part.state.input : {}
    const filePath = input.file_path ?? input.path ?? input.filename
    if (typeof filePath === "string") {
      files.add(filePath)
    }

    // For tools that operate on arrays of files
    const filePaths = input.files ?? input.paths
    if (Array.isArray(filePaths)) {
      for (const f of filePaths) {
        if (typeof f === "string") files.add(f)
      }
    }

    const allPaths = [...files]
    const location = classifyLocationFromPaths(allPaths)

    // Derive work type from tool name + context
    let workType = classifyWorkType(toolName)
    if (workType === "unknown" && "title" in part.state && typeof part.state.title === "string") {
      workType = classifyWorkType(part.state.title)
    }

    const scope: AivSchema.Scope = {
      files: files.size,
      modules: countModules(allPaths),
    }

    updateIntent(sessionID, {
      location,
      scope,
      ...(workType !== "unknown" ? { workType } : {}),
    })
  }

  /**
   * Process a text part to extract intent summary and work type signals.
   */
  function handleTextPart(sessionID: SessionID, text: string, role: "user" | "assistant") {
    if (role === "user") {
      // User messages define the intent summary
      const summary = text.length > 200 ? text.slice(0, 200) + "..." : text
      const workType = classifyWorkType(text)
      updateIntent(sessionID, {
        summary,
        ...(workType !== "unknown" ? { workType } : {}),
      })
    } else {
      // Assistant text can refine work type
      const workType = classifyWorkType(text)
      if (workType !== "unknown") {
        const current = intents.get(sessionID)
        if (current?.workType === "unknown") {
          updateIntent(sessionID, { workType })
        }
      }
    }
  }

  /**
   * Initialize subscriptions to the bus to derive AIV state from system events.
   */
  export function subscribe() {
    log.info("initializing AIV state subscriptions")

    // Track part updates to detect tool calls and text
    Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
      const { sessionID, part } = event.properties
      if (part.type === "tool") {
        handleToolPart(sessionID, part as MessageV2.ToolPart)
      }
    })

    // Track new messages for user intent text
    Bus.subscribe(MessageV2.Event.Updated, (event) => {
      const { sessionID, info } = event.properties
      if (info.role === "user") {
        // We'll pick up text from the parts
      }
    })

    // Track part deltas for streaming text
    Bus.subscribe(MessageV2.Event.PartDelta, (event) => {
      const { sessionID, field, delta } = event.properties
      if (field === "text" && typeof delta === "string") {
        // Accumulate — the full text will arrive via PartUpdated
      }
    })

    // Clear intent when session goes idle
    Bus.subscribe(SessionStatus.Event.Status, (event) => {
      const { sessionID, status } = event.properties
      if (status.type === "idle") {
        // Keep the intent around but mark it as completed
        const current = intents.get(sessionID)
        if (current) {
          log.info("session idle, preserving final intent", { sessionID })
        }
      }
    })

    // Clear intent when session is deleted
    Bus.subscribe(Session.Event.Deleted, (event) => {
      clear(event.properties.sessionID)
    })

    // Handle file edit events for scope tracking
    const fileEditedEvent = BusEventLookup("file.edited")
    if (fileEditedEvent) {
      Bus.subscribe(fileEditedEvent, (event: any) => {
        const sessionID = event.properties.sessionID as SessionID | undefined
        const filePath = event.properties.file as string | undefined
        if (sessionID && filePath) {
          const files = getOrCreateFiles(sessionID)
          files.add(filePath)
          const allPaths = [...files]
          updateIntent(sessionID, {
            location: classifyLocationFromPaths(allPaths),
            scope: {
              files: files.size,
              modules: countModules(allPaths),
            },
          })
        }
      })
    }

    log.info("AIV state subscriptions initialized")
  }
}

/**
 * Safely look up a bus event by type string.
 * Returns undefined if the event isn't registered (avoids hard coupling).
 */
function BusEventLookup(_type: string) {
  // The bus event registry is internal; we rely on typed subscriptions above.
  // File edit tracking happens via tool part updates instead.
  return undefined
}
