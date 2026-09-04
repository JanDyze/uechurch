// Searches YouTube for a song, so a worship leader who cannot find something in
// the song list can find it on YouTube in the same box and add it there and
// then, instead of leaving for the YouTube app and pasting a link back.
//
// The key lives here rather than in the bundle: YouTube bills a search against
// a daily quota, and a key shipped to the browser is a key anyone can spend.
//
// Requires the YOUTUBE_API_KEY env var (Google Cloud Console → APIs & Services
// → Credentials, with "YouTube Data API v3" enabled on the project).
import { requireUser } from "../lib/firebaseAdmin.js";

const ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

// A search costs 100 units of the 10,000/day the free quota allows, so it is
// worth one deliberate tap and not a keystroke.
const MAX_RESULTS = 8;

/** YouTube returns titles HTML-escaped ("Bless the Lord &amp; Sing"). */
const decodeEntities = (text) =>
  String(text || "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === "#") {
        const code = entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      return named[entity.toLowerCase()] ?? match;
    });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Every search spends quota the whole church shares, so the endpoint stays
  // shut to anyone who is not signed in. Whether a signed-in account may press
  // the button is a `songs.manage` question, answered in the client.
  const caller = await requireUser(req);
  if (caller.error) return res.status(caller.status).json({ error: caller.error });

  if (!process.env.YOUTUBE_API_KEY) {
    return res.status(500).json({ error: "YOUTUBE_API_KEY not configured" });
  }

  const query = String(req.body?.q || "").trim();
  if (!query) return res.status(400).json({ error: "No search term provided" });

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    // The app plays these inline, so a video that refuses to embed is a dead
    // row: it is filtered out by YouTube rather than by the person tapping it.
    videoEmbeddable: "true",
    videoSyndicated: "true",
    maxResults: String(MAX_RESULTS),
    q: query,
    key: process.env.YOUTUBE_API_KEY,
  });

  try {
    const response = await fetch(`${ENDPOINT}?${params}`);
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const reason = body?.error?.errors?.[0]?.reason || "";
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        return res.status(429).json({
          error: "YouTube's daily search limit is used up. It resets at midnight Pacific time.",
        });
      }
      if (response.status === 400 || response.status === 403) {
        console.error("youtube-search rejected", response.status, body?.error);
        return res.status(500).json({ error: "YouTube rejected the search key." });
      }
      return res.status(502).json({ error: "YouTube did not answer. Try again." });
    }

    const results = (body.items || [])
      .filter((item) => item?.id?.videoId)
      .map((item) => ({
        videoId: item.id.videoId,
        title: decodeEntities(item.snippet?.title),
        channelTitle: decodeEntities(item.snippet?.channelTitle),
        publishedAt: item.snippet?.publishedAt || "",
        thumbnail:
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          "",
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      }));

    return res.status(200).json({ query, results });
  } catch (error) {
    console.error("youtube-search failed", error);
    return res.status(500).json({ error: "Search failed. Try again." });
  }
}
