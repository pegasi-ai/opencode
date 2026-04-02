import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { Aiv } from "../../aiv"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

export const AivRoutes = lazy(() =>
  new Hono()
    .post(
      "/event",
      describeRoute({
        summary: "Append AIV event",
        description: "Record an agent intent/activity event for visualization.",
        operationId: "aiv.event.append",
        responses: {
          200: {
            description: "Event created",
            content: {
              "application/json": {
                schema: resolver(z.object({ id: z.string() })),
              },
            },
          },
        },
      }),
      validator("json", Aiv.EventInput),
      async (c) => {
        const input = c.req.valid("json")
        const result = Aiv.append(input)
        return c.json(result)
      },
    )
    .get(
      "/timeline/:sessionID",
      describeRoute({
        summary: "Get AIV timeline",
        description: "Get the event timeline for a session, ordered most recent first.",
        operationId: "aiv.timeline.get",
        responses: {
          200: {
            description: "Event timeline",
            content: {
              "application/json": {
                schema: resolver(Aiv.EventInfo.array()),
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
        const events = Aiv.timeline(sessionID, limit)
        return c.json(events)
      },
    )
    .get(
      "/state/:sessionID",
      describeRoute({
        summary: "Get AIV state",
        description: "Get the current work state for a session.",
        operationId: "aiv.state.get",
        responses: {
          200: {
            description: "Current state",
            content: {
              "application/json": {
                schema: resolver(Aiv.StateInfo.nullable()),
              },
            },
          },
        },
      }),
      async (c) => {
        const sessionID = c.req.param("sessionID")
        const state = Aiv.state(sessionID)
        return c.json(state)
      },
    )
    .get(
      "/state",
      describeRoute({
        summary: "List AIV states",
        description: "List current work states for all active sessions.",
        operationId: "aiv.state.list",
        responses: {
          200: {
            description: "List of states",
            content: {
              "application/json": {
                schema: resolver(Aiv.StateInfo.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const states = Aiv.listStates()
        return c.json(states)
      },
    ),
)
