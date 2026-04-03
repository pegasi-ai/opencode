import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { lazy } from "@/util/lazy"
import { AivSchema } from "@/aiv/schema"
import { AivState } from "@/aiv/state"
import { AivPersistence } from "@/aiv/persistence"
import { DASHBOARD_HTML } from "@/aiv/dashboard"
import { SessionID } from "@/session/schema"

export const AIVRoutes = lazy(() =>
  new Hono()
    .get("/dashboard", async (c) => {
      c.header("Content-Type", "text/html; charset=utf-8")
      return c.body(DASHBOARD_HTML)
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
      validator("param", z.object({ sessionID: SessionID.zod })),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        return c.json(AivState.get(sessionID))
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
      validator("param", z.object({ sessionID: SessionID.zod })),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        AivState.clear(sessionID)
        return c.json(true)
      },
    )
    .get(
      "/timeline/:sessionID",
      describeRoute({
        summary: "Get AIV timeline",
        description: "Get the persisted event timeline for a session, most recent first.",
        operationId: "aiv.timeline.get",
        responses: {
          200: {
            description: "Event timeline",
            content: {
              "application/json": {
                schema: resolver(z.array(z.object({
                  id: z.string(),
                  sessionID: z.string(),
                  type: z.string(),
                  summary: z.string().nullable(),
                  workType: z.string().nullable(),
                  location: z.string().nullable(),
                  scopeFiles: z.number().nullable(),
                  scopeModules: z.number().nullable(),
                  previousWorkType: z.string().nullable(),
                  newWorkType: z.string().nullable(),
                  timeCreated: z.number(),
                }))),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          limit: z.coerce.number().int().min(1).max(1000).default(100),
        }),
      ),
      async (c) => {
        const sessionID = c.req.param("sessionID")
        const { limit } = c.req.valid("query")
        const events = AivPersistence.timeline(sessionID, limit)
        return c.json(events)
      },
    ),
)
