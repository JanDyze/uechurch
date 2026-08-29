// Vercel serverless function: the church's outgoing email.
//
//   GET  /api/email?type=auto|monthly|today|happening
//        Scheduled sends. Authorised by CRON_SECRET, which Vercel Cron
//        attaches as `Authorization: Bearer <secret>`. `auto` is what the cron
//        entry in vercel.json actually calls: it sends today's digest every
//        day, adds the monthly one on the 1st, and adds the week-ahead one on
//        Mondays — one daily job covering all three, which also keeps it
//        inside the Hobby plan's cron allowance.
//
//   POST /api/email  { type, range?, preview? }
//        Manual sends from Settings. Administrators only.
//        type: monthly | today | happening -> to every opted-in account
//        type: activity                    -> the full report, to the caller
//        preview: true                     -> build it, report what would go
//                                             out, send nothing
//
// Digests go to every active account with a usable address. They are on by
// default, so an account leaves the list only by explicitly turning them off —
// `emailDigests.enabled === false` on its `userAccounts` document. An account
// that has never touched the switch is a recipient.
import { FieldValue } from "firebase-admin/firestore";
import { db, requireAdmin, isCronRequest } from "../lib/firebaseAdmin.js";
import { isMailConfigured, sendBulk, sendTo, isValidEmail } from "../lib/mailer.js";
import {
  buildEventDigest,
  buildActivityReport,
  collectOccurrences,
  rangeFor,
  DIGEST_KINDS,
  ACTIVITY_RANGES,
} from "../lib/digest.js";
import {
  zonedDateString,
  parseDateString,
  addDays,
  formatLongDate,
  DEFAULT_TIMEZONE,
} from "../lib/occurrences.js";

// A scheduled run can build three digests, and the activity report reads
// sixteen collections before it writes a word. The 10s default is not enough
// for either; 60 is the Hobby plan's ceiling.
export const config = { maxDuration: 60 };

const DEFAULT_CHURCH = {
  shortName: "UEC Canubing II",
  fullName: "United Evangelical Church Philippines Inc.",
  branch: "Canubing II Outreach",
};

const docsOf = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));

const appUrlFrom = (req) =>
  (process.env.APP_URL || `https://${req.headers.host}`).replace(/\/$/, "");

async function loadChurch(firestore) {
  const snap = await firestore.collection("appSettings").doc("church").get();
  return { ...DEFAULT_CHURCH, ...(snap.exists ? snap.data()?.church || {} : {}) };
}

/** Events, weekly schedules and birthdays — everything the calendar is made of. */
async function loadCalendar(firestore) {
  const [events, schedules, members] = await Promise.all([
    firestore
      .collection("events")
      .select("title", "type", "date", "time", "location", "description", "overrideOf", "isCancelled")
      .get(),
    firestore.collection("recurringSchedules").get(),
    // `select` matters here: member documents carry a base64 profile photo, and
    // pulling the whole collection to read a birthday would move megabytes.
    firestore
      .collection("members")
      .select("firstName", "lastName", "nickname", "dateOfBirth", "isMember")
      .get(),
  ]);
  return { events: docsOf(events), schedules: docsOf(schedules), members: docsOf(members) };
}

/**
 * Addresses to send `kind` to. Filtered in memory rather than with a `where`
 * on the nested field, so no composite index is needed and a document written
 * before this feature existed still reads correctly.
 *
 * Opt-out, not opt-in: only an explicit `false` removes an account. A missing
 * `emailDigests` map — which is every account that has never opened the
 * switch — is a subscriber. Keep this in step with DEFAULT_DIGEST_PREFS in
 * src/api/emailService.js, or the toggle will show one thing and the server
 * will do another.
 */
async function loadRecipients(firestore, kind) {
  const snap = await firestore
    .collection("userAccounts")
    .select("email", "displayName", "disabled", "emailDigests")
    .get();

  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((account) => {
      const prefs = account.emailDigests;
      if (prefs?.enabled === false) return false;
      if (prefs?.[kind] === false) return false;
      if (account.disabled) return false;
      return isValidEmail(account.email);
    })
    .map((account) => account.email);
}

/** Writes the send to `mailLog`, which the Settings panel reads back. */
async function logSend(firestore, entry) {
  try {
    await firestore.collection("mailLog").add({ ...entry, sentAt: FieldValue.serverTimestamp() });
  } catch (error) {
    // A failed log must never turn a delivered email into an error response
    console.error("Could not write mailLog entry:", error);
  }
}

/** Builds one congregation digest and, unless previewing, sends it. */
async function runDigest({ firestore, kind, today, appUrl, preview, trigger, actor }) {
  const [church, calendar] = await Promise.all([loadChurch(firestore), loadCalendar(firestore)]);
  const { start, end } = rangeFor(kind, today);
  const occurrences = collectOccurrences(calendar, start, end);

  const digest = buildEventDigest({ kind, today, church, occurrences, appUrl });
  if (!digest) {
    return {
      kind,
      skipped: true,
      reason: `Nothing on the calendar for ${
        kind === "today" ? formatLongDate(today) : `${formatLongDate(start)} to ${formatLongDate(end)}`
      }.`,
      recipients: 0,
      sent: 0,
    };
  }

  const recipients = await loadRecipients(firestore, kind);
  if (!recipients.length) {
    return {
      kind,
      skipped: true,
      reason: "Nobody has switched this digest on yet.",
      subject: digest.subject,
      events: digest.count,
      recipients: 0,
      sent: 0,
    };
  }

  if (preview) {
    return {
      kind,
      preview: true,
      subject: digest.subject,
      events: digest.count,
      recipients: recipients.length,
      sent: 0,
    };
  }

  const result = await sendBulk({
    recipients,
    subject: digest.subject,
    html: digest.html,
    text: digest.text,
    churchName: church.shortName,
  });

  await logSend(firestore, {
    kind,
    subject: digest.subject,
    events: digest.count,
    recipients: recipients.length,
    sent: result.sent,
    failed: result.failed,
    trigger,
    actor: actor || "",
    error: result.errors[0] || "",
  });

  return { kind, subject: digest.subject, events: digest.count, recipients: recipients.length, ...result };
}

/* ----------------------------------------------------- activity report */

const withinRange = (value, from) => {
  if (!from) return true;
  const date = typeof value === "string" ? value : value?.toDate?.()?.toISOString().slice(0, 10);
  return Boolean(date) && date >= from;
};

async function loadActivity(firestore, { from, today }) {
  const [
    events,
    schedules,
    members,
    attendance,
    minutes,
    prayerConcerns,
    sessions,
    groups,
    finances,
    accounts,
    claims,
    notifications,
    songs,
    links,
    albums,
    lineups,
  ] = await Promise.all([
    firestore
      .collection("events")
      .select("title", "type", "date", "time", "location", "description", "overrideOf", "isCancelled")
      .get(),
    firestore.collection("recurringSchedules").get(),
    firestore
      .collection("members")
      .select("firstName", "lastName", "nickname", "dateOfBirth", "isMember")
      .get(),
    firestore
      .collection("attendance")
      .select("eventTitle", "date", "location", "notes", "totalAttendees", "expectedAttendees")
      .get(),
    firestore.collection("minutes").select("title", "date", "location", "attendees").get(),
    firestore
      .collection("prayerConcerns")
      .select("title", "memberName", "status", "priority", "date", "createdAt")
      .get(),
    firestore
      .collection("sgSessions")
      .select("groupId", "date", "venue", "lesson", "attendance")
      .get(),
    firestore.collection("smallGroups").select("name", "active").get(),
    firestore
      .collection("finances")
      .select("date", "description", "direction", "type", "category", "amount", "payerPayee")
      .get(),
    firestore.collection("userAccounts").select("email", "displayName", "lastSignInAt").get(),
    firestore.collection("memberClaims").select("status").get(),
    firestore.collection("notifications").orderBy("sentAt", "desc").limit(30).get(),
    // Library sizes only — count aggregations never transfer the documents
    firestore.collection("worshipSongs").count().get(),
    firestore.collection("links").count().get(),
    firestore.collection("gallery_albums").count().get(),
    firestore.collection("worshipLineups").count().get(),
  ]);

  const byDateDesc = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));
  const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const allEvents = docsOf(events);
  const allSchedules = docsOf(schedules);
  const allMembers = docsOf(members);

  // The next fortnight, expanded the same way the calendar does it
  const upcoming = collectOccurrences(
    { events: allEvents, schedules: allSchedules, members: allMembers },
    today,
    addDays(today, 13)
  ).slice(0, 12);

  return {
    from,
    upcoming,
    recentEvents: rows(events).filter((e) => withinRange(e.date, from)),
    schedules: rows(schedules),
    members: rows(members),
    attendance: rows(attendance).filter((a) => withinRange(a.date, from)).sort(byDateDesc),
    minutes: rows(minutes).filter((m) => withinRange(m.date, from)).sort(byDateDesc),
    prayerConcerns: rows(prayerConcerns)
      .filter((c) => withinRange(c.date || c.createdAt, from))
      .sort(byDateDesc),
    sessions: rows(sessions).filter((s) => withinRange(s.date, from)).sort(byDateDesc),
    groups: rows(groups),
    finances: rows(finances)
      .filter((t) => withinRange(t.date, from))
      .map((t) => ({
        ...t,
        // Documents written before the ledger rewrite carry `type` instead
        direction: t.direction || (t.type === "expense" ? "outflow" : "inflow"),
        amount: Math.abs(Number(t.amount) || 0),
      }))
      .sort(byDateDesc),
    accounts: rows(accounts),
    claims: rows(claims),
    notifications: rows(notifications).filter((n) => withinRange(n.sentAt, from)),
    songsCount: songs.data().count,
    linksCount: links.data().count,
    albumsCount: albums.data().count,
    lineupsCount: lineups.data().count,
  };
}

async function runActivityReport({ firestore, today, range, appUrl, admin, preview }) {
  const from =
    range === "all"
      ? null
      : range === "quarter"
        ? addDays(today, -(ACTIVITY_RANGES.quarter.days))
        : `${today.slice(0, 7)}-01`;

  const [church, data] = await Promise.all([
    loadChurch(firestore),
    loadActivity(firestore, { from, today }),
  ]);

  const report = buildActivityReport({ church, today, range, data, appUrl });

  if (preview) {
    return { kind: "activity", preview: true, subject: report.subject, recipients: 1, sent: 0 };
  }

  await sendTo({
    to: admin.email,
    subject: report.subject,
    html: report.html,
    text: report.text,
    churchName: church.shortName,
  });

  await logSend(firestore, {
    kind: "activity",
    subject: report.subject,
    range,
    recipients: 1,
    sent: 1,
    failed: 0,
    trigger: "manual",
    actor: admin.email,
  });

  return { kind: "activity", subject: report.subject, to: admin.email, recipients: 1, sent: 1 };
}

/* ---------------------------------------------------------------- handler */

/** Which digests a scheduled `auto` run should send on this date. */
export function scheduledKinds(today) {
  const date = parseDateString(today);
  const kinds = ["today"];
  if (date?.getDate() === 1) kinds.unshift("monthly");
  if (date?.getDay() === 1) kinds.push("happening");
  return kinds;
}

export default async function handler(req, res) {
  // No wildcard CORS: this reaches into every collection and mails the
  // congregation, so it answers the app's own origin only.
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!isMailConfigured()) {
      return res.status(500).json({
        error: "Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.",
      });
    }

    const firestore = db();
    const appUrl = appUrlFrom(req);
    const today = zonedDateString(new Date(), DEFAULT_TIMEZONE);

    /* Scheduled run */
    if (req.method === "GET") {
      if (!isCronRequest(req)) return res.status(401).json({ error: "Not authorised" });

      const requested = String(req.query?.type || "auto");
      const kinds =
        requested === "auto"
          ? scheduledKinds(today)
          : DIGEST_KINDS.includes(requested)
            ? [requested]
            : [];
      if (!kinds.length) return res.status(400).json({ error: `Unknown digest type: ${requested}` });

      const results = [];
      for (const kind of kinds) {
        // Sequential on purpose — Gmail dislikes parallel SMTP bursts
        results.push(
          await runDigest({ firestore, kind, today, appUrl, trigger: "cron", preview: false })
        );
      }
      return res.status(200).json({ today, timeZone: DEFAULT_TIMEZONE, results });
    }

    /* Manual run */
    const admin = await requireAdmin(req);
    if (admin.error) return res.status(admin.status).json({ error: admin.error });

    const { type, range = "month", preview = false } = req.body || {};

    if (type === "activity") {
      if (!isValidEmail(admin.email)) {
        return res.status(400).json({ error: "Your account has no email address to send to." });
      }
      if (!Object.keys(ACTIVITY_RANGES).includes(range)) {
        return res.status(400).json({ error: `Unknown range: ${range}` });
      }
      const result = await runActivityReport({ firestore, today, range, appUrl, admin, preview });
      return res.status(200).json(result);
    }

    if (!DIGEST_KINDS.includes(type)) {
      return res
        .status(400)
        .json({ error: `type must be one of ${[...DIGEST_KINDS, "activity"].join(", ")}` });
    }

    const result = await runDigest({
      firestore,
      kind: type,
      today,
      appUrl,
      preview: Boolean(preview),
      trigger: "manual",
      actor: admin.email,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error sending email:", error);
    return res.status(500).json({ error: error.message || "Failed to send email" });
  }
}
