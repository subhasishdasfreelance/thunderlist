# Thunderlist

A productivity app for one person or a team — **Checklists**, **Trackers**,
**Tags**, **Priority** and **Across lists** — stored in MongoDB. **Today** is a special
tag, and the **Inbox** and the **Backlog** are the two checklists every space
has: one for everything that belongs to no other, one for parked work.

Built with TanStack Start, React 19 and the [Astryx](https://astryx.atmeta.com)
design system, with Tailwind utilities layered on top of Astryx's design tokens.

- **Today** — a special tag for what you plan to do today, and the app's home
  screen (`/tags/today`). The bolt on any task writes `#today` at the end of its
  title; pressing it again takes the tag out wherever it was written. Paced
  from 06:00 to 22:00 every day. It can be renamed on the Tags screen, never
  deleted.
- **Backlog** — the checklist parked work goes into: **B** on a task, or
  **Move to Backlog** in its menu, which also takes it off Today. Every space
  has one, and it cannot be deleted.
- **Inbox** — the checklist a task goes into when it is written somewhere that
  is not a checklist: onto Today, or any tag's page. Every space has one, and it
  cannot be deleted.
- **Checklists** — tasks with progress, a start date and a deadline, moving
  through stages: "To do" and "Done", or as many as the work has.
- **Trackers** — progress towards any measurable goal: a book, a course, a
  fitness target, a project.
- **Tags** — labels that group tasks across every checklist.
- **Priority** — every open task, sorted by whether it is urgent and important.
- **Across lists** — every task by the stage it is at, or by what kind of work
  it is, whichever checklist it is in: everything in Review, say, or every bug.
- **Teams** — a space shared with other people, each with a role that caps what
  they can change, and an access list per checklist, tracker and tag saying who
  it is for and what each of them may do with it.

Every change is drawn on screen at once and saved straight away. See
[Making a change](#making-a-change).

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
and write goes through a TanStack Start server function, which works out who is
asking and in which space, validates its input with Valibot, and calls a
server-only repository module.

`src/lib/mongo/client.server.ts` throws at import time if it is ever pulled into
a browser bundle, so a layering mistake fails loudly instead of leaking secrets.

### Layers

| Path | Responsibility |
|---|---|
| `src/schemas/` | Valibot schemas and domain types, roles and what each may do. Shared by client and server. |
| `src/lib/tasks/`, `src/lib/progress.ts` | Pure logic: task ordering, paging, filters, progress, pace, velocity. No I/O. |
| `src/lib/changes.ts`, `src/lib/optimistic.ts` | Making a change, and drawing it before the server confirms it. |
| `src/lib/mongo/` | The connection, the collections and their indexes. Server only. |
| `src/data/` | Repositories: checklists, trackers, tags, teams, who sees what, settings, search. Server only. |
| `src/functions/` | Server functions: resolve the space, validate input, call a repository, sanitise errors. |
| `src/queries/` | TanStack Query option factories and query keys. |
| `src/components/` | UI, built from Astryx components. No data access. |
| `src/routes/` | File-based routes; loaders prime the query cache. |

Server functions are **reads plus one write**. Every mutation is a `Change`, so
there is a single write endpoint — `applyChangeFn` — rather than one per
operation, and one place that decides whether it is allowed.

---

## Making a change

1. Every action builds one `Change` (`src/lib/changes.ts`): "add this task",
   "move that one to Review", "keep this checklist to these three people".
2. It is drawn at once: the caches every screen reads from are patched
   (`src/lib/optimistic.ts`) and the request goes out behind it.
3. The server works out who is asking and where, refuses anything their role
   may not do or that is kept from them, and writes it
   (`src/data/change.server.ts`).
4. If it is refused, the screen is put back exactly as it was and says why.
   Either way, the screens read afresh once nothing else is still saving.

Every id is minted in the browser, so a change can be drawn in the right place
before the server has it, and sending the same change twice is the same change
rather than two. That is what makes a retry safe: a change that failed because
the connection went is tried again when it comes back. MongoDB's own `_id` is
never used as an identity, and every read projects it away.

Every operation is **idempotent** — creating something that already exists
returns it, deleting something already gone is a no-op — and one that takes
several writes is ordered so the safest failure wins; see
[Notes and limitations](#notes-and-limitations).

---

## Teams and permissions

Everyone has a space of their own. A **team** is another space, shared: its
checklists, tasks, tags and trackers are stored exactly like anyone's, owned by
the team's id instead of a person's, so nothing of one space can be read from
another. The Settings screen lists them — each team's name, what you are in it
and how many people it has — and moves between them. Which one a browser is in
is a cookie, but only ever a request: membership is checked against it on every
call (`requireScope`), and someone asking for a team they are not in works in
their own space instead.

### Roles

Whoever makes a team is its **admin**, and there is only ever one: making
someone else the admin hands the team over, and the old admin becomes a project
manager. The admin opens the team from the Settings screen and adds people by
the address their Google account signs in with — before they have ever opened
the app, if need be — gives each a role, and can change it at any time. The
same popup lists who is in the team and has the table below.

| | Admin | Project manager | Collaborator | Viewer |
|---|:-:|:-:|:-:|:-:|
| See everything, whoever it is kept to | ✓ | | | ✓ |
| See what is shared with them | ✓ | ✓ | ✓ | ✓ |
| Tick tasks, move them through stages, edit, flag and take them on; record tracker progress | ✓ | ✓ | ✓ | |
| Add and delete tasks, and move them between checklists | ✓ | ✓ | | |
| Make, change and delete checklists, trackers, tags and task types | ✓ | ✓ | | |
| Choose who a checklist, a tag or a tracker is for, and what each may do | ✓ | ✓ | | |
| Add and remove people, change their roles, delete the team | ✓ | | | |

The roles are defined once, in `src/schemas/team.ts` (`roleCan`), and the
server holds every change to them. The screens only hide what a role cannot do
(`usePermissions`), so a missing button is a convenience, never the protection.
The account menu says what you are in the space you are working in, and the
Settings screen what you are in each team.

A collaborator who writes a `#tag` that does not exist yet keeps it in the title
as plain words, since making tags is not theirs to do. Teams made before the
roles were split had "members", who could do everything but run the team; they
are read as project managers.

### Who it is for, and what they may do with it

A role is the **most** anyone can do in a team, not what they are handed. What
they actually reach is decided per checklist, per tracker and per tag, by an
access list: who is on it, and how far in each of them may go.

| Level | What it means |
|---|---|
| **Read** | Sees it and everything in it. Changes nothing. |
| **Edit** | Ticks its tasks, moves them along their stages, edits, flags and takes them on; records a tracker's readings. |
| **Full** | All of that, and adds and deletes tasks, moves them between checklists, and changes or deletes the thing itself — who it is for included. |

The two are read together and the **smaller wins**, so a list can never hand
out more than a role allows: a collaborator given Full on a checklist still
adds and deletes nothing, because that is not theirs to do anywhere. The rules
are in `src/schemas/access.ts` (`levelFor`), and the server holds every change
to them (`assertLevel`).

The row of faces beside **Back** on a page says who it is for; pressing it
opens a searchable picker with a level beside each person. Whoever sets it is
on the list and runs it, so nothing is ever left with nobody who can change it
again, and the admin and viewers are on every list by right.

**Adding someone to a team hands them nothing.** They see no checklist, no
tracker and no tag until they are put on one — which is why a new checklist,
tracker or tag starts with its author alone on its list. A tag typed into a
title (`#shopping`) is the exception and starts as everyone's: whoever reads
the task reads the tag.

Anything made before levels existed carries the old `visibleTo` field — who
could see it, with what they could do left to their role — and is read as an
access list of those people at Full, which capped by the role is exactly what
they could already do (`accessFromVisibleTo`). Nobody gains or loses anything;
the field is dropped the next time that document's list is saved.

What something holds goes with it: a task in a checklist is seen by whoever can
see the checklist, and a task in the Inbox — which belongs to no checklist of
its own — by whoever can see one of its tags. Today, the Backlog and the Inbox
are everyone's.

To anyone else, something kept from them does not exist: it is left out of
every list, count and search, and naming it by id is answered as for something
deleted (`src/data/visibility.server.ts`).

### Working together

A task can be assigned to one person or several, and shows their faces. With
the pointer on a task, **Space** assigns it to you or takes you off it;
**Assign people…** in its menu picks anyone.

A checklist has a filter row: one person's tasks, one tag's, or both. Everything
on the screen follows it — the progress, the speed figures, the chart, the
counts on each stage and the list — so the numbers are always about the rows
under them. A tag's page has the same person filter.

---

## Data model

One database, `thunderlist`:

```
checklists   one document per checklist
tasks        one document per task, linked by checklistId
trackers     one document per tracker
entries      one reading per document, linked by trackerId
tags         tag names, colours and schedules
teams        one document per team
members      one document per person per team, with their role
settings     what a space has chosen for itself: its task types
taskRefs     the old Today and Backlog lists, moved onto tags on first read
```

Better Auth keeps its own `user`, `session` and `account` collections alongside,
under its own names. Every other document carries `userId` — a person's own id,
or a team's — and every query, read and write alike, filters on it. It is read
from the session on the server, never from the browser.

Nothing is nested. A task is edited, moved between lists and searched for on its
own, and a document per task keeps every one of those a single targeted write
rather than a rewrite of the whole checklist.

### `checklists`

`checklistId`, `title`, `description`, `startDate`, `deadline`,
`deadlineTime`, `dailyWindow`, `tagIds`, `stages`, `access`, `special`,
`createdAt`, `updatedAt`.

`special` is `"inbox"` for the Inbox, `"backlog"` for the Backlog, and absent
for every other checklist.
`stages` is absent until a checklist is given stages of its own; see
[Stages](#stages). `tagIds` are carried by every task in the checklist, added
later or not. `access` is who in a team it is for and what each may do with
it, or absent for everyone; see
[Who it is for](#who-it-is-for-and-what-they-may-do-with-it).

### `tasks`

`taskId`, `checklistId`, `title`, `completed`, `completedAt`, `addedAt`,
`tagIds`, `stageId`, `typeId`, `urgent`, `important`, `assignees`,
`trackerId`, `linkedChecklistId`, `caption`, `notes`.

A task is written in one line — a title, with its tags and flags typed into it —
because that is all adding a task should cost. Everything else is optional and
written elsewhere: the caption, notes and type from its edit dialog, the people
from its menu, the stage by moving it along. `completedAt` is stamped by the
server, so a chart drawn from it runs off one clock.

A task with a `trackerId` or a `linkedChecklistId` stands for a tracker or
another checklist and is done when that is. Its tick is worked out on every
read and cannot be set by hand, so the task and the thing it stands for can
never disagree.

There is no stored position and no `updatedAt`. Nothing in the app reads
either, and a field nobody reads is a field that quietly goes stale.

### `trackers`

`trackerId`, `title`, `type`, `unit`, `targetValue`, `startValue`,
`currentValue`, `description`, `coverUrl`, `author`, `startDate`, `deadline`,
`deadlineTime`, `tagIds`, `assignees`, `access`, `createdAt`, `updatedAt`.

### `entries`

`entryId`, `trackerId`, `recordedAt`, `value`, `note`, `updatedAt`.

No `delta` is stored — see [tracker progress](#how-tracker-progress-is-stored).

### `tags`

`tagId`, `name`, `color`, `special`, `description`, `startDate`, `deadline`,
`deadlineTime`, `dailyWindow`, `access`, `createdAt`, `updatedAt`.

Tasks reference a tag by **id**, and also write it into the title by name.
Renaming a tag rewrites that `#name` in the titles of the tasks carrying it, so
an edit never reads an old name back as a new tag. Deleting a tag strips its id
from every task, checklist and tracker that carried it.

One tag is **special**: `today`. Every space has it, made on the first read of
its tags (a unique index on `userId, special` settles two first requests at
once); it can be renamed and recoloured but not deleted, and its page is
addressed by its kind, `/tags/today`.

The Backlog was the other special tag. It is a checklist now: the first time a
space is read, every task still carrying the old tag moves into the Backlog
checklist with the tag taken out of its title, and the tag is deleted
(`ensureBacklog`).

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
turns names into ids remembers what it has already made, because the first
uses exist only on screen, where the server's tag list cannot see them yet.

### `teams` and `members`

`teamId`, `name`, `createdAt` — and for each person in it, `teamId`, `email`,
`role`, `addedAt`.

People are known by the lower-cased address they sign in with, which is how
someone can be added before they have an account. Their name and picture are
read from Better Auth's `user` once there is one.

### `settings`

`userId`, `taskTypes`, `updatedAt`: one document per space, absent until it
changes anything. Each type is a `typeId`, a `name` and a `color`; with no
document a space has Bug, Feature, Story and Chore. Taking a type off the list
takes it off every task that had it.

### `taskRefs`

`itemId`, `list`, `taskId`, `sortOrder`, `addedAt`.

Legacy. Today and the Backlog used to be lists of references. The first time a
space's tags are read, anything still in here for Today is written onto its task
as `#today`, and everything is deleted: the Backlog is a checklist now, with no
tag for its entries to go onto.

### Indexes

Created on first connect and idempotent, so there is no migration step. Each
app-minted id is unique; the rest are the lookups every screen makes.

| Collection | Index |
|---|---|
| `checklists`, `trackers`, `tags` | its id, unique; `userId` |
| `checklists` | `userId, special`, unique where set — one Inbox and one Backlog per space |
| `tags` | `userId, special`, unique where set — one Today |
| `tasks` | `taskId` unique; `userId, checklistId` |
| `entries` | `entryId` unique; `userId, trackerId, recordedAt` |
| `teams` | `teamId` unique |
| `members` | `teamId, email` unique; `email` |
| `settings` | `userId` unique |
| `taskRefs` | `itemId` unique; `userId, taskId`; `userId, list, sortOrder` |

---

## Stages

A checklist's tasks go through its stages in order: "To do" and "Done" to begin
with, or as many as the work needs — To do, Review, UAT, Done. They are set,
renamed and reordered in the checklist's edit dialog, and the last one is always
done: a task reaching it is complete. Ticking a task — wherever it is shown —
moves it on to the next stage, so it is done once ticked at the stage before
the last. Unticking moves it back to the first.

A checklist's page shows one stage at a time, opening on the first, with how
many tasks are at each. **Stage** in a task's menu sends it to any of them,
straight to done included. Taking a stage away moves its tasks back to the
nearest stage before it that is left.

The **Across lists** screen shows one stage across every checklist at once,
twenty tasks a page. A stage there is a name, since that is what checklists
share: Review is every task at a stage called Review, wherever it lives. The
names run from the first stages to done, each placed by the earliest point any
checklist has it (`stagesByName`).

The same screen cuts the same rows **by type** instead, at a switch: every bug
whatever list it is in (`tasksByType`). One screen rather than two, because it
is the same question asked of the same tasks, and a tab strip that changes what
it names is the smallest thing that can carry both.

A stage has an id of its own, so renaming one keeps its tasks. A task stores the
id of the stage it is at; one from before stages, or from a stage since taken
away, is at the first stage while open and the last once done (`stageOf`).
Everything that counts progress still counts `completed`, which the server
keeps in step with the stage.

## The Inbox

Every task is in a checklist. One written where there is no checklist to put it
in — typed onto Today or any tag's page, or put on Today from a tracker — goes
into the space's Inbox, so it can always be found and always be moved into a
proper list with **Move to checklist…**. The Inbox is made the first time a
space is read, and any older task that belonged to no checklist is moved into
it then (`ensureInbox`).

## Task types

A task can say what kind of work it is — a bug, a feature, a chore — shown as a
coloured label in front of its title. Press **K** with the pointer on a task, or
set it in its edit dialog.

Each space keeps its own list, and the **Settings** screen is where it lives:
unlike a checklist's stages, types belong to the whole space, so they sit with
the space rather than with any one list. The type picker opens the same editor
(**Manage types**), so a type that is missing can be added without leaving the
task.

Every task list can be **narrowed to one kind** — and to one person's and one
tag's — from the filter row, and **ordered by kind**, in the order the space
keeps its types in, the untyped last. Everything on the screen follows the
filter: the list, the counts and the progress.

---

## How tasks are ordered

By `addedAt`, newest first — or by priority (urgent and important first), by
stage (still to do first, done last), or by type. One menu says which, since
four orders would be four switches competing to say which one is in force; the
button always names the order the list is actually in.

A stored position would be a second source of truth to keep in step, and it
bought nothing a timestamp does not already give: the order you added things in
*is* the order you want to see them in. Ties break on `taskId`, which is
time-sortable, so the order is total and stable.

### A page at a time

Every list is shown twenty rows a page, with the pages numbered, so any page is
a click away. The long ones — a checklist's stages, a tag's open tasks — are
read from the server a page at a time. A link to a task (`?task=`) opens on the
page, and the stage, it is on, and rings it.

---

## How Today and the Backlog work

Today is a tag, so a task on Today is a task carrying `#today`, in whichever
checklist it lives — the Inbox, for one typed onto Today. Today's page is that
tag's page. There is nothing to keep in step: completion lives on the task, as
it always did.

The bolt on a row writes the tag at the end of the title and takes it out again
from wherever it was written.

The Backlog is a checklist. **B** on a row, or **Move to Backlog** in its menu,
moves the task into it as **Move to checklist…** would, taking it off Today
first: a task is planned or parked, not both. Moving is shaping the work, so it
is a project manager's to do. A task leaves the Backlog the way it leaves any
checklist, and can go on Today while it is there.

### Completed work

On a checklist, finished tasks are its last stage, which can be shown as a list
or as a chart of how the work was finished against the plan. On a tag's page
they sit in a folded **Completed** section at the bottom, read only once it is
opened. What clearing them means follows the screen: on a checklist or an
ordinary tag it deletes the tasks, while on Today it only takes the tag off.

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

Every checklist, tag and tracker has a **start date** (defaulting to today, but
editable, so something begun last month is paced from when it really began) and
an optional **deadline**, which can carry a time: due at 18:30, not just due on
Friday. A checklist or a tag can instead **repeat daily** — the same hours every
day, 06:00 to 22:00 to begin with — and is then paced against today's stretch
of them. Today starts that way.

**Pace** (`Ahead` / `On track` / `Behind`) compares how much is done against how
much of that window has passed, with a 5-point tolerance. The time is measured
to the minute in fractional hours — four and a half hours of a nine-hour window
is exactly half — on the viewer's own clock, so it is worked out in the
browser: the server knows neither the clock nor the time zone, and draws no
figure it would have to take back. With no deadline there is no status — the
app never invents one. The same figure places the bolt on each progress bar and
writes the "62% expected by now" line under it, so the bar and the words always
agree. The speeds are counted in days, or in hours for a daily window.

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
3 October 2026"); detail screens carry the full grid; Today and Tags carry the
counts their own data supports.

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

### The sixteen colours

A tag, a stage and a task type each pick from one list of sixteen
(`TAG_COLORS`), ordered round the wheel. Ten are Astryx's own `Token` colours;
the other six — rose, magenta, indigo, lime, brown, slate — fill the gaps that
ring had, because a checklist may run to a dozen stages and ten colours could
not keep them apart.

Each colour is two things, and both were measured rather than picked by eye:

- a **chip**, where the name sits on a 20% wash of the colour. At least 7:1 on
  the card, the page and a menu, in both schemes — the ratio Astryx's ten keep.
- a **mark** (`--thunderlist-mark-*`), the solid dot, bar segment and checkbox
  outline. At least 3:1 against those same three surfaces, in both schemes,
  because a mark is read against the page and not beside its own label.
  Astryx's `--color-icon-*` is tuned for the latter and its yellow is 1.5:1 on
  a white card, which as a dot is a dot you cannot see, so the marks are the
  app's own table.

Light, dark or match the system is chosen from the bar and kept per browser, in
local storage and in a cookie. The server reads the cookie and draws the page in
the chosen scheme, so a full load — after a deploy, or when a new service worker
takes over — never shows the other scheme first; a script in the head sets the
page's own background before the first paint.

The page sits on the body wash rather than on white, so the cards and rows above
it have an edge to be seen by. The top bar and the phone's bottom bar are
translucent and blurred, so a page reads as one surface continuing underneath
them.

Translucency costs contrast, and those bars carry the navigation, so the blur
does most of the separating and the wash is thin over it. Browsers without
`backdrop-filter`, and anyone who has asked their system for less transparency
or more contrast, get the opaque surface instead, because a flat wash of
translucent white over arbitrary content is exactly the unreadable case.

Every change makes a small sound: a rising note for something added, two
climbing ones for a tick, an octave down for something gone, the same note
twice for something moved, a blip for a tag, a long climb for a reading
recorded. They are synthesised rather than recorded, so there are no files to
fetch, and anything without a sound of its own falls back to a barely-there tap
rather than to silence (`src/lib/sounds.ts`).

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
- a checklist's page is sent one page of one stage; a tag's page one page of
  its open tasks, and its finished ones only once their section is opened
- the search index doubles as the task source for the Tags, Priority and
  Across lists screens, so none of them costs an extra read
- most changes write **one document**; the few that reach further — deleting a
  tag, changing a checklist's tags or stages — write the tasks they affect in
  one bulk write

TanStack Query caches on the client, and every screen reads again after each
change and when the window comes back into focus. Moving to another space
empties the whole cache, and every screen reads afresh from the new one.

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

### 2. Google sign-in

Google is the only way in — there are no passwords. In the Google Cloud console,
create an **OAuth client ID** of type *Web application* and add this authorised
redirect URI (the same with your deployed origin, for production):

```
http://localhost:4000/api/auth/callback/google
```

### 3. Environment

```bash
cp .env.example .env.local
```

| Variable | Value |
|---|---|
| `MONGO_CONN_STR` | The connection string above |
| `BETTER_AUTH_SECRET` | Any long random string |
| `BETTER_AUTH_URL` | `http://localhost:4000` in development — the exact origin, port included |
| `GOOGLE_CLIENT_ID` | From the OAuth client above |
| `GOOGLE_CLIENT_SECRET` | From the OAuth client above |

The database is always `thunderlist`; a database named in the connection string
is ignored.

Never commit `.env.local`. It is gitignored.

### 4. Run

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

Tests cover the parts worth pinning down: task ordering, paging, checklist
progress, tracker percentages, delta derivation and re-spacing, pace, velocity,
calendar arithmetic, date formatting, inline `#tag` parsing, who in a team can
see which task and what they may do with it, and how a change is drawn before
the server confirms it — stages, counts and pages included.

---

## Deployment

The project targets Vercel (`vercel.json` sets the framework to
`tanstack-start`).

1. Push to GitHub, GitLab or Bitbucket.
2. In Vercel choose **Add New → Project** and import the repo.
3. Under **Settings → Environment Variables** add `MONGO_CONN_STR`,
   `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`, with `BETTER_AUTH_URL` set to the deployed origin.
4. Add the deployed origin's redirect URI to the Google OAuth client.
5. On Atlas, allow Vercel's egress under **Network Access**.
6. Deploy.

Only variables prefixed `VITE_` reach the browser bundle. Keep every secret
unprefixed.

### Installing on a phone

Thunderlist is a PWA. Open it in the phone's browser and choose **Add to Home
Screen** (Safari) or **Install app** (Chrome); the manifest and icons are in
`public/`.

`public/sw.js` answers the hashed files under `/assets/` from the browser's
cache. Pages always come from the network, so every open gets the latest
version; the last copy of Today is kept only so the app can open offline. A page
that cannot be fetched and has no kept copy opens onto `public/offline.html`,
the app's own offline page, rather than the browser's error; bump `FALLBACK` in
the worker when that page changes, or installed copies keep the old one. A new
worker reloads the page when it takes over, so a change to it lands on the same
open. The worker is registered in production builds only.

A page left open across a deploy can ask for a screen's code the server no
longer has. The app shows its loading screen instead of the browser's error and
reloads to pick up the current version (`src/lib/chunk-reload.ts`), holding off
if that was just tried or the connection is down, and trying again until it
works.

The splash and status bar colours, icon and name come from the manifest, which
Chrome builds into the installed app. The manifest is never cached, and Chrome
checks it when the app is opened and updates the installed app on its own —
usually within a day, with no reinstall.

---

## Notes and limitations

- **Google sign-in only.** Better Auth with Google as the one provider; there
  is no password to phish, reset or store.
- **Not transactional.** A change is one write, or a few, not a transaction.
  Those that take several are ordered so the safest failure wins — deleting a
  checklist deletes its tasks before the checklist, and changing a checklist's
  tags or stages rewrites its tasks before the checklist itself — so a failure
  leaves recoverable data, and trying again works out the same difference and
  finishes the job. Every operation is idempotent, so a retry is always safe.
- **Other devices catch up on focus.** A change made on another device shows
  when this window next comes into focus, or after the next change made here.
- **Roles are checked on the server, visibility on every read.** A role changed
  or a person removed takes effect on their very next request, whatever their
  screen still shows.
- **`mongodb` is pinned to v6.** The v7 driver's BSON package calls
  `v8.startupSnapshot.isBuildingSnapshot()` at import time, which Bun does not
  implement, so v7 crashes the dev server on this runtime.
