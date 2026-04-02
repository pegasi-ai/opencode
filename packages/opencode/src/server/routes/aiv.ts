import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { lazy } from "@/util/lazy"
import { AIV } from "@/aiv"
import { DASHBOARD_HTML } from "@/aiv/dashboard"
import { SessionID } from "@/session/schema"

export const AIVRoutes = lazy(() =>
  new Hono()
    .get("/dashboard", async (c) => {
      c.header("Content-Type", "text/html; charset=utf-8")
      return c.body(DASHBOARD_HTML)
    })
    .get(
      "/",
      describeRoute({
        summary: "List all AIV states",
        description: "Get the current AIV work state for all active sessions.",
        operationId: "aiv.list",
        responses: {
          200: {
            description: "List of work states",
            content: {
              "application/json": {
                schema: resolver(AIV.WorkState.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(AIV.list())
      },
    )
    .get(
      "/:sessionID",
      describeRoute({
        summary: "Get AIV state for session",
        description: "Get the current AIV work state for a specific session.",
        operationId: "aiv.get",
        responses: {
          200: {
            description: "Work state for the session",
            content: {
              "application/json": {
                schema: resolver(AIV.WorkState.nullable()),
              },
            },
          },
        },
      }),
      validator("param", z.object({ sessionID: SessionID.zod })),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const state = AIV.get(sessionID)
        return c.json(state ?? null)
      },
    )
    .post(
      "/ingest",
      describeRoute({
        summary: "Manually ingest an event",
        description: "Manually push an event into the AIV processor for testing or external integration.",
        operationId: "aiv.ingest",
        responses: {
          200: {
            description: "Updated work state",
            content: {
              "application/json": {
                schema: resolver(AIV.WorkState),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          sessionID: SessionID.zod,
          text: z.string().optional(),
          files: z.string().array().optional(),
          toolName: z.string().optional(),
          active: z.boolean().optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        const state = AIV.ingestMessage(body)
        return c.json(state)
      },
    ),
)
