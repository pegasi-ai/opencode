import { For, createMemo } from "solid-js"
import type { SystemLocation, WorkType } from "../types"
import { getLocationLabel, getWorkTypeSvgColor } from "../types"

interface Props {
  activeLocations: SystemLocation[]
  workType: WorkType
}

const ALL_LOCATIONS: SystemLocation[] = [
  "frontend",
  "api",
  "service",
  "database",
  "infrastructure",
  "tests",
]

const LAYER_HEIGHT = 56
const LAYER_GAP = 8
const LAYER_WIDTH = 320
const PADDING_X = 40
const PADDING_Y = 32

export function SystemLayers(props: Props) {
  const activeColor = () => getWorkTypeSvgColor(props.workType)
  const activeSet = createMemo(() => new Set(props.activeLocations))

  const totalHeight = () =>
    PADDING_Y * 2 + ALL_LOCATIONS.length * LAYER_HEIGHT + (ALL_LOCATIONS.length - 1) * LAYER_GAP

  return (
    <div class="flex flex-col items-center gap-3">
      <span class="text-xs font-medium text-white/40 uppercase tracking-widest">
        System Layers
      </span>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${LAYER_WIDTH + PADDING_X * 2} ${totalHeight()}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ "max-width": `${LAYER_WIDTH + PADDING_X * 2}px`, "max-height": `${totalHeight()}px` }}
        role="img"
        aria-label={`System layer diagram showing active locations: ${props.activeLocations.map(getLocationLabel).join(", ") || "none"}`}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <For each={ALL_LOCATIONS}>
          {(location, i) => {
            const y = () => PADDING_Y + i() * (LAYER_HEIGHT + LAYER_GAP)
            const isActive = () => activeSet().has(location)

            return (
              <g>
                <rect
                  x={PADDING_X}
                  y={y()}
                  width={LAYER_WIDTH}
                  height={LAYER_HEIGHT}
                  rx={8}
                  fill={isActive() ? activeColor() + "22" : "#ffffff08"}
                  stroke={isActive() ? activeColor() : "#ffffff15"}
                  stroke-width={isActive() ? 2 : 1}
                  filter={isActive() ? "url(#glow)" : undefined}
                  style={{ transition: "all 0.6s ease" }}
                />
                <text
                  x={PADDING_X + LAYER_WIDTH / 2}
                  y={y() + LAYER_HEIGHT / 2}
                  text-anchor="middle"
                  dominant-baseline="central"
                  fill={isActive() ? activeColor() : "#ffffff40"}
                  font-size="14"
                  font-weight={isActive() ? "600" : "400"}
                  font-family="system-ui, sans-serif"
                  style={{ transition: "all 0.6s ease" }}
                >
                  {getLocationLabel(location)}
                </text>

                {i() < ALL_LOCATIONS.length - 1 && (
                  <line
                    x1={PADDING_X + LAYER_WIDTH / 2}
                    y1={y() + LAYER_HEIGHT}
                    x2={PADDING_X + LAYER_WIDTH / 2}
                    y2={y() + LAYER_HEIGHT + LAYER_GAP}
                    stroke={
                      isActive() && activeSet().has(ALL_LOCATIONS[i() + 1])
                        ? activeColor() + "80"
                        : "#ffffff15"
                    }
                    stroke-width={
                      isActive() && activeSet().has(ALL_LOCATIONS[i() + 1]) ? 2 : 1
                    }
                    stroke-dasharray={
                      isActive() && activeSet().has(ALL_LOCATIONS[i() + 1])
                        ? undefined
                        : "4 4"
                    }
                    style={{ transition: "all 0.6s ease" }}
                  />
                )}
              </g>
            )
          }}
        </For>
      </svg>
    </div>
  )
}
