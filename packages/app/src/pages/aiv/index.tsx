import "@opencode-ai/ui/styles/aiv.css"
import { createSignal, onCleanup, Show } from "solid-js"
import type { AgentState } from "./types"
import { createMockDataSource } from "./mock-data"
import { IntentHeader } from "./components/intent-header"
import { SystemLayers } from "./components/system-layers"
import { ScopePanel } from "./components/scope-panel"
import { StrategyTimeline } from "./components/strategy-timeline"

export default function AIVPage() {
  const [state, setState] = createSignal<AgentState | null>(null)

  const cleanup = createMockDataSource((newState) => {
    setState(newState)
  })
  onCleanup(cleanup)

  return (
    <div class="flex flex-col h-full bg-[#0a0a0f] text-white overflow-hidden">
      <Show
        when={state()}
        fallback={
          <div class="flex items-center justify-center h-full text-white/30">
            Waiting for agent state...
          </div>
        }
      >
        {(s) => (
          <>
            <IntentHeader intent={s().intent} workType={s().workType} />

            <div class="flex flex-1 min-h-0">
              {/* Center: System layer visualization */}
              <div class="flex-1 flex items-center justify-center">
                <SystemLayers
                  activeLocations={s().locations}
                  workType={s().workType}
                />
              </div>

              {/* Right sidebar: Scope + Strategy */}
              <div class="w-72 border-l border-white/10 p-5 flex flex-col gap-8 overflow-y-auto">
                <ScopePanel scope={s().scope} workType={s().workType} />
                <StrategyTimeline changes={s().strategyChanges} />

                <div class="mt-auto pt-4 border-t border-white/10">
                  <div class="flex items-center gap-2 text-xs text-white/30">
                    <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      Updated {new Date(s().updatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}
