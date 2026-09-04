#!/usr/bin/env python3
"""
Scrape a Bible translation from BibleGateway, chapter by chapter, into clean files.

Targets the `div.passage-col ... version-XXXX` container of
https://www.biblegateway.com/passage/?search=<book>+<chapter>&version=<VERSION>
and pulls out verses, section headings and footnotes.

Usage
-----
    python scripts/scrape_bible.py                        # whole MBBTAG bible
    python scripts/scrape_bible.py --books "Genesis,John" # a few books
    python scripts/scrape_bible.py --books nt             # New Testament only
    python scripts/scrape_bible.py --version ASND         # another translation
    python scripts/scrape_bible.py --list-books           # print the canon table

Requires:  pip install requests beautifulsoup4

Politeness
----------
BibleGateway's robots.txt allows /passage/ but asks for `Crawl-delay: 15`, which is
this script's default. A full 66-book run is 1,189 requests (~5 h at that pace).
Every request is cached to disk and every finished book is skipped on re-run, so
you can stop with Ctrl+C and resume later at no cost. Lower --delay only if you
know you are allowed to. Scraped text stays copyrighted by its publisher.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:  # pragma: no cover
    sys.exit("Missing dependencies. Run:  pip install requests beautifulsoup4")


BASE_URL = "https://www.biblegateway.com/passage/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# (English book name as BibleGateway understands it, chapter count, testament)
CANON = [
    ("Genesis", 50, "OT"), ("Exodus", 40, "OT"), ("Leviticus", 27, "OT"),
    ("Numbers", 36, "OT"), ("Deuteronomy", 34, "OT"), ("Joshua", 24, "OT"),
    ("Judges", 21, "OT"), ("Ruth", 4, "OT"), ("1 Samuel", 31, "OT"),
    ("2 Samuel", 24, "OT"), ("1 Kings", 22, "OT"), ("2 Kings", 25, "OT"),
    ("1 Chronicles", 29, "OT"), ("2 Chronicles", 36, "OT"), ("Ezra", 10, "OT"),
    ("Nehemiah", 13, "OT"), ("Esther", 10, "OT"), ("Job", 42, "OT"),
    ("Psalms", 150, "OT"), ("Proverbs", 31, "OT"), ("Ecclesiastes", 12, "OT"),
    ("Song of Solomon", 8, "OT"), ("Isaiah", 66, "OT"), ("Jeremiah", 52, "OT"),
    ("Lamentations", 5, "OT"), ("Ezekiel", 48, "OT"), ("Daniel", 12, "OT"),
    ("Hosea", 14, "OT"), ("Joel", 3, "OT"), ("Amos", 9, "OT"),
    ("Obadiah", 1, "OT"), ("Jonah", 4, "OT"), ("Micah", 7, "OT"),
    ("Nahum", 3, "OT"), ("Habakkuk", 3, "OT"), ("Zephaniah", 3, "OT"),
    ("Haggai", 2, "OT"), ("Zechariah", 14, "OT"), ("Malachi", 4, "OT"),
    ("Matthew", 28, "NT"), ("Mark", 16, "NT"), ("Luke", 24, "NT"),
    ("John", 21, "NT"), ("Acts", 28, "NT"), ("Romans", 16, "NT"),
    ("1 Corinthians", 16, "NT"), ("2 Corinthians", 13, "NT"), ("Galatians", 6, "NT"),
    ("Ephesians", 6, "NT"), ("Philippians", 4, "NT"), ("Colossians", 4, "NT"),
    ("1 Thessalonians", 5, "NT"), ("2 Thessalonians", 3, "NT"), ("1 Timothy", 6, "NT"),
    ("2 Timothy", 4, "NT"), ("Titus", 3, "NT"), ("Philemon", 1, "NT"),
    ("Hebrews", 13, "NT"), ("James", 5, "NT"), ("1 Peter", 5, "NT"),
    ("2 Peter", 3, "NT"), ("1 John", 5, "NT"), ("2 John", 1, "NT"),
    ("3 John", 1, "NT"), ("Jude", 1, "NT"), ("Revelation", 22, "NT"),
]

# A verse span carries its reference in its class name, in one of two shapes:
#   class="text Gen-1-1"                 -> Genesis 1:1
#   class="text Matt-1-2-Matt-1-11"      -> Matthew 1:2-11 merged into one block
SINGLE_REF_RE = re.compile(r"^([A-Za-z0-9]+)-(\d+)-(\d+)$")
RANGE_REF_RE = re.compile(r"^([A-Za-z0-9]+)-(\d+)-(\d+)-([A-Za-z0-9]+)-(\d+)-(\d+)$")
NOISE_SELECTORS = (
    "div.footnotes", "div.crossrefs", "sup.footnote", "sup.crossreference",
    "div.publisher-info-bottom",
    "a.full-chap-link", "div.passage-other-trans", "p.translation-note",
    "div.il-text", "script", "style",
)


class ChapterUnavailable(Exception):
    """BibleGateway returned a page with no verses (chapter does not exist)."""


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def slug(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-")


def clean_text(raw: str, keep_linebreaks: bool) -> str:
    raw = raw.replace("\xa0", " ").replace("​", "").replace("­", "")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in raw.split("\n")]
    lines = [ln for ln in lines if ln]
    joined = "\n".join(lines) if keep_linebreaks else " ".join(lines)
    return re.sub(r"\s+([,;:.!?])", r"\1", joined).strip()


def verse_span(classes, chapter=None):
    """(first, last) verse numbers named by a span's classes, or None if it has none.

    Ranges such as 'Matt-1-2-Matt-1-11' cover several verses in a single block;
    passing `chapter` keeps only references belonging to the chapter being parsed.
    """
    found = []
    for cls in classes or []:
        m = RANGE_REF_RE.match(cls)
        if m:
            for ch, verse in ((int(m.group(2)), int(m.group(3))),
                              (int(m.group(5)), int(m.group(6)))):
                if chapter is None or ch == chapter:
                    found.append(verse)
            continue
        m = SINGLE_REF_RE.match(cls)
        if m and (chapter is None or int(m.group(2)) == chapter):
            found.append(int(m.group(3)))
    return (min(found), max(found)) if found else None


# --------------------------------------------------------------------------- #
# fetching
# --------------------------------------------------------------------------- #

def build_session():
    s = requests.Session()
    s.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    return s


def fetch_html(session, book, chapter, version, args, cache_path):
    """Return (html, was_cached) for one chapter, using the disk cache when possible."""
    if cache_path and cache_path.exists() and not args.force:
        return cache_path.read_text(encoding="utf-8"), True

    params = {"search": "%s %d" % (book, chapter), "version": version}
    for attempt in range(1, args.retries + 1):
        try:
            r = session.get(BASE_URL, params=params, timeout=args.timeout)
            if r.status_code in (429, 500, 502, 503, 504):
                wait = float(r.headers.get("Retry-After", args.delay * attempt * 2))
                print("    HTTP %s; waiting %.0fs (attempt %d/%d)"
                      % (r.status_code, wait, attempt, args.retries), flush=True)
                time.sleep(wait)
                continue
            r.raise_for_status()
            r.encoding = r.encoding or "utf-8"
            html = r.text
            if cache_path:
                # write then rename, so a Ctrl+C mid-write cannot leave a half file
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                tmp = cache_path.with_suffix(".part")
                tmp.write_text(html, encoding="utf-8")
                tmp.replace(cache_path)
            return html, False
        except requests.RequestException as exc:
            if attempt == args.retries:
                raise
            wait = args.delay * attempt * 2
            print("    %s: %s; retrying in %.0fs (attempt %d/%d)"
                  % (type(exc).__name__, exc, wait, attempt, args.retries), flush=True)
            time.sleep(wait)
    raise RuntimeError("gave up on %s %d" % (book, chapter))


# --------------------------------------------------------------------------- #
# parsing
# --------------------------------------------------------------------------- #

def parse_chapter(html, book, chapter, version, args):
    soup = BeautifulSoup(html, "html.parser")

    col = (soup.select_one("div.passage-col.version-%s" % version)
           or soup.select_one("div.passage-col")
           or soup.select_one("div.passage-text"))
    if col is None:
        raise ChapterUnavailable("no passage container for %s %d" % (book, chapter))

    display = col.select_one("h1.passage-display .bcv .dropdown-display-text")
    reference = (display.get_text(" ", strip=True) if display
                 else "%s %d" % (book, chapter))

    root = col.select_one("div.passage-text") or col

    # footnotes / cross references sit at the end of the passage: grab before purging
    footnotes = []
    for li in root.select("div.footnotes li"):
        body = li.select_one(".footnote-text")
        anchor = li.find("a")
        footnotes.append({
            "id": li.get("id", ""),
            "reference": anchor.get_text(" ", strip=True) if anchor else "",
            "text": clean_text(body.get_text(" ") if body else "", False),
        })

    crossrefs = []
    if args.crossrefs:
        for li in root.select("div.crossrefs li"):
            anchor = li.find("a")
            crossrefs.append({
                "id": li.get("id", ""),
                "reference": anchor.get_text(" ", strip=True) if anchor else "",
                "text": clean_text(li.get_text(" "), False),
            })

    for br in root.find_all("br"):
        br.replace_with("\n")
    for selector in NOISE_SELECTORS:
        for el in root.select(selector):
            el.decompose()

    # section headings, tagged with the verse they introduce
    headings = []
    for h in root.select("h1, h2, h3, h4, h5, h6"):
        if "passage-display" in (h.get("class") or []):
            h.decompose()
            continue
        span = h.find("span", class_="text")
        refs = verse_span(span.get("class") if span else None, chapter)
        title = clean_text(h.get_text(""), False)
        if title:
            headings.append({"before_verse": refs[0] if refs else None, "text": title})
        h.decompose()

    # verses: one or more spans each, the verse number lives in the class name
    buckets = OrderedDict()
    for span in root.select("span.text"):
        if span.find_parent("span", class_="text"):
            continue                       # nested span, covered by its parent already
        refs = verse_span(span.get("class"), chapter)
        if not refs:
            continue

        # the printed number ("2", "2-11", "6b-11") before it is stripped from the text
        marker = span.select_one("sup.versenum, span.chapternum")
        label = marker.get_text(" ", strip=True) if marker else None
        for el in span.select("sup.versenum, span.chapternum"):
            el.decompose()

        piece = clean_text(span.get_text(""), args.keep_linebreaks)
        if not piece:
            continue
        start, end = refs
        slot = buckets.setdefault(start, {"verse": start, "verse_end": end,
                                          "label": label, "parts": []})
        slot["verse_end"] = max(slot["verse_end"], end)
        slot["parts"].append(piece)

    verses = []
    for start in sorted(buckets):
        slot = buckets[start]
        sep = "\n" if args.keep_linebreaks else " "
        entry = {"verse": slot["verse"], "text": sep.join(slot["parts"]).strip()}
        if slot["verse_end"] != slot["verse"]:
            entry["verse_end"] = slot["verse_end"]
        if slot["label"] and slot["label"] != str(slot["verse"]):
            entry["label"] = slot["label"]
        verses.append(entry)

    if not verses:
        raise ChapterUnavailable("no verses found for %s %d" % (book, chapter))

    data = {"chapter": chapter, "reference": reference, "verses": verses}
    if headings:
        data["headings"] = headings
    if footnotes:
        data["footnotes"] = footnotes
    if crossrefs:
        data["crossrefs"] = crossrefs
    return data


# --------------------------------------------------------------------------- #
# writers
# --------------------------------------------------------------------------- #

def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")


def book_to_text(book_data):
    lines = [book_data["book_localized"] or book_data["book"], ""]
    for ch in book_data["chapters"]:
        lines.append("=== %s ===" % ch["reference"])
        heads = dict((h["before_verse"], h["text"]) for h in ch.get("headings", [])
                     if h["before_verse"])
        for v in ch["verses"]:
            if v["verse"] in heads:
                lines += ["", heads.pop(v["verse"]), ""]
            num = v.get("label") or ("%d-%d" % (v["verse"], v["verse_end"])
                                     if "verse_end" in v else str(v["verse"]))
            lines.append("%s %s" % (num, v["text"]))
        for fn in ch.get("footnotes", []):
            lines.append("    [fn] %s: %s" % (fn["reference"], fn["text"]))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


# --------------------------------------------------------------------------- #
# driver
# --------------------------------------------------------------------------- #

def parse_chapter_spec(spec):
    """'1', '1-3', '1,4-6' -> sorted list of chapter numbers, or None for all."""
    if not spec:
        return None
    wanted = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            wanted.update(range(int(lo), int(hi) + 1))
        else:
            wanted.add(int(part))
    return sorted(n for n in wanted if n > 0)


def select_books(args):
    spec = (args.books or "all").strip().lower()
    if spec in ("all", "*", ""):
        books = list(CANON)
    elif spec in ("ot", "old", "old-testament"):
        books = [b for b in CANON if b[2] == "OT"]
    elif spec in ("nt", "new", "new-testament"):
        books = [b for b in CANON if b[2] == "NT"]
    else:
        index = dict((entry[0].lower(), entry) for entry in CANON)
        books = []
        for wanted in [w.strip().lower() for w in args.books.split(",") if w.strip()]:
            match = index.get(wanted) or next(
                (e for e in CANON if e[0].lower().startswith(wanted)), None)
            if not match:
                sys.exit("Unknown book: %r (try --list-books)" % wanted)
            books.append(match)

    if args.start_book:
        names = [b[0].lower() for b in books]
        try:
            books = books[names.index(args.start_book.lower()):]
        except ValueError:
            sys.exit("--start-book %r is not in the selection" % args.start_book)
    return books


def scrape(args):
    version = args.version.upper()
    out_root = Path(args.out).expanduser().resolve() / version
    json_dir, txt_dir = out_root / "books", out_root / "text"
    cache_dir = None if args.no_cache else out_root / "html"

    books = select_books(args)
    only = parse_chapter_spec(args.chapters)
    if only:
        total = sum(len([c for c in only if c <= b[1]]) for b in books)
    else:
        total = sum(b[1] for b in books) + (len(books) if args.probe_extra else 0)
    print("Version %s -> %s" % (version, out_root))
    print("%d book(s), up to %d chapter requests, %.1fs delay\n"
          % (len(books), total, args.delay))

    session = build_session()
    manifest, all_books, done = [], [], 0
    started = time.time()
    last_book = books[-1][0]

    for book, chapter_count, testament in books:
        book_slug = slug(book)
        book_json = json_dir / ("%s.json" % book_slug)

        if book_json.exists() and not args.force and not only:
            existing = json.loads(book_json.read_text(encoding="utf-8"))
            if not existing.get("missing_chapters") and not existing.get("partial"):
                print("-- %s: already saved, skipping" % book)
                all_books.append(existing)
                manifest.append({"book": book, "testament": testament,
                                 "chapters": existing["chapter_count"],
                                 "verses": existing["verse_count"]})
                done += chapter_count
                continue

        chapters, missing, localized = [], [], None
        limit = chapter_count + (1 if args.probe_extra else 0)
        todo = [c for c in only if c <= chapter_count] if only else list(range(1, limit + 1))

        for chapter in todo:
            done += 1
            cache_path = (cache_dir / book_slug / ("%03d.html" % chapter)
                          if cache_dir else None)
            label = "[%4d/%d] %s %d" % (done, total, book, chapter)
            try:
                html, cached = fetch_html(session, book, chapter, version,
                                          args, cache_path)
                data = parse_chapter(html, book, chapter, version, args)
            except ChapterUnavailable:
                if chapter > chapter_count:
                    print("%s: not in this translation (expected)" % label)
                else:
                    print("%s: NO CONTENT" % label)
                    missing.append(chapter)
                break
            except Exception as exc:                  # network / parse failure
                print("%s: FAILED - %s: %s" % (label, type(exc).__name__, exc))
                missing.append(chapter)
                continue

            chapters.append(data)
            if localized is None:
                localized = re.sub(r"\s*\d+\s*$", "", data["reference"]).strip()
            print("%s: %d verses%s" % (label, len(data["verses"]),
                                       " (cached)" if cached else ""), flush=True)
            if not cached and not (book == last_book and chapter == todo[-1]):
                time.sleep(args.delay + random.uniform(0, args.jitter))

        if not chapters:
            print("!! %s: nothing scraped\n" % book)
            continue

        book_data = {
            "version": version,
            "book": book,
            "book_localized": localized or book,
            "testament": testament,
            "chapter_count": len(chapters),
            "verse_count": sum(len(c["verses"]) for c in chapters),
            "source": "%s?search=%s 1&version=%s" % (BASE_URL, book, version),
            "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "chapters": chapters,
        }
        if missing:
            book_data["missing_chapters"] = missing
        if only:
            book_data["partial"] = True

        write_json(book_json, book_data)
        txt_path = txt_dir / ("%s.txt" % book_slug)
        txt_path.parent.mkdir(parents=True, exist_ok=True)
        txt_path.write_text(book_to_text(book_data), encoding="utf-8")

        all_books.append(book_data)
        manifest.append({"book": book, "testament": testament,
                         "chapters": book_data["chapter_count"],
                         "verses": book_data["verse_count"],
                         "missing_chapters": missing})
        print("   saved %s + %s (%d verses)\n"
              % (book_json.name, txt_path.name, book_data["verse_count"]), flush=True)

    if not all_books:
        print("Nothing scraped.")
        return 1

    # combined outputs
    write_json(out_root / ("%s.json" % version), {"version": version, "books": all_books})

    with (out_root / ("%s.jsonl" % version)).open("w", encoding="utf-8",
                                                  newline="\n") as fh:
        for bd in all_books:
            for ch in bd["chapters"]:
                for v in ch["verses"]:
                    end = v.get("verse_end", v["verse"])
                    num = "%d-%d" % (v["verse"], end) if end != v["verse"] else v["verse"]
                    fh.write(json.dumps({
                        "version": version,
                        "book": bd["book"],
                        "book_localized": bd["book_localized"],
                        "chapter": ch["chapter"],
                        "verse": v["verse"],
                        "verse_end": end,
                        "reference": "%s %d:%s" % (bd["book_localized"],
                                                   ch["chapter"], num),
                        "text": v["text"],
                    }, ensure_ascii=False) + "\n")

    write_json(out_root / "index.json", {
        "version": version,
        "source": BASE_URL,
        "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "book_count": len(all_books),
        "verse_count": sum(b["verse_count"] for b in all_books),
        "books": manifest,
    })

    incomplete = [m["book"] for m in manifest if m.get("missing_chapters")]
    print("\nDone in %.1f min - %d books, %d verses -> %s"
          % ((time.time() - started) / 60, len(all_books),
             sum(b["verse_count"] for b in all_books), out_root))
    if incomplete:
        print("Incomplete books (re-run to fill them in): %s" % ", ".join(incomplete))
    return 0


def main():
    p = argparse.ArgumentParser(
        description="Scrape a Bible translation from BibleGateway into JSON/text files.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("--version", default="MBBTAG",
                   help="BibleGateway version code (MBBTAG, ASND, NIV, ...)")
    p.add_argument("--out", default="data/bible", help="output directory")
    p.add_argument("--books", default="all",
                   help="'all', 'ot', 'nt', or a comma list e.g. 'Genesis,John'")
    p.add_argument("--start-book", help="resume the selection from this book")
    p.add_argument("--chapters",
                   help="limit chapters per book, e.g. '1', '1-3', '1,5-7'")
    p.add_argument("--delay", type=float, default=15.0,
                   help="seconds between requests (robots.txt asks for 15)")
    p.add_argument("--jitter", type=float, default=1.5,
                   help="extra random delay of 0..N seconds")
    p.add_argument("--timeout", type=float, default=30.0, help="request timeout")
    p.add_argument("--retries", type=int, default=4, help="attempts per chapter")
    p.add_argument("--force", action="store_true",
                   help="re-download and overwrite instead of resuming")
    p.add_argument("--no-cache", action="store_true",
                   help="do not keep raw HTML (loses cheap re-parsing)")
    p.add_argument("--keep-linebreaks", action="store_true",
                   help="preserve poetry line breaks inside verse text")
    p.add_argument("--crossrefs", action="store_true",
                   help="also store cross references")
    p.add_argument("--probe-extra", action="store_true",
                   help="try one chapter past the canon table (versions that split books)")
    p.add_argument("--list-books", action="store_true",
                   help="print the canon table and exit")
    args = p.parse_args()

    if args.list_books:
        for name, count, testament in CANON:
            print("%s  %-20s %3d chapters" % (testament, name, count))
        print("\n%d books, %d chapters" % (len(CANON), sum(c for _, c, _ in CANON)))
        return 0

    try:
        return scrape(args)
    except KeyboardInterrupt:
        print("\nInterrupted. Re-run the same command to resume "
              "(finished books and cached chapters are skipped).")
        return 130


if __name__ == "__main__":
    sys.exit(main())
