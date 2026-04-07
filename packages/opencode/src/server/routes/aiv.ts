import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { streamSSE } from "hono/streaming"
import z from "zod"
import { Log } from "@/util/log"
import { Bus } from "@/bus"
import { SessionID } from "@/session/schema"
import { AsyncQueue } from "@/util/queue"
import { AivSchema } from "@/aiv/schema"
import { AivEvent } from "@/aiv/events"
import { AivState } from "@/aiv/state"
import { DASHBOARD_HTML } from "@/aiv/dashboard"
import { Flag } from "@/flag/flag"
import { lazy } from "@/util/lazy"

const log = Log.create({ service: "aiv" })

const MAX_SSE_CONNECTIONS = 10
let activeSseConnections = 0

export const AivRoutes = lazy(() =>
  new Hono()
    .use(async (c, next) => {
      if (!Flag.OPENCODE_EXPERIMENTAL_AIV) return c.notFound()
      return next()
    })
    .get(
      "/intent",
      describeRoute({
        summary: "List all active intents",
        description: "Get the current AIV intent state for all active sessions.",
        operationId: "aiv.intent.list",
        responses: {
          200: {
            description: "Map of session IDs to their current intent state",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), AivSchema.Intent)),
              },
            },
          },
        },
      }),
      async (c) => {
        const intents = AivState.list()
        return c.json(Object.fromEntries(intents))
      },
    )
    .get(
      "/intent/:sessionID",
      describeRoute({
        summary: "Get session intent",
        description: "Get the current AIV intent state for a specific session.",
        operationId: "aiv.intent.get",
        responses: {
          200: {
            description: "Current intent state for the session",
            content: {
              "application/json": {
                schema: resolver(AivSchema.Intent),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const intent = AivState.get(sessionID)
        if (!intent) return c.json({ error: "Session not found" }, 404)
        return c.json(intent)
      },
    )
    .delete(
      "/intent/:sessionID",
      describeRoute({
        summary: "Clear session intent",
        description: "Clear the AIV intent state for a specific session.",
        operationId: "aiv.intent.clear",
        responses: {
          200: {
            description: "Intent cleared",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        AivState.clear(sessionID)
        return c.json(true)
      },
    )
    .get(
      "/event",
      describeRoute({
        summary: "Subscribe to AIV events",
        description: "Get a real-time SSE stream of AIV intent changes, strategy changes, and scope updates.",
        operationId: "aiv.event.subscribe",
        responses: {
          200: {
            description: "AIV event stream",
            content: {
              "text/event-stream": {
                schema: resolver(
                  z.object({
                    type: z.string(),
                    properties: z.record(z.string(), z.any()),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        if (activeSseConnections >= MAX_SSE_CONNECTIONS) {
          return c.json({ error: "Too many SSE connections" }, 429)
        }
        activeSseConnections++
        log.info("aiv event stream connected", { active: activeSseConnections })
        c.header("Cache-Control", "no-cache, no-transform")
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamSSE(c, async (stream) => {
          const q = new AsyncQueue<string | null>()
          let done = false

          // Send initial state snapshot
          q.push(
            JSON.stringify({
              type: "aiv.snapshot",
              properties: {
                intents: Object.fromEntries(AivState.list()),
              },
            }),
          )

          const heartbeat = setInterval(() => {
            q.push(
              JSON.stringify({
                type: "aiv.heartbeat",
                properties: {},
              }),
            )
          }, 10_000)

          const stop = () => {
            if (done) return
            done = true
            activeSseConnections--
            clearInterval(heartbeat)
            unsubs.forEach((fn) => fn())
            q.push(null)
            log.info("aiv event stream disconnected", { active: activeSseConnections })
          }

          const unsubs = [
            Bus.subscribe(AivEvent.IntentUpdated, (event) => {
              q.push(JSON.stringify(event))
            }),
            Bus.subscribe(AivEvent.StrategyChanged, (event) => {
              q.push(JSON.stringify(event))
            }),
            Bus.subscribe(AivEvent.ScopeChanged, (event) => {
              q.push(JSON.stringify(event))
            }),
            Bus.subscribe(AivEvent.Cleared, (event) => {
              q.push(JSON.stringify(event))
            }),
          ]

          stream.onAbort(stop)

          try {
            for await (const data of q) {
              if (data === null) return
              await stream.writeSSE({ data })
            }
          } finally {
            stop()
          }
        })
      },
    )
    .get("/dashboard", async (c) => {
      return c.html(DASHBOARD_HTML)
    }),
)
