// Shared by /api/lyrics-structure. Outside `api/` for the same reason
// lib/firebaseAdmin.js is: modules parked in that directory are candidate
// Serverless Functions rather than reliably-bundled imports.

/**
 * The words of a lyric, stripped of everything a capitalisation pass is
 * allowed to touch — case, punctuation, spacing and the several apostrophes a
 * paste can carry.
 *
 * Two texts sharing this are the same lyric differing only in presentation.
 * That is what lets the structure pass prove a model recapitalised the line it
 * was given rather than rewriting it from memory: if the fingerprint moves,
 * that line is discarded. The guarantee is structural, not a matter of the
 * model having followed instructions.
 */
export function lyricFingerprint(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .trim()
}

/**
 * The lines a structure pass recapitalised, each checked against the line it
 * came from.
 *
 * A recased line has to be the same line: the same words, in the same order,
 * spelled and spaced the same, differing only in case and in which apostrophe
 * a paste happened to carry. Anything else is the model rewriting a lyric from
 * memory, and is refused.
 *
 * That is deliberately stricter than a rule permitting deletion. Dropping what
 * is not the song is still done — a stray "svg" left by a web page, a shouted
 * "(oh)" — but it is done by `adlibLines`, as line numbers, where the model
 * never has to hand back text to remove text.
 *
 * Checked one line at a time so a single refusal costs that line and not the
 * whole analysis: a line not accepted simply keeps the capitalisation the
 * church typed. Note that joining two words into one moves the fingerprint —
 * "sa 'Yo" is not "Sa'Yo" — so tightening a spelling is refused here even
 * though it looks like capitalisation.
 *
 * @param {unknown} recased  a { lineNumber: recasedLine } map from the model
 * @param {string[]} lines  the lines it was given, in order
 * @returns {{ accepted: Record<number, string>, refused: number[] }}
 */
export function validateRecasing(recased, lines) {
  const accepted = {};
  const refused = [];
  if (!recased || typeof recased !== "object") return { accepted, refused };

  for (const [key, value] of Object.entries(recased)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= lines.length) continue;

    const candidate = String(value ?? "");
    const source = lines[index];
    if (!candidate || candidate === source) continue;

    if (lyricFingerprint(candidate) === lyricFingerprint(source)) {
      accepted[index] = candidate;
    } else {
      refused.push(index);
    }
  }

  return { accepted, refused };
}

/** The labels a structure pass is allowed to assign. Anything else is a sign
 *  the model improvised, and the analysis is rejected rather than trusted.
 *
 *  English only, by choice: the songs are Tagalog but the section names stay
 *  Verse and Chorus, which is what the worship team reads them as. A sheet
 *  that already says Koro is still understood when read (utils/songUtils.js);
 *  this is only about what gets assigned. */
export const ALLOWED_SECTION_LABELS = [
  "Verse", "Chorus", "Pre-Chorus", "Bridge", "Refrain", "Tag",
  "Intro", "Outro", "Interlude", "Ending", "Vamp",
];

const LABEL_PATTERN = new RegExp(
  `^(${ALLOWED_SECTION_LABELS.join("|")})( [1-9][0-9]?)?$`
);

/**
 * Checks a structure analysis against the lyrics it claims to describe.
 *
 * The model returns line numbers and labels, never text — so the only way it
 * can corrupt a lyric is by pointing at the wrong lines, and that is what this
 * catches. Sections must be in order, must not overlap, must stay inside the
 * song, and must carry a label from the list above. A `repeatOf` must point
 * backwards at a section that exists.
 *
 * @returns {{ ok: true, sections: Array } | { ok: false, reason: string }}
 */
export function validateStructure(analysis, lineCount) {
  const sections = Array.isArray(analysis?.sections) ? analysis.sections : null;
  if (!sections || !sections.length) return { ok: false, reason: "no sections" };

  let previousEnd = -1;
  for (let i = 0; i < sections.length; i += 1) {
    const { start, end, label, repeatOf } = sections[i] || {};

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      return { ok: false, reason: "line numbers must be integers" };
    }
    if (start < 0 || end >= lineCount || end < start) {
      return { ok: false, reason: "section falls outside the lyrics" };
    }
    if (start <= previousEnd) return { ok: false, reason: "sections overlap or are out of order" };
    previousEnd = end;

    if (typeof label !== "string" || !LABEL_PATTERN.test(label)) {
      return { ok: false, reason: `unrecognised label: ${label}` };
    }
    if (repeatOf !== undefined && repeatOf !== null) {
      if (!Number.isInteger(repeatOf) || repeatOf < 0 || repeatOf >= i) {
        return { ok: false, reason: "repeatOf must point at an earlier section" };
      }
    }
  }

  const adlibs = Array.isArray(analysis?.adlibLines) ? analysis.adlibLines : [];
  if (adlibs.some((n) => !Number.isInteger(n) || n < 0 || n >= lineCount)) {
    return { ok: false, reason: "ad-lib line out of range" };
  }

  return { ok: true, sections, adlibLines: adlibs };
}
