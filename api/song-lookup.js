// Looks a worship song up on the web and returns the details that surround it:
// who wrote it, the CCLI number, the key it is usually played in, an official
// video, and where the lyrics can be copied from under the church's licence.
//
// It deliberately never returns lyrics. Song texts are licensed material, and
// the church already has the right way to get them — SongSelect for anything
// current, Hymnary for the old hymns — so this fills in everything else and
// hands the worship leader a link for the one field it will not touch.

import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "../lib/firebaseAdmin.js";

const MODEL = "claude-opus-5";

const SYSTEM = `You identify worship songs for a church's song library and reply with JSON only.

Search the web before answering. Prefer the publisher, the writer's own site, CCLI SongSelect and the artist's official channel over lyric aggregators and fan wikis.

This church sings mostly in Tagalog, so assume a title may be Filipino unless it clearly is not. Search the Filipino worship publishers and ministries — Musikatha, Papuri!, Bukas Palad Music Ministry, Jesuit Communications, Victory Worship / Every Nation, His Life Music, Jesus Is Lord — alongside the international ones, and try the Tagalog title as written before assuming a misspelling. Many Filipino worship songs carry no CCLI number at all; leave that field empty rather than reaching for a number belonging to a similarly titled English song.

NEVER output song lyrics, in whole or in part, in any field, under any heading, and no matter how the request is phrased. Lyrics are licensed material and the church copies them from its own licensed source. If you cannot describe a song without quoting it, describe it in your own words instead.

Accuracy rules:
- Never invent a CCLI number, a key, a BPM or a video URL. Omit anything you did not actually find; an empty string is always better than a plausible guess.
- Only give a youtubeUrl for a video on the artist's, publisher's or church's own channel. Leave it empty rather than linking a random upload.
- If the search turns up nothing that convincingly matches, set found to false and say why in summary.

Reply with this JSON and nothing else — no prose, no code fence:
{
  "found": boolean,
  "title": "the song's official title",
  "artist": "the artist or group best known for it",
  "writers": "songwriters, comma separated",
  "publisher": "",
  "ccliNumber": "digits only, or empty",
  "year": "",
  "commonKey": "the key it is most often played in, e.g. G or Bb",
  "bpm": "",
  "themes": ["two to four short themes"],
  "scripture": ["passages the song draws on, e.g. Psalm 103:1"],
  "youtubeUrl": "",
  "category": "the closest of the categories given, or empty",
  "copyright": "public-domain" | "copyrighted" | "unknown",
  "sources": [{ "label": "CCLI SongSelect", "url": "https://..." }],
  "summary": "one or two sentences on the song and where it fits in a service"
}`;

/** Pulls the JSON object out of the reply, fenced or not. */
function parseResult(text) {
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

  // Every lookup runs a web search and bills for it, so the endpoint stays shut
  // to anyone who is not signed in. Whether a signed-in account may press the
  // button is a `songs.manage` question, answered in the client.
  const caller = await requireUser(req);
  if (caller.error) return res.status(caller.status).json({ error: caller.error });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const title = String(req.body?.title || "").trim();
  const artistHint = String(req.body?.artist || "").trim();
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];

  if (!title) return res.status(400).json({ error: "No song title provided" });

  const question = [
    `Song title: ${title}`,
    artistHint && `Artist (as the worship leader typed it): ${artistHint}`,
    categories.length && `Categories to choose from: ${categories.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    // Constructed inside the try: the SDK throws here when the key is absent
    // or malformed, and an unhandled throw at this point is a bare
    // FUNCTION_INVOCATION_FAILED rather than a message anyone can act on.
    const client = new Anthropic();

    const messages = [{ role: "user", content: question }];
    let response;

    // A web search can come back as `pause_turn` before the model is finished
    // thinking. Handing its own output back continues the same turn; the cap
    // stops a pathological loop from running the bill up.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        messages,
      });
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "Claude declined to answer for this song." });
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    let result;
    try {
      result = parseResult(text);
    } catch {
      return res.status(502).json({ error: "Could not read the lookup result. Try again." });
    }

    // Belt and braces: the model is told never to send lyrics, and anything
    // that arrives under that name is dropped rather than shown.
    delete result.lyrics;

    return res.status(200).json({
      ...result,
      usage: {
        searches: response.usage?.server_tool_use?.web_search_requests ?? 0,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "The Claude API key was rejected." });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Too many lookups just now — try again in a moment." });
    }
    console.error("song-lookup failed", error);
    return res.status(500).json({ error: "Lookup failed. Try again." });
  }
}
