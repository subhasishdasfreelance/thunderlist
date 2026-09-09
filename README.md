# Thunderlist

A personal productivity app with five sections — **Today**, **Backlog**,
**Checklists**, **Trackers** and **Tags** — stored in MongoDB.

Built with TanStack Start, React 19 and the [Astryx](https://astryx.atmeta.com)
design system, with Tailwind utilities layered on top of Astryx's design tokens.

- **Today** — what you plan to do today. It stores *references* to tasks, never
  copies of them, and opens as the app's home screen.
- **Backlog** — parked work, out of the way of today. Same shape as Today; a
  task is on one list or the other, never both.
- **Checklists** — flat task lists with progress, a start date and a deadline.
- **Trackers** — progress towards any measurable goal: a book, a course, a
  fitness target, a project.
- **Tags** — labels that group tasks across every checklist.

Edits do not go straight to the database. They collect in the browser and are
written as one reviewed batch. See [Pending changes](#pending-changes).

---

## Architecture

```
Browser
   ↓  (no connection string, no driver, no database access)
TanStack Start
   ↓
Server Functions      src/functions/*.functions.ts
   ↓
Repositories          src/data/*.server.ts
   ↓
MongoDB driver        src/lib/mongo/client.server.ts
   ↓
One `thunderlist` database
```

The browser never sees the connection string or a driver response. Every read
and write goes through a TanStack Start server function, which validates its
input with Valibot and calls a server-only repository module.

`src/lib/mongo/client.server.ts` throws at import time if it is ever pulled into
a browser bundle, so a layering mistake fails loudly instead of leaking secrets.

### Layers

| Path | Responsibility |
|---|---|
| `src/schemas/` | Valibot schemas and domain types. Shared by client and server. |
| `src/lib/tasks/`, `src/lib/progress.ts` | Pure logic: task ordering, progress, pace, velocity. No I/O. |
| `src/lib/pending/` | The edit queue, the projections that render it, and batch scheduling. |
| `src/lib/mongo/` | The connection, the collections and their indexes. Server only. |
| `src/data/` | Repositories: checklists, trackers, lists, tags, search. Server only. |
| `src/functions/` | Server functions: validate input, call a repository, sanitise errors. |
| `src/queries/` | TanStack Query option factories and query keys. |
| `src/components/` | UI, built from Astryx components. No data access. |
| `src/routes/` | File-based routes; loaders prime the query cache. |

Server functions are **reads plus one write**. Because every mutation is queued
in the browser, there is a single write endpoint — `applyChangesFn` — rather
than one per operation.

---

## Pending changes

Edits are collected rather than written one keystroke at a time, so nothing is
saved until it has been looked at.

1. Every action queues a change in `localStorage` (`src/lib/pending/store.ts`).
2. Screens render what the server returned with the queue laid over the top, so
   a queued edit looks exactly like a saved one (`src/lib/pending/overlay-*.ts`).
3. The top bar shows how many changes are waiting. Opening it lists them in
   plain words — "Add task Book flights", "Complete Draft the brief" — and each
   can be discarded on its own.
4. Confirming replays them against the database, in the order they were made.

Every id is minted in the browser so that a queued change can be shown in the
right place, referred to by later changes, and replayed on the server without
ever being renumbered. MongoDB's own `_id` is never used as an identity, and
every read projects it away.

### Ordering, and where it can be dropped

Order matters, but not everywhere. A change can depend on one before it — a task
added to a checklist created moments earlier — while twenty tasks pasted into
that checklist have nothing to serialise at all. Applying them one at a time
costs a network round trip each, which is the whole cost of a save.

`planRuns()` (`src/lib/pending/plan.ts`) works out which is which. Each change
declares the keys it *writes*, and whether it needs each to itself:

| Change | Claims |
|---|---|
| A checklist created, edited or deleted | Its checklist, **exclusively** |
| A task created, edited or deleted | Its checklist, *shared*; its own id, exclusively |
| A tracker created, edited or deleted | Its tracker, **exclusively** |
| A reading | Its tracker, *shared*; that tracker's total, **exclusively** |
| A Today/Backlog reference | The task it points at; its list |
| A reference moved | That whole list, **exclusively** |
| A tag created or renamed | Every tag, since the name must be unique |
| A tag deleted | **Everything** — it rewrites every task carrying it |

The shared/exclusive split is the point. Creating a checklist and writing a task
into it both concern that checklist, but twenty tasks in the same checklist do
not concern *each other* — so a container's lifecycle claims it exclusively
while the things inside it claim it shared, and the twenty inserts go out
together.

A run grows for as long as no two changes in it write to the same place. Runs go
out concurrently, at most 25 at a time. Runs themselves stay in order and no
change ever moves past one it might depend on, so the batch replays exactly as
it was built.

Pasting 25 lines into Today is 51 changes. Sequentially that was 7.0 s; as two
runs behind the checklist that creates them, it is about 1.8 s.

### Stopping part way

A batch is a replay, not a transaction, so it stops at the first failure.

The server reports how many went in as a **prefix**: the browser drops exactly
those and keeps the rest queued. Changes after the failure *within the same run*
may already have gone through, so they are replayed on the next attempt. That is
safe because every operation is **idempotent** — creating something that already
exists returns it, deleting something already gone is a no-op.

---

## Data model

One database, `thunderlist`, with six collections:

```
checklists   one document per checklist
tasks        one document per task, linked by checklistId
trackers     one document per tracker
entries      one reading per document, linked by trackerId
taskRefs     Today and Backlog, told apart by `list`
tags         tag names and colours
```

Nothing is nested. A task is edited, moved between lists and searched for on its
own, and a document per task keeps every one of those a single targeted write
rather than a rewrite of the whole checklist.

### `checklists`

`checklistId`, `title`, `description`, `startDate`, `deadline`, `createdAt`,
`updatedAt`.

### `tasks`

`taskId`, `checklistId`, `title`, `completed`, `addedAt`, `tagIds`.

A task is a title, when it was added, and its tags — and every field earns its
place. There is deliberately no due date, no notes, no sub-tasks and no stored
position: adding a task should cost one line of typing, and a form with four
optional fields is what stops people writing anything down.

There is no `updatedAt` either. Nothing in the app reads it, and a field nobody
reads is a field that quietly goes stale.

### `trackers`

`trackerId`, `title`, `type`, `unit`, `targetValue`, `currentValue`,
`description`, `coverUrl`, `author`, `startDate`, `deadline`, `createdAt`,
`updatedAt`.

### `entries`

`entryId`, `trackerId`, `recordedAt`, `value`, `note`, `updatedAt`.

No `delta` is stored — see [tracker progress](#how-tracker-progress-is-stored).

### `taskRefs`

`itemId`, `list`, `checklistId`, `taskId`, `sortOrder`, `addedAt`.

Both lists are one collection because they are one thing: a task belongs to at
most one of them. Neither has a `completed` field, by design. See below.

### `tags`

`tagId`, `name`, `color`, `createdAt`, `updatedAt`.

Tasks reference a tag by **id**, never by name. That is what makes renaming a
tag a single document write however many tasks carry it, and why a task can
never show a stale copy of a name. Deleting a tag strips its id from every task
that carried it, in one `updateMany`.

Tags are **written into the task, not picked from a menu**: "buy milk
#shopping". The `#name` is markup rather than content, so it is lifted out of
the title and applied as a tag (`src/lib/tags/inline-tags.ts`), and written back
the same way when the task is edited — so the round trip is lossless and there
is one place to change a task rather than two.

Typing `#` completes against the tags that already exist. A name that is not one
of them yet is offered too and becomes a real tag, so typing a tag is never a
dead end; the Tags screen stays the master list, where colours are set. A `#`
only starts a tag at the beginning of a word, so "learn C# properly" keeps its
title.

A tag written on several pasted lines is created **once**: the resolver that
turns names into ids remembers what it has already queued, because the first two
uses exist only in the queue where the server's tag list cannot see them.

### Indexes

Created on first connect and idempotent, so there is no migration step. Each
app-minted id is unique; the rest are the lookups every screen makes.

| Collection | Index |
|---|---|
| `checklists`, `trackers`, `tags` | its id, unique |
| `tasks` | `taskId` unique; `checklistId` |
| `entries` | `entryId` unique; `trackerId, recordedAt` |
| `taskRefs` | `itemId` unique; `list, sortOrder` |

---

## How tasks are ordered

By `addedAt`, and nothing else.

A stored position would be a second source of truth to keep in step, and it
bought nothing a timestamp does not already give: the order you added things in
*is* the order you want to see them in. Ties break on `taskId`, which is
time-sortable, so the order is total and stable.

---

## How Today and Backlog reference canonical tasks

Both hold `(checklistId, taskId)` pairs. When a list is rendered:

1. the entries of **both** lists are read, already sorted
2. the checklists and tasks they point at are read in one query each
3. each reference is resolved to its canonical task

Reading them together is deliberate: they draw on the same checklists, so one
task read serves both, and the checklist screen needs both to know which icon to
light up on a task.

Ticking a checkbox on Today writes to the task in **its own checklist**. Neither
list has completion state of its own, so there is exactly one source of truth
and no way for the views to disagree.

A task is on Today **or** in the Backlog, never both: putting it on one takes it
off the other.

A reference whose task or checklist has been deleted is shown as "This task no
longer exists" with a control to clear it, rather than being silently dropped.

### The Inbox

A task typed straight into Today or the Backlog still needs a checklist to live
in, because those lists hold references only. The first such task creates an
ordinary checklist called **Inbox** and the rest join it. It can be opened,
renamed, tidied or deleted like any other checklist.

### Completed work

Completed tasks move to a **Completed** section at the bottom of the list rather
than staying in place, with one control to clear it. What clearing means follows
what the screen holds: in a checklist it deletes the tasks (behind a
confirmation), while on Today and the Backlog — which hold references only — it
takes them off the list and leaves the tasks where they live.

### Adding several tasks at once

The quick-add field treats a **newline as a task boundary**, so a list written
or copied from somewhere else can be pasted in one go and lands as one task per
line. Enter adds everything typed; Shift+Enter starts another line by hand.

That is why it is a text area and not a single-line input: an `<input>` flattens
a multi-line paste into one line and the boundaries are lost before the app ever
sees them.

---

## How tracker progress is stored

You always enter **the reading, not the increment**: after reading to page 78
you type 78, not 33.

The step from the previous reading is **derived, never stored**. It is the
distance from the reading before it, which changes whenever a neighbour is
added, edited or back-dated — so deriving it on read means there is nothing to
keep in step, and back-dating an entry re-spaces its neighbours for free.

Current progress is the most recent reading, ordered by `recordedAt` and then by
`entryId`, which is time-sortable. That value is denormalised onto the tracker
as `currentValue` so the tracker list renders from one query and never touches a
history; it is recomputed from the readings whenever one changes, so the copy
cannot drift from what it summarises.

Progress is unit-agnostic: `284 / 412 pages`, `12 / 20 lessons`, `64 / 100 km`.
Books are first-class (author, cover, "Current page" on the entry form) but are
just a tracker `type`; nothing in the generic logic knows about pages.

### Pace and velocity

Every checklist and tracker has a **start date** (defaulting to today, but
editable, so something begun last month is paced from when it really began) and
an optional **deadline**.

**Pace** (`Ahead` / `On track` / `Behind`) compares how much is done against how
much of the time between those two dates has passed, with a 10-point tolerance.
With no deadline there is no status — the app never invents one. The same figure
draws the target mark on each progress bar and the "62% expected by now" line
underneath it, so the bar and the words always agree.

### Stats

`computeVelocity()` turns a start date, a deadline, a current position and a
target into the figures every screen shows:

- **current speed** — units covered per day so far
- **expected speed** — what the deadline asked for on day one
- **needed from now** — what it takes from today to still make it
- **finishing** — the day the target is reached if the current pace holds
- **total time** and **time left**

A checklist counts tasks and a tracker counts pages, but "am I going fast enough
to finish by the deadline" is the same question, so both get the same figures
from the same code. Cards carry the one-line version ("1.2 tasks/day · finishing
3 October 2026"); detail screens carry the full grid; Today, Backlog and Tags
carry the counts their own data supports.

Each figure is omitted when the data cannot support it: no deadline, or a
standstill that would never finish. Day one counts as a whole day, so something
started today reports the pace it actually achieved rather than dividing by
zero.

---

## Look and feel

One Astryx theme, defined in `src/theme/thunderlist.theme.ts`. Astryx generates
the whole palette — every surface, border, text and icon token, light and dark,
contrast-checked against each other — from a couple of seeds; only the accent
family is written out by hand, because the generator resolves any blue seed to a
pale periwinkle for the dark scheme and that is not this app. The four accent
tokens are chosen as a set and the file states the ratios they were chosen for.

That file is the source, not what the app loads. `bun run theme:build` compiles
it to `thunderlist.css` and `thunderlist.js` beside it, and those ship: a
stylesheet the server can send with the page, rather than a `<style>` the
browser injects at hydration, which is a flash of the wrong colours on every
first paint. `bun run build` recompiles it first, so the two cannot drift;
`bun run theme:check` fails if they have.

The page sits on the body wash rather than on white, so the cards and rows above
it have an edge to be seen by. The top bar and the phone's bottom bar are
translucent and blurred, so a page reads as one surface continuing underneath
them.

Translucency costs contrast, and those bars carry the navigation, so the blur
does most of the separating and the wash is 72% opaque over it. Browsers without
`backdrop-filter` get the opaque surface instead, because a flat wash of
translucent white over arbitrary content is exactly the unreadable case.

Dates are written one way everywhere — `8th Oct, 2026` — including inside the
date pickers, which take the same formatter. They are stored as `YYYY-MM-DD`,
which is right for storage and wrong for reading.

---

## Reads

There is no server-side read cache. MongoDB is fast enough to answer every
request from the database, and a cache would only add staleness. Reads are kept
cheap by shape instead:

- the checklist list is **two queries** whatever the number of checklists: the
  checklists, and the `completed` flag of every task
- the tracker list is **one query** — the denormalised `currentValue` is what
  the cards show
- a tracker's full history is read only when you open it
- the search index doubles as the task source for the Tags screen and the "add
  from a checklist" picker, so neither costs an extra read
- mutations write **one document**, never a collection

TanStack Query caches on the client. Because the same database can be changed
from another device or tab, the avatar menu has **Refresh**, which refetches
everything.

---

## Setup

### 1. A database

Any MongoDB will do — a local server, a container, or a free
[Atlas](https://www.mongodb.com/atlas) cluster. Thunderlist creates the
`thunderlist` database, its collections and its indexes on first connect, so
there is nothing to set up by hand.

On Atlas you need two things:

1. A **database user** with read/write access (Database Access → Add New
   Database User). The username and password go in the connection string.
2. Your IP address in **Network Access**.

Get the string from **Connect → Drivers**. It looks like:

```
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
```

If the password contains any of `: / ? # [ ] @ %` it must be percent-encoded.

### 2. Environment

```bash
cp .env.example .env.local
```

| Variable | Value |
|---|---|
| `MONGO_CONN_STR` | The connection string above |
| `BETTER_AUTH_SECRET` | Any long random string |
| `BETTER_AUTH_URL` | `http://localhost:4000` in development |

The database is always `thunderlist`; a database named in the connection string
is ignored.

Never commit `.env.local`. It is gitignored.

### 3. Run

```bash
bun install
bun --bun run dev      # http://localhost:4000
```

If the connection string is missing or the database cannot be reached, the app
says so at the top of every screen rather than failing silently.

---

## Scripts

```bash
bun --bun run dev        # dev server on :4000
bun --bun run build      # production build
bun --bun run preview    # serve the build
bun run typecheck        # tsc --noEmit
bun test                 # unit tests for the pure logic
bun run check            # Biome lint + format
```

Tests cover the parts worth pinning down: task ordering, checklist progress,
tracker percentages, delta derivation and re-spacing, pace, velocity, calendar
arithmetic, date formatting, inline `#tag` parsing, and which queued changes may
be applied together.

---

## Deployment

The project targets Vercel (`vercel.json` sets the framework to
`tanstack-start`).

1. Push to GitHub, GitLab or Bitbucket.
2. In Vercel choose **Add New → Project** and import the repo.
3. Under **Settings → Environment Variables** add `MONGO_CONN_STR`,
   `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
4. On Atlas, allow Vercel's egress under **Network Access**.
5. Deploy.

Only variables prefixed `VITE_` reach the browser bundle. Keep every secret
unprefixed.

---

## Notes and limitations

- **Single user.** Authentication is Better Auth in stateless mode and every
  document is shared. There is no per-user data separation.
- **The queue is per browser.** Unsaved changes live in that browser's
  `localStorage`. They survive a reload, but another device will not see them
  until they are saved.
- **Not transactional.** A batch is replayed change by change rather than
  committed at once. Multi-step operations are ordered so the safest failure
  wins — deleting a checklist clears the references pointing at it before the
  checklist goes, so a failure leaves recoverable data rather than a dangling
  pointer. Every operation is idempotent, so a stopped batch is simply retried.
- **`mongodb` is pinned to v6.** The v7 driver's BSON package calls
  `v8.startupSnapshot.isBuildingSnapshot()` at import time, which Bun does not
  implement, so v7 crashes the dev server on this runtime.
