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
import {
  ageOn,
  asDate,
  cached,
  clampLimit,
  dateArg,
  docsOf,
  excerpt,
  fullName,
  indexMembers,
  loadMembers,
  matches,
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
      .filter((t) => holds(t.assigneeIds))
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

const searchSongs = async (args = {}) => {
  const limit = clampLimit(args.limit, 40, 200);
  const songs = await cached("songs", () => db().collection("worshipSongs").get().then(docsOf));

  const rows = songs
    .filter((s) => !args.category || matches(s.category, args.category))
    .filter((s) => !args.key || String(s.key || "").toLowerCase() === String(args.key).toLowerCase())
    .filter(
      (s) =>
        !args.query ||
        [s.title, s.artist, s.writers, s.ccli, s.lyrics].some((f) => matches(f, args.query))
    )
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
    .map((s) => ({
      id: s.id,
      title: s.title || "",
      artist: s.artist || undefined,
      category: s.category || undefined,
      key: s.key || undefined,
      ccli: s.ccli || undefined,
      youtubeUrl: s.youtubeUrl || s.url || undefined,
      hasLyrics: Boolean(s.lyrics),
    }));

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
  const buckets = new Map();

  for (const entry of entries) {
    const direction = entry.direction || "out";
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
      entries: entries.length,
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
 * worse than answer a question wrongly; a writing one can put a gathering on
 * the church calendar, and that is not a thing to enable by forgetting to
 * disable it.
 */

const createEvent = async (args = {}) => {
  const title = String(args.title || "").trim();
  if (!title) throw new Error("An event needs a title.");
  const when = dateArg(args.date);

  const ref = await db()
    .collection("events")
    .add({
      title,
      type: args.type || "worship",
      date: when,
      time: args.time || "09:00",
      location: args.location || "",
      description: args.description || "",
      audienceTags: Array.isArray(args.audienceTags) ? args.audienceTags : [],
      excludeTags: [],
      icon: "Calendar",
      attendees: 0,
      isCancelled: false,
    });

  return {
    created: true,
    id: ref.id,
    title,
    date: when,
    note:
      "Added straight to the calendar. Push notifications are sent by the app when a person " +
      "saves an event, not by this tool, so the congregation has not been notified.",
  };
};

const addPrayerConcern = async (args = {}) => {
  const title = String(args.title || "").trim();
  if (!title) throw new Error("A prayer concern needs a title.");
  const now = new Date();

  const ref = await db()
    .collection("prayerConcerns")
    .add({
      title,
      memberName: args.about || "",
      memberId: "",
      description: args.description || "",
      status: "active",
      priority: args.priority || "normal",
      date: dateArg(args.date, today()),
      notes: "",
      createdBy: "MCP connector",
      createdAt: now,
      updatedAt: now,
    });

  return { created: true, id: ref.id, title, status: "active" };
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
    name: "create_event",
    title: "Add an event to the calendar",
    description:
      "Puts a one-off gathering on the church calendar. Only available when the connector is " +
      "configured to allow writes.",
    write: true,
    input: schema(
      {
        title: str("What the gathering is called."),
        date: dateField("YYYY-MM-DD."),
        time: str("24-hour HH:MM. Defaults to 09:00."),
        type: str("worship, meeting, training, celebration, outreach, and so on."),
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
    name: "add_prayer_concern",
    title: "Record a prayer concern",
    description:
      "Adds a prayer concern to the list the church is holding. Only available when the connector " +
      "is configured to allow writes.",
    write: true,
    input: schema(
      {
        title: str("A short line naming the concern."),
        about: str("Who it is for."),
        description: str("The request in full."),
        priority: enumOf(["low", "normal", "high", "urgent"], "Default normal."),
        date: dateField("YYYY-MM-DD. Defaults to today."),
      },
      ["title"]
    ),
    run: addPrayerConcern,
  },
];

/** The tools this deployment actually offers, given its write setting. */
export const enabledTools = (allowWrites) => TOOLS.filter((tool) => allowWrites || !tool.write);
