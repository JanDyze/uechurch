// What an assistant is allowed to ask this church's records.
//
// Each entry is a tool as MCP means it: a name, a description the model reads
// to decide whether to reach for it, a JSON Schema for its arguments, and a
// handler that returns plain data. The handler's return value is serialised as
// the tool result — return objects and arrays, not prose.
//
// Two rules run through all of them:
//
//   Every list is bounded. A congregation is small but a ledger is not, and a
//   tool that answers "all of them" turns one question into a context window.
//   Every listing tool takes `limit`, defaults it low, and says how many rows
//   it left behind so the model can ask again rather than guess.
//
//   Personal details are opt-in. Names, ministries and birthdays are the
//   working vocabulary of a church office and travel freely. Phone numbers and
//   home addresses do not: `search_members` omits them unless asked, so a
//   question about who sings on Sunday cannot come back with everyone's
//   address attached.
import { db } from "../firebaseAdmin.js";
import { collectOccurrences } from "../occurrences.js";
import { provenanceForRow } from "../attendance.js";
// The chart of accounts, imported rather than restated. A ledger line this
// connector invents but the statement cannot print is a line the treasurer
// has to chase, so the validation reads from the same table the app prints.
import {
  ACCOUNT_KEYS,
  BANK,
  CASH,
  categoryOptions,
  isKnownCategory,
} from "../../src/data/financeChart.js";
import {
  ageOn,
  asDate,
  cached,
  canonical,
  clampLimit,
  dateArg,
  docsOf,
  excerpt,
  fullName,
  indexMembers,
  invalidate,
  loadMembers,
  loadVocabulary,
  matches,
  MCP_ACTOR,
  MCP_ACTOR_ID,
  nameOf,
  peso,
  shiftDays,
  today,
} from "./data.js";

/* ------------------------------------------------------ argument schemas */

const str = (description) => ({ type: "string", description });
const int = (description) => ({ type: "integer", description });
const bool = (description) => ({ type: "boolean", description });
const enumOf = (values, description) => ({ type: "string", enum: values, description });
const dateField = (description) => ({
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  description,
});
const limitOf = (fallback, max) =>
  int(`Most rows to return (default ${fallback}, maximum ${max}).`);

const schema = (properties, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

/** Rows plus the count that tells the model whether it saw everything. */
const page = (rows, limit, extra = {}) => ({
  ...extra,
  matched: rows.length,
  returned: Math.min(rows.length, limit),
  truncated: rows.length > limit,
  rows: rows.slice(0, limit),
});

/* ----------------------------------------------------------- the church */

const churchProfile = async () => {
  const [settings, members] = await Promise.all([
    db().collection("appSettings").doc("church").get(),
    loadMembers(),
  ]);
  const data = settings.exists ? settings.data() : {};
  const church = data.church || {};
  const landing = data.landing || {};

  return {
    name: church.fullName || church.shortName || "",
    shortName: church.shortName || "",
    branch: church.branch || "",
    vision: landing.vision || "",
    mission: landing.mission || "",
    about: landing.about || "",
    address: landing.address || "",
    phone: landing.phone || "",
    email: landing.email || "",
    facebook: landing.facebook || "",
    // The service times as an administrator worded them for the public page.
    services: Array.isArray(landing.services) ? landing.services : [],
    roll: {
      members: members.filter((m) => m.isMember).length,
      attendees: members.filter((m) => !m.isMember).length,
      total: members.length,
    },
    ministries: [...new Set(members.flatMap((m) => m.ministries))].sort(),
    tags: [...new Set(members.flatMap((m) => m.tags))].sort(),
    today: today(),
  };
};

/* ------------------------------------------------------------- the roll */

const memberRow = (member, withContact) => ({
  id: String(member.id),
  name: fullName(member),
  nickname: member.nickname || undefined,
  isMember: member.isMember,
  age: ageOn(member.dateOfBirth),
  birthday: member.dateOfBirth || undefined,
  sex: member.sex || undefined,
  civilStatus: member.civilStatus || undefined,
  ministries: member.ministries.length ? member.ministries : undefined,
  tags: member.tags.length ? member.tags : undefined,
  ...(withContact
    ? {
        contactNumber: member.contactNumber || undefined,
        address: member.address || undefined,
        occupation: member.occupation || undefined,
      }
    : {}),
});

const searchMembers = async (args = {}) => {
  const limit = clampLimit(args.limit, 40, 300);
  const members = await loadMembers();
  const month = args.birthdayMonth ? String(args.birthdayMonth).padStart(2, "0") : null;

  const rows = members
    .filter((member) => {
      if (args.membership === "member" && !member.isMember) return false;
      if (args.membership === "attendee" && member.isMember) return false;
      if (args.ministry && !member.ministries.some((m) => matches(m, args.ministry))) return false;
      if (args.tag && !member.tags.some((t) => matches(t, args.tag))) return false;
      if (args.sex && !matches(member.sex, args.sex)) return false;
      if (args.civilStatus && !matches(member.civilStatus, args.civilStatus)) return false;
      if (month && String(member.dateOfBirth || "").slice(5, 7) !== month) return false;
      if (args.minAge != null && (ageOn(member.dateOfBirth) ?? -1) < args.minAge) return false;
      if (args.maxAge != null && (ageOn(member.dateOfBirth) ?? 999) > args.maxAge) return false;
      if (!args.query) return true;
      return [
        fullName(member),
        member.nickname,
        member.occupation,
        member.address,
        member.ministries.join(" "),
        member.tags.join(" "),
      ].some((field) => matches(field, args.query));
    })
    .sort((a, b) => fullName(a).localeCompare(fullName(b)))
    .map((member) => memberRow(member, Boolean(args.includeContact)));

  return page(rows, limit, { contactDetailsIncluded: Boolean(args.includeContact) });
};

const getMember = async (args = {}) => {
  const members = await loadMembers();
  const wanted = String(args.memberId ?? "").trim();

  let member = wanted ? indexMembers(members).get(wanted) : null;
  if (!member && args.name) {
    const hits = members.filter(
      (m) => matches(fullName(m), args.name) || matches(m.nickname, args.name)
    );
    if (hits.length > 1) {
      return {
        ambiguous: true,
        message: `"${args.name}" matches ${hits.length} people. Call get_member again with one of these ids.`,
        candidates: hits.slice(0, 20).map((m) => ({ id: String(m.id), name: fullName(m) })),
      };
    }
    member = hits[0] || null;
  }
  if (!member) return { found: false, message: "No member matched that id or name." };

  // The one field the projection leaves out, read only for the one person.
  const doc = await db().collection("members").doc(member.docId).get();
  const relatives = doc.exists ? doc.data().relatives || {} : {};

  const [groups, tasks] = await Promise.all([
    db().collection("smallGroups").get(),
    db().collection("tasks").where("done", "==", false).get(),
  ]);
  // Either id may be the one a reference was written against; see data.js.
  const ids = new Set([String(member.id), String(member.docId)]);
  const holds = (list) => (Array.isArray(list) ? list : []).some((id) => ids.has(String(id)));

  return {
    found: true,
    ...memberRow(member, true),
    relatives: Object.keys(relatives).length ? relatives : undefined,
    smallGroups: docsOf(groups)
      .filter((g) => holds(g.memberIds) || ids.has(String(g.leaderId)) || holds(g.coLeaderIds))
      .map((g) => ({
        id: g.id,
        name: g.name || "",
        role: ids.has(String(g.leaderId))
          ? "leader"
          : holds(g.coLeaderIds)
            ? "co-leader"
            : "member",
      })),
    openTasks: docsOf(tasks)
      .filter((t) => t.scope !== "dev" && holds(t.assigneeIds))
      .map((t) => ({
        id: t.id,
        title: t.title || "",
        dueDate: t.dueDate || "",
        priority: t.priority || "normal",
      })),
  };
};

/* ---------------------------------------------------------- the calendar */

const loadCalendarSources = () =>
  cached("calendar", async () => {
    const [events, schedules] = await Promise.all([
      db().collection("events").get(),
      db().collection("recurringSchedules").get(),
    ]);
    return {
      events: events.docs.map((d) => ({ id: d.id, data: d.data() })),
      schedules: schedules.docs.map((d) => ({ id: d.id, data: d.data() })),
    };
  });

const listEvents = async (args = {}) => {
  const from = dateArg(args.from, today());
  const to = dateArg(args.to, shiftDays(from, 30));
  if (to < from) throw new Error("`to` is before `from`.");
  const limit = clampLimit(args.limit, 60, 300);

  const [{ events, schedules }, members] = await Promise.all([
    loadCalendarSources(),
    args.includeBirthdays === false ? [] : loadMembers(),
  ]);

  const rows = collectOccurrences({ events, schedules, members }, from, to)
    .filter((row) => !args.type || matches(row.type, args.type))
    .filter((row) => !args.query || matches(`${row.title} ${row.description}`, args.query))
    .map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type || undefined,
      date: row.date,
      time: row.time || undefined,
      location: row.location || undefined,
      description: excerpt(row.description, 300) || undefined,
      // "event" is a one-off somebody typed, "recurring" is a weekly service
      // generated from the schedule, "birthday" is nobody's decision at all.
      source: row.source,
    }));

  return page(rows, limit, { from, to });
};

/* --------------------------------------------------------- who turned up */

const loadAttendance = (from, to) =>
  db()
    .collection("attendance")
    .where("date", ">=", from)
    .where("date", "<=", to)
    .get()
    .then(docsOf);

/**
 * How many the gathering was for.
 *
 * The field is a head count on a record derived from an event and a list of
 * member ids on one derived from a meeting — see utils/audience.js, which
 * spells the same case out for the same reason. Passing it through raw put a
 * bare array of numbers into the tool result where a count belonged.
 */
const expectedCount = (value) => {
  if (Array.isArray(value)) return value.length || undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const attendanceRecords = async (args = {}) => {
  const from = dateArg(args.from, shiftDays(today(), -90));
  const to = dateArg(args.to, today());
  const limit = clampLimit(args.limit, 40, 200);

  const rows = (await loadAttendance(from, to))
    .filter((r) => !args.eventType || matches(r.eventType, args.eventType))
    .filter((r) => !args.query || matches(`${r.eventTitle} ${r.notes}`, args.query))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((r) => ({
      id: r.id,
      date: r.date || "",
      title: r.eventTitle || "",
      type: r.eventType || undefined,
      time: r.time || undefined,
      present: r.totalAttendees || 0,
      // How many the audience tags said to expect, when the gathering was for
      // a particular set of people rather than everyone.
      expected: expectedCount(r.expectedAttendees),
      notes: excerpt(r.notes, 200) || undefined,
    }));

  return page(rows, limit, { from, to });
};

const attendanceSummary = async (args = {}) => {
  const from = dateArg(args.from, shiftDays(today(), -180));
  const to = dateArg(args.to, today());
  const groupBy = args.groupBy || "eventType";

  const records = await loadAttendance(from, to);
  const keyOf = (r) =>
    groupBy === "month"
      ? String(r.date || "").slice(0, 7)
      : groupBy === "event"
        ? r.eventTitle || "(untitled)"
        : r.eventType || "(no type)";

  const buckets = new Map();
  for (const record of records) {
    const key = keyOf(record);
    const bucket = buckets.get(key) || { key, sessions: 0, total: 0, lowest: Infinity, highest: 0 };
    const count = record.totalAttendees || 0;
    bucket.sessions += 1;
    bucket.total += count;
    bucket.lowest = Math.min(bucket.lowest, count);
    bucket.highest = Math.max(bucket.highest, count);
    buckets.set(key, bucket);
  }

  const groups = [...buckets.values()]
    .map((b) => ({
      ...b,
      lowest: b.sessions ? b.lowest : 0,
      average: b.sessions ? Math.round(b.total / b.sessions) : 0,
    }))
    .sort((a, b) => (groupBy === "month" ? a.key.localeCompare(b.key) : b.total - a.total));

  const sessions = records.length;
  const total = records.reduce((sum, r) => sum + (r.totalAttendees || 0), 0);

  return {
    from,
    to,
    groupBy,
    overall: {
      sessions,
      totalAttendances: total,
      average: sessions ? Math.round(total / sessions) : 0,
    },
    groups,
    note:
      "Counts are head counts recorded per gathering, not per person: the same individual " +
      "attending twice is two attendances. Small group sessions keep their own attendance and " +
      "are not counted here.",
  };
};

/* ------------------------------------------------------------- worship */

/**
 * A song carries no single key.
 *
 * `leaderKeys` maps a member id to the key that leader sings it in, because
 * two song leaders transpose the same song differently and the lineup picks
 * the key off whoever is leading that Sunday. Resolved to names here, which is
 * the only form in which it means anything to a reader.
 */
const keysByLeader = (leaderKeys, index) =>
  Object.entries(leaderKeys || {})
    .filter(([, key]) => key)
    .map(([id, key]) => ({ leader: nameOf(index, id), key }));

const searchSongs = async (args = {}) => {
  const limit = clampLimit(args.limit, 40, 200);
  const [songs, members] = await Promise.all([
    cached("songs", () => db().collection("worshipSongs").get().then(docsOf)),
    loadMembers(),
  ]);
  const index = indexMembers(members);
  const wantedKey = args.key ? String(args.key).toLowerCase() : null;

  const rows = songs
    .filter((s) => !args.category || matches(s.category, args.category))
    .filter(
      (s) =>
        !wantedKey ||
        Object.values(s.leaderKeys || {}).some((k) => String(k).toLowerCase() === wantedKey)
    )
    .filter(
      (s) => !args.query || [s.title, s.lyrics, s.notes].some((f) => matches(f, args.query))
    )
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
    .map((s) => {
      const keys = keysByLeader(s.leaderKeys, index);
      return {
        id: s.id,
        title: s.title || "",
        category: s.category || undefined,
        youtubeUrl: s.youtubeUrl || undefined,
        keys: keys.length ? keys : undefined,
        notes: excerpt(s.notes, 200) || undefined,
        hasLyrics: Boolean(s.lyrics),
      };
    });

  return page(rows, limit);
};

const getLineup = async (args = {}) => {
  const month = String(args.month || today().slice(0, 7));
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Not a month: "${month}". Use YYYY-MM.`);

  const [doc, members] = await Promise.all([
    db().collection("worshipLineups").doc(month).get(),
    loadMembers(),
  ]);
  if (!doc.exists) {
    return { month, planned: false, message: "Nothing has been planned for that month." };
  }

  const index = indexMembers(members);
  const data = doc.data();

  return {
    month,
    planned: true,
    // A draft is visible only to whoever plans the month; say so rather than
    // letting it read as settled.
    status: data.status === "published" ? "published" : "draft",
    updatedBy: data.updatedBy || undefined,
    sundays: (Array.isArray(data.sundays) ? data.sundays : [])
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((sunday) => ({
        date: sunday.date || "",
        theme: sunday.theme || undefined,
        leader: sunday.leaderId ? nameOf(index, sunday.leaderId) : "(not assigned)",
        team: (sunday.teamIds || []).map((id) => nameOf(index, id)),
        songs: (sunday.songs || []).map((song) => ({
          title: song.title || "",
          key: song.key || undefined,
          note: song.note || undefined,
        })),
      })),
  };
};

/* ---------------------------------------------------------------- care */

const listPrayerConcerns = async (args = {}) => {
  const limit = clampLimit(args.limit, 30, 200);
  const concerns = await db().collection("prayerConcerns").get().then(docsOf);

  const rows = concerns
    .filter((c) => !args.status || String(c.status || "active") === args.status)
    .filter((c) => !args.priority || String(c.priority || "normal") === args.priority)
    .filter((c) => !args.query || matches(`${c.title} ${c.description} ${c.memberName}`, args.query))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .map((c) => ({
      id: c.id,
      title: c.title || "",
      about: c.memberName || undefined,
      status: c.status || "active",
      priority: c.priority || "normal",
      date: c.date || asDate(c.createdAt) || undefined,
      description: excerpt(c.description, 400) || undefined,
      notes: excerpt(c.notes, 200) || undefined,
    }));

  return page(rows, limit);
};

/* -------------------------------------------------------- small groups */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const listSmallGroups = async (args = {}) => {
  const limit = clampLimit(args.limit, 30, 100);
  const [groups, members] = await Promise.all([
    db().collection("smallGroups").get().then(docsOf),
    loadMembers(),
  ]);
  const index = indexMembers(members);

  const rows = groups
    .filter((g) => (args.activeOnly === false ? true : g.active !== false))
    .filter((g) => !args.query || matches(`${g.name} ${g.description}`, args.query))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    .map((g) => ({
      id: g.id,
      name: g.name || "",
      description: excerpt(g.description, 200) || undefined,
      leader: g.leaderId ? nameOf(index, g.leaderId) : "(none)",
      coLeaders: (g.coLeaderIds || []).map((id) => nameOf(index, id)),
      memberCount: (g.memberIds || []).length,
      meets:
        typeof g.meetingDay === "number"
          ? `${WEEKDAYS[g.meetingDay]}${g.meetingTime ? ` ${g.meetingTime}` : ""}`
          : undefined,
      active: g.active !== false,
    }));

  return page(rows, limit);
};

const getSmallGroup = async (args = {}) => {
  const wanted = String(args.groupId || args.name || "").trim();
  const [groups, members] = await Promise.all([
    db().collection("smallGroups").get().then(docsOf),
    loadMembers(),
  ]);
  const group =
    groups.find((g) => g.id === wanted) || groups.find((g) => wanted && matches(g.name, wanted));
  if (!group) return { found: false, message: "No small group matched that id or name." };

  const index = indexMembers(members);
  const sessionLimit = clampLimit(args.sessionLimit, 6, 50);
  const sessions = await db()
    .collection("sgSessions")
    .where("groupId", "==", group.id)
    .get()
    .then(docsOf);

  return {
    found: true,
    id: group.id,
    name: group.name || "",
    description: group.description || undefined,
    leader: group.leaderId ? nameOf(index, group.leaderId) : "(none)",
    coLeaders: (group.coLeaderIds || []).map((id) => nameOf(index, id)),
    location: group.location || undefined,
    meets:
      typeof group.meetingDay === "number"
        ? `${WEEKDAYS[group.meetingDay]}${group.meetingTime ? ` ${group.meetingTime}` : ""}`
        : undefined,
    members: (group.memberIds || []).map((id) => nameOf(index, id)),
    recentSessions: sessions
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, sessionLimit)
      .map((s) => ({
        id: s.id,
        date: s.date || "",
        venue: s.venue || undefined,
        lesson: s.lesson?.title || undefined,
        scripture: s.lesson?.scripture || undefined,
        present: (s.attendance?.presentIds || []).length + (s.attendance?.guests || []).length,
        absent: (s.attendance?.absentIds || []).length,
        prayerRequests: (s.prayerRequests || []).length,
      })),
  };
};

/* ------------------------------------------------------------- minutes */

const searchMinutes = async (args = {}) => {
  const limit = clampLimit(args.limit, 20, 100);
  const minutes = await db().collection("minutes").get().then(docsOf);
  const from = args.from ? dateArg(args.from) : null;
  const to = args.to ? dateArg(args.to) : null;

  const rows = minutes
    .filter((m) => !from || String(m.date || "") >= from)
    .filter((m) => !to || String(m.date || "") <= to)
    .filter(
      (m) =>
        !args.query ||
        matches(`${m.title} ${m.content} ${JSON.stringify(m.structure || {})}`, args.query)
    )
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .map((m) => ({
      id: m.id,
      title: m.title || "",
      date: m.date || "",
      location: m.location || undefined,
      attendeeCount: (m.attendees || []).length,
      agendaItems: (m.structure?.agenda || m.agenda || []).length,
      actionItems: (m.structure?.actionItems || m.actionItems || []).length,
      summary: excerpt(m.structure?.overallSummary || m.content, 300) || undefined,
    }));

  return page(rows, limit, { hint: "Call get_minute with a row's id for the full record." });
};

const getMinute = async (args = {}) => {
  const doc = await db().collection("minutes").doc(String(args.minuteId || "")).get();
  if (!doc.exists) return { found: false, message: "No meeting minute with that id." };

  const data = doc.data();
  const index = indexMembers(await loadMembers());
  const structure = data.structure || {};

  return {
    found: true,
    id: doc.id,
    title: data.title || "",
    date: data.date || "",
    startTime: data.startTime || undefined,
    endTime: data.endTime || undefined,
    location: data.location || undefined,
    attendees: (data.attendees || []).map((id) => nameOf(index, id)),
    summary: structure.overallSummary || undefined,
    agenda: structure.agenda || data.agenda || [],
    discussions: structure.discussions || data.discussions || {},
    decisions: structure.decisions || data.decisions || {},
    actionItems: structure.actionItems || data.actionItems || [],
    // The typed-up notes, for a minute written before the structured version.
    content: excerpt(data.content, 4000) || undefined,
  };
};

/* --------------------------------------------------------------- tasks */

const listTasks = async (args = {}) => {
  const limit = clampLimit(args.limit, 40, 200);
  const tasks = await db().collection("tasks").get().then(docsOf);
  const now = today();

  const rows = tasks
    // Developer tickets share this collection and are not the church's work.
    // The To-do page filters them out; so must this, or "what is outstanding"
    // answers with somebody's bug list.
    .filter((t) => t.scope !== "dev")
    .filter((t) => (args.done === undefined ? true : Boolean(t.done) === args.done))
    .filter((t) => !args.ministry || matches(t.ministry, args.ministry))
    .filter((t) => !args.assignee || (t.assigneeNames || []).some((n) => matches(n, args.assignee)))
    .filter((t) => !args.overdue || (!t.done && t.dueDate && t.dueDate < now))
    .filter((t) => !args.query || matches(`${t.title} ${t.details}`, args.query))
    .sort((a, b) => String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")))
    .map((t) => ({
      id: t.id,
      title: t.title || "",
      details: excerpt(t.details, 200) || undefined,
      assignees: t.assigneeNames || [],
      ministry: t.ministry || undefined,
      dueDate: t.dueDate || undefined,
      overdue: Boolean(!t.done && t.dueDate && t.dueDate < now),
      priority: t.priority || "normal",
      done: Boolean(t.done),
    }));

  return page(rows, limit);
};

/* -------------------------------------------------------------- ledger */

const financeSummary = async (args = {}) => {
  const from = dateArg(args.from, `${today().slice(0, 4)}-01-01`);
  const to = dateArg(args.to, today());
  const groupBy = args.groupBy || "category";

  const entries = (await db().collection("ledgerEntries").get().then(docsOf)).filter(
    (e) => String(e.date || "") >= from && String(e.date || "") <= to
  );

  let moneyIn = 0;
  let moneyOut = 0;
  let transfers = 0;
  const buckets = new Map();

  for (const entry of entries) {
    const direction = entry.direction || "out";
    if (direction === "transfer") transfers += 1;
    // A transfer moves money between the church's own two accounts. Counting
    // it as income and as expense would double the year's turnover and change
    // nothing about what the church actually has.
    if (direction === "transfer") continue;

    const amount = Math.abs(Math.trunc(Number(entry.amount) || 0));
    if (direction === "in") moneyIn += amount;
    else moneyOut += amount;

    const key =
      groupBy === "month"
        ? String(entry.date).slice(0, 7)
        : groupBy === "account"
          ? entry.account || "cash"
          : [entry.category, entry.subcategory].filter(Boolean).join(" / ") || "(uncategorised)";

    const bucket = buckets.get(key) || { key, in: 0, out: 0, entries: 0 };
    bucket[direction === "in" ? "in" : "out"] += amount;
    bucket.entries += 1;
    buckets.set(key, bucket);
  }

  return {
    from,
    to,
    groupBy,
    currency: "PHP",
    totals: {
      in: peso(moneyIn),
      out: peso(moneyOut),
      net: peso(moneyIn - moneyOut),
      // The count of what these totals are made of. Transfers are reported
      // beside it rather than inside it, so the number never disagrees with
      // the money next to it.
      entries: entries.length - transfers,
      ...(transfers ? { transfersExcluded: transfers } : {}),
    },
    groups: [...buckets.values()]
      .sort((a, b) =>
        groupBy === "month" ? a.key.localeCompare(b.key) : b.in + b.out - (a.in + a.out)
      )
      .map((b) => ({ key: b.key, in: peso(b.in), out: peso(b.out), entries: b.entries })),
    note: "Transfers between the church's own accounts are excluded from every total.",
  };
};

/* --------------------------------------------------------------- writes */
/*
 * Off unless MCP_WRITE_TOOLS=true. A read-only connector cannot do anything
 * worse than answer a question wrongly; a writing one edits the church's own
 * records, and that is not a thing to enable by forgetting to disable it.
 *
 * Four rules hold across all of them:
 *
 *   Nothing is deleted. Every tool here creates or amends; a gathering is
 *   cancelled rather than removed, a task is ticked rather than dropped, a
 *   prayer concern is marked answered. A conversation is a bad place to lose
 *   a record from, and every one of these has an undo in the app.
 *
 *   Controlled lists are enforced, not guessed. A ministry that is not in the
 *   ministries collection is refused with the real list attached, exactly as
 *   the app refuses it — a ministry is the one field that grants access, and
 *   this must not become the way round that.
 *
 *   Every write says where it came from. createdByName / updatedByName carry
 *   MCP_ACTOR, so a record changed through a conversation can be told from one
 *   somebody typed.
 *
 *   Nothing here notifies anybody. The app raises a push when a person saves
 *   an event or a task; these deliberately do not. Ringing every phone in the
 *   congregation is not a side effect a tool call should have.
 */

/** A write's answer: what happened, in the terms the model asked in. */
const wrote = (verb, extra) => ({ ok: true, action: verb, ...extra });

/** Refuses an off-list value with the list attached, so the retry can succeed. */
const fromList = (value, list, label) => {
  const hit = canonical(value, list);
  if (!hit) throw new Error(`"${value}" is not a known ${label}. Valid: ${list.join(", ")}.`);
  return hit;
};

const requireText = (value, label) => {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} cannot be empty.`);
  return text;
};

/** Only the keys the caller actually supplied, so a patch cannot blank a field. */
const patch = (args, fields) => {
  const out = {};
  for (const [key, transform] of Object.entries(fields)) {
    if (args[key] !== undefined) out[key] = transform ? transform(args[key]) : args[key];
  }
  return out;
};

const findMemberOrThrow = (index, id, label = "member") => {
  const member = index.get(String(id));
  if (!member) throw new Error(`No ${label} with id "${id}". Use search_members to find one.`);
  return member;
};

/* ......................................................... people */

const addMember = async (args = {}) => {
  const [members, vocabulary] = await Promise.all([loadMembers(), loadVocabulary()]);
  const firstName = requireText(args.firstName, "firstName");
  const lastName = requireText(args.lastName, "lastName");

  const ministries = (args.ministries || []).map((m) =>
    fromList(m, vocabulary.ministries, "ministry")
  );

  // The app numbers members itself, highest plus one, and other records point
  // at that number rather than at the document. A new one has to be numbered
  // the same way or nothing can refer to it.
  const nextId = members.reduce((top, m) => Math.max(top, Number(m.id) || 0), 0) + 1;
  const dateOfBirth = args.dateOfBirth ? dateArg(args.dateOfBirth) : null;

  const record = {
    id: nextId,
    firstName,
    lastName,
    nickname: String(args.nickname || "").trim() || firstName,
    sex: args.sex === "Female" ? "Female" : "Male",
    civilStatus: args.civilStatus || "Single",
    address: String(args.address || "").trim(),
    contactNumber: String(args.contactNumber || "").trim(),
    occupation: String(args.occupation || "").trim(),
    relatives: {},
    ministries,
    tags: (args.tags || []).map((t) => String(t).trim()).filter(Boolean),
    isMember: args.isMember !== false,
    image: null,
    ...(dateOfBirth ? { dateOfBirth, age: ageOn(dateOfBirth) } : {}),
  };

  const ref = await db().collection("members").add(record);
  invalidate("members", "calendar");

  return wrote("added", {
    id: String(nextId),
    documentId: ref.id,
    name: `${firstName} ${lastName}`,
    isMember: record.isMember,
    note: record.isMember
      ? undefined
      : "Recorded as an attendee rather than a member. Use update_member to change that once they join.",
  });
};

const updateMember = async (args = {}) => {
  const [members, vocabulary] = await Promise.all([loadMembers(), loadVocabulary()]);
  const member = findMemberOrThrow(indexMembers(members), args.memberId);

  const changes = patch(args, {
    firstName: (v) => requireText(v, "firstName"),
    lastName: (v) => requireText(v, "lastName"),
    nickname: (v) => String(v).trim(),
    sex: (v) => (v === "Female" ? "Female" : "Male"),
    civilStatus: String,
    address: (v) => String(v).trim(),
    contactNumber: (v) => String(v).trim(),
    occupation: (v) => String(v).trim(),
    isMember: Boolean,
    tags: (v) => (v || []).map((t) => String(t).trim()).filter(Boolean),
    ministries: (v) => (v || []).map((m) => fromList(m, vocabulary.ministries, "ministry")),
  });

  if (args.dateOfBirth !== undefined) {
    changes.dateOfBirth = dateArg(args.dateOfBirth);
    // Stored alongside the date and read by the members list, so it has to
    // move with it or the two disagree.
    changes.age = ageOn(changes.dateOfBirth);
  }

  if (!Object.keys(changes).length) throw new Error("Nothing to change: no fields were given.");

  await db().collection("members").doc(member.docId).update(changes);
  invalidate("members", "calendar");

  return wrote("updated", {
    id: String(member.id),
    name: fullName(member),
    changed: Object.keys(changes),
    note:
      args.ministries || args.tags
        ? "ministries and tags are replaced wholesale, not merged. Read the member first if you meant to add one."
        : undefined,
  });
};

/* ....................................................... calendar */

const QUIET =
  "Nobody has been notified. The app raises a push when a person saves this kind of record; " +
  "tools deliberately do not.";

const createEvent = async (args = {}) => {
  const vocabulary = await loadVocabulary();
  const title = requireText(args.title, "title");
  const when = dateArg(args.date);

  const ref = await db()
    .collection("events")
    .add({
      title,
      type: args.type ? fromList(args.type, vocabulary.eventTypes, "event type") : "worship",
      date: when,
      time: args.time || "09:00",
      location: String(args.location || "").trim(),
      description: String(args.description || "").trim(),
      audienceTags: (args.audienceTags || []).map(String),
      excludeTags: [],
      icon: "Calendar",
      attendees: 0,
      isCancelled: false,
    });
  invalidate("calendar");

  return wrote("created", { id: ref.id, title, date: when, note: QUIET });
};

/**
 * Amends one entry on the calendar, whether or not it is a real document.
 *
 * A recurring service and a birthday exist only as generated occurrences —
 * there is nothing to update. The app's answer is an override: a stored event
 * carrying `overrideOf: <the generated id>`, which collectOccurrences then
 * substitutes for the generated one. So "move next Sunday to ten o'clock"
 * writes a new document, and this does it the same way rather than refusing.
 */
const updateEvent = async (args = {}) => {
  const id = requireText(args.eventId, "eventId");
  const vocabulary = await loadVocabulary();
  const events = db().collection("events");

  const edits = patch(args, {
    title: (v) => requireText(v, "title"),
    date: (v) => dateArg(v),
    time: String,
    location: (v) => String(v).trim(),
    description: (v) => String(v).trim(),
    isCancelled: Boolean,
    type: (v) => fromList(v, vocabulary.eventTypes, "event type"),
  });
  if (!Object.keys(edits).length) throw new Error("Nothing to change: no fields were given.");

  const generated = id.startsWith("recurring-") || id.startsWith("birthday-");
  if (generated) {
    // Already overridden once? Amend that document rather than stacking a
    // second override on the same occurrence, which would leave two.
    const existing = await events.where("overrideOf", "==", id).limit(1).get();
    if (!existing.empty) {
      await existing.docs[0].ref.update(edits);
      invalidate("calendar");
      return wrote("updated", {
        id: existing.docs[0].id,
        overrideOf: id,
        changed: Object.keys(edits),
        note: `Amended the existing override for this occurrence. ${QUIET}`,
      });
    }

    const [{ events: stored, schedules }, members] = await Promise.all([
      loadCalendarSources(),
      loadMembers(),
    ]);
    // The occurrence has to be found before it can be copied, and it exists
    // only on its own date. A recurring id ends in that date, so the calendar
    // is asked for exactly one day. A birthday id ends in a year instead, and
    // is looked for across it.
    const tail = id.slice(-10);
    const [from, to] = /^\d{4}-\d{2}-\d{2}$/.test(tail)
      ? [tail, tail]
      : /^\d{4}$/.test(id.slice(-4))
        ? [`${id.slice(-4)}-01-01`, `${id.slice(-4)}-12-31`]
        : [today(), shiftDays(today(), 400)];

    const found = collectOccurrences({ events: stored, schedules, members }, from, to).find(
      (row) => row.id === id
    );

    if (!found) {
      throw new Error(
        `No occurrence "${id}" between ${from} and ${to}. Note that once an occurrence has been ` +
          `overridden its generated id retires — call list_events again and use the id it returns now.`
      );
    }

    const ref = await events.add({
      title: found.title,
      type: found.type || "",
      date: found.date,
      time: found.time || "",
      location: found.location || "",
      description: found.description || "",
      audienceTags: [],
      excludeTags: [],
      icon: "Calendar",
      attendees: 0,
      isCancelled: false,
      overrideOf: id,
      isOverride: true,
      ...(found.memberId ? { memberId: found.memberId } : {}),
      ...edits,
    });
    invalidate("calendar");

    return wrote(edits.isCancelled ? "cancelled" : "overridden", {
      id: ref.id,
      overrideOf: id,
      changed: Object.keys(edits),
      note:
        `"${found.title}" is a generated occurrence, so this was saved as a one-off override ` +
        `for ${found.date}; the rest of the series is untouched. ${QUIET}`,
    });
  }

  const doc = await events.doc(id).get();
  if (!doc.exists) throw new Error(`No event with id "${id}". Use list_events to find one.`);
  await doc.ref.update(edits);
  invalidate("calendar");

  return wrote(edits.isCancelled ? "cancelled" : "updated", {
    id,
    title: edits.title || doc.data().title,
    changed: Object.keys(edits),
    note: QUIET,
  });
};

/* ..................................................... attendance */

const recordAttendance = async (args = {}) => {
  const id = requireText(args.occurrenceId, "occurrenceId");
  const present = Number(args.present);
  if (!Number.isFinite(present) || present < 0) {
    throw new Error("`present` must be a head count of zero or more.");
  }

  const [{ events, schedules }, members] = await Promise.all([
    loadCalendarSources(),
    loadMembers(),
  ]);
  // Wide enough to cover a service being recorded late, or one entered ahead.
  const found = collectOccurrences(
    { events, schedules, members },
    shiftDays(today(), -400),
    shiftDays(today(), 30)
  ).find((row) => row.id === id);
  if (!found) {
    throw new Error(`No gathering "${id}" in the last 400 days. Use an id from list_events.`);
  }

  const provenance = provenanceForRow({ id: found.id, firestoreId: found.firestoreId });

  // Recording the same service twice is the mistake this is most likely to
  // make — the model cannot see what it already saved — and two records
  // silently double a month's attendance.
  const clash = await db()
    .collection("attendance")
    .where("occurrenceKey", "==", provenance.occurrenceKey)
    .limit(1)
    .get();
  if (!clash.empty && !args.replace) {
    const existing = clash.docs[0].data();
    return {
      ok: false,
      alreadyRecorded: true,
      id: clash.docs[0].id,
      date: existing.date,
      title: existing.eventTitle,
      present: existing.totalAttendees,
      message:
        "Attendance for this gathering is already recorded. Call again with replace: true to " +
        "correct the figure, or leave it as it is.",
    };
  }

  const record = {
    ...provenance,
    eventId: provenance.source === "event" ? provenance.sourceId : "",
    eventType: found.type || "",
    eventTitle: found.title || "",
    date: found.date,
    time: found.time || "",
    location: found.location || "",
    attendees: [],
    totalAttendees: Math.trunc(present),
    expectedAttendees: 0,
    audienceTags: [],
    excludeTags: [],
    notes: String(args.notes || "").trim(),
    createdBy: MCP_ACTOR_ID,
    createdByName: MCP_ACTOR,
    updatedAt: new Date(),
  };

  if (!clash.empty) {
    await clash.docs[0].ref.update({ totalAttendees: record.totalAttendees, notes: record.notes, updatedAt: new Date() });
    return wrote("corrected", {
      id: clash.docs[0].id,
      title: record.eventTitle,
      date: record.date,
      present: record.totalAttendees,
    });
  }

  const ref = await db()
    .collection("attendance")
    .add({ ...record, createdAt: new Date() });

  return wrote("recorded", {
    id: ref.id,
    title: record.eventTitle,
    date: record.date,
    present: record.totalAttendees,
    note: "A head count only. Who was there individually is not tracked for this kind of gathering.",
  });
};

/* ........................................................... care */

const addPrayerConcern = async (args = {}) => {
  const title = requireText(args.title, "title");
  const now = new Date();

  // Linked to a person where one is named, so the concern shows on their
  // record rather than only in the list.
  let memberId = "";
  let memberName = String(args.about || "").trim();
  if (args.memberId) {
    const member = findMemberOrThrow(indexMembers(await loadMembers()), args.memberId);
    memberId = String(member.id);
    memberName = fullName(member);
  }

  const ref = await db()
    .collection("prayerConcerns")
    .add({
      title,
      memberId,
      memberName,
      description: String(args.description || "").trim(),
      status: "active",
      priority: args.priority || "normal",
      date: dateArg(args.date, today()),
      notes: "",
      createdBy: MCP_ACTOR,
      createdAt: now,
      updatedAt: now,
    });

  return wrote("recorded", { id: ref.id, title, status: "active", about: memberName || undefined, note: QUIET });
};

const updatePrayerConcern = async (args = {}) => {
  const id = requireText(args.concernId, "concernId");
  const edits = patch(args, {
    title: (v) => requireText(v, "title"),
    description: (v) => String(v).trim(),
    notes: (v) => String(v).trim(),
    status: String,
    priority: String,
  });
  if (!Object.keys(edits).length) throw new Error("Nothing to change: no fields were given.");

  const doc = await db().collection("prayerConcerns").doc(id).get();
  if (!doc.exists) throw new Error(`No prayer concern with id "${id}".`);

  await doc.ref.update({ ...edits, updatedAt: new Date() });
  return wrote(edits.status === "answered" ? "marked answered" : "updated", {
    id,
    title: doc.data().title,
    changed: Object.keys(edits),
  });
};

/* .......................................................... tasks */

const resolveAssignees = async (ids) => {
  if (!ids?.length) return { assigneeIds: [], assigneeNames: [] };
  const index = indexMembers(await loadMembers());
  const people = ids.map((id) => findMemberOrThrow(index, id, "assignee"));
  return {
    // Names are stored beside the ids the way the app stores them, so a row
    // reads as "Ana Reyes" the instant it arrives rather than after a lookup.
    assigneeIds: people.map((m) => String(m.id)),
    assigneeNames: people.map(fullName),
  };
};

const addTask = async (args = {}) => {
  const title = requireText(args.title, "title");
  const vocabulary = await loadVocabulary();
  const now = new Date();

  const ref = await db()
    .collection("tasks")
    .add({
      title,
      details: String(args.details || "").trim(),
      ...(await resolveAssignees(args.assigneeIds)),
      ministry: args.ministry ? fromList(args.ministry, vocabulary.ministries, "ministry") : "",
      dueDate: args.dueDate ? dateArg(args.dueDate) : "",
      priority: args.priority || "normal",
      done: false,
      createdBy: MCP_ACTOR_ID,
      createdByName: MCP_ACTOR,
      createdAt: now,
      updatedAt: now,
    });

  return wrote("added", { id: ref.id, title, note: QUIET });
};

const updateTask = async (args = {}) => {
  const id = requireText(args.taskId, "taskId");
  const vocabulary = await loadVocabulary();

  const edits = patch(args, {
    title: (v) => requireText(v, "title"),
    details: (v) => String(v).trim(),
    priority: String,
    dueDate: (v) => (v === "" ? "" : dateArg(v)),
    ministry: (v) => (v === "" ? "" : fromList(v, vocabulary.ministries, "ministry")),
  });
  if (args.assigneeIds !== undefined) Object.assign(edits, await resolveAssignees(args.assigneeIds));
  if (args.done !== undefined) {
    edits.done = Boolean(args.done);
    // Ticked and unticked leave different traces, and the app reads both.
    edits.doneAt = edits.done ? new Date() : null;
    edits.doneBy = edits.done ? MCP_ACTOR_ID : "";
    edits.doneByName = edits.done ? MCP_ACTOR : "";
  }
  if (!Object.keys(edits).length) throw new Error("Nothing to change: no fields were given.");

  const doc = await db().collection("tasks").doc(id).get();
  if (!doc.exists) throw new Error(`No task with id "${id}". Use list_tasks to find one.`);
  if (doc.data().scope === "dev") {
    throw new Error("That is a developer ticket, not a church task, and is not editable here.");
  }

  await doc.ref.update({ ...edits, updatedAt: new Date() });
  return wrote(edits.done ? "completed" : "updated", {
    id,
    title: doc.data().title,
    changed: Object.keys(edits),
  });
};

/* ........................................................ worship */

const addSong = async (args = {}) => {
  const vocabulary = await loadVocabulary();
  const title = requireText(args.title, "title");
  const url = requireText(args.youtubeUrl, "youtubeUrl");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("youtubeUrl must be a full link starting http:// or https://.");
  }

  const ref = await db()
    .collection("worshipSongs")
    .add({
      title,
      youtubeUrl: url,
      category: args.category
        ? fromList(args.category, vocabulary.songCategories, "song category")
        : vocabulary.songCategories[0] || "Praise",
      // Line breaks are slide breaks to whoever builds the projector deck, so
      // they are kept exactly as given.
      lyrics: typeof args.lyrics === "string" ? args.lyrics : "",
      notes: String(args.notes || "").trim(),
      leaderKeys: {},
      createdAt: new Date(),
    });
  invalidate("songs");

  return wrote("added", {
    id: ref.id,
    title,
    note: "The key each leader sings it in is set on the song in the app, not here.",
  });
};

/* ................................................... small groups */

const updateSmallGroupMembers = async (args = {}) => {
  const groupId = requireText(args.groupId, "groupId");
  const members = await loadMembers();
  const index = indexMembers(members);

  const doc = await db().collection("smallGroups").doc(groupId).get();
  if (!doc.exists) throw new Error(`No small group with id "${groupId}". Use list_small_groups.`);

  const current = new Set((doc.data().memberIds || []).map(String));
  const added = [];
  const removed = [];

  for (const id of args.add || []) {
    const member = findMemberOrThrow(index, id);
    if (!current.has(String(member.id)) && !current.has(String(member.docId))) {
      current.add(String(member.id));
      added.push(fullName(member));
    }
  }
  for (const id of args.remove || []) {
    const member = findMemberOrThrow(index, id);
    // Written against either id over the years, so both are cleared.
    if (current.delete(String(member.id)) || current.delete(String(member.docId))) {
      removed.push(fullName(member));
    }
  }
  if (!added.length && !removed.length) {
    return { ok: true, action: "unchanged", message: "Everyone named was already as requested." };
  }

  await doc.ref.update({ memberIds: [...current], updatedAt: new Date() });
  return wrote("updated", {
    id: groupId,
    name: doc.data().name,
    added: added.length ? added : undefined,
    removed: removed.length ? removed : undefined,
    memberCount: current.size,
  });
};

/* ......................................................... ledger */

const addLedgerEntry = async (args = {}) => {
  const direction = ["in", "out", "transfer"].includes(args.direction) ? args.direction : null;
  if (!direction) throw new Error('`direction` must be "in", "out" or "transfer".');

  const description = requireText(args.description, "description");
  const when = dateArg(args.date, today());

  // Spoken and written in pesos; stored as an integer count of centavos,
  // because that is the only representation the ledger has ever used and a
  // float would round somebody's tithe.
  const pesos = Number(args.amount);
  if (!Number.isFinite(pesos) || pesos <= 0) throw new Error("`amount` must be a positive number of pesos.");
  const centavos = Math.round(pesos * 100);

  const account = ACCOUNT_KEYS.includes(args.account) ? args.account : CASH;
  const entry = {
    date: when,
    description,
    direction,
    category: "",
    subcategory: "",
    account,
    toAccount: "",
    amount: centavos,
    payee: String(args.payee || "").trim(),
    notes: String(args.notes || "").trim(),
    createdBy: MCP_ACTOR_ID,
    createdByName: MCP_ACTOR,
    updatedBy: MCP_ACTOR_ID,
    updatedByName: MCP_ACTOR,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (direction === "transfer") {
    entry.toAccount = ACCOUNT_KEYS.includes(args.toAccount)
      ? args.toAccount
      : account === BANK
        ? CASH
        : BANK;
    if (entry.toAccount === account) throw new Error("A transfer needs two different accounts.");
  } else {
    // An off-chart category prints as "Unclassified" on the statement, which
    // is the one thing the treasurer cannot reconcile. Refuse it with the real
    // options rather than write a line nobody can account for.
    const category = String(args.category || "");
    const subcategory = String(args.subcategory || "");
    if (!isKnownCategory(direction, category, subcategory)) {
      const options = categoryOptions(direction).map((o) =>
        o.subcategory ? `${o.category}/${o.subcategory} (${o.label})` : `${o.category} (${o.label})`
      );
      throw new Error(
        `"${[category, subcategory].filter(Boolean).join("/") || "(none)"}" is not a line on the ` +
          `statement for money ${direction === "in" ? "in" : "out"}. Valid: ${options.join("; ")}.`
      );
    }
    entry.category = category;
    entry.subcategory = subcategory;
  }

  const ref = await db().collection("ledgerEntries").add(entry);

  return wrote("recorded", {
    id: ref.id,
    date: when,
    description,
    direction,
    amount: peso(centavos),
    account,
    ...(direction === "transfer" ? { toAccount: entry.toAccount } : { category: entry.category }),
  });
};

/* ------------------------------------------------------------ registry */

export const TOOLS = [
  {
    name: "church_profile",
    title: "Church profile",
    description:
      "The church's own details: name, branch, vision and mission, address and contacts, the " +
      "published service times, how many are on the roll, and the full vocabulary of ministries " +
      "and member tags in use. Call this first when you need to know what the other tools' " +
      "`ministry` and `tag` arguments can be set to.",
    input: schema({}),
    run: churchProfile,
  },
  {
    name: "search_members",
    title: "Search members and attendees",
    description:
      "Find people on the roll. Filter by name, ministry, tag, sex, civil status, age range or " +
      "birthday month. `membership` separates members from attendees — people who come but have " +
      "not joined. Phone numbers and home addresses are omitted unless includeContact is true, so " +
      "ask for them only when the question actually needs them.",
    input: schema({
      query: str(
        "Free text matched against name, nickname, occupation, address, ministries and tags."
      ),
      ministry: str("Only people serving in this ministry."),
      tag: str("Only people carrying this tag."),
      membership: enumOf(["member", "attendee", "all"], "Default all."),
      sex: enumOf(["Male", "Female"], "Filter by sex as recorded."),
      civilStatus: str("Single, Married, Widowed, and so on."),
      birthdayMonth: int("1–12. Whose birthday falls in this month."),
      minAge: int("Youngest age to include."),
      maxAge: int("Oldest age to include."),
      includeContact: bool("Include contact number, address and occupation. Default false."),
      limit: limitOf(40, 300),
    }),
    run: searchMembers,
  },
  {
    name: "get_member",
    title: "One person's record",
    description:
      "The full record for one person — contact details, relatives, ministries and tags, the " +
      "small groups they belong to or lead, and any task still open against them. Give either " +
      "memberId (from search_members) or name; an ambiguous name comes back as a list to choose " +
      "from.",
    input: schema({
      memberId: str("The id returned by search_members."),
      name: str("A name to look up instead, when you do not have an id."),
    }),
    run: getMember,
  },
  {
    name: "list_events",
    title: "What is on the calendar",
    description:
      "Everything happening between two dates: one-off events, the weekly services generated from " +
      "the recurring schedule, and members' birthdays. An edited or cancelled service correctly " +
      "replaces the generated one. Defaults to the next 30 days.",
    input: schema({
      from: dateField("First date, YYYY-MM-DD. Defaults to today."),
      to: dateField("Last date, inclusive. Defaults to 30 days after `from`."),
      type: str(
        "Only this kind of gathering — worship, meeting, training, celebration, and so on."
      ),
      query: str("Free text matched against title and description."),
      includeBirthdays: bool("Default true."),
      limit: limitOf(60, 300),
    }),
    run: listEvents,
  },
  {
    name: "attendance_records",
    title: "Attendance, gathering by gathering",
    description:
      "The head count recorded for each gathering in a date range, newest first. Defaults to the " +
      "last 90 days.",
    input: schema({
      from: dateField("First date, YYYY-MM-DD."),
      to: dateField("Last date, inclusive."),
      eventType: str("Only gatherings of this type."),
      query: str("Free text matched against the gathering's title and notes."),
      limit: limitOf(40, 200),
    }),
    run: attendanceRecords,
  },
  {
    name: "attendance_summary",
    title: "Attendance totals and averages",
    description:
      "Attendance aggregated over a period — sessions, total attendances, average, lowest and " +
      "highest — grouped by gathering type, by month, or by named gathering. Use this for trends " +
      "rather than pulling every record. Defaults to the last 180 days.",
    input: schema({
      from: dateField("First date, YYYY-MM-DD."),
      to: dateField("Last date, inclusive."),
      groupBy: enumOf(["eventType", "month", "event"], "Default eventType."),
    }),
    run: attendanceSummary,
  },
  {
    name: "search_songs",
    title: "Search the worship song library",
    description:
      "The songs the worship team draws on, with category, the key it is usually sung in, CCLI " +
      "number and whether lyrics are on file. The query also searches lyrics, so a remembered " +
      "line will find the song.",
    input: schema({
      query: str("Title, artist, writer, CCLI number, or a line of the lyrics."),
      category: str("Praise, Worship, Hymnal, and so on."),
      key: str("Exact musical key, such as G or Bb."),
      limit: limitOf(40, 200),
    }),
    run: searchSongs,
  },
  {
    name: "get_lineup",
    title: "A month's worship plan",
    description:
      "The worship lineup for one month: each Sunday's theme, who leads, who is on the team, and " +
      "the songs in order with the key each will be sung in. Defaults to the current month. A " +
      "month still marked draft is not settled.",
    input: schema({ month: str("YYYY-MM. Defaults to the current month.") }),
    run: getLineup,
  },
  {
    name: "list_prayer_concerns",
    title: "Prayer concerns",
    description:
      "Prayer concerns the church is holding, newest first, with who they are about, their status " +
      "(active, ongoing, answered) and priority.",
    input: schema({
      status: enumOf(["active", "ongoing", "answered"], "Default: all."),
      priority: enumOf(["low", "normal", "high", "urgent"], "Default: all."),
      query: str("Free text matched against title, description and the person named."),
      limit: limitOf(30, 200),
    }),
    run: listPrayerConcerns,
  },
  {
    name: "list_small_groups",
    title: "Small groups",
    description:
      "The church's small groups with their leaders, when and where they meet, and how many " +
      "belong to each. Active groups only unless activeOnly is false.",
    input: schema({
      query: str("Free text matched against name and description."),
      activeOnly: bool("Default true."),
      limit: limitOf(30, 100),
    }),
    run: listSmallGroups,
  },
  {
    name: "get_small_group",
    title: "One small group in detail",
    description:
      "One group's full membership by name, plus its recent sessions — date, venue, the lesson " +
      "taught, and how many were present, absent, or brought a prayer request.",
    input: schema({
      groupId: str("The id from list_small_groups, or the group's name."),
      sessionLimit: int("How many recent sessions to include. Default 6, maximum 50."),
    }),
    run: getSmallGroup,
  },
  {
    name: "search_minutes",
    title: "Search meeting minutes",
    description:
      "Meeting minutes, newest first, as summaries with counts of agenda and action items. The " +
      "query searches the full text including discussions and decisions, so this is how you find " +
      "when something was agreed. Follow up with get_minute for the whole record.",
    input: schema({
      query: str("Free text searched across the entire minute."),
      from: dateField("Earliest meeting date, YYYY-MM-DD."),
      to: dateField("Latest meeting date, inclusive."),
      limit: limitOf(20, 100),
    }),
    run: searchMinutes,
  },
  {
    name: "get_minute",
    title: "One meeting in full",
    description:
      "The complete minute for one meeting: attendees by name, agenda, discussions, decisions and " +
      "action items.",
    input: schema({ minuteId: str("The id from search_minutes.") }, ["minuteId"]),
    run: getMinute,
  },
  {
    name: "list_tasks",
    title: "Tasks",
    description:
      "Tasks assigned around the church, soonest due first, with who they are on, which ministry, " +
      "and whether they are past their due date.",
    input: schema({
      done: bool("true for completed only, false for outstanding only. Default: both."),
      overdue: bool("Only outstanding tasks past their due date."),
      assignee: str("Only tasks assigned to someone whose name matches this."),
      ministry: str("Only tasks for this ministry."),
      query: str("Free text matched against title and details."),
      limit: limitOf(40, 200),
    }),
    run: listTasks,
  },
  {
    name: "finance_summary",
    title: "Ledger totals",
    description:
      "Money in, money out and the net for a period, broken down by category, by month, or by " +
      "account. Amounts come back formatted in pesos. Transfers between the church's own accounts " +
      "are excluded. Defaults to the year to date.",
    input: schema({
      from: dateField("First date, YYYY-MM-DD. Defaults to 1 January this year."),
      to: dateField("Last date, inclusive. Defaults to today."),
      groupBy: enumOf(["category", "month", "account"], "Default category."),
    }),
    run: financeSummary,
  },
  {
    name: "add_member",
    title: "Add someone to the roll",
    description:
      "Puts a new person on the roll. Set isMember false for an attendee — someone who comes but " +
      "has not joined. Ministries must already exist (church_profile lists them); tags are free " +
      "text. The person is numbered the way the app numbers them, so other records can refer to " +
      "them straight away.",
    write: true,
    input: schema(
      {
        firstName: str("Given name."),
        lastName: str("Family name."),
        nickname: str("What they are called. Defaults to the first name."),
        sex: enumOf(["Male", "Female"], "Default Male."),
        dateOfBirth: dateField("YYYY-MM-DD. Their age is worked out from it."),
        civilStatus: str("Single, Married, Widowed. Default Single."),
        address: str("Where they live."),
        contactNumber: str("Mobile number."),
        occupation: str("What they do."),
        ministries: { type: "array", items: { type: "string" }, description: "Must be known ministries." },
        tags: { type: "array", items: { type: "string" }, description: "Free-text labels." },
        isMember: bool("true for a member, false for an attendee. Default true."),
      },
      ["firstName", "lastName"]
    ),
    run: addMember,
  },
  {
    name: "update_member",
    title: "Change someone's record",
    description:
      "Amends a person on the roll — correct a phone number, record a marriage, add a ministry, " +
      "or set isMember true when an attendee joins. Only the fields you pass are touched, but " +
      "`ministries` and `tags` REPLACE the existing lists rather than adding to them, so read the " +
      "member first if you mean to add one. Never deletes anybody.",
    write: true,
    input: schema(
      {
        memberId: str("The id from search_members."),
        firstName: str("Given name."),
        lastName: str("Family name."),
        nickname: str("What they are called."),
        sex: enumOf(["Male", "Female"], "As recorded."),
        dateOfBirth: dateField("YYYY-MM-DD."),
        civilStatus: str("Single, Married, Widowed."),
        address: str("Where they live."),
        contactNumber: str("Mobile number."),
        occupation: str("What they do."),
        ministries: { type: "array", items: { type: "string" }, description: "Replaces the list. Must be known ministries." },
        tags: { type: "array", items: { type: "string" }, description: "Replaces the list." },
        isMember: bool("true for a member, false for an attendee."),
      },
      ["memberId"]
    ),
    run: updateMember,
  },
  {
    name: "create_event",
    title: "Add an event to the calendar",
    description:
      "Puts a one-off gathering on the church calendar. For a change to a service that already " +
      "recurs, use update_event instead — this would put a second one alongside it.",
    write: true,
    input: schema(
      {
        title: str("What the gathering is called."),
        date: dateField("YYYY-MM-DD."),
        time: str("24-hour HH:MM. Defaults to 09:00."),
        type: str("One of the church's event types; church_profile does not list these, so omit it if unsure and it defaults to worship."),
        location: str("Where it is held."),
        description: str("Any detail worth keeping alongside it."),
        audienceTags: {
          type: "array",
          items: { type: "string" },
          description: "Member tags this is for. Empty means everyone.",
        },
      },
      ["title", "date"]
    ),
    run: createEvent,
  },
  {
    name: "update_event",
    title: "Change or cancel one gathering",
    description:
      "Moves, retitles, relocates or cancels a single entry on the calendar. Pass any id from " +
      "list_events. A recurring service or a birthday has no document behind it, so changing one " +
      "saves a one-off override for that date and leaves the rest of the series alone — which is " +
      "how you move next Sunday without moving every Sunday. Set isCancelled true to call " +
      "something off; nothing is ever deleted.",
    write: true,
    input: schema(
      {
        eventId: str("An id from list_events."),
        title: str("A new name for it."),
        date: dateField("Move it to this date, YYYY-MM-DD."),
        time: str("Move it to this 24-hour HH:MM."),
        location: str("Where it is now held."),
        description: str("Replacement detail."),
        type: str("A different event type."),
        isCancelled: bool("true calls it off; false reinstates it."),
      },
      ["eventId"]
    ),
    run: updateEvent,
  },
  {
    name: "record_attendance",
    title: "Record a head count",
    description:
      "Saves how many came to one gathering. Pass an id from list_events and the number present. " +
      "If that gathering already has attendance recorded it says so and changes nothing, unless " +
      "you pass replace true to correct the figure.",
    write: true,
    input: schema(
      {
        occurrenceId: str("An id from list_events."),
        present: int("How many were there."),
        notes: str("Anything worth recording about the gathering."),
        replace: bool("Correct an already-recorded figure. Default false."),
      },
      ["occurrenceId", "present"]
    ),
    run: recordAttendance,
  },
  {
    name: "add_prayer_concern",
    title: "Record a prayer concern",
    description:
      "Adds a prayer concern to the list the church is holding. Pass memberId to attach it to " +
      "someone on the roll, or `about` for a name that is not.",
    write: true,
    input: schema(
      {
        title: str("A short line naming the concern."),
        memberId: str("The id of the person it is for, from search_members."),
        about: str("Who it is for, when they are not on the roll."),
        description: str("The request in full."),
        priority: enumOf(["low", "normal", "high", "urgent"], "Default normal."),
        date: dateField("YYYY-MM-DD. Defaults to today."),
      },
      ["title"]
    ),
    run: addPrayerConcern,
  },
  {
    name: "update_prayer_concern",
    title: "Update a prayer concern",
    description:
      "Changes a concern already on the list — most often marking it answered, or raising its " +
      "priority. Nothing is deleted; a concern that is over is marked answered.",
    write: true,
    input: schema(
      {
        concernId: str("The id from list_prayer_concerns."),
        status: enumOf(["active", "ongoing", "answered"], "Where it now stands."),
        priority: enumOf(["low", "normal", "high", "urgent"], "How urgent it now is."),
        title: str("A new title."),
        description: str("Replacement detail."),
        notes: str("What has happened since."),
      },
      ["concernId"]
    ),
    run: updatePrayerConcern,
  },
  {
    name: "add_task",
    title: "Assign a task",
    description:
      "Adds a task to the church's to-do list. Assignees are given by member id, from " +
      "search_members, and their names are stored alongside so the row reads properly.",
    write: true,
    input: schema(
      {
        title: str("What needs doing."),
        details: str("Anything more the person needs to know."),
        assigneeIds: { type: "array", items: { type: "string" }, description: "Member ids from search_members." },
        ministry: str("The ministry it belongs to. Must be a known ministry."),
        dueDate: dateField("YYYY-MM-DD."),
        priority: enumOf(["low", "normal", "high", "urgent"], "Default normal."),
      },
      ["title"]
    ),
    run: addTask,
  },
  {
    name: "update_task",
    title: "Tick off or change a task",
    description:
      "Marks a task done, reassigns it, reschedules it or rewords it. Pass done true to complete " +
      "it — that is how a task is finished with; there is no delete.",
    write: true,
    input: schema(
      {
        taskId: str("The id from list_tasks."),
        done: bool("true ticks it off, false reopens it."),
        title: str("A new title."),
        details: str("Replacement detail."),
        assigneeIds: { type: "array", items: { type: "string" }, description: "Replaces who it is on." },
        ministry: str("A different ministry, or empty string for none."),
        dueDate: str("YYYY-MM-DD, or empty string to clear the due date."),
        priority: enumOf(["low", "normal", "high", "urgent"], "How urgent it now is."),
      },
      ["taskId"]
    ),
    run: updateTask,
  },
  {
    name: "add_song",
    title: "Add a song to the library",
    description:
      "Adds a song the worship team can draw on. A link is required — the library is built around " +
      "playing the song. Lyrics are stored exactly as given, because a line break is a slide " +
      "break to whoever builds the projector deck.",
    write: true,
    input: schema(
      {
        title: str("The song's title."),
        youtubeUrl: str("Full link to a recording."),
        category: str("Praise, Worship or Hymnal."),
        lyrics: str("The words, line breaks and all."),
        notes: str("Anything the team should know."),
      },
      ["title", "youtubeUrl"]
    ),
    run: addSong,
  },
  {
    name: "update_small_group_members",
    title: "Move people in and out of a small group",
    description:
      "Adds people to a small group's membership or takes them off it, by member id. Removing " +
      "somebody from a group does not touch their record on the roll.",
    write: true,
    input: schema(
      {
        groupId: str("The id from list_small_groups."),
        add: { type: "array", items: { type: "string" }, description: "Member ids to add." },
        remove: { type: "array", items: { type: "string" }, description: "Member ids to take off." },
      },
      ["groupId"]
    ),
    run: updateSmallGroupMembers,
  },
  {
    name: "add_ledger_entry",
    title: "Record money in or out",
    description:
      "Writes one line into the church ledger. The amount is in pesos, as a person would say it " +
      "(1500.50, not centavos). Money in and money out need a category from the statement's own " +
      "chart of accounts; get one wrong and the error lists every valid line. A transfer moves " +
      "money between the church's two accounts and takes no category.",
    write: true,
    input: schema(
      {
        direction: enumOf(["in", "out", "transfer"], "Money in, money out, or between accounts."),
        amount: { type: "number", description: "In pesos, e.g. 1500.50." },
        description: str("What the line says."),
        date: dateField("YYYY-MM-DD. Defaults to today."),
        category: str("The statement line, e.g. tithes-offering or admin. Not for a transfer."),
        subcategory: str("The line beneath it, e.g. onsite or utilities, where the category has any."),
        account: enumOf(["cash", "bank"], "Which account. Default cash."),
        toAccount: enumOf(["cash", "bank"], "For a transfer: where it went."),
        payee: str("Who was paid, or who gave."),
        notes: str("Anything else worth recording."),
      },
      ["direction", "amount", "description"]
    ),
    run: addLedgerEntry,
  },
];

/** The tools this deployment actually offers, given its write setting. */
export const enabledTools = (allowWrites) => TOOLS.filter((tool) => allowWrites || !tool.write);
