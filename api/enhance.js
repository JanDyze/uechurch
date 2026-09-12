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

Write it so a tired person can read it on a phone and understand it the first time. That is the whole brief, and it decides everything below. These are read by volunteers catching up on a Tuesday night, not by a board. So:

- Everyday words. "We agreed to" not "it was resolved that". If a shorter word means the same thing, it is the right word.
- Short sentences. One idea each.
- One fact per bullet, and no bullet longer than one line on a phone — about fifteen words.
- Lead with the answer, never the reasoning.
- Bold only what someone came looking for: the decision, the amount, the name carrying a task.
- No filler. "It was discussed that" carries nothing; start at the noun.

Reply in Markdown with these "##" headings in this order, leaving out any heading the notes hold nothing for, except "What we talked about" which is always written:

## What we talked about
What was raised, as a few short bullets. Keep the dates and figures the notes give.

## What we decided
What was agreed, one bullet each. Where the notes give a reason, include it; where they do not, do not supply one. If nothing was settled, write "Nothing was decided yet." and say what is still open.

## Who does what
Always a Markdown table, with the header row Task | Who | By when | Status, even when there is only one row. "Not set" fills a cell the notes leave empty; never drop the column itself.

The Task cell reads as an instruction that makes sense on its own, away from this page — "Write the letter to the mayor", not "the letter". The Who cell holds only names, and only names the notes give. The By when cell uses the notes' own words — "by Friday", "before the anniversary" — and never a date the notes did not give.

## Money
A Markdown table with the header row What it is for | Amount | Status, one row per amount, and a last row whose first cell is **Total** with the sum in bold. Status is "Approved" or "Not yet". Show the arithmetic in the first cell where the notes imply it: "Barbers (2 x ₱2,000)". Leave this heading out entirely when no money was mentioned.

## Please pray for
People or situations the notes raise for prayer, one per bullet, name in bold.

## Still open
Anything explicitly left unresolved or put off, one short bullet each.

Output the Markdown and nothing else — no preamble, no code fence.`;

const meetingSystem = `You are writing up the minutes of a Filipino church's meeting. You are given the meeting's own details, then the raw notes from every agenda item, each under its own heading.

${RULES}

The meeting details given to you — the date, the time, the place, who was present — are facts from the church's records, not from the notes. Write them into the header as given. Never add an attendee, a time or a place that was not handed to you, and never invent one because a minute usually has it.

Write it so a tired person can read it on a phone and understand it the first time.

That is the whole brief, and it decides everything below. The people who read these are volunteers catching up on a Tuesday night, not a board. So:

- Everyday words. "We agreed to" not "it was resolved that". "Money" not "financial matters". If a shorter word means the same thing, it is the right word.
- Short sentences. One idea each. If a sentence needs a comma to hold two ideas together, make it two sentences.
- One fact per bullet, and no bullet longer than one line on a phone — about fifteen words.
- Lead with the answer. "**We will hold it at the gym.** The court is not free that week." Never the reasoning first.
- Bold only what someone came looking for: the decision, the amount, the name carrying a task.
- No filler. "It was discussed that", "The committee noted that", "Moving forward" — start at the noun instead.
- No jargon and no formal padding. Nothing needs to sound like a legal document.

Headings are plain questions, not the traditional minute-book sections. Reply in Markdown with these "##" headings in this order, leaving out any heading the notes hold nothing for:

## In short
Two to four bullets. The whole meeting for someone who reads nothing else: what was settled, what it costs, what is still hanging. Every bullet must be traceable to something further down — a shorter telling of the meeting, never an interpretation of it. If nothing was settled, say that plainly.

## What we talked about
One "###" subheading per agenda item, in the order given. Under each, at most two short bullets, then a line starting "**Decided:**" or "**Still deciding:**". Every item ends with one or the other, so nobody has to guess where it landed.

## Who does what
A Markdown table with the header row Task | Who | By when | About. One row per commitment made anywhere in the meeting. The Task cell reads as an instruction that makes sense on its own — "Write the letter to the mayor", not "the letter". The Who cell holds only names the notes give. The By when cell uses the notes' own words. "Not set" fills a cell the notes leave empty; never drop the column.

## Money
A Markdown table with the header row What it is for | Amount | Status, one row per amount, and a last row whose first cell is **Total** with the sum in bold. Status is "Approved" or "Not yet". Show the arithmetic in the first cell where the notes imply it: "Barbers (2 x ₱2,000)". Leave this heading out entirely when no money was mentioned.

## Still open
What was left hanging, one short bullet each, and the next meeting's date if the notes give one.

## Please pray for
People or situations raised for prayer, one per bullet, name in bold.

## Who was there
One line, from the details given and never from the notes: "Present (4): Ptr. Reyes, Joyce Santos, Dan Cruz, Mercy Villanueva". Add a second line for apologies if any were given. Then, on its own line, the date, time and place as one plain sentence.

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

  // Corrections typed by whoever is filing the minutes, carried on every
  // rewrite. Unlike the notes these come from a person who was in the room and
  // has read the draft, so where one contradicts the notes it wins — that is
  // the entire point of them, and it is the one place in this endpoint where
  // something outranks what was typed during the meeting.
  //
  // They are appended after the notes rather than folded into the system
  // prompt: the system prompt is the standing brief, and these are about this
  // document. A comment must never be able to rewrite the rules that keep the
  // minutes honest, so it arrives as user content, clearly fenced.
  const comments = Array.isArray(req.body?.comments)
    ? req.body.comments
        .map((comment) => ({
          text: String(comment?.text || "").trim().slice(0, 2000),
          quote: String(comment?.quote || "").trim().slice(0, 500),
        }))
        .filter((comment) => comment.text)
        .slice(0, 40)
    : [];

  const commentBlock = comments.length
    ? "\n\n---\n\nCORRECTIONS FROM THE PERSON FILING THESE MINUTES\n\n" +
      "These come from someone who was at the meeting and has read the previous draft. " +
      "Apply every one of them. Where a correction contradicts the notes above, the correction is right and the notes are out of date. " +
      "A correction may add a fact the notes do not contain — that is what it is for — but it does not license anything beyond what it says: everything else still comes only from the notes. " +
      "Never mention the corrections, quote them, or refer to a previous draft in the minutes themselves.\n\n" +
      comments
        .map((comment, index) =>
          comment.quote
            ? `${index + 1}. About "${comment.quote}": ${comment.text}`
            : `${index + 1}. ${comment.text}`
        )
        .join("\n")
    : "";

  // Newline-delimited JSON, one event per line, so the page can show the
  // minutes being written instead of a spinner.
  //
  // This used to be a single awaited call that returned the finished document.
  // A whole meeting at medium effort takes the better part of a minute, and
  // for all of it the page showed nothing — which reads as broken, and gets
  // the button pressed again. Streaming is not decoration here: the thinking
  // phase is genuinely quiet, and the writing phase genuinely is progress,
  // and the difference between them is the thing worth showing.
  //
  // The framing degrades safely. If anything between here and the browser
  // buffers the response, the client parses the same lines out of one lump
  // and lands exactly where the old JSON contract left it.
  let started = false;
  const send = (event) => {
    if (!started) {
      started = true;
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      // no-transform and X-Accel-Buffering keep proxies from holding the
      // chunks back until the end, which would quietly undo all of this.
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
    }
    res.write(`${JSON.stringify(event)}\n`);
    res.flush?.();
  };

  let stream;
  try {
    // Built here rather than at module scope: the SDK throws when the key is
    // malformed, and an unhandled throw is a bare FUNCTION_INVOCATION_FAILED
    // rather than something the person clicking the button can act on.
    const client = new Anthropic();

    stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: isMeeting ? meetingSystem : agendaSystem,
      thinking: { type: "adaptive" },
      // Minutes carry money and commitments, and the arithmetic in them is the
      // part a reader will trust without rechecking.
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: `${heading}${rawNotes}${commentBlock}` }],
    });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) });
  }

  const parts = [];
  let refused = false;

  try {
    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block?.type === "thinking") {
        send({ type: "phase", phase: "reading" });
      }
      if (event.type === "content_block_delta") {
        // Thinking text is not shown — it is working-out, not the record —
        // but the fact of it arriving is, so the page can say the model is
        // still on the notes rather than stalled.
        if (event.delta?.type === "thinking_delta") {
          send({ type: "thinking", length: event.delta.thinking?.length || 0 });
        }
        if (event.delta?.type === "text_delta" && event.delta.text) {
          parts.push(event.delta.text);
          send({ type: "text", delta: event.delta.text });
        }
      }
      if (event.type === "message_delta" && event.delta?.stop_reason === "refusal") {
        refused = true;
      }
    }
  } catch (error) {
    // Nothing sent yet means a normal HTTP error is still possible; once the
    // stream is open the only way to report is another line on it.
    if (!started) return res.status(statusFor(error)).json({ error: errorMessage(error) });
    send({ type: "error", error: errorMessage(error) });
    return res.end();
  }

  if (refused) {
    if (!started) return res.status(422).json({ error: "Claude declined to summarise these notes." });
    send({ type: "error", error: "Claude declined to summarise these notes." });
    return res.end();
  }

  const enhanced = parts.join("").trim();
  if (!enhanced) {
    if (!started) return res.status(502).json({ error: "The summary came back empty. Try again." });
    send({ type: "error", error: "The summary came back empty. Try again." });
    return res.end();
  }

  // The whole document again on the last line. The client could join the
  // deltas itself, but then a dropped chunk would be a silently truncated
  // minute — and a truncated minute looks exactly like a complete one.
  send({ type: "done", enhanced, mode });
  return res.end();
}

const statusFor = (error) => {
  if (error instanceof Anthropic.AuthenticationError) return 500;
  if (error instanceof Anthropic.RateLimitError) return 429;
  return 500;
};

const errorMessage = (error) => {
  if (error instanceof Anthropic.AuthenticationError) return "The Claude API key was rejected.";
  if (error instanceof Anthropic.RateLimitError) {
    return "Too many requests just now — try again shortly.";
  }
  console.error("enhance failed", error);
  return "Could not write up those notes. Try again.";
};

// Exported for the prompt check in scripts/ — the prompts are the artefact
// worth testing here, and they are what changes.
export { agendaSystem, meetingSystem };
