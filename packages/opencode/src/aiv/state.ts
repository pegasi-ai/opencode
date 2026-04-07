import { Bus } from "@/bus"
import { Log } from "@/util/log"
import { SessionID } from "@/session/schema"
import { MessageV2 } from "@/session/message-v2"
import { Session } from "@/session"
import { SessionStatus } from "@/session/status"
import { AivSchema } from "./schema"
import { AivEvent } from "./events"
import { classifyLocationFromPaths, classifyAllLocations, classifyWorkType, countModules } from "./classifier"
import { AivPersistence } from "./persistence"

const log = Log.create({ service: "aiv" })

const MAX_TOUCHED_FILES = 500
const MAX_STRATEGY_CHANGES = 50
const IDLE_EVICTION_MS = 30 * 60 * 1000 // 30 minutes
const SWEEP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

const intents = new Map<SessionID, AivSchema.Intent>()
const touchedFiles = new Map<SessionID, Set<string>>()

function isFilePath(value: string): boolean {
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("//")) return false
  if (value.includes("\n") || value.includes("\t")) return false
  if (value.length > 500) return false
  if (/^[.\/~]/.test(value) || /\/[^/]+\.\w+$/.test(value)) return true
  return false
}

export namespace AivState {
  export function has(sessionID: SessionID): boolean {
    return intents.has(sessionID)
  }

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
    AivPersistence.clear(sessionID)
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
      next.strategyChanges = [...prev.strategyChanges, change].slice(-MAX_STRATEGY_CHANGES)
      Bus.publish(AivEvent.StrategyChanged, { sessionID, change })
      AivPersistence.appendEvent({
        sessionID,
        type: "aiv.strategy.changed",
        previousWorkType: change.from,
        newWorkType: change.to,
      })
    }

    // Detect scope change
    if (prev.scope.files !== next.scope.files || prev.scope.modules !== next.scope.modules) {
      Bus.publish(AivEvent.ScopeChanged, { sessionID, scope: next.scope })
    }

    intents.set(sessionID, next)
    Bus.publish(AivEvent.IntentUpdated, { sessionID, intent: next })

    // Persist to database
    AivPersistence.appendEvent({
      sessionID,
      type: "aiv.intent.updated",
      summary: next.summary || undefined,
      workType: next.workType,
      location: next.location,
      scopeFiles: next.scope.files,
      scopeModules: next.scope.modules,
    })
    AivPersistence.upsertState({
      sessionID,
      summary: next.summary || undefined,
      workType: next.workType,
      location: next.location,
      scopeFiles: next.scope.files,
      scopeModules: next.scope.modules,
      strategyChanges: next.strategyChanges,
    })
  }

  function addFile(files: Set<string>, path: string) {
    if (files.size >= MAX_TOUCHED_FILES) return
    if (isFilePath(path)) files.add(path)
  }

  function handleToolPart(sessionID: SessionID, part: MessageV2.ToolPart) {
    const files = getOrCreateFiles(sessionID)

    // Extract file paths from tool input across all states
    const input = "input" in part.state ? part.state.input : {}
    if (input) {
      const filePath = input.file_path ?? input.path ?? input.filename
      if (typeof filePath === "string") addFile(files, filePath)

      const filePaths = input.files ?? input.paths
      if (Array.isArray(filePaths)) {
        for (const f of filePaths) {
          if (typeof f === "string") addFile(files, f)
        }
      }
    }

    const allPaths = [...files]
    const location = classifyLocationFromPaths(allPaths)
    const locations = classifyAllLocations(allPaths)

    let workType = classifyWorkType(part.tool)
    if (workType === "unknown" && input?.description && typeof input.description === "string") {
      workType = classifyWorkType(input.description)
    }

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

  function handleTextPart(sessionID: SessionID, text: string) {
    const summary = text.length > 200 ? text.slice(0, 200) + "..." : text
    const workType = classifyWorkType(text)
    updateIntent(sessionID, {
      summary,
      ...(workType !== "unknown" ? { workType } : {}),
    })
  }

  function handlePatchPart(sessionID: SessionID, files: string[]) {
    const tracked = getOrCreateFiles(sessionID)
    for (const f of files) addFile(tracked, f)

    const allPaths = [...tracked]
    updateIntent(sessionID, {
      summary: `Patching ${files.length} file(s)`,
      location: classifyLocationFromPaths(allPaths),
      locations: classifyAllLocations(allPaths),
      scope: {
        files: tracked.size,
        modules: countModules(allPaths),
      },
    })
  }

  /**
   * Initialize bus subscriptions. Returns an unsubscribe function for cleanup.
   */
  export function subscribe(): () => void {
    log.info("initializing AIV state subscriptions")
    const unsubs: (() => void)[] = []

    // Track part updates — text, tools, patches, step lifecycle
    unsubs.push(
      Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
        const { sessionID, part } = event.properties
        try {
          switch (part.type) {
            case "text":
              handleTextPart(sessionID, part.text)
              break
            case "tool":
              handleToolPart(sessionID, part as MessageV2.ToolPart)
              break
            case "patch":
              handlePatchPart(sessionID, part.files)
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

    // Track diffs for file scope
    unsubs.push(
      Bus.subscribe(Session.Event.Diff, (event) => {
        const { sessionID, diff } = event.properties
        try {
          const files = diff.map((d) => d.file)
          if (files.length > 0) {
            const tracked = getOrCreateFiles(sessionID)
            for (const f of files) addFile(tracked, f)
            const allPaths = [...tracked]
            updateIntent(sessionID, {
              location: classifyLocationFromPaths(allPaths),
              locations: classifyAllLocations(allPaths),
              scope: {
                files: tracked.size,
                modules: countModules(allPaths),
              },
            })
          }
        } catch (e) {
          log.error("aiv diff handler error", { error: e })
        }
      }),
    )

    // Track session status changes
    unsubs.push(
      Bus.subscribe(SessionStatus.Event.Status, (event) => {
        const { sessionID, status } = event.properties
        try {
          if (status.type === "idle") {
            updateIntent(sessionID, { active: false })
          }
        } catch (e) {
          log.error("aiv status handler error", { error: e })
        }
      }),
    )

    // Clean up on session deletion
    unsubs.push(
      Bus.subscribe(Session.Event.Deleted, (event) => {
        try {
          clear(event.properties.sessionID)
        } catch (e) {
          log.error("aiv delete handler error", { error: e })
        }
      }),
    )

    // Periodic sweep to evict idle sessions
    const sweepTimer = setInterval(() => {
      const now = Date.now()
      for (const [sessionID, intent] of intents) {
        if (!intent.active && now - intent.timestamp > IDLE_EVICTION_MS) {
          intents.delete(sessionID)
          touchedFiles.delete(sessionID)
          log.info("evicted idle session", { sessionID })
        }
      }
    }, SWEEP_INTERVAL_MS)

    log.info("AIV state subscriptions initialized")

    return () => {
      clearInterval(sweepTimer)
      for (const unsub of unsubs) unsub()
      log.info("AIV state subscriptions stopped")
    }
  }
}
