// Builds the digest emails: what is on this month, what is on today, what is
// coming up this week, and the administrator's full activity report.
//
// Everything here is pure once the Firestore reads at the top have run, so the
// endpoint can preview a digest without sending it.
import {
  collectOccurrences,
  monthBounds,
  addDays,
  formatTime,
  formatLongDate,
  formatShortDate,
  formatMonth,
} from "./occurrences.js";

/* ------------------------------------------------------------------ theme */

const BRAND = "#01779b";
const INK = "#111827";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const LINE = "#e5e7eb";
const WASH = "#f1f5f7";

// Event types get a quiet colour so a month of entries is scannable rather
// than a wall of identical rows. Keys match the eventTypes vocabulary in
// src/data/appDefaults.js; anything unrecognised falls back to plain grey.
const TYPE_STYLES = {
  worship: { bg: "#e0f2fe", fg: "#075985", label: "Worship" },
  prayer: { bg: "#ede9fe", fg: "#5b21b6", label: "Prayer" },
  meeting: { bg: "#fef3c7", fg: "#92400e", label: "Meeting" },
  fellowship: { bg: "#dcfce7", fg: "#166534", label: "Fellowship" },
  outreach: { bg: "#ffedd5", fg: "#9a3412", label: "Outreach" },
  training: { bg: "#e0e7ff", fg: "#3730a3", label: "Training" },
  celebration: { bg: "#fce7f3", fg: "#9d174d", label: "Celebration" },
  special: { bg: "#f3e8ff", fg: "#6b21a8", label: "Special" },
};

const typeStyle = (type) =>
  TYPE_STYLES[type] || { bg: "#f3f4f6", fg: MUTED, label: String(type || "Event") };

// Email clients strip <style> blocks and class selectors with abandon, so
// every rule here is inline and the layout is tables. Dark mode is left to the
// client: a white card on a light shell survives an inverted palette better
// than a hand-rolled dark theme that half of them would ignore.

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const PESO = "₱";

export const formatMoney = (value) => {
  const n = Number(value) || 0;
  return `${PESO}${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/* ----------------------------------------------------------- html pieces */

const heading = (text) => `
  <tr><td style="padding:26px 24px 8px 24px;">
    <div style="font:700 11px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${BRAND};">
      ${escapeHtml(text)}
    </div>
  </td></tr>`;

const paragraph = (text) => `
  <tr><td style="padding:4px 24px 12px 24px;">
    <p style="margin:0;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:${MUTED};">${text}</p>
  </td></tr>`;

const empty = (text) => `
  <tr><td style="padding:4px 24px 16px 24px;">
    <div style="padding:18px;border:1px dashed ${LINE};border-radius:12px;text-align:center;font:400 14px/1.5 Helvetica,Arial,sans-serif;color:${MUTED};">
      ${escapeHtml(text)}
    </div>
  </td></tr>`;

/** A small coloured pill naming the kind of event. */
const badge = (type) => {
  const { bg, fg, label } = typeStyle(type);
  return `<span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${bg};color:${fg};font:700 10px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;">${escapeHtml(
    label
  )}</span>`;
};

/**
 * One calendar entry. The time sits in its own left rail so a list of events
 * reads as a schedule rather than a paragraph of run-together text, and the
 * whole row is a bordered card so nothing looks like an unstyled mailing.
 */
const eventRow = (event, { showDate = true } = {}) => {
  const time = formatTime(event.time);
  // The rail carries whichever is the more useful anchor: the date across a
  // multi-day list, the clock time within a single day.
  const rail = showDate ? formatShortDate(event.date) : time;
  const railSub = showDate && time ? time : "";

  return `
  <tr><td style="padding:0 0 8px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid ${LINE};border-radius:12px;background:#ffffff;">
      <tr>
        <td width="92" valign="top"
            style="padding:14px 0 14px 14px;font:700 13px/1.4 Helvetica,Arial,sans-serif;color:${BRAND};white-space:nowrap;">
          ${escapeHtml(rail || "All day")}
          ${
            railSub
              ? `<div style="margin-top:2px;font:600 11px/1.4 Helvetica,Arial,sans-serif;color:${FAINT};">${escapeHtml(
                  railSub
                )}</div>`
              : ""
          }
        </td>
        <td valign="top" style="padding:14px 14px 14px 10px;border-left:1px solid ${LINE};">
          <div style="font:700 15px/1.35 Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(
            event.title
          )}</div>
          ${
            event.location
              ? `<div style="margin-top:3px;font:400 13px/1.5 Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(
                  event.location
                )}</div>`
              : ""
          }
          ${
            event.description
              ? `<div style="margin-top:3px;font:400 13px/1.5 Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(
                  event.description
                )}</div>`
              : ""
          }
          ${event.type ? `<div style="margin-top:8px;">${badge(event.type)}</div>` : ""}
        </td>
      </tr>
    </table>
  </td></tr>`;
};

// Each row is its own bordered card, so this outer table is only a spacer.
const eventTable = (events, options) => `
  <tr><td style="padding:4px 24px 0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${events.map((e) => eventRow(e, options)).join("")}
    </table>
  </td></tr>`;

/** A label/value grid — the activity report's counts, two to a row. */
const statGrid = (stats) => {
  const cell = (stat) =>
    stat
      ? `<td width="50%" valign="top" style="padding:6px;">
           <div style="padding:14px 16px;background:${WASH};border-radius:12px;">
             <div style="font:700 22px/1.2 Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(stat.value)}</div>
             <div style="margin-top:2px;font:600 11px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">${escapeHtml(
               stat.label
             )}</div>
           </div>
         </td>`
      : // A spacer keeps an odd final row half-width instead of stretching
        '<td width="50%"></td>';

  const rows = [];
  for (let i = 0; i < stats.length; i += 2) {
    rows.push(`<tr>${cell(stats[i])}${cell(stats[i + 1])}</tr>`);
  }

  return `
  <tr><td style="padding:0 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>
  </td></tr>`;
};

/** A simple two-column list: what happened, and when. */
const listRows = (items) => {
  if (!items.length) return "";
  return `
  <tr><td style="padding:0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${LINE};">
      ${items
        .map(
          (item) => `
        <tr>
          <td valign="top" style="padding:11px 10px 11px 0;border-bottom:1px solid ${LINE};">
            <div style="font:600 14px/1.4 Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(item.title)}</div>
            ${
              item.detail
                ? `<div style="margin-top:2px;font:400 13px/1.5 Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(
                    item.detail
                  )}</div>`
                : ""
            }
          </td>
          <td valign="top" align="right" style="padding:11px 0;border-bottom:1px solid ${LINE};white-space:nowrap;font:600 12px/1.6 Helvetica,Arial,sans-serif;color:${MUTED};">
            ${escapeHtml(item.meta || "")}
          </td>
        </tr>`
        )
        .join("")}
    </table>
  </td></tr>`;
};

const button = (label, url) => `
  <tr><td style="padding:22px 24px 4px 24px;">
    <a href="${escapeHtml(url)}"
       style="display:inline-block;padding:12px 22px;background:${BRAND};color:#ffffff;border-radius:10px;font:700 14px/1 Helvetica,Arial,sans-serif;text-decoration:none;">
      ${escapeHtml(label)}
    </a>
  </td></tr>`;

/**
 * Wraps the sections in the shell: church name, title, body, footer.
 * `unsubscribeNote` is omitted for the admin report, which nobody subscribes to.
 */
const layout = ({ church, title, subtitle, body, appUrl, unsubscribe = true }) => `
<!doctype html>
<html><body style="margin:0;padding:0;background:${WASH};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(subtitle || title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${WASH};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">

        <!-- Brand band. An image logo would be the obvious thing here, but the
             stored logo is a base64 WebP: Gmail blocks data: URIs outright and
             WebP is unreliable in Outlook, so most recipients would get a
             broken box. A solid colour band carries the identity with no such
             risk. bgcolor is repeated as an attribute for older Outlook. -->
        <tr><td bgcolor="${BRAND}" style="background:${BRAND};padding:22px 24px;">
          <div style="font:700 17px/1.3 Helvetica,Arial,sans-serif;color:#ffffff;">
            ${escapeHtml(church.shortName)}
          </div>
          ${
            church.branch
              ? `<div style="margin-top:3px;font:400 12px/1.4 Helvetica,Arial,sans-serif;color:#d6ecf4;">${escapeHtml(
                  church.branch
                )}</div>`
              : ""
          }
        </td></tr>

        <tr><td style="padding:26px 24px 0 24px;">
          <h1 style="margin:0;font:700 24px/1.3 Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(title)}</h1>
          ${
            subtitle
              ? `<p style="margin:6px 0 0 0;font:400 15px/1.5 Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(
                  subtitle
                )}</p>`
              : ""
          }
        </td></tr>
        ${body}

        <tr><td style="padding:8px 24px 26px 24px;">
          <div style="border-top:1px solid ${LINE};padding-top:16px;font:400 12px/1.6 Helvetica,Arial,sans-serif;color:${MUTED};">
            <strong style="color:${INK};">${escapeHtml(church.fullName)}</strong>${
              church.branch ? `<br>${escapeHtml(church.branch)}` : ""
            }
            <div style="margin-top:10px;color:${FAINT};">
            ${
              unsubscribe
                ? // Settings is administrators only, so point everyone else at
                  // the switch they can actually reach: the bell in the app.
                  `You are receiving this because you have an account at ${escapeHtml(church.shortName)}.
                   To stop these emails, <a href="${escapeHtml(appUrl)}" style="color:${BRAND};">open the app</a>
                   and turn off &ldquo;Email digests&rdquo; under the bell.`
                : "Sent to you because you are an administrator."
            }
            </div>
          </div>
        </td></tr>
      </table>

      <div style="max-width:600px;margin:14px auto 0;font:400 11px/1.5 Helvetica,Arial,sans-serif;color:${FAINT};text-align:center;">
        Sent automatically by the ${escapeHtml(church.shortName)} app.
      </div>
    </td></tr>
  </table>
</body></html>`;

/* --------------------------------------------------------- plain text */

const textEventLine = (event, showDate) => {
  const bits = [];
  if (showDate) bits.push(formatShortDate(event.date));
  const time = formatTime(event.time);
  if (time) bits.push(time);
  bits.push(event.title);
  if (event.location) bits.push(`at ${event.location}`);
  return `  - ${bits.join(" | ")}`;
};

const textShell = (church, title, lines, appUrl) =>
  [
    church.shortName.toUpperCase(),
    title,
    "",
    ...lines,
    "",
    "-".repeat(48),
    `${church.fullName}${church.branch ? ` - ${church.branch}` : ""}`,
    `${appUrl}`,
  ].join("\n");

/* --------------------------------------------------------- event digests */

export const DIGEST_KINDS = ["monthly", "today", "happening"];

export const DIGEST_LABELS = {
  monthly: "Monthly - what is on this month",
  today: "Daily - what is on today",
  happening: "Weekly - what is happening in the next 7 days",
};

/** The date window each digest kind covers, anchored on the church's today. */
export const rangeFor = (kind, today) => {
  if (kind === "monthly") return monthBounds(today);
  if (kind === "happening") return { start: today, end: addDays(today, 6) };
  return { start: today, end: today };
};

/**
 * Renders one of the three congregation digests.
 * Returns `null` when there is nothing to say, so the caller can skip the send
 * rather than mail everyone an empty page.
 */
export function buildEventDigest({ kind, today, church, occurrences, appUrl }) {
  if (!occurrences.length) return null;

  const groupedByDate = occurrences.reduce((acc, event) => {
    (acc[event.date] ||= []).push(event);
    return acc;
  }, {});
  const dates = Object.keys(groupedByDate).sort();

  let title;
  let subtitle;
  let body = "";
  let textLines = [];

  if (kind === "today") {
    const count = occurrences.length;
    title = "Today at church";
    subtitle = formatLongDate(today);
    body =
      paragraph(
        count === 1
          ? "One thing on the calendar today."
          : `<strong>${count}</strong> things on the calendar today.`
      ) + eventTable(occurrences, { showDate: false });
    textLines = [subtitle, "", ...occurrences.map((e) => textEventLine(e, false))];
  } else if (kind === "monthly") {
    title = formatMonth(today);
    subtitle = `${occurrences.length} ${occurrences.length === 1 ? "entry" : "entries"} on the calendar this month`;
    // Grouped by day so a month with thirty entries still scans quickly
    body = dates
      .map(
        (date) =>
          heading(formatLongDate(date)) +
          eventTable(groupedByDate[date], { showDate: false })
      )
      .join("");
    textLines = dates.flatMap((date) => [
      formatLongDate(date),
      ...groupedByDate[date].map((e) => textEventLine(e, false)),
      "",
    ]);
  } else {
    title = "What is happening";
    subtitle = `${formatLongDate(today)} to ${formatLongDate(addDays(today, 6))}`;
    body = paragraph("Here is the week ahead.") + eventTable(occurrences, { showDate: true });
    textLines = [subtitle, "", ...occurrences.map((e) => textEventLine(e, true))];
  }

  const subjects = {
    today: `Today at ${church.shortName}: ${formatLongDate(today)}`,
    monthly: `${formatMonth(today)} at ${church.shortName}`,
    happening: `This week at ${church.shortName}`,
  };

  return {
    subject: subjects[kind],
    html: layout({
      church,
      title,
      subtitle,
      body: body + button("Open the calendar", `${appUrl}/events`),
      appUrl,
    }),
    text: textShell(church, `${title} - ${subtitle}`, textLines, appUrl),
    count: occurrences.length,
  };
}

/* ------------------------------------------------------ activity report */

export const ACTIVITY_RANGES = {
  month: { label: "This month", days: null },
  quarter: { label: "Last 3 months", days: 92 },
  all: { label: "Everything", days: null },
};

/**
 * The administrator's full picture: every module, counted over the chosen
 * window, with the most recent entries spelled out underneath.
 */
export function buildActivityReport({ church, today, range, data, appUrl }) {
  const {
    upcoming,
    recentEvents,
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
    songsCount,
    linksCount,
    albumsCount,
    lineupsCount,
    from,
  } = data;

  const rangeLabel =
    range === "all"
      ? "All time"
      : `${formatLongDate(from)} to ${formatLongDate(today)}`;

  const inflow = finances
    .filter((t) => t.direction === "inflow")
    .reduce((sum, t) => sum + t.amount, 0);
  const outflow = finances
    .filter((t) => t.direction === "outflow")
    .reduce((sum, t) => sum + t.amount, 0);

  const activeMembers = members.filter((m) => m.isMember !== false).length;
  const pendingClaims = claims.filter((c) => c.status === "pending").length;
  const openConcerns = prayerConcerns.filter((c) => c.status !== "answered").length;
  const totalAttendees = attendance.reduce((sum, a) => sum + (a.totalAttendees || 0), 0);
  const averageAttendance = attendance.length ? Math.round(totalAttendees / attendance.length) : 0;

  const stats = [
    { label: "Members", value: String(activeMembers) },
    { label: "App accounts", value: String(accounts.length) },
    { label: "Events recorded", value: String(recentEvents.length) },
    { label: "Recurring schedules", value: String(schedules.length) },
    { label: "Attendance records", value: String(attendance.length) },
    { label: "Average attendance", value: String(averageAttendance) },
    { label: "Minutes filed", value: String(minutes.length) },
    { label: "Prayer concerns open", value: String(openConcerns) },
    { label: "Small group sessions", value: String(sessions.length) },
    { label: "Small groups", value: String(groups.length) },
    { label: "Money in", value: formatMoney(inflow) },
    { label: "Money out", value: formatMoney(outflow) },
  ];

  const sections = [];
  const textLines = [`Period: ${rangeLabel}`, ""];

  const pushSection = (label, items, emptyNote) => {
    sections.push(heading(label));
    if (items.length) {
      sections.push(listRows(items));
      textLines.push(
        label.toUpperCase(),
        ...items.map((i) => `  - ${[i.title, i.detail, i.meta].filter(Boolean).join(" | ")}`),
        ""
      );
    } else {
      sections.push(empty(emptyNote));
      textLines.push(label.toUpperCase(), `  ${emptyNote}`, "");
    }
  };

  sections.push(heading("At a glance"), statGrid(stats));
  textLines.push("AT A GLANCE", ...stats.map((s) => `  ${s.label}: ${s.value}`), "");

  if (upcoming.length) {
    sections.push(heading("Coming up next"));
    sections.push(eventTable(upcoming, { showDate: true }));
    textLines.push("COMING UP NEXT", ...upcoming.map((e) => textEventLine(e, true)), "");
  }

  pushSection(
    "Recent attendance",
    attendance.slice(0, 12).map((a) => ({
      title: a.eventTitle || "Untitled event",
      detail: [a.location, a.notes].filter(Boolean).join(" - "),
      meta: `${a.totalAttendees || 0} present - ${formatShortDate(a.date)}`,
    })),
    "No attendance recorded in this period."
  );

  pushSection(
    "Minutes",
    minutes.slice(0, 12).map((m) => ({
      title: m.title || "Untitled meeting",
      detail: [m.location, m.attendees?.length ? `${m.attendees.length} attending` : ""]
        .filter(Boolean)
        .join(" - "),
      meta: formatShortDate(m.date),
    })),
    "No minutes filed in this period."
  );

  pushSection(
    "Prayer concerns",
    prayerConcerns.slice(0, 15).map((c) => ({
      title: c.title || "Untitled concern",
      detail: [c.memberName, c.priority !== "normal" ? c.priority : ""].filter(Boolean).join(" - "),
      meta: c.status,
    })),
    "No prayer concerns raised in this period."
  );

  pushSection(
    "Small group sessions",
    sessions.slice(0, 12).map((s) => ({
      title: s.lesson?.title || "Session",
      detail: [groups.find((g) => g.id === s.groupId)?.name, s.venue].filter(Boolean).join(" - "),
      meta: `${s.attendance?.presentIds?.length || 0} present - ${formatShortDate(s.date)}`,
    })),
    "No small group sessions recorded in this period."
  );

  pushSection(
    "Ledger",
    finances.slice(0, 15).map((t) => ({
      title: t.description || t.category || "Transaction",
      detail: [t.category, t.payerPayee].filter(Boolean).join(" - "),
      meta: `${t.direction === "outflow" ? "-" : t.direction === "inflow" ? "+" : ""}${formatMoney(
        t.amount
      )} - ${formatShortDate(t.date)}`,
    })),
    "No transactions in this period."
  );

  pushSection(
    "Push notifications sent",
    notifications.slice(0, 10).map((n) => ({
      title: n.title || "Notification",
      detail: n.body || "",
      meta: `${n.sent || 0} delivered`,
    })),
    "No push notifications sent in this period."
  );

  const followUps = [];
  if (pendingClaims) {
    followUps.push({
      title: `${pendingClaims} member link ${pendingClaims === 1 ? "request" : "requests"} waiting`,
      detail: "Approve or decline them in Settings > Accounts.",
      meta: "action",
    });
  }
  if (!schedules.length) {
    followUps.push({
      title: "No recurring schedules configured",
      detail: "The calendar will stay empty until at least one is added.",
      meta: "setup",
    });
  }
  pushSection("Needs your attention", followUps, "Nothing is waiting on you.");

  const contentCounts = [
    `${songsCount} songs`,
    `${lineupsCount} worship lineups`,
    `${albumsCount} gallery albums`,
    `${linksCount} links`,
  ].join(" &middot; ");
  sections.push(heading("Library"), paragraph(contentCounts));
  textLines.push("LIBRARY", `  ${contentCounts.replace(/&middot;/g, "-")}`, "");

  return {
    subject: `${church.shortName} activity report - ${
      range === "all" ? "all time" : formatLongDate(today)
    }`,
    html: layout({
      church,
      title: "Activity report",
      subtitle: rangeLabel,
      body: sections.join("") + button("Open the app", appUrl),
      appUrl,
      unsubscribe: false,
    }),
    text: textShell(church, `Activity report - ${rangeLabel}`, textLines, appUrl),
  };
}

export { collectOccurrences };
