import "@opencode-ai/ui/styles/aiv.css"
import { createSignal, ErrorBoundary, For, onCleanup, onMount, Show } from "solid-js"
import type { AgentState, ConnectionStatus } from "./types"
import { createMockDataSource } from "./mock-data"
import { createSseDataSource } from "./sse-data"
import { IntentHeader } from "./components/intent-header"
import { SystemLayers } from "./components/system-layers"
import { ScopePanel } from "./components/scope-panel"
import { StrategyTimeline } from "./components/strategy-timeline"
import { ConnectionStatusBadge } from "./components/connection-status"

const USE_MOCK = import.meta.env.DEV && !import.meta.env.VITE_AIV_SSE_URL

export default function AIVPage() {
  const [states, setStates] = createSignal<Map<string, AgentState>>(new Map())
  const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>("connecting")
  const [selectedSession, setSelectedSession] = createSignal<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = createSignal(true)
  const [isNarrow, setIsNarrow] = createSignal(false)

  onMount(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    setIsNarrow(mq.matches)
    if (mq.matches) setSidebarOpen(false)
    const handler = (e: MediaQueryListEvent) => {
      setIsNarrow(e.matches)
      if (e.matches) setSidebarOpen(false)
    }
    mq.addEventListener("change", handler)
    onCleanup(() => mq.removeEventListener("change", handler))
  })

  let cleanup: (() => void) | undefined

  if (USE_MOCK) {
    setConnectionStatus("connected")
    cleanup = createMockDataSource((newStates) => {
      setStates(newStates)
      if (!selectedSession() && newStates.size > 0) {
        setSelectedSession(newStates.keys().next().value!)
      }
    })
  } else {
    const serverUrl = import.meta.env.VITE_AIV_SSE_URL || window.location.origin
    cleanup = createSseDataSource(
      serverUrl,
      (newStates) => {
        setStates(newStates)
        const current = selectedSession()
        if (!current || !newStates.has(current)) {
          setSelectedSession(newStates.size > 0 ? newStates.keys().next().value! : null)
        }
      },
      setConnectionStatus,
    )
  }

  onCleanup(() => cleanup?.())

  const activeState = () => {
    const id = selectedSession()
    return id ? states().get(id) ?? null : null
  }

  const sessionList = () => [...states().values()]

  return (
    <ErrorBoundary
      fallback={(err) => (
        <div class="flex flex-col items-center justify-center h-full bg-[#0a0a0f] text-white gap-4">
          <div class="text-red-400 text-lg">Something went wrong</div>
          <div class="text-white/40 text-sm max-w-md text-center">{String(err)}</div>
        </div>
      )}
    >
      <div class="flex flex-col h-full bg-[#0a0a0f] text-white overflow-hidden">
        <Show
          when={activeState()}
          fallback={
            <div class="flex flex-col items-center justify-center h-full gap-4">
              <Show
                when={connectionStatus() === "connected" || connectionStatus() === "connecting"}
                fallback={
                  <div class="flex flex-col items-center gap-3">
                    <div class="text-white/30 text-lg">Connection lost</div>
                    <ConnectionStatusBadge status={connectionStatus()} />
                  </div>
                }
              >
                <div class="text-white/30">
                  {connectionStatus() === "connecting" ? "Connecting to server..." : "No active sessions"}
                </div>
                <ConnectionStatusBadge status={connectionStatus()} />
              </Show>
            </div>
          }
        >
          {(s) => (
            <>
              {/* Session tabs when multiple sessions */}
              <Show when={sessionList().length > 1}>
                <div class="flex items-center gap-1 px-4 pt-2 border-b border-white/5 overflow-x-auto">
                  <For each={sessionList()}>
                    {(session) => (
                      <button
                        class="px-3 py-1.5 text-xs rounded-t transition-colors"
                        classList={{
                          "bg-white/10 text-white": selectedSession() === session.sessionID,
                          "text-white/40 hover:text-white/60": selectedSession() !== session.sessionID,
                        }}
                        onClick={() => setSelectedSession(session.sessionID)}
                      >
                        {session.sessionID.slice(0, 8)}
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              <div aria-live="polite">
                <IntentHeader intent={s().intent} workType={s().workType} />
              </div>

              <div class="flex flex-1 min-h-0 relative">
                <div class="flex-1 flex items-center justify-center p-4">
                  <SystemLayers
                    activeLocations={s().locations}
                    workType={s().workType}
                  />
                </div>

                {/* Sidebar toggle for narrow viewports */}
                <Show when={isNarrow()}>
                  <button
                    class="absolute top-16 right-2 z-10 px-2 py-1 text-xs text-white/50 hover:text-white/80 bg-white/5 rounded"
                    onClick={() => setSidebarOpen(!sidebarOpen())}
                  >
                    {sidebarOpen() ? "Hide" : "Details"}
                  </button>
                </Show>

                <Show when={sidebarOpen()}>
                  <div
                    class="border-l border-white/10 p-5 flex flex-col gap-8 overflow-y-auto"
                    classList={{
                      "w-72": !isNarrow(),
                      "absolute right-0 top-14 bottom-0 w-64 bg-[#0a0a0f] z-10": isNarrow(),
                    }}
                  >
                    <ScopePanel scope={s().scope} workType={s().workType} />
                    <StrategyTimeline changes={s().strategyChanges} />

                    <div class="mt-auto pt-4 border-t border-white/10">
                      <ConnectionStatusBadge status={connectionStatus()} />
                    </div>
                  </div>
                </Show>
              </div>
            </>
          )}
        </Show>
      </div>
    </ErrorBoundary>
  )
}
