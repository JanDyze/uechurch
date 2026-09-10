# The church records as an MCP connector

`/api/mcp` serves this app's Firestore records to Claude over the Model Context
Protocol, so you can ask about the congregation, the calendar, worship
planning, small groups, minutes, tasks and the ledger in ordinary conversation
instead of opening the app and reading pages.

It is a **remote** MCP server — Streamable HTTP, stateless, one Vercel function.
Nothing is installed on your machine.

---

## What it can answer

Fifteen read-only tools, and two that write which are off by default.

| Tool | What it gives you |
| --- | --- |
| `church_profile` | Name, vision, service times, contacts, the size of the roll, and every ministry and tag in use |
| `search_members` | People, filtered by name, ministry, tag, sex, civil status, age or birthday month |
| `get_member` | One person in full, plus their small groups and open tasks |
| `list_events` | The calendar between two dates — events, recurring services and birthdays |
| `attendance_records` | The head count for each gathering |
| `attendance_summary` | Attendance totals and averages by type, month or gathering |
| `search_songs` | The worship library, searchable down to a line of lyrics |
| `get_lineup` | A month's worship plan: leaders, teams, songs and keys |
| `list_prayer_concerns` | What the church is praying for, by status and priority |
| `list_small_groups` | Groups, leaders, when they meet, how many belong |
| `get_small_group` | One group's membership and its recent sessions |
| `search_minutes` | Meeting minutes, full-text |
| `get_minute` | One meeting: agenda, discussions, decisions, action items |
| `list_tasks` | What is assigned, to whom, and what is overdue |
| `finance_summary` | Money in, out and net for a period, by category, month or account |
| `create_event` ⚠ | Adds a gathering to the calendar — **needs `MCP_WRITE_TOOLS=true`** |
| `add_prayer_concern` ⚠ | Records a prayer concern — **needs `MCP_WRITE_TOOLS=true`** |

Things it deliberately will not do: it never returns member portraits or gallery
photos, and `search_members` withholds contact numbers and home addresses
unless the question asks for them.

---

## Setting it up

### 1. Make a token

The endpoint reads with the Firebase Admin SDK, so Firestore's security rules
do not apply to it. **The token is the only thing standing between this URL and
every record the church keeps.** Generate a real one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 2. Put it in Vercel

Project → Settings → Environment Variables:

| Name | Value | Environments |
| --- | --- | --- |
| `MCP_TOKEN` | the string from step 1 | Production |
| `MCP_WRITE_TOOLS` | `false`, or omit it entirely | — |

`FIREBASE_SERVICE_ACCOUNT` must already be set; the connector reads through it.

Then redeploy — environment variables are read at request time, but a
deployment made before the variable existed has no `/api/mcp` route to serve
until the next build.

Without `MCP_TOKEN` the endpoint answers every request with "not configured".
That is deliberate: it fails shut, so a forgotten variable can never leave the
congregation's records open.

### 3. Add it to Claude

**Claude.ai (web and desktop).** Settings → Connectors → *Add custom connector*.
Paste the URL with the token as the last path segment:

```
https://uechurch.vercel.app/api/mcp/YOUR_MCP_TOKEN
```

Leave the OAuth fields blank. Custom connectors need a paid Claude plan (Pro,
Max, Team or Enterprise). Once it connects you will see the tools listed; start
a conversation and ask something like *"how has Sunday attendance been over the
last three months?"*

**Claude Code.** It can send a proper header, which is better — see the note
below:

```bash
claude mcp add --transport http uec-church https://uechurch.vercel.app/api/mcp \
  --header "Authorization: Bearer YOUR_MCP_TOKEN"
```

**Checking it by hand.** A browser GET on the endpoint reports its own state:

```bash
curl https://uechurch.vercel.app/api/mcp
# {"server":{...},"configured":true,"authorised":false,"writesEnabled":false}

curl -X POST https://uechurch.vercel.app/api/mcp \
  -H "Authorization: Bearer YOUR_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## About the token in the URL

Claude's custom connector form takes a URL and nothing else, so the token has to
travel in the path for that client. That is a genuine trade-off worth
understanding rather than glossing over:

- A URL ends up in more places than a header does — browser history, server
  logs, anything that records where a request went.
- Anyone holding that URL holds the whole congregation's records.

So: treat the URL itself as the password. Do not paste it into a group chat or a
shared document. Where a client can send `Authorization: Bearer <token>` — Claude
Code can — prefer that; the endpoint accepts both. If the URL is ever exposed,
change `MCP_TOKEN` in Vercel and redeploy; the old one stops working
immediately.

A wrong token gets a plain `403`, not a `401`, on purpose: a `401` is the
protocol's signal to go and start an OAuth flow, and there is no authorisation
server here to find.

---

## Turning writes on

`MCP_WRITE_TOOLS=true` adds `create_event` and `add_prayer_concern`. Read-only,
the worst this connector can do is answer a question badly. With writes on it
can put a gathering on the church calendar — so leave it off unless you want
that, and turn it off again afterwards.

The write tools do not send push notifications. Those are raised by the app when
a person saves an event, so anything added this way lands on the calendar
quietly.

---

## Running it locally

`npm run dev` serves the endpoint too, at `http://localhost:5173/api/mcp`, as
long as `MCP_TOKEN` is in `.env.local` alongside `FIREBASE_SERVICE_ACCOUNT`.
Note that local means the *real* Firestore — there is no emulator here, so a
write made in development is a write made.

The MCP Inspector is the quickest way to look at it:

```bash
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP
# URL: http://localhost:5173/api/mcp
# Authentication: Bearer Token -> your MCP_TOKEN
```

---

## How it is put together

```
api/mcp.js         HTTP: CORS, the token check, and the POST/GET contract
lib/mcp/server.js  the protocol: JSON-RPC dispatch, initialize, tools/list, tools/call
lib/mcp/tools.js   the seventeen tools — schemas and handlers
lib/mcp/data.js    shared Firestore reads, the member index, formatting
```

There is no MCP SDK dependency. A tools-only server over Streamable HTTP is a
dispatch table, and a Vercel function cannot hold a session between requests
anyway, so each POST is answered on its own and no `Mcp-Session-Id` is ever
issued — which the specification allows.

Adding a tool means adding one entry to the `TOOLS` array in `lib/mcp/tools.js`:
a name, a description the model reads to decide whether to reach for it, a JSON
Schema for the arguments, and an async handler returning plain data. Set
`write: true` on anything that changes a record so it stays behind the flag.
