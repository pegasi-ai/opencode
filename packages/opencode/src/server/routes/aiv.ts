import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { AivPersistence } from "../../aiv"
import { lazy } from "../../util/lazy"

export const AivRoutes = lazy(() =>
  new Hono()
    .post(
      "/event",
      describeRoute({
        summary: "Append AIV event",
        description: "Persist an agent intent event to the append-only log.",
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
      validator("json", AivPersistence.EventInput),
      async (c) => {
        const input = c.req.valid("json")
        const result = AivPersistence.appendEvent(input)
        return c.json(result)
      },
    )
    .put(
      "/state",
      describeRoute({
        summary: "Upsert AIV state",
        description: "Persist or update the materialized state snapshot for a session.",
        operationId: "aiv.state.upsert",
        responses: {
          200: {
            description: "State upserted",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      validator("json", AivPersistence.StateInput),
      async (c) => {
        const input = c.req.valid("json")
        AivPersistence.upsertState(input)
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
                schema: resolver(AivPersistence.EventInfo.array()),
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
    )
    .get(
      "/state/:sessionID",
      describeRoute({
        summary: "Get persisted AIV state",
        description: "Get the persisted state snapshot for a session (for recovery or history).",
        operationId: "aiv.state.get",
        responses: {
          200: {
            description: "Persisted state",
            content: {
              "application/json": {
                schema: resolver(AivPersistence.StateInfo.nullable()),
              },
            },
          },
        },
      }),
      async (c) => {
        const sessionID = c.req.param("sessionID")
        const state = AivPersistence.getState(sessionID)
        return c.json(state)
      },
    )
    .get(
      "/state",
      describeRoute({
        summary: "List persisted AIV states",
        description: "List all persisted state snapshots, most recently updated first.",
        operationId: "aiv.state.list",
        responses: {
          200: {
            description: "List of persisted states",
            content: {
              "application/json": {
                schema: resolver(AivPersistence.StateInfo.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const states = AivPersistence.listStates()
        return c.json(states)
      },
    )
    .delete(
      "/state/:sessionID",
      describeRoute({
        summary: "Clear AIV data",
        description: "Remove all persisted events and state for a session.",
        operationId: "aiv.state.clear",
        responses: {
          200: {
            description: "Data cleared",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        const sessionID = c.req.param("sessionID")
        AivPersistence.clear(sessionID)
        return c.json(true)
      },
    ),
)
