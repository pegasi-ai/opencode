import type { ConnectionStatus } from "../types"

interface Props {
  status: ConnectionStatus
}

const STATUS_CONFIG: Record<ConnectionStatus, { color: string; label: string; animate: boolean }> = {
  connecting: { color: "bg-amber-500", label: "Connecting", animate: true },
  connected: { color: "bg-emerald-500", label: "Connected", animate: true },
  reconnecting: { color: "bg-amber-500", label: "Reconnecting", animate: true },
  disconnected: { color: "bg-red-500", label: "Disconnected", animate: false },
}

export function ConnectionStatusBadge(props: Props) {
  const config = () => STATUS_CONFIG[props.status]

  return (
    <div class="flex items-center gap-2 text-xs text-white/30">
      <div
        class={`w-1.5 h-1.5 rounded-full ${config().color}`}
        classList={{ "aiv-pulse": config().animate }}
      />
      <span>{config().label}</span>
    </div>
  )
}
