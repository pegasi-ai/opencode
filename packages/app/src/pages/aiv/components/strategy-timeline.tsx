import { For, Show } from "solid-js"
import type { StrategyChange } from "../types"
import { getWorkTypeColors, getWorkTypeLabel } from "../types"

interface Props {
  changes: StrategyChange[]
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function StrategyTimeline(props: Props) {
  return (
    <div class="flex flex-col gap-4">
      <span class="text-xs font-medium text-white/40 uppercase tracking-widest">
        Strategy Changes
      </span>

      <Show
        when={props.changes.length > 0}
        fallback={
          <div class="flex items-center gap-2 text-sm text-white/30">
            <div class="w-2 h-2 rounded-full bg-emerald-500/50" />
            No strategy changes
          </div>
        }
      >
        <div class="flex flex-col gap-2">
          <For each={props.changes}>
            {(change) => {
              const fromColors = () => getWorkTypeColors(change.from)
              const toColors = () => getWorkTypeColors(change.to)

              return (
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-white/30 font-mono w-16 shrink-0">
                    {formatTime(change.timestamp)}
                  </span>
                  <span
                    class={`px-1.5 py-0.5 rounded ${fromColors().bg} ${fromColors().text}`}
                  >
                    {getWorkTypeLabel(change.from)}
                  </span>
                  <svg width="16" height="8" viewBox="0 0 16 8">
                    <path d="M0 4 H12 L9 1 M12 4 L9 7" stroke="#ffffff40" stroke-width="1.5" fill="none" />
                  </svg>
                  <span
                    class={`px-1.5 py-0.5 rounded ${toColors().bg} ${toColors().text}`}
                  >
                    {getWorkTypeLabel(change.to)}
                  </span>
                </div>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}
