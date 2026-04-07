import type { ScopeMetrics, WorkType } from "../types"
import { getWorkTypeSvgColor } from "../types"

interface Props {
  scope: ScopeMetrics
  workType: WorkType
}

function ScopeBar(props: { label: string; value: number; max: number; color: string }) {
  const dynamicMax = () => Math.max(props.max, props.value)
  const pct = () => Math.min(100, (props.value / dynamicMax()) * 100)

  return (
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between">
        <span class="text-xs text-white/50">{props.label}</span>
        <span class="text-xs font-mono text-white/70">{props.value}</span>
      </div>
      <div class="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          class="h-full rounded-full"
          style={{
            width: `${pct()}%`,
            "background-color": props.color,
            transition: "width 0.8s ease, background-color 0.6s ease",
          }}
        />
      </div>
    </div>
  )
}

export function ScopePanel(props: Props) {
  const color = () => getWorkTypeSvgColor(props.workType)

  return (
    <div class="flex flex-col gap-4">
      <span class="text-xs font-medium text-white/40 uppercase tracking-widest">
        Change Scope
      </span>
      <div class="flex flex-col gap-3">
        <ScopeBar label="Files" value={props.scope.files} max={20} color={color()} />
        <ScopeBar label="Modules" value={props.scope.modules} max={10} color={color()} />
      </div>
    </div>
  )
}
