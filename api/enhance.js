// Turns the raw notes someone typed during a meeting into minutes the church
// can file: one agenda item at a time, or the whole meeting at once.
//
// The notes are what a secretary actually types on a phone mid-discussion —
// Taglish, abbreviations, "2x2000", a name in brackets after a task, "di pa
// sure" against a booking nobody has confirmed. The job is to organise that,
// not to improve it.
//
// Which is the whole risk here. Minutes are a record: a fluent sentence about
// a decision nobody made is worse than an obviously incomplete page, because
// it will be read next month as what the church agreed. Everything in the
// prompt below that looks like nagging is aimed at that one failure.
//
// Previously this ran a cascade of small open models on Hugging Face — gpt2
// among them — against a 200-line prompt, capped at 500 output tokens, with a
// client-side formatter catching what came back. The prompt was never the
// binding constraint; the models were.

import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "../lib/firebaseAdmin.js";

const MODEL = "claude-opus-5";

// Both modes are the same job on a different scope, so the rules that keep the
// minutes honest are written once and shared.
const RULES = `Write only what the notes say.

- Never add, infer or invent anything: no attendee who is not named, no decision that was not reached, no deadline that was not given, no amount that was not written down.
- Never write a placeholder like "[Insert Date]" or "[Name]". Where the notes are silent, write "Not specified" or leave the line out entirely.
- A section with nothing behind it says "None mentioned". Do not fill a section to make the page look complete.
- Keep the notes' own names, amounts, dates and wording for decisions. Tidy the grammar around them, not them.
- The notes are usually Tagalog and English mixed. Write the minutes in English, but keep a Tagalog phrase where translating it would change what was meant, and leave names exactly as they were typed.
- Money is in Philippine pesos. Write it as ₱4,000. Where the notes imply arithmetic, do it and show your working so it can be checked: "2x2000" becomes "2 × ₱2,000 = ₱4,000". Total the expenses.
- Preserve uncertainty instead of resolving it. "di pa sure" is "pending confirmation", not a decision.
- A name in brackets or after a task is the person doing it: "letter (joyce)" is Joyce's task.
- Write in the third person, plainly: "the committee agreed", not "we agreed".`;

const agendaSystem = `You are minuting one agenda item for a Filipino church's meeting. You are given the item's title and the raw notes taken under it.

${RULES}

Cover only this agenda item. The opening prayer, attendance and adjournment belong to the meeting as a whole — leave them out.

Minutes follow the same three beats for every item: what was discussed, what was decided, and who now has to do something. Reply in Markdown with "##" headings in this order, omitting any heading the notes hold nothing for, except Discussion which is always written:

## Discussion
What was raised and considered, in a short paragraph or a few bullets. Include the dates and figures the notes give.

## Decisions
What was agreed, one bullet each. Where the notes give a reason, include it; where they do not, do not supply one. If nothing was settled, write "No decision was reached." and say what remains open.

## Action Items
A Markdown table — Task | Servant | Timeline | Status — when there is more than one; a short bullet list when there is one. "Not specified" fills a column the notes leave empty.

## Financial Matters
Each amount on its own line with what it is for, then a bold total. Omit this heading when the notes mention no money.

## Prayer Concerns
People or situations the notes raise for prayer.

## For Next Meeting
Anything explicitly left unresolved or deferred.

Output the Markdown and nothing else — no preamble, no code fence.`;

const meetingSystem = `You are writing up the minutes of a Filipino church's meeting. You are given the meeting's own details, then the raw notes from every agenda item, each under its own heading.

${RULES}

The meeting details given to you — the date, the time, the place, who was present — are facts from the church's records, not from the notes. Write them into the header as given. Never add an attendee, a time or a place that was not handed to you, and never invent one because a minute usually has it.

This sits above the per-item minutes, so under Business draw each item together in a few lines rather than reproducing it in full.

Reply in Markdown with "##" headings in this order, omitting any heading nothing was given for:

## Call to Order
The date, time and place, and who opened the meeting in prayer if the notes say so.

## Attendance
Present, and apologies, from the details given. Never from the notes.

## Approval of Previous Minutes
Only if the notes record the previous minutes being approved.

## Business
One "###" subheading per agenda item, in the order given, each with a few lines covering what was discussed and what was decided.

## Financial Matters
Every amount approved anywhere in the meeting, each with the agenda item it belongs to, then a bold total across all of them.

## Action Items
A Markdown table — Task | Servant | Timeline | Agenda Item — covering every commitment made in the meeting.

## Prayer Concerns
People or situations raised for prayer anywhere in the notes.

## For Next Meeting
What was left unresolved, and the next meeting's date if the notes give one.

## Adjournment
The closing time and closing prayer, if recorded.

End with these two lines exactly, and no signatures or names beneath them:

Prepared by: ______________________
Approved by: ______________________

Output the Markdown and nothing else — no preamble, no code fence.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // This endpoint bills Anthropic per call and used to be open to anyone who
  // found the URL. It is a church's meeting notes either way: signed in only.
  const caller = await requireUser(req);
  if (caller.error) return res.status(caller.status).json({ error: caller.error });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const agendaTitle = String(req.body?.agendaTitle || "").trim();
  const rawNotes = String(req.body?.rawNotes || "");
  if (!rawNotes.trim()) return res.status(400).json({ error: "No notes provided" });
  if (rawNotes.length > 60000) {
    return res.status(400).json({ error: "Those notes are too long to summarise in one go." });
  }

  // The caller says which it is. The sniff behind it is how this was decided
  // before — the overall summary arrives as "**Item**:" blocks — and is kept
  // only so an older client still gets the right prompt.
  const mode =
    req.body?.mode === "meeting" || req.body?.mode === "agenda"
      ? req.body.mode
      : rawNotes.split("**:\n").length > 1
        ? "meeting"
        : "agenda";

  const isMeeting = mode === "meeting";

  // The date, place and attendance are the church's own records, not something
  // to be read out of the notes — the notes never mention them, and a model
  // asked to write a header without them will supply a plausible one.
  const details = req.body?.details || {};
  const detailLines = isMeeting
    ? [
        ["Meeting", agendaTitle],
        ["Date", details.date],
        ["Time", [details.startTime, details.endTime].filter(Boolean).join(" – ")],
        ["Place", details.location],
        ["Present", (details.present || []).join(", ")],
        ["Apologies", (details.apologies || []).join(", ")],
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => `${label}: ${value}`)
    : agendaTitle
      ? [`Agenda item: ${agendaTitle}`]
      : [];

  const heading = detailLines.length ? `${detailLines.join("\n")}\n\n---\n\n` : "";

  try {
    // Built inside the try: the SDK throws here when the key is malformed, and
    // an unhandled throw at this point is a bare FUNCTION_INVOCATION_FAILED
    // rather than something the person clicking the button can act on.
    const client = new Anthropic();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: isMeeting ? meetingSystem : agendaSystem,
      thinking: { type: "adaptive" },
      // Minutes carry money and commitments, and the arithmetic in them is the
      // part a reader will trust without rechecking.
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: `${heading}${rawNotes}` }],
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "Claude declined to summarise these notes." });
    }

    const enhanced = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!enhanced) {
      return res.status(502).json({ error: "The summary came back empty. Try again." });
    }

    return res.status(200).json({ enhanced, mode });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "The Claude API key was rejected." });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Too many requests just now — try again shortly." });
    }
    console.error("enhance failed", error);
    return res.status(500).json({ error: "Could not write up those notes. Try again." });
  }
}

// Exported for the prompt check in scripts/ — the prompts are the artefact
// worth testing here, and they are what changes.
export { agendaSystem, meetingSystem };
