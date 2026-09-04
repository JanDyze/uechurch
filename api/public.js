// Everything the public page at "/" is made of — and the only way it can get
// there.
//
// Firestore's rules refuse anonymous reads: a visitor's browser is answered
// with permission-denied for appSettings/church, so every word an admin types
// under Settings > Public page would otherwise never leave the building and
// strangers would see the built-in defaults instead. This endpoint reads with
// the Admin SDK and publishes a deliberately narrow slice.
//
//   GET /api/public
//        The page's data as JSON. Cached at the edge — it changes when an
//        admin saves, not per visitor.
//
//   GET /api/public?image=logo|logoDark|hero&v=<stamp>
//   GET /api/public?image=photo&id=<gallery_photos id>
//        The bytes behind one picture. Images are served separately rather
//        than inlined as base64 so the JSON stays a few kilobytes, the browser
//        can lazy-load them, and each one is cached on its own.
//
// Nothing here is authorised, so nothing here may read anything that is not
// meant for the open internet. Three rules keep that honest:
//
//   1. The gallery is published album by album, and an admin can switch the
//      whole thing off or hold individual albums back under Settings > Public
//      page. The image route re-checks that on every request — otherwise a
//      guessed document id would be a way to read a held-back album.
//   2. Gatherings never carry a location. The church's own address is on the
//      page once, where the admin typed it; small groups and leaders' meetings
//      that meet at somebody's house must not put a member's home address on
//      the open web, and no filter can reliably tell one from the other.
//   3. Anything aimed at particular members — a gathering with audience tags —
//      and the inward-facing types (meetings, training) are not published at
//      all. Neither are birthdays, which is why no member documents are read.
import { db } from "../lib/firebaseAdmin.js";
import {
  collectOccurrences,
  zonedDateString,
  addDays,
  weekdayName,
  LAST_OCCURRENCE,
  DEFAULT_TIMEZONE,
} from "../lib/occurrences.js";

// How far ahead a visitor is shown, and how much of it. Long enough that a
// quiet fortnight still has something in it, short enough to stay a "what's
// coming up" rather than a calendar.
const HORIZON_DAYS = 75;
const MAX_GATHERINGS = 6;

// How many photos the page may draw on. The hero rotates through a few of
// them and the strip shows the rest; the client picks its own order, so a
// larger pool than either needs is what makes the page look different on two
// visits.
const MAX_PHOTOS = 12;

// Inward-facing by nature: an elders' meeting or a leaders' training session
// is not something a stranger can turn up to, and listing it reads as noise on
// a page whose whole job is "here is when you could join us".
const PRIVATE_TYPES = new Set(["meeting", "training"]);

const docsOf = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));

const hasAudienceTags = (data) =>
  Array.isArray(data?.audienceTags) && data.audienceTags.length > 0;

const ORDINALS = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", [LAST_OCCURRENCE]: "Last" };

/**
 * How often a weekly schedule comes round, in the words a visitor would use:
 * "Every Sunday", "1st & 3rd Saturday". Worth more to a stranger than the date
 * of the next one, which is why both are published.
 */
const cadenceLabel = (schedule = {}) => {
  const weekday = weekdayName(typeof schedule.weekday === "number" ? schedule.weekday : 0);
  if (!weekday) return "";
  const weeks = Array.isArray(schedule.occurrences) ? schedule.occurrences : [];
  if (!weeks.length) return `Every ${weekday}`;
  return `${weeks.map((week) => ORDINALS[week] || week).join(" & ")} ${weekday}`;
};

/**
 * The identity fields a visitor sees. Deliberately not merged with defaults:
 * the client owns those (src/data/appDefaults.js), so there is one copy of the
 * starting values rather than two that can drift apart.
 */
const publicChurch = (church = {}, stamp) => ({
  shortName: church.shortName || "",
  fullName: church.fullName || "",
  branch: church.branch || "",
  // Sent as URLs, not base64. `v` busts the cache the moment a new logo is
  // saved, which is what lets the bytes be cached hard.
  logo: church.logo ? `/api/public?image=logo&v=${stamp}` : "",
  logoDark: church.logoDark ? `/api/public?image=logoDark&v=${stamp}` : "",
});

/**
 * The landing block as stored, minus the base64 hero, which becomes a URL, and
 * minus the list of albums held back — which is a decision about the page, not
 * part of it, and naming the private ones on the page itself would be an odd
 * thing to publish.
 */
const publicLanding = (landing = {}, stamp) => {
  const { heroImage, hiddenAlbums, ...rest } = landing;
  return {
    ...rest,
    heroImage: heroImage ? `/api/public?image=hero&v=${stamp}` : "",
  };
};

/**
 * Upcoming gatherings a stranger could turn up to: stored events and the
 * weekly schedules expanded onto real dates, exactly as the app's own calendar
 * and the digest email expand them.
 *
 * Everything is passed to collectOccurrences before anything is filtered out,
 * so a cancelled or edited Sunday still suppresses the generated occurrence it
 * replaces. The public/private decision is made on the rows that come back.
 */
const publicGatherings = ({ events, schedules }, today) => {
  const privateSchedules = new Set(
    schedules.filter((s) => hasAudienceTags(s.data)).map((s) => s.id)
  );
  const privateEvents = new Set(
    events.filter((e) => hasAudienceTags(e.data)).map((e) => e.id)
  );

  const byId = new Map(schedules.map((s) => [s.id, s.data]));

  const rows = collectOccurrences(
    { events, schedules, members: [] },
    today,
    addDays(today, HORIZON_DAYS)
  );

  // A weekly service belongs on this list once, as the next time it happens.
  // Five Sundays in a row is a calendar rather than an invitation, and it would
  // push the things a visitor could not have guessed — the anniversary, the
  // outreach — off the end of a short list.
  const seenSeries = new Set();

  return rows
    .filter((row) => {
      if (PRIVATE_TYPES.has(String(row.type || "").toLowerCase())) return false;
      if (row.scheduleId && privateSchedules.has(row.scheduleId)) return false;
      if (row.firestoreId && privateEvents.has(row.firestoreId)) return false;
      if (row.scheduleId) {
        if (seenSeries.has(row.scheduleId)) return false;
        seenSeries.add(row.scheduleId);
      }
      return true;
    })
    .slice(0, MAX_GATHERINGS)
    .map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type || "",
      date: row.date,
      time: row.time || "",
      cadence: row.scheduleId ? cadenceLabel(byId.get(row.scheduleId)) : "",
      // Rule 2: no location, ever. See the header.
      recurring: row.source === "recurring",
    }));
};

/**
 * A random handful of the gallery: every photo whose album is still there and
 * has not been held back, shuffled and cut to a dozen. Only ids and captions
 * travel in the JSON — the bytes come one request at a time from the image
 * route, so this stays a few hundred bytes however big the gallery grows.
 *
 * Both reads use `select`, which is what keeps them cheap: a photo document is
 * a base64 image and an album document carries its cover, so pulling either
 * collection whole would move megabytes to list a set of ids.
 */
const publicPhotos = async (firestore, hidden) => {
  const [photoSnap, albumSnap] = await Promise.all([
    firestore.collection("gallery_photos").select("albumId").get(),
    firestore.collection("gallery_albums").select("title").get(),
  ]);

  const albumTitles = new Map();
  albumSnap.docs.forEach((d) => {
    if (!hidden.has(d.id)) albumTitles.set(d.id, d.data().title || "");
  });

  const photos = photoSnap.docs
    // An album can be deleted without its photos going with it. Those are not
    // anybody's decision to publish, so they stay out.
    .filter((d) => albumTitles.has(d.data().albumId))
    .map((d) => ({
      id: d.id,
      // A photo document never changes after it is uploaded, so its bytes can
      // be cached for good.
      url: `/api/public?image=photo&id=${d.id}`,
      album: albumTitles.get(d.data().albumId) || "",
    }));

  for (let i = photos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }
  return photos.slice(0, MAX_PHOTOS);
};

/** `data:image/webp;base64,...` -> the bytes and what they are. */
const decodeDataUrl = (value) => {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(String(value || ""));
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
};

/** One picture's bytes, after checking it is one this route may hand out. */
async function serveImage(firestore, req, res) {
  const { image, id } = req.query;
  const settings = await firestore.collection("appSettings").doc("church").get();
  const data = settings.exists ? settings.data() || {} : {};

  let source = "";
  let immutable = false;

  if (image === "logo") source = data.church?.logo;
  else if (image === "logoDark") source = data.church?.logoDark;
  else if (image === "hero") source = data.landing?.heroImage;
  else if (image === "photo") {
    // Rule 1, re-checked here rather than trusted from the listing: without
    // this a guessed document id would reach a held-back album.
    if (!id || data.landing?.showPhotos === false) {
      return res.status(404).json({ error: "Not found" });
    }
    const hidden = new Set(
      Array.isArray(data.landing?.hiddenAlbums) ? data.landing.hiddenAlbums : []
    );

    const photo = await firestore.collection("gallery_photos").doc(String(id)).get();
    const albumId = photo.exists ? photo.data()?.albumId : "";
    if (!albumId || hidden.has(albumId)) return res.status(404).json({ error: "Not found" });

    // The album still has to exist: deleting one leaves its photos behind, and
    // an orphan is not something anybody decided to publish.
    const album = await firestore.collection("gallery_albums").doc(albumId).get();
    if (!album.exists) return res.status(404).json({ error: "Not found" });

    source = photo.data()?.url;
    immutable = true;
  } else {
    return res.status(400).json({ error: "Unknown image" });
  }

  const decoded = decodeDataUrl(source);
  if (!decoded) return res.status(404).json({ error: "Not found" });

  res.setHeader("Content-Type", decoded.mime);
  res.setHeader("Content-Length", decoded.buffer.length);
  // A photo is addressed by an id that never changes its bytes; a logo or hero
  // is addressed with the settings document's own timestamp, so a new upload
  // is a new URL. Either way the bytes behind one URL are final.
  res.setHeader(
    "Cache-Control",
    immutable || req.query.v
      ? "public, max-age=3600, s-maxage=31536000, immutable"
      : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
  );
  return res.end(decoded.buffer);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  let firestore;
  try {
    firestore = db();
  } catch {
    // No service account configured — `npm run dev` without the env file, say.
    // The page falls back to what it can read for itself, so this is a state
    // to report rather than an error to shout about.
    return res.status(503).json({ error: "Public page data is not configured" });
  }

  try {
    if (req.query.image) return await serveImage(firestore, req, res);

    const settings = await firestore.collection("appSettings").doc("church").get();
    const data = settings.exists ? settings.data() || {} : {};
    const landing = data.landing || {};

    // Off means off: an install using this only as an internal tool answers
    // with nothing to publish rather than with its address and phone number.
    if (landing.enabled === false) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
      return res.status(200).json({ enabled: false });
    }

    const stamp = data.updatedAt?.toMillis?.() || 0;
    const today = zonedDateString(new Date(), DEFAULT_TIMEZONE);
    const hidden = new Set(Array.isArray(landing.hiddenAlbums) ? landing.hiddenAlbums : []);

    const [events, schedules, photos] = await Promise.all([
      firestore
        .collection("events")
        .select(
          "title",
          "type",
          "date",
          "time",
          "location",
          "description",
          "overrideOf",
          "isCancelled",
          "audienceTags"
        )
        .get(),
      firestore.collection("recurringSchedules").get(),
      landing.showPhotos === false ? [] : publicPhotos(firestore, hidden),
    ]);

    const gatherings =
      landing.showEvents === false
        ? []
        : publicGatherings(
            { events: docsOf(events), schedules: docsOf(schedules) },
            today
          );

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).json({
      enabled: true,
      church: publicChurch(data.church, stamp),
      landing: publicLanding(landing, stamp),
      gatherings,
      photos,
      timeZone: DEFAULT_TIMEZONE,
    });
  } catch (error) {
    console.error("Error building the public page payload:", error);
    return res.status(500).json({ error: "Could not load the page" });
  }
}
