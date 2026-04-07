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

const MAX_TOUCHED_FILES = 500
const MAX_STRATEGY_CHANGES = 50
const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const SWEEP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

const intents = new Map<SessionID, AivSchema.Intent>()
const touchedFiles = new Map<SessionID, Set<string>>()

export namespace AivState {
  export function get(sessionID: SessionID): AivSchema.Intent | undefined {
    return intents.get(sessionID)
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
    const next: AivSchema.Intent = { ...prev, ...partial, sessionID, timestamp: Date.now() }

    let strategyChange: { from: string; to: string } | undefined
    if (prev.workType !== "unknown" && next.workType !== "unknown" && prev.workType !== next.workType) {
      const change: AivSchema.StrategyChange = { from: prev.workType, to: next.workType, timestamp: Date.now() }
      const changes = [...prev.strategyChanges, change]
      next.strategyChanges = changes.length > MAX_STRATEGY_CHANGES ? changes.slice(-MAX_STRATEGY_CHANGES) : changes
      strategyChange = { from: change.from, to: change.to }
      Bus.publish(AivEvent.StrategyChanged, { sessionID, change })
      persistEvent("aiv.strategy.changed", sessionID, next, strategyChange)
    }

    if (prev.scope.files !== next.scope.files || prev.scope.modules !== next.scope.modules) {
      Bus.publish(AivEvent.ScopeChanged, { sessionID, scope: next.scope })
      persistEvent("aiv.scope.changed", sessionID, next)
    }

    intents.set(sessionID, next)
    Bus.publish(AivEvent.IntentUpdated, { sessionID, intent: next })

    persistEvent("aiv.intent.updated", sessionID, next, strategyChange)
    persistState(sessionID, next)
  }

  function addFile(files: Set<string>, path: string) {
    if (files.size >= MAX_TOUCHED_FILES) return
    files.add(path)
  }

  function handleToolPart(sessionID: SessionID, part: MessageV2.ToolPart) {
    const files = getOrCreateFiles(sessionID)
    const input = "input" in part.state ? part.state.input : {}
    if (input) {
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === "string" && isFilePath(value)) addFile(files, value)
        if (key === "files" && Array.isArray(value)) {
          for (const f of value) {
            if (typeof f === "string" && isFilePath(f)) addFile(files, f)
          }
        }
      }
    }
    const allPaths = [...files]
    const toolText = `${part.tool}: ${"title" in part.state && typeof part.state.title === "string" ? part.state.title : ""}`
    const workType = classifyWorkType(toolText)
    updateIntent(sessionID, {
      location: classifyLocationFromPaths(allPaths),
      locations: classifyLocations(allPaths),
      scope: { files: files.size, modules: countModules(allPaths) },
      ...(workType !== "unknown" ? { workType } : {}),
    })
  }

  function handleTextPart(sessionID: SessionID, text: string) {
    const summary = text.length > 200 ? text.slice(0, 200) + "..." : text
    const workType = classifyWorkType(text)
    updateIntent(sessionID, { summary, ...(workType !== "unknown" ? { workType } : {}) })
  }

  function handlePatchPart(sessionID: SessionID, patchFiles: string[]) {
    const files = getOrCreateFiles(sessionID)
    for (const f of patchFiles) addFile(files, f)
    const allPaths = [...files]
    updateIntent(sessionID, {
      location: classifyLocationFromPaths(allPaths),
      locations: classifyLocations(allPaths),
      scope: { files: files.size, modules: countModules(allPaths) },
    })
  }

  export function subscribe(): () => void {
    log.info("initializing AIV state subscriptions")
    const unsubs: (() => void)[] = []

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

    unsubs.push(
      Bus.subscribe(Session.Event.Diff, (event) => {
        try {
          const { sessionID, diff } = event.properties
          const diffFiles = diff.map((d) => d.file)
          if (diffFiles.length > 0) handlePatchPart(sessionID, diffFiles)
        } catch (e) {
          log.error("aiv diff handler error", { error: e })
        }
      }),
    )

    unsubs.push(
      Bus.subscribe(Session.Event.Deleted, (event) => {
        try {
          clear(event.properties.sessionID)
        } catch (e) {
          log.error("aiv delete handler error", { error: e })
        }
      }),
    )

    const sweepTimer = setInterval(() => {
      const now = Date.now()
      for (const [sessionID, intent] of intents) {
        if (now - intent.timestamp > IDLE_TIMEOUT_MS) {
          intents.delete(sessionID)
          touchedFiles.delete(sessionID)
          log.info("evicted idle AIV session", { sessionID })
        }
      }
    }, SWEEP_INTERVAL_MS)

    log.info("AIV state subscriptions initialized")
    return () => {
      clearInterval(sweepTimer)
      for (const unsub of unsubs) unsub()
      log.info("AIV state subscriptions torn down")
    }
  }
}

function isFilePath(value: string): boolean {
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("//")) return false
  if (value.length < 2 || value.length > 500) return false
  // Must start with `.`, `/`, or `~` and contain a file extension or directory separator
  if (!/^[./~]/.test(value)) return false
  return value.includes("/") || /\.\w+$/.test(value)
}
