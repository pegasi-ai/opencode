import { Bus } from "@/bus"
import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { AIV } from "./index"
import { Log } from "@/util/log"

const log = Log.create({ service: "aiv" })

/**
 * Start listening to bus events and translating them into AIV state updates.
 * Returns an unsubscribe function.
 */
export function startAIVListener() {
  const unsubs: (() => void)[] = []

  // Listen for message part updates — this is where we get tool calls, text, patches
  unsubs.push(
    Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
      const { sessionID, part } = event.properties
      try {
        switch (part.type) {
          case "text": {
            AIV.ingestMessage({
              sessionID,
              text: part.text,
            })
            break
          }
          case "tool": {
            // Extract file paths from tool metadata/input
            const files = extractFilesFromTool(part)
            const toolText = `${part.tool}: ${describeToolAction(part)}`
            AIV.ingestMessage({
              sessionID,
              text: toolText,
              files,
            })
            break
          }
          case "patch": {
            AIV.ingestMessage({
              sessionID,
              files: part.files,
              text: `Patching ${part.files.length} file(s)`,
            })
            break
          }
          case "step-start": {
            AIV.ingestMessage({
              sessionID,
              active: true,
            })
            break
          }
          case "step-finish": {
            AIV.ingestMessage({
              sessionID,
              active: false,
            })
            break
          }
        }
      } catch (e) {
        log.error("aiv listener error", { error: e })
      }
    }),
  )

  // Listen for session deletions to clean up state
  unsubs.push(
    Bus.subscribe(Session.Event.Deleted, (event) => {
      AIV.remove(event.properties.sessionID)
    }),
  )

  // Listen for diffs to update scope
  unsubs.push(
    Bus.subscribe(Session.Event.Diff, (event) => {
      const { sessionID, diff } = event.properties
      const files = diff.map((d) => d.file)
      if (files.length > 0) {
        AIV.ingestMessage({
          sessionID,
          files,
          text: `Changed ${files.length} file(s)`,
        })
      }
    }),
  )

  log.info("aiv listener started")

  return () => {
    for (const unsub of unsubs) unsub()
    log.info("aiv listener stopped")
  }
}

// --- Helpers ---

function extractFilesFromTool(part: MessageV2.ToolPart): string[] {
  const files: string[] = []

  // Extract from tool input if it has file-like fields
  if (part.state.status !== "pending") return files
  const input = part.state.input
  if (!input) return files

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && isFilePath(value)) {
      files.push(value)
    }
    if (key === "files" && Array.isArray(value)) {
      for (const f of value) {
        if (typeof f === "string" && isFilePath(f)) files.push(f)
      }
    }
  }

  return files
}

function isFilePath(value: string): boolean {
  return /^[.\/].*\.\w+$/.test(value) || value.includes("/")
}

function describeToolAction(part: MessageV2.ToolPart): string {
  const tool = part.tool
  if (part.state.status === "pending") {
    const input = part.state.input
    if (input?.file_path) return `${tool} ${input.file_path}`
    if (input?.path) return `${tool} ${input.path}`
    if (input?.command) return `${tool} command`
    return tool
  }
  return tool
}
