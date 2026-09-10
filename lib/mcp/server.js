// The Model Context Protocol itself: JSON-RPC in, JSON-RPC out.
//
// Hand-written rather than pulled from the SDK, because a tools-only server
// over Streamable HTTP is a dispatch table and nothing else. There is no
// session to keep — a Vercel function is gone by the next request, so this
// answers each POST on its own and never issues an Mcp-Session-Id, which the
// specification permits and which is the only design that survives a platform
// that may run the next call on a different machine.
//
// Everything here is transport-agnostic: `respond` takes a parsed JSON-RPC
// message and returns a message to send back, or null for a notification that
// wants no reply. api/mcp.js does the HTTP.
import { enabledTools } from "./tools.js";

/** Newest first. A client asking for one of these gets it back verbatim. */
const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_VERSION = SUPPORTED_VERSIONS[0];

export const SERVER_INFO = {
  name: "uec-church",
  title: "UEC Church",
  version: "1.0.0",
};

/*
 * Read by the model once, at connection. Worth spending words on: it is the
 * only chance to say what the vocabulary means before the first question is
 * asked, and "attendee" meaning something specific here is exactly the kind of
 * thing a tool description repeated fifteen times would not fix.
 */
const INSTRUCTIONS = `These tools read the records of a local church — its congregation, calendar, worship planning, small groups, meeting minutes, tasks and ledger.

Vocabulary, because it is not the obvious one:
- A **member** has joined the church. An **attendee** comes along but has not. Both are on the roll and both are returned by search_members; the "membership" argument separates them.
- A **ministry** is what somebody does in the church, and it is a controlled list. A **tag** is a free-text label used for describing people and deciding who a gathering is for. Call church_profile to see which of each exist before filtering on them.
- The calendar has three kinds of entry: one-off **events** somebody typed, **recurring** weekly services generated from a schedule, and **birthdays**, which are derived from the roll. list_events returns all three and marks which is which.
- Attendance is a **head count per gathering**, not a per-person register, so it can answer "how full was the service" but never "did Ana come".
- Money is kept in Philippine pesos.

Working practice:
- Dates are always YYYY-MM-DD and are resolved in the church's own timezone. church_profile reports today's date there; use it rather than assuming.
- Every listing tool is capped and reports "truncated". If it comes back true, narrow the filters rather than reporting a partial answer as complete.
- Contact numbers and home addresses are withheld unless a tool is asked for them. Ask only when the question genuinely needs them, and do not repeat them back in bulk.
- These are real people in a small congregation. Prayer concerns, minutes and member records are pastoral records: answer what was asked and leave the rest where it is.`;

/*
 * Appended only where the writing tools are actually on offer. A read-only
 * connector has no use for a paragraph about how to write, and spending the
 * model's attention on rules it cannot act on is how instructions stop being
 * read at all.
 */
const WRITE_INSTRUCTIONS = `

This connector can also change records. Working practice for that:
- Nothing here deletes. A gathering is cancelled, a task is ticked, a concern is marked answered. If asked to delete something, say what the nearest non-destructive action is and do that instead.
- Look the thing up before changing it. Ids come from the read tools; do not construct one. On update_member in particular, "ministries" and "tags" replace the existing lists rather than adding to them, so read the member first.
- Ministries, event types and ledger categories are fixed lists. A refusal names every valid value — read it and retry rather than guessing again.
- No write notifies anyone. If something needs announcing to the congregation, say so; it still has to be done in the app.
- Confirm before writing anything the user only implied, and report back exactly what was recorded, so a wrong entry is caught while they are still reading.`;

/* ------------------------------------------------------------ JSON-RPC */

const result = (id, value) => ({ jsonrpc: "2.0", id, result: value });

const failure = (id, code, message, data) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message, ...(data ? { data } : {}) },
});

export const ERRORS = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
};

/** A tool as tools/list describes it. */
const advertise = (tool) => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  inputSchema: tool.input,
  annotations: {
    title: tool.title,
    readOnlyHint: !tool.write,
    destructiveHint: false,
    // Reading the same records twice changes nothing; writing twice makes two.
    idempotentHint: !tool.write,
    openWorldHint: false,
  },
});

/**
 * A tool's answer, as MCP carries it.
 *
 * Text rather than structuredContent: every client can read a text block,
 * and pretty-printed JSON is both what the model wants and what a person
 * debugging the connector wants to see in a log.
 */
const toolResult = (payload) => ({
  content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
});

/**
 * A tool that threw. Deliberately a *result* and not a JSON-RPC error: the
 * model is meant to see "no member matched that id" and try something else,
 * and a protocol-level error would be swallowed by the client instead.
 */
const toolFailure = (error) => ({
  content: [{ type: "text", text: `Error: ${error?.message || String(error)}` }],
  isError: true,
});

/* ------------------------------------------------------------- dispatch */

/**
 * Answers one JSON-RPC message.
 *
 * @param message parsed JSON-RPC request or notification
 * @param options.allowWrites whether the writing tools are on offer
 * @returns the response to send, or null when nothing should be sent
 */
export async function respond(message, { allowWrites = false } = {}) {
  if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") {
    return failure(message?.id ?? null, ERRORS.INVALID_REQUEST, "Not a JSON-RPC 2.0 message");
  }

  const { id, method, params = {} } = message;
  // No id means a notification: acknowledge by saying nothing at all.
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize": {
        const asked = params.protocolVersion;
        return result(id, {
          protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : LATEST_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: allowWrites ? INSTRUCTIONS + WRITE_INSTRUCTIONS : INSTRUCTIONS,
        });
      }

      case "notifications/initialized":
      case "notifications/cancelled":
        return null;

      case "ping":
        return isNotification ? null : result(id, {});

      case "tools/list":
        return result(id, { tools: enabledTools(allowWrites).map(advertise) });

      case "tools/call": {
        const tool = enabledTools(allowWrites).find((t) => t.name === params.name);
        if (!tool) {
          // A tool that exists but is switched off deserves to say so, rather
          // than looking to the model like a name it hallucinated.
          const gated = !allowWrites && params.name;
          return failure(
            id,
            ERRORS.INVALID_PARAMS,
            gated
              ? `Unknown tool "${params.name}". Note that this connector is read-only; tools that change records are not enabled.`
              : `Unknown tool "${params.name}".`
          );
        }

        const args = params.arguments || {};
        const missing = (tool.input.required || []).filter(
          (key) => args[key] === undefined || args[key] === null || args[key] === ""
        );
        if (missing.length) {
          return result(id, toolFailure(new Error(`Missing required argument(s): ${missing.join(", ")}.`)));
        }

        try {
          return result(id, toolResult(await tool.run(args)));
        } catch (error) {
          return result(id, toolFailure(error));
        }
      }

      default:
        return isNotification ? null : failure(id, ERRORS.METHOD_NOT_FOUND, `Unknown method "${method}"`);
    }
  } catch (error) {
    if (isNotification) return null;
    return failure(id, ERRORS.INTERNAL, error?.message || "Internal error");
  }
}

/**
 * A whole POST body, which the 2025-03-26 protocol allowed to be an array of
 * messages. Returns the body to send back, or null when every message in it
 * was a notification and there is nothing to answer.
 */
export async function respondToBody(body, options) {
  if (Array.isArray(body)) {
    if (!body.length) {
      return failure(null, ERRORS.INVALID_REQUEST, "Empty batch");
    }
    const replies = (await Promise.all(body.map((m) => respond(m, options)))).filter(Boolean);
    return replies.length ? replies : null;
  }
  return respond(body, options);
}
