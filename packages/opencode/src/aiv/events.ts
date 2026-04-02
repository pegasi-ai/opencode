import z from "zod"
import { BusEvent } from "@/bus/bus-event"
import { SessionID } from "@/session/schema"
import { AivSchema } from "./schema"

export namespace AivEvent {
  export const IntentUpdated = BusEvent.define(
    "aiv.intent.updated",
    z.object({
      sessionID: SessionID.zod,
      intent: AivSchema.Intent,
    }),
  )

  export const StrategyChanged = BusEvent.define(
    "aiv.strategy.changed",
    z.object({
      sessionID: SessionID.zod,
      change: AivSchema.StrategyChange,
    }),
  )

  export const ScopeChanged = BusEvent.define(
    "aiv.scope.changed",
    z.object({
      sessionID: SessionID.zod,
      scope: AivSchema.Scope,
    }),
  )

  export const Cleared = BusEvent.define(
    "aiv.cleared",
    z.object({
      sessionID: SessionID.zod,
    }),
  )
}
