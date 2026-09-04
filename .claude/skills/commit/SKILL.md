---
name: commit
description: Commit the working tree with a conventional-commit message and keep the app version in step — decide the bump, update package.json, add the CHANGELOG entry, and tag. Use when the user says "commit", "commit all", "bump the version", "cut a release", or "what version is this".
---

# Commit and version

This project versions in `package.json` and records every release in
`CHANGELOG.md`. The version reaches the app through `__APP_VERSION__`
(defined in `vite.config.js`) and is shown at the foot of the Settings page,
so a bump is what makes a build identifiable on someone's phone.

Committing does not deploy. Pushing `main` is what deploys — that is the
`deploy` skill.

## 1. See what is actually there

```
git status --porcelain
git diff --stat
```

Read enough of the diff to describe it truthfully. Never write a message from
the file list alone.

**Never commit:**
- `dist/`, `node_modules/` — build output and dependencies.
- `data/bible/`, `backups/` — gitignored: 189 MB of publisher-copyrighted
  scrape, and real member/attendance records.
- `.env*` — gitignored, but check anyway before a wide `git add`.
- Scratch and throwaway files (`__t.mjs`, one-off `*.test.mjs`, temp scripts).
  Leave them untracked and say so; delete only if the user asks.

**Stage explicit paths. Never `git add -A` or `git add .`.**

The person who owns this repo edits it in parallel, in their own editor, while
you work. A sweep does not just risk the files listed above — it captures
whatever they were in the middle of and buries it in a commit whose message
says nothing about it. This has happened. List the paths you touched:

```
git add src/views/Lineups.vue src/composables/useLineups.js CHANGELOG.md
```

Then `git status --short` again before committing, and confirm the staged set
is exactly what you changed. Anything staged that you did not write is theirs:
leave it unstaged, finish your commit without it, and tell them it is there.

## 2. Decide the bump

The app is pre-1.0 and its module set still changes, so:

| Change | Bump |
| --- | --- |
| A module added or removed; a capability or route gone; a schema change users would notice | **minor** (`0.7.0` → `0.8.0`) |
| Features inside existing modules, refactors, UI passes, fixes | **patch** (`0.7.0` → `0.7.1`) |
| Nothing user-visible — comments, docs, tooling, dev-only config | **no bump** |

Breaking changes ride on a minor bump while pre-1.0. Reserve `1.0.0` for when
modules stop being added and removed; propose it, never assume it.

A single commit that is only a fix or a tidy-up does not need a version at all.
Bump when the working tree adds up to something a church would notice.

## 3. Bump and record

Only if step 2 called for a bump:

1. Edit the `version` field in `package.json`. That is the only place the
   number is written — do not touch `vite.config.js` or any component.
2. Add a `## [x.y.z] — YYYY-MM-DD` section at the top of `CHANGELOG.md`, under
   the existing preamble and above the previous release. Follow the house
   style: a one- or two-line summary of what the release is *for*, then
   `### Added` / `### Changed` / `### Fixed` / `### Removed` — only the
   headings that apply. Mark anything breaking **Breaking** inline.
3. Write it for the person running the church, not for the diff. "Songs became
   a real module with a projector attached" beats "added SongDetails.vue".

## 4. Commit

Conventional commits, matching the existing history:

```
feat: songs module with projector output, tasks, public site
fix: keep the sidebar minimize button within bounds
refactor: rework members around shared composables
chore: pin jose to v5 so firebase-admin loads on Vercel
```

One commit is right for one coherent change. Split when the tree holds
genuinely unrelated work — a feature and an unrelated fix — and say why.

When the tree includes a version bump, put it in the same commit as the work it
describes, and end the subject with the version:

```
feat: songs, presentation and tasks modules; drop finances (v0.8.0)
```

Body: a short paragraph on the why, and a `BREAKING CHANGE:` line for anything
removed. End every commit message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## 5. Tag

After a commit that carries a bump:

```
git tag -a v0.8.0 -m "v0.8.0 — <the release summary line>"
```

Tags stay local until pushed (`git push origin v0.8.0`) — mention that; don't
push unless the user asks, and never move or delete an existing tag.

## Answering "what version is this?"

Read `package.json` and the top of `CHANGELOG.md`. If the working tree has
uncommitted work, say so: the released version is what is tagged, and what is
on disk is that plus unreleased changes.
