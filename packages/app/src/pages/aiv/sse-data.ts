import type { AgentState, ConnectionStatus } from "./types"

interface SseEvent {
  type: string
  properties: Record<string, unknown>
}

function parseIntent(props: Record<string, unknown>): AgentState | null {
  const intent = props.intent as Record<string, unknown> | undefined
  if (!intent) return null

  return {
    sessionID: (props.sessionID ?? intent.sessionID ?? "") as string,
    intent: {
      summary: (intent.summary as string) ?? "",
    },
    workType: (intent.workType as AgentState["workType"]) ?? "unknown",
    locations: (intent.locations as AgentState["locations"]) ?? [],
    scope: {
      files: ((intent.scope as Record<string, number>)?.files) ?? 0,
      modules: ((intent.scope as Record<string, number>)?.modules) ?? 0,
    },
    strategyChanges: (intent.strategyChanges as AgentState["strategyChanges"]) ?? [],
    active: (intent.active as boolean) ?? true,
    updatedAt: (intent.timestamp as number) ?? Date.now(),
  }
}

export function createSseDataSource(
  serverUrl: string,
  onUpdate: (states: Map<string, AgentState>) => void,
  onStatus: (status: ConnectionStatus) => void,
) {
  const states = new Map<string, AgentState>()
  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = 1000

  function connect() {
    onStatus("connecting")
    const url = `${serverUrl}/aiv/event`
    eventSource = new EventSource(url)

    eventSource.onopen = () => {
      onStatus("connected")
      reconnectDelay = 1000
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SseEvent
        handleEvent(data)
      } catch {
        // ignore malformed events
      }
    }

    eventSource.onerror = () => {
      eventSource?.close()
      eventSource = null
      onStatus("reconnecting")
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30000)
        connect()
      }, reconnectDelay)
    }
  }

  function handleEvent(event: SseEvent) {
    switch (event.type) {
      case "aiv.intent.updated": {
        const state = parseIntent(event.properties)
        if (state) {
          states.set(state.sessionID, state)
          onUpdate(new Map(states))
        }
        break
      }
      case "aiv.strategy.changed": {
        const sessionID = event.properties.sessionID as string
        const existing = states.get(sessionID)
        if (existing) {
          const change = event.properties.change as AgentState["strategyChanges"][number]
          existing.strategyChanges = [...existing.strategyChanges.slice(-49), change]
          existing.workType = change.to
          existing.updatedAt = Date.now()
          states.set(sessionID, { ...existing })
          onUpdate(new Map(states))
        }
        break
      }
      case "aiv.scope.changed": {
        const sessionID = event.properties.sessionID as string
        const existing = states.get(sessionID)
        if (existing) {
          const scope = event.properties.scope as AgentState["scope"]
          existing.scope = scope
          existing.updatedAt = Date.now()
          states.set(sessionID, { ...existing })
          onUpdate(new Map(states))
        }
        break
      }
      case "aiv.cleared": {
        const sessionID = event.properties.sessionID as string
        states.delete(sessionID)
        onUpdate(new Map(states))
        break
      }
      case "aiv.snapshot": {
        states.clear()
        const intents = event.properties.intents as Record<string, Record<string, unknown>> | undefined
        if (intents) {
          for (const [sessionID, intentData] of Object.entries(intents)) {
            const state = parseIntent({ sessionID, intent: intentData })
            if (state) states.set(sessionID, state)
          }
        }
        onUpdate(new Map(states))
        break
      }
    }
  }

  connect()

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    eventSource?.close()
    eventSource = null
    onStatus("disconnected")
  }
}
