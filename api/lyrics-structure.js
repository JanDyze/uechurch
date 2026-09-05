// Identifies the shape of a song: which lines are a verse, which are the
// chorus, which sections are repeats of earlier ones, which lines are ad-libs
// rather than lyrics — and which lines are capitalised wrongly for a worship
// sheet, where a word addressing God is capitalised and the same word
// addressing a person is not.
//
// The model is given numbered lines and answers, for the structure, with
// numbers alone: line indices and labels from a fixed list, checked by
// lib/lyrics.js before anything is done with them. That split is the point.
// Asking a model to "return the lyrics, but labelled" invites it to fix a
// half-remembered line on the way past; asking it only where the chorus starts
// cannot.
//
// Capitalisation is the one thing it cannot answer in numbers, so a recased
// line does come back as text — and is then accepted only if it is the same
// line, word for word, differing in case alone (validateRecasing). A line that
// fails keeps the capitalisation the church typed, and the rest of the
// analysis still stands. This used to be a second pass behind its own button;
// it is here because it is the same read of the same song.

import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "../lib/firebaseAdmin.js";
import { validateStructure, validateRecasing, ALLOWED_SECTION_LABELS } from "../lib/lyrics.js";

const MODEL = "claude-sonnet-5";

const SYSTEM = `You prepare a worship song for a Filipino church: you identify its structure, and you fix its capitalisation. You are given the song's lines, numbered from 0. Many songs are in Tagalog.

Never correct a lyric. A line you do not recognise is a line you leave as it is — do not repair it from memory, do not fix a typo, do not translate or reword. The structure is answered in line numbers only; the only text you ever write back is a line whose capitalisation changed, and that line keeps every word it was given, spelled and spaced exactly as given.

Divide every line into consecutive sections that cover the whole song without gaps or overlaps. For each section give:
- "start" and "end": the first and last line number of that section, inclusive
- "label": one of ${ALLOWED_SECTION_LABELS.join(", ")} — optionally followed by a number, e.g. "Verse 2"
- "repeatOf": when this section repeats an earlier one, the index of that earlier section in your own list (0-based). Omit otherwise.

How to label:
- The section that comes back most often is the Chorus. Always label in English, even though the lyrics are usually Tagalog — never "Koro" or "Talata".
- A repeating section that always sits immediately before a chorus is a Pre-Chorus.
- A repeating section elsewhere, usually late in the song, is a Bridge.
- Everything else is a Verse, numbered in the order it first appears. Number verses only; do not number the chorus.
- A section that repeats an earlier one keeps that section's exact label — the second chorus is "Chorus", not "Chorus 2" — and carries repeatOf.

Also list "adlibLines": line numbers that are asides rather than lyrics — a shouted "(oh)", a "(2x)", a background echo in brackets, a stray artifact left by the page the lyrics were copied from. A line with real lyrics in it is not an ad-lib, even if part of it is bracketed. When unsure, leave it out.

Capitalisation:

Give "recased" an entry for each line whose capitalisation should change: the line number, and that line written out again with only its capitalisation altered. Keep every word, in order, spelled and spaced exactly as it was given — never join two words into one or split one into two, so "sa 'Yo" stays two words and does not become "Sa'Yo". A line you would hand back unchanged does not belong in "recased" at all. Leave a line out of "recased" when it is also an ad-lib.

Capitalise words that address or refer to God:
- Tagalog pronouns: Ikaw, Ka, Mo, Iyo, Iyong, Sayo, Kita, Kanya, Kanyang, Siya, Niya — and the same pronouns in the elided spellings a songbook actually uses: 'Yo, 'Yong, Mo't, Mo'y, Ka'y, Siya'y, 'Yo'y
- The formal address some hymns use for God: Kayo, Ninyo, Inyo
- Names and titles: Diyos, Panginoon, Ama, Espiritu Santo, Hesus, Kristo, Manunubos, Tagapagligtas
- English mixed into a Tagalog song: You, Your, Yours, He, Him, His

Leave those same words lowercase where they address a person rather than God — a testimony line sung to a friend, a parent, or the congregation. Judge that from the surrounding lines. When a line is genuinely ambiguous, leave it as it was written.

Three words need the judgement made explicitly, because each is ordinary Tagalog as often as it is a name for God: capitalise "Anak" only where it is the Son and not the singer ("ako'y anak ng Diyos" is the singer), "Hari" only where it is God and not a king in a story, and "Banal" only where it names God rather than describing something as holy.

Reply with JSON only, no prose and no code fence:
{ "sections": [ { "start": 0, "end": 3, "label": "Verse 1" } ], "adlibLines": [], "recased": { "2": "Ang 'Yong dahilan kung bakit ako'y" } }`;

function parseReply(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const caller = await requireUser(req);
  if (caller.error) return res.status(caller.status).json({ error: caller.error });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const lines = Array.isArray(req.body?.lines)
    ? req.body.lines.map((line) => String(line || ""))
    : [];

  if (lines.length < 2) return res.status(400).json({ error: "Not enough lyrics to work from" });
  if (lines.length > 400) return res.status(400).json({ error: "That is too long to analyse" });

  const numbered = lines.map((line, index) => `${index}: ${line}`).join("\n");

  try {
    const client = new Anthropic();

    const response = await client.messages.create({
      model: MODEL,
      // Raised from 4000 when recasing joined this pass: the structure is a
      // page of numbers, but the recased lines are text, and a song where most
      // lines address God hands back most of the song. Truncation here is not
      // a short answer, it is unparseable JSON.
      max_tokens: 8000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: numbered }],
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "Claude declined to analyse this song." });
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    let analysis;
    try {
      analysis = parseReply(text);
    } catch {
      return res.status(502).json({ error: "Could not read the analysis. Try again." });
    }

    const checked = validateStructure(analysis, lines.length);
    if (!checked.ok) {
      return res.status(422).json({ error: `Analysis rejected — ${checked.reason}.` });
    }

    // Every recased line is checked against the line it came from, and one
    // that fails is dropped on its own. Capitalisation is the smaller half of
    // this pass: a refusal here should cost that line's styling, not the
    // structure the same reply got right.
    const { accepted, refused } = validateRecasing(analysis?.recased, lines);

    // Gaps are not an error worth refusing over, but they would silently drop
    // lines when the text is rebuilt, so the caller is told what was covered.
    const covered = checked.sections.reduce((sum, s) => sum + (s.end - s.start + 1), 0);

    return res.status(200).json({
      sections: checked.sections,
      adlibLines: checked.adlibLines,
      recased: accepted,
      recasedRefused: refused.length,
      covered,
      total: lines.length,
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "The Claude API key was rejected." });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Too many requests just now — try again shortly." });
    }
    console.error("lyrics-structure failed", error);
    return res.status(500).json({ error: "Could not analyse the song. Try again." });
  }
}
