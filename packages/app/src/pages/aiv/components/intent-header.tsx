import { Show } from "solid-js"
import type { AgentIntent, WorkType } from "../types"
import { getWorkTypeColors, getWorkTypeLabel } from "../types"

interface Props {
  intent: AgentIntent
  workType: WorkType
}

export function IntentHeader(props: Props) {
  const colors = () => getWorkTypeColors(props.workType)
  const label = () => getWorkTypeLabel(props.workType)

  return (
    <div class="flex items-center gap-4 px-6 py-4 border-b border-white/10">
      <div
        class={`flex items-center gap-2 rounded-full px-3 py-1.5 border ${colors().bg} ${colors().border}`}
      >
        <div
          class="w-2 h-2 rounded-full aiv-pulse"
          style={{ "background-color": colors().glow }}
        />
        <span class={`text-sm font-medium ${colors().text}`}>{label()}</span>
      </div>

      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-base font-semibold text-white truncate">
          {props.intent.summary}
        </span>
        <Show when={props.intent.detail}>
          <span class="text-sm text-white/50 truncate">{props.intent.detail}</span>
        </Show>
      </div>
    </div>
  )
}
