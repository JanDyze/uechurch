// Runs the /api/enhance prompts against a realistic set of notes and checks the
// result for the two things that matter: that the money adds up, and that
// nothing appears which was not in the notes.
//
//   node scripts/check-minutes-prompt.mjs           # the per-agenda-item prompt
//   node scripts/check-minutes-prompt.mjs meeting   # the whole-meeting prompt
//
// Reads ANTHROPIC_API_KEY from .env.local. Costs one API call per run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { agendaSystem, meetingSystem } from "../api/enhance.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Split on /\r?\n/, not "\n": the file has CRLF endings, and a trailing \r is a
// line terminator to a JS regex — "." will not match it and "$" will not sit
// before it, so every line silently fails to parse.
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

// Deliberately awkward: Taglish, a multiplier, a name in brackets, an unresolved
// booking, and NO decision on the sound system — the last one is the trap.
const AGENDA_NOTES = `anniversary 9-12
manggugupit 2x2000
tarpaulin 1500, sound system rental 3500 pero di pa sure kung available yung provider
letter sa mayor (joyce) - by friday
program flow - youth ang bahala
pinag usapan kung sa gym or sa covered court, walang napagdesisyunan
si nanay linda nasa ospital, ipagdasal natin
snacks - tita mercy mag aayos, 200 pax`;

const MEETING_NOTES = `**Anniversary Preparations**:
${AGENDA_NOTES}

**Building Repairs**:
tumutulo yung bubong sa likod ng altar
quotation 15000 sa contractor ni bro dan
napagkasunduan na ipagawa bago mag anniversary
si bro dan bahala makipag usap sa contractor

**Opening**:
nagbukas si pastor ng panalangin`;

const mode = process.argv[2] === "meeting" ? "meeting" : "agenda";
const notes = mode === "meeting" ? MEETING_NOTES : AGENDA_NOTES;
const title = mode === "meeting" ? "Church Council Meeting" : "Anniversary Preparations";

// The meeting header comes from the church's records, exactly as the app sends it.
const header =
  mode === "meeting"
    ? [
        `Meeting: ${title}`,
        "Date: 31 August 2026",
        "Time: 7:00 PM – 9:15 PM",
        "Place: Fellowship Hall",
        "Present: Ptr. Reyes, Sis Joyce, Bro Dan, Tita Mercy",
      ].join("\n") + "\n\n---\n\n"
    : `Agenda item: ${title}\n\n`;

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-opus-5",
  max_tokens: 16000,
  system: mode === "meeting" ? meetingSystem : agendaSystem,
  thinking: { type: "adaptive" },
  output_config: { effort: "medium" },
  messages: [
    {
      role: "user",
      content: `${header}${notes}`,
    },
  ],
});

const text = response.content
  .filter((block) => block.type === "text")
  .map((block) => block.text)
  .join("\n")
  .trim();

console.log(text);

// What the notes actually support, and what a model tends to add anyway.
const expected = [
  ["multiplier worked out", /4,?000/],
  ["kept the peso sign", /₱/],
  ["booking left unresolved", /pending|not confirmed|unconfirmed|di pa sure/i],
  ["task attributed to Joyce", /Joyce/],
  ["prayer for Nanay Linda", /Linda/],
];
const invented = [
  ["placeholder text", /\[(insert|name|date|tbd)/i],
  ["a venue was decided", /(decided|agreed|approved).{0,40}(gym|covered court)/i],
  ["a fabricated date", /202[0-9]-[0-9]{2}-[0-9]{2}/],
];

console.log("\n─────────── checks ───────────");
let failures = 0;
for (const [label, pattern] of expected) {
  const ok = pattern.test(text);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}
for (const [label, pattern] of invented) {
  const ok = !pattern.test(text);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  no ${label}`);
}

const total = (mode === "meeting" ? 15000 : 0) + 4000 + 1500 + 3500;
console.log(`\nExpected expense total: ₱${total.toLocaleString()} — check the Total line above.`);
console.log(
  `usage: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
);
process.exitCode = failures ? 1 : 0;
