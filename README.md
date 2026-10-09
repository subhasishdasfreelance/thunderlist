# Thunderlist

A productivity app for one person or a team: **checklists** of tasks that move
through stages, **trackers** for any measurable goal, **tags** that group work
across lists, and views that look across all of it — **Priority**, **Across
lists**, **Groups** — plus **Plans** (Markdown documents) and **Countdowns**.
**Today** is a special tag and the app's home screen. **Inbox** and **Backlog**
are two checklists that every space has.

It is a TanStack Start app (React 19, SSR) with the Astryx design system,
Valibot validation, MongoDB storage and Google sign-in through Better Auth. It
runs on Bun in development and installs as a PWA.

This README is the developer guide. It explains how to run the app, how it
works, and how to change and ship it. Everything here was checked against the
code; where something could not be checked, the text says so.

---

## Table of contents

1. [What the app does](#1-what-the-app-does)
2. [Tech stack](#2-tech-stack)
3. [Getting started](#3-getting-started)
4. [Directory layout](#4-directory-layout)
5. [Architecture](#5-architecture)
6. [Teams, roles and access](#6-teams-roles-and-access)
7. [Domain behaviour](#7-domain-behaviour)
8. [Data model](#8-data-model)
9. [UI, theme and look and feel](#9-ui-theme-and-look-and-feel)
10. [PWA, offline and notifications](#10-pwa-offline-and-notifications)
11. [Conventions](#11-conventions)
12. [Recipes](#12-recipes)
13. [Testing](#13-testing)
14. [Deployment](#14-deployment)
15. [Troubleshooting](#15-troubleshooting)
16. [Notes, limitations and open questions](#16-notes-limitations-and-open-questions)

---

## 1. What the app does

### Features at a glance

| Feature | What it is | Where it lives |
|---|---|---|
| **Today** | A special tag for what you plan to do today. It is also the home screen (`/tags/today`). It is paced against a daily window, 06:00–22:00 by default. You can rename it, but not delete it. | `src/routes/tags.$tagId.tsx`, `SPECIAL_TAGS` in `src/schemas/tag.ts` |
| **Inbox** | The checklist that holds a task written where there is no checklist, such as on Today or a tag's page. Every space has one, and it cannot be deleted. | `ensureInbox` in `src/data/checklist.server.ts` |
| **Backlog** | The checklist for parked work. **B** on a task, or **Move to Backlog**, moves the task here and takes it off Today. Every space has one, and it cannot be deleted. | `ensureBacklog`, `moveToBacklog` in `src/lib/changes.ts` |
| **Checklists** | Tasks with progress, a start date, a deadline (optionally with a time) or a daily window, and 2–12 stages. | `src/routes/checklists.*.tsx` |
| **Stages** | The steps a checklist's tasks go through, "To do" → "Done" by default. The last stage means done. | `src/schemas/checklist.ts` |
| **Tasks** | One line to add. Supports inline `#tags`, `&tracker` / `&checklist` links, `-u`/`-i`/`-ui` flags, a caption, Markdown notes, a type, assignees and dependencies. | `src/schemas/task.ts` |
| **Tags** | Labels that group tasks across checklists. Each can have its own schedule, stage colours and access list. | `src/routes/tags.*.tsx` |
| **Untagged** | Every task without a tag, reached from its card on the Tags screen. | `src/routes/tags.untagged.tsx` |
| **Trackers** | Progress towards a measurable goal (book, course, project, fitness, custom). You enter readings, not increments. A tracker's page has **Add to #today**, which adds a task standing for it to Today. | `src/routes/trackers.*.tsx` |
| **Priority** | Every open task, grouped by urgent and important. | `src/routes/priority.tsx` |
| **Across lists** | Every task across all checklists, grouped by stage name or by task type. It is served by the server a page at a time. | `src/routes/stages.tsx`, `src/data/across.server.ts` |
| **Task types** | Labels for the kind of work, per space: Deliverable, Milestone, Issue, Routine, Meeting, Follow-up and Idea by default. Managed in Settings. | `src/schemas/task-type.ts` |
| **Dependencies** | A task can wait on other tasks, checklists, trackers or tags. It cannot be completed until they are done. | `Task.dependsOn`, `src/lib/depends.ts` |
| **Groups** | Named collections that can mix checklists, trackers and tags. | `src/routes/groups.*.tsx`, `src/schemas/group.ts` |
| **Plans** | Long Markdown documents, written in the app or imported from `.md`. | `src/routes/plans.*.tsx`, `src/schemas/plan.ts` |
| **Countdowns** | A day to count down to, shown in one of four formats. | `src/routes/countdowns.tsx`, `src/schemas/countdown.ts` |
| **Numbers** | Short, human-readable numbers (`T-42`, `C-3`, `TR-7` …) that can be searched for. | `src/schemas/number.ts`, `src/data/numbers.server.ts` |
| **Search** | **Ctrl+K** searches checklists, tasks (titles, captions and notes), trackers, readings, tags, plans, countdowns and groups, including by number (`T-42`). | `src/components/shell/search-dialog.tsx`, `search-results.ts`, `src/data/search.server.ts` |
| **Undo** | **Ctrl+Z** undoes the last 20 task-level actions, after asking "Do you want to undo?". | `src/lib/undo.ts`, `src/components/shell/undo-provider.tsx` |
| **Teams** | Shared spaces with four roles and an access list on each checklist, tracker, tag, plan, countdown and group. | `src/schemas/team.ts`, `src/schemas/access.ts` |
| **Team messages** | Project managers can push a message to a team, a role, everyone who can see a checklist, tag or tracker, or one person. | `sendTeamMessage` in `src/data/reminder.server.ts` |
| **Notification codes** | Secrets that let an outside script send notifications through `POST /api/notify`. | `src/schemas/notification-code.ts` |
| **AI agents** | Everything above can be done by an AI agent: through MCP at `/api/mcp` with an AI access token (Claude Code, Claude Desktop, Cursor…), or through WebMCP in the open tab. One tool catalog serves both (see [AI agents](#104-ai-agents-mcp-and-webmcp)). | `src/schemas/ai-tools.ts`, `src/data/ai-*.server.ts` |
| **Backdrops** | A per-person choice of background design and palette for each section of the app. | `src/schemas/backdrop*.ts`, `src/components/shell/scenery.tsx` |
| **Feedback** | "Send feedback…" in the account menu. It files a task in the maintainer's own account (see [Feedback](#710-feedback)). | `src/data/feedback.server.ts` |
| **PWA** | Installable, with a service worker that caches the hashed bundle and keeps the last copy of Today for offline launches, and home-screen shortcuts to Today, Checklists and Priority. | `public/sw.js`, `public/manifest.webmanifest` |

Every change appears on screen immediately and is saved in the background (see
[The change pipeline](#54-the-change-pipeline-writes)). Each change plays a
short synthesised sound (`src/lib/sounds.ts`).

### Screens and routes

Routes are file-based and live in `src/routes/`. `src/routeTree.gen.ts` is
generated from them; do not edit it.

| Path | File | Notes |
|---|---|---|
| `/` | `index.tsx` | Redirects to `/tags/today`. |
| `/today` | `today.tsx` | Legacy address. Redirects to `/tags/today`. |
| `/backlog` | `backlog.tsx` | Legacy address. Redirects to the Backlog checklist. |
| `/login` | `login.tsx` | The only page available when signed out. Google sign-in. |
| `/checklists` | `checklists.index.tsx` | Checklist cards, which can be ordered by hand. |
| `/checklists/$checklistId` | `checklists.$checklistId.tsx` | Search params: `?task=` (scroll to and highlight a task), `?stage=`, `?page=`, plus the filters `?sort=`, `?who=`, `?tag=`, `?type=`. |
| `/priority` | `priority.tsx` | Open tasks by priority. Takes the filter params (`?sort=`, `?who=`, `?tag=`, `?type=`). |
| `/stages` | `stages.tsx` | The **Across lists** screen. `?by=type`, `?group=`, `?page=`, plus the filter params. |
| `/tags` | `tags.index.tsx` | Tag cards. |
| `/tags/$tagId` | `tags.$tagId.tsx` | A tag's page. Special tags use their kind as the id (`/tags/today`); see `tagParam`. Search params: `?task=`, `?stage=` (a stage name), `?sort=`, `?who=`, `?type=`. |
| `/tags/untagged` | `tags.untagged.tsx` | Tasks that have no tag. |
| `/trackers`, `/trackers/$trackerId` | `trackers.*.tsx` | `/trackers?who=`; `/trackers/$trackerId?entry=` (bring a reading into view) and `?who=`. |
| `/groups`, `/groups/$groupId` | `groups.*.tsx` | |
| `/plans`, `/plans/$planId` | `plans.*.tsx` | |
| `/countdowns` | `countdowns.tsx` | `?countdown=` brings one into view, from search. |
| `/settings` | `settings.tsx` | Account, where you work (spaces and teams), task types, notifications, team messages, notification codes. |
| `/api/auth/$` | `api/auth/$.ts` | Better Auth handler (GET and POST). |
| `/api/notify` | `api/notify.ts` | Public endpoint for notification codes. |
| `/api/mcp` | `api/mcp.ts` | MCP server for AI agents, authenticated by an AI access token. |

The navigation entries and their number-key shortcuts are defined in
`src/components/shell/nav-items.ts`.

### Keyboard shortcuts

The in-app reference opens with **?** (`src/components/shell/help-dialog.tsx`).
Row shortcuts apply to the task under the pointer — checked with `:hover` at
the moment of the keypress — and never fire while you are typing in a field
(`src/lib/use-row-shortcuts.ts`). The keys are defined in
`TASK_SHORTCUTS` in `src/components/tasks/task-actions.tsx`.

| Key | Action |
|---|---|
| `T` | Put the task on Today, or take it off |
| `B` | Move to Backlog |
| `M` | Move to another checklist |
| `U` / `I` | Toggle urgent / important |
| `X` | Tick: move to the next stage, or to done |
| `E` | Edit |
| `K` | Set the task type |
| `#` | Tag it, choosing from a list |
| `Space` | Assign to me, or unassign me (teams only) |
| `D` | Delete |
| `>` / `<` | Next / previous stage tab on a checklist (`src/components/checklists/stage-tabs.tsx`), or next / previous choice in a tag page's stage filter (`stage-filter.tsx`) |
| Drag across rows | Select several tasks (press and hold on a phone) on any task list — a checklist, a tag, Priority, Across lists, Untagged. The bar that appears moves them on, finishes, tags, moves or deletes them. `Esc` clears the selection |
| `↑` / `↓` | Pick the previous / next task on the list, starting from the row under the pointer or the first on screen. `Shift` stretches the pick from where it started (`useTaskSelection` in `src/lib/use-task-selection.ts`) |
| `X` with tasks picked | Each picked task on to its next stage, or done where none has one — the Selection bar's **Next stage** / **Done** (`SelectionBar`). It takes the key ahead of the row under the pointer |
| `1`–`9` | Go to Today, Checklists, Priority, Across lists, Tags, Trackers, Groups, Plans, Countdowns |
| `E` / `D` on a reading | On a tracker reading under the pointer: edit / delete (`progress-history.tsx`) |
| `Ctrl+K` | Search (Cmd+K on a Mac). Works even while typing in a field |
| `Ctrl+Z` | Undo the last task action. On a touch screen, each undoable action shows a toast with an **Undo** button instead |
| `?` | Open the shortcuts and how-to guide (not while typing) |
| `Tab` | In the quick-add field, take the highlighted suggestion |
| `Esc` | Closes one layer at a time: first leaves the text field, then closes the popup, then clears toasts. Every press also lets go of the row under the pointer until the pointer moves (`src/lib/use-escape.ts`) |

### Writing a task

The quick-add field is a `<textarea>`. Each **new line is a separate task**, so
you can paste a list. **Enter** adds everything; **Shift+Enter** starts a new
line. Parsing is in `src/lib/tags/inline-tags.ts`. Typing `#` or `&` opens
suggestions: tags (including new names) for `#`, existing trackers and
checklists for `&`. **Tab** takes the highlighted one. On a phone, a round
**+** floats above the bottom bar once the field has scrolled out of view;
pressing it brings the field back and focuses it (`thunderlist-add-fab`).

| You type | Effect |
|---|---|
| `buy milk #shopping` | Tags the task with `shopping`, creating the tag if it does not exist. The `#name` stays in the title. `#` only starts a tag at the beginning of a word, so `C#` is left alone. Tag names are 1–40 characters. |
| `read 30 pages &Dune` | Links the task to the tracker named "Dune". If no tracker has that name, it tries a checklist with that name (the tracker wins if both match). If neither matches, the task is ordinary. A linked task completes itself and cannot be ticked by hand. |
| `fix login -u` / `-i` / `-ui` | Marks the task urgent / important / both. The suffix is removed from the title. |

A tag written on several pasted lines is created once, because
`createTagResolver` remembers the ids it has already minted. A collaborator
cannot create tags, so an unknown `#name` stays as plain text for them.

---

## 2. Tech stack

| Concern | Choice | What it means day to day |
|---|---|---|
| Framework | **TanStack Start** (`@tanstack/react-start`) on **Vite 8**, served by **Nitro** (`nitro/vite`) | SSR plus server functions (`createServerFn`). There is no separate API server. Config is in `vite.config.ts`. |
| UI runtime | **React 19** | |
| Router | **TanStack Router**, file-based (`src/routes/`) | `src/routeTree.gen.ts` is generated by the Start Vite plugin (or `bun run generate-routes`). Route loaders prime the query cache. |
| Data fetching | **TanStack Query** with `@tanstack/react-router-ssr-query` | Query option factories live in `src/queries/`. The SSR integration sends the server's cache down with the page. |
| Validation | **Valibot** | Every server function input and every `Change` is a Valibot schema in `src/schemas/`, with messages written for users. |
| Design system | **Astryx** (`@astryxdesign/core`, CLI `@astryxdesign/cli`), plus **Tailwind v4** utilities on top of Astryx tokens, and **StyleX** as an Astryx peer | Import components per entry point, e.g. `@astryxdesign/core/Button`. The theme is compiled from `src/theme/thunderlist.theme.ts`. Icons come from `lucide-react`. |
| Forms | `@tanstack/react-form` | Used by one dialog, `task-rename-dialog.tsx`; the others keep their own state. Check an existing dialog before assuming a pattern. |
| Database | **MongoDB**, official driver **pinned to v6** | A single `thunderlist` database. Server-only access through `src/lib/mongo/client.server.ts`. |
| Auth | **Better Auth** with Google as the only provider | `src/lib/auth.ts` (config), `src/lib/auth.server.ts` (`currentUser`, `requireUser`), `src/lib/auth-client.ts` (browser). |
| Push | **web-push** (VAPID) | Team messages, assignments and notification codes. |
| Runtime | **Bun** (package manager, test runner, dev runtime); **Node** for ad-hoc DB scripts | See [Running database scripts](#37-running-database-scripts-use-node). |
| Lint and format | **Biome 2** | Tabs and double quotes. See `biome.json`. |
| Types | **TypeScript 6**, `strict`, `noUnusedLocals`/`Parameters`, `verbatimModuleSyntax` | `bun run typecheck`. |
| Hosting | **Vercel** (`vercel.json` sets the `tanstack-start` framework) | See [Deployment](#14-deployment). |

Several TanStack packages are on the `latest` tag in `package.json`, so a fresh
install can bring in newer versions than `bun.lock` records. Keep the lockfile
committed.

---

## 3. Getting started

### 3.1 Prerequisites

- **Bun** (the lockfile is `bun.lock`; `.cta.json` records `packageManager: bun`).
  This guide was checked with Bun 1.3.14.
- **Node.js**, for ad-hoc database scripts (see [3.7](#37-running-database-scripts-use-node)).
  `@types/node` is on v22; this guide was checked with Node 26.
- A **MongoDB** database, either local or Atlas.
- A **Google OAuth client** (Web application).

### 3.2 A database

Any MongoDB works: a local server, a container, or a free
[Atlas](https://www.mongodb.com/atlas) cluster. On first connect, the app
creates the collections and indexes itself (`ensureIndexes` in
`src/lib/mongo/client.server.ts`). There is no migration step.

On Atlas you need:

1. A **database user** with read/write access. The username and password go in
   the connection string.
2. Your IP address under **Network Access**.

The connection string (Connect → Drivers) looks like
`mongodb+srv://<user>:<password>@<cluster>.mongodb.net/`. If the password
contains any of `: / ? # [ ] @ %`, percent-encode it. The database is always
`thunderlist`; any database named in the string is ignored.

### 3.3 Google sign-in

Create an **OAuth client ID** of type *Web application* in the Google Cloud
console and add this authorised redirect URI (plus your deployed origin's
equivalent):

```
http://localhost:4000/api/auth/callback/google
```

### 3.4 Environment variables

```bash
cp .env.example .env.local   # then fill it in; never commit it (it is gitignored)
```

`.env.example` only lists the first five variables below. Add the push
variables yourself if you need notifications.

| Variable | Required | Purpose | Read in |
|---|---|---|---|
| `MONGO_CONN_STR` | yes | MongoDB connection string. Surrounding quotes are stripped. | `src/lib/mongo/client.server.ts` |
| `BETTER_AUTH_URL` | yes | The exact origin the app is served from, port included (`http://localhost:4000` in dev). Also used as the VAPID subject fallback. | `src/lib/auth.ts` |
| `BETTER_AUTH_SECRET` | yes | A long random string for signing sessions. | `src/lib/auth.ts` |
| `GOOGLE_CLIENT_ID` | yes | From the OAuth client. | `src/lib/auth.ts` |
| `GOOGLE_CLIENT_SECRET` | yes | From the OAuth client. | `src/lib/auth.ts` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | for push | Web-push key pair. Generate one with `bunx web-push generate-vapid-keys`. Without them, Settings reports that notifications are not set up and no push is sent. | `src/data/reminder.server.ts` |
| `VAPID_SUBJECT` | no | A `mailto:` or URL for push services. Falls back to `BETTER_AUTH_URL`, then `mailto:reminders@thunderlist.app`. | `src/data/reminder.server.ts` |

`src/lib/auth.ts` throws on import if any of the four auth variables is
missing. It prints the origin it is configured for:

```
[thunderlist] Sign-in is configured for http://localhost:4000
```

Only `VITE_`-prefixed variables reach the browser bundle, and the app defines
none. Keep every secret unprefixed.

### 3.5 Install and run

```bash
bun install
bun --bun run dev        # http://localhost:4000
```

The `--bun` flag runs Vite and the server under the Bun runtime rather than
Node. The port is fixed at 4000 in `package.json` and must match
`BETTER_AUTH_URL`.

If `MONGO_CONN_STR` is missing or the database cannot be reached,
`getSetupStatusFn` reports it and `SetupNotice` shows it at the top of the app.
Sign-in also needs the database: `src/lib/auth.ts` opens a connection when it
loads, for Better Auth's adapter.

### 3.6 Scripts

All scripts are defined in `package.json`.

| Command | Runs | Notes |
|---|---|---|
| `bun --bun run dev` | `vite dev --port 4000` | `devstart` is an identical alias. |
| `bun --bun run build` | `astryx theme build src/theme/thunderlist.theme.ts && vite build` | Recompiles the theme first. Output goes to `.output/`. |
| `bun --bun run preview` | `vite preview --port 4000` | Serves the production build. The service worker only registers in production builds, so use this to test PWA behaviour. |
| `bun run theme:build` | Compiles the theme to `src/theme/thunderlist.css` and `.js` | Run after editing `thunderlist.theme.ts`. |
| `bun run theme:check` | Fails if the compiled theme is stale | |
| `bun run generate-routes` | `tsr generate` | The Vite plugin normally does this for you. |
| `bun test` | Bun's test runner over `**/*.test.ts` | About 260 tests, runs in well under a second. |
| `bun run typecheck` | `tsc --noEmit` | |
| `bun run check` | `biome check` (lint + format + import order, report only) | Add `--write` via `bunx biome check --write` to fix. |
| `bun run lint` / `bun run format` | `biome lint` / `biome format` | Report only unless you pass `--write`. |

Before pushing, run `bun test`, `bun run typecheck` and `bun run check`. There
is no CI config in the repo and no git hook, so nothing enforces these.

> When this guide was written, `bun test` and `bun run typecheck` passed.
> `bun run check` was not clean: `biome.json` (its `$schema` names 2.2.4
> while the CLI is 2.4.5, plus formatting), `.vscode/settings.json`,
> `.vscode/tasks.json`, `vite.config.ts` (formatting and import order), and
> one `useExhaustiveDependencies` warning in
> `src/components/checklists/task-row.tsx`.

### 3.7 Running database scripts: use Node

There are no DB scripts in the repo. When you need a one-off script to inspect
or fix data, **run it with Node, not Bun**. Loading the `mongodb`/`bson`
driver directly under Bun has been seen to crash or hang. This is the same
Bun/`bson` incompatibility that keeps the driver pinned to v6 (see
[Notes](#16-notes-limitations-and-open-questions)).

```bash
node --env-file=.env.local my-script.cjs
```

Guidelines:

- The database name is `thunderlist`.
- Every app document carries `userId`: a person's id (Better Auth's `user._id`
  as a hex string) or a team id (`team_…`). Always filter on it.
- Never use `_id` as an identity. Use the app ids (`taskId`, `checklistId`, …).
- Do not write to Better Auth's collections (`user`, `session`, `account`).
- Keep scripts outside `src/` (for example, in a scratch folder) so they are
  not bundled.

### 3.8 Verifying your setup

1. `bun test` passes.
2. `bun run typecheck` exits 0.
3. `bun --bun run dev`, then open http://localhost:4000. You should be redirected to `/login`.
4. Sign in with Google. You land on Today, and your Inbox, Backlog and Today tag are created on the first read.

---

## 4. Directory layout

```
.
├─ public/                   Static files served as-is
│  ├─ sw.js                  Service worker (production only)
│  ├─ manifest.webmanifest   PWA manifest (start_url /tags/today)
│  ├─ offline.html           Offline fallback page
│  ├─ icons/, logo.*, fonts/ Icons (incl. the monochrome badge-96.png), logo, wordmark font
├─ src/
│  ├─ routes/                File-based routes (pages + /api/* server routes)
│  ├─ routeTree.gen.ts       GENERATED route tree — do not edit
│  ├─ router.tsx             Router factory: view transitions, preload on intent, SSR-query integration
│  ├─ functions/             Server functions (*.functions.ts) + scope.ts, guard.ts
│  ├─ data/                  Repositories (*.server.ts): all MongoDB access, server only
│  ├─ lib/
│  │  ├─ mongo/client.server.ts  Connection, collection types, indexes (throws if bundled for the browser)
│  │  ├─ auth.ts / auth.server.ts / auth-client.ts  Better Auth config, session helpers, browser client
│  │  ├─ changes.ts          useApplyChange + change builders (the client side of every write)
│  │  ├─ optimistic.ts       Patches every cache for a change before the server answers
│  │  ├─ undo.ts             Works out the inverse of a change (Ctrl+Z)
│  │  ├─ depends.ts          Client-side "is this task blocked?" check
│  │  ├─ ids.ts              Prefixed, time-sortable ids minted in the browser
│  │  ├─ progress.ts, day-pace.ts, chart-points.ts   Pure progress / pace / velocity maths
│  │  ├─ tasks/tasks.ts      Pure task ordering, filtering, paging, progress
│  │  ├─ tags/inline-tags.ts Pure #tag / &tracker / -u -i parsing
│  │  ├─ format-date.ts      The one date format: "8th Oct, 2026"
│  │  ├─ sounds.ts           Synthesised change sounds
│  │  ├─ filter-search.ts    Sort and filters kept in the URL (?sort= ?who= ?tag= ?type=)
│  │  ├─ device-data.ts      Safe localStorage helpers
│  │  ├─ push.ts             Turning this device's notifications on and off
│  │  ├─ toasts.ts, errors.ts   Toasts (with "close all" for Esc); AppError
│  │  ├─ use-task-copy.ts    Copying several tasks copies just their titles and captions
│  │  ├─ theme.ts, first-open.ts, chunk-reload.ts   Inline head scripts and recovery helpers
│  │  └─ use-*.ts            React hooks (permissions, space, pages, pace, shortcuts, selection…)
│  ├─ queries/               TanStack Query option factories; keys.ts holds every key but push-key
│  ├─ schemas/               Valibot schemas + domain types + pure domain rules (shared client/server)
│  ├─ components/            UI built from Astryx, grouped by domain
│  │  ├─ shell/              App frame, nav, search, help, undo provider, notifications, backdrops
│  │  ├─ checklists/, tasks/, tags/, trackers/, teams/, groups/, plans/, countdowns/, common/
│  │  │  (tasks/index-task-list.tsx: the selectable task rows of Priority, Across lists and Untagged)
│  ├─ integrations/tanstack-query/  QueryClient defaults (refetch policy) + devtools panel
│  ├─ theme/                 thunderlist.theme.ts (source) → thunderlist.css/.js/.d.ts (generated)
│  ├─ types/                 Ambient type augmentations (Astryx autoComplete prop)
│  └─ styles.css             Global CSS: layer order, colour tokens, thunderlist-* classes
├─ vite.config.ts            Vite + TanStack devtools + Nitro (cache headers for public files) + Tailwind + Start + React
├─ CLAUDE.md                 Engineering guidelines for AI-assisted work
├─ skills-lock.json          Pinned versions of the agent skills in .claude/skills/
├─ tsconfig.json             Strict TS, `#/*` path alias (an unused `@/*` alias is also declared)
├─ biome.json                Formatter/linter config and the files it covers
├─ vercel.json               Vercel framework preset
├─ tsr.config.json           Router CLI target (react)
├─ .env.example              Environment template (see §3.4 for the full list)
├─ .cta.json                 create-tanstack-app metadata (add-ons: biome, vercel, tanstack-query, better-auth)
├─ .vscode/                  Biome as default formatter, routeTree.gen.ts read-only, git helper tasks
├─ .claude/skills/           Agent skills (astryx-ui, fallow) for AI-assisted work
└─ .fallow/                  Local cache of the fallow code-health tool
```

---

## 5. Architecture

### 5.1 The big picture

```
Browser (React, TanStack Router + Query)
   │   no connection string, no driver, no database access
   │
   │  reads:  route loader → queryOptions (src/queries) → server function (GET)
   │  writes: useApplyChange → applyChangeFn (POST) with one `Change`
   ▼
TanStack Start server functions        src/functions/*.functions.ts
   │   validator(Valibot schema) → guard(label, …) → requireScope()
   ▼
Repositories                           src/data/*.server.ts
   │   every function takes the owner id first and filters on it
   ▼
MongoDB driver (v6)                    src/lib/mongo/client.server.ts
   ▼
One `thunderlist` database (app collections + Better Auth's user/session/account)
```

The browser never sees the connection string or a raw driver response.
`src/lib/mongo/client.server.ts` and `src/lib/auth.ts` both throw at import
time if they end up in a browser bundle, so a layering mistake fails loudly.

### 5.2 Layers

| Path | Responsibility | May import |
|---|---|---|
| `src/schemas/` | Valibot schemas, domain types, roles, access rules, pure domain helpers (`stageOf`, `levelFor`, …) | Other schemas only |
| `src/lib/` (pure) | `tasks/`, `tags/`, `progress.ts`, `format-date.ts`, … with no I/O | schemas |
| `src/lib/mongo/`, `src/lib/auth*.server.ts`, `src/lib/auth.ts` | Server only: connection, collections, indexes, session | schemas, errors |
| `src/data/` | Repositories: the only code that queries MongoDB | lib, schemas |
| `src/functions/` | Server functions: validate, resolve scope, check access, call a repository, sanitise errors | data, schemas |
| `src/queries/` | `queryOptions` factories and `queryKeys` | functions |
| `src/lib/changes.ts`, `optimistic.ts`, `undo.ts`, `depends.ts` | Client write path | functions, queries, schemas |
| `src/components/` | UI. No direct data access beyond queries and `useApplyChange` | everything client-side |
| `src/routes/` | Pages: loaders prime queries, components render | everything client-side |

Imports use the `#/` alias for `src/` (declared in `package.json` `imports` and
`tsconfig.json` `paths`). Some browser code imports *types* from
`src/data/*.server.ts` (for example `SearchIndex` and `AcrossPage`). That is
fine because `verbatimModuleSyntax` erases `import type`. Never import values
from a `.server.ts` file into client code.

### 5.3 The read path

Take opening a checklist as an example:

1. **Route loader** (`src/routes/checklists.$checklistId.tsx`) calls
   `primeQuery(queryClient, checklistQuery(id))` for what the page is *about*,
   and `deferQuery(...)` for secondary data (tags, trackers, the checklist
   list). Both helpers are in `src/queries/prime.ts`.
   - `primeQuery` awaits the read **on the server** (so SSR sends content) but
     **not in the browser**, so navigation is instant and the component shows
     its own loading state. Failures are swallowed; the component reads the
     error from the cache and renders an error state.
2. **Query options** (`src/queries/checklists.ts`) pair a key from
   `src/queries/keys.ts` with a server function call.
3. **Server function** (`src/functions/checklist.functions.ts`):
   ```ts
   export const getChecklistFn = createServerFn()
     .validator(validator(checklistReadInputSchema))
     .handler(({ data }) =>
       guard("getChecklist", async () => {
         const scope = await requireScope();
         assertLevel(scope, "checklists", data.checklistId, "read");
         return getChecklist(scope.ownerId, data.checklistId, scope.hidden, { … });
       }),
     );
   ```
4. **Repository** (`src/data/checklist.server.ts`) queries with
   `{ userId: ownerId, … }`, projects `DOMAIN_FIELDS` (`_id: 0, userId: 0`)
   away, and returns plain domain objects.

Long lists are paged on the server, 20 rows per page (`PAGE_SIZE` in
`src/lib/use-pages.ts`, and `taskPageSchema` in `src/schemas/task.ts`). This
covers a checklist's stage, a tag's open tasks, the Across lists groups, and
the Priority corners (`groupBy: "priority"` in `getAcrossTasks`).
Finished tasks are read only when their section is opened.

**The search index** (`getSearchIndex`) is one read that returns every
checklist, tracker, reading and task visible to the viewer. It powers search
(Ctrl+K, together with the tags, plans, countdowns and groups already in the
cache; see `Sources` in `search-results.ts`), the item picker, the Tags
screen and the Untagged page.

**Client cache policy** (`src/integrations/tanstack-query/root-provider.tsx`):
- Queries refetch every **30 s** while the page is visible, and when the window
  regains focus (both the `focus` and `visibilitychange` events).
- **Neither happens while a mutation is in flight**, because a read sent mid-change
  would come back without the change and make it flicker. Nor does the refetch
  a screen makes when it mounts over cached data (`refetchOnMount`): deleting
  a tag and landing on the Tags screen would otherwise show the tag again
  until the delete saved. Everything is refetched once the last change lands.
- Some queries override this: `sessionQuery` (gcTime ∞, stale after 60 s),
  `spaceQuery` (refetches every 60 s to notice removal from a team),
  `backdropsQuery` / `pushKeyQuery` (never stale), and `arrangementsQuery`
  (seeded from `localStorage` so lists open in their saved order).
- Switching space **resets** every query (`src/lib/use-space-changed.ts`).
- There is no server-side cache.

**Router** (`src/router.tsx`): view transitions on every navigation, preload on
hover/intent (`defaultPreloadStaleTime: 0`), scroll restoration, and
`RouteError` as the default error component.

### 5.4 The change pipeline (writes)

**Every content mutation is a `Change`**: a discriminated union on `kind`,
defined in `src/schemas/change.ts`. Each variant spreads the entries of the
payload schema its repository already accepts, so the command cannot drift
from what the server validates.

Current kinds:

| Entity | Kinds |
|---|---|
| Checklist | `checklist.create`, `checklist.update`, `checklist.delete` |
| Task | `task.create`, `task.update`, `task.delete`, `task.deleteMany`, `task.move` |
| Tracker | `tracker.create`, `tracker.update`, `tracker.delete` |
| Reading | `entry.create`, `entry.update`, `entry.delete` |
| Tag | `tag.create`, `tag.update`, `tag.delete` |
| Space settings | `taskTypes.set`, `arrangement.set` |
| Group | `group.create`, `group.update`, `group.delete` |
| Plan | `plan.create`, `plan.update`, `plan.delete` |
| Countdown | `countdown.create`, `countdown.update`, `countdown.delete` |

There is **one write endpoint** for all of them: `applyChangeFn` in
`src/functions/change.functions.ts`.

Account and team plumbing is **not** a `Change`. It uses its own POST server
functions: team management (`team.functions.ts`), push subscriptions and team
messages (`reminder.functions.ts`), notification codes
(`notification-code.functions.ts`), feedback (`feedback.functions.ts`) and
backdrops (`preferences.functions.ts`).

**Client side** (`src/lib/changes.ts`, `useApplyChange()`):

```
apply(change)
 ├─ refusal(change)           offline → "You're offline…" toast; else whyBlocked(change),
 │                            a tick on a task still waiting on something (src/lib/depends.ts)
 ├─ playChangeSound(change)
 └─ mutation.mutate(change)
     onMutate:
       cancelQueries()                  so an in-flight read cannot overwrite the patch
       snapshot(queryClient)            full copy of the cache for rollback
       remember(change)                 undo step, computed from the cache BEFORE the patch
       applyOptimistically(client, change)
     mutationFn = send(change):
       - changes to the same task are serialised (sendingTasks)
       - a change naming a checklist still being created waits for it (creatingChecklists)
       - applyChangeFn({ data: { change } })
     retry: only while navigator.onLine is false, so a dropped connection retries when it returns
     onError: restore(snapshot), then re-apply later pending changes over it; forget the undo
              step; reset caches of a never-saved checklist/tracker; toast the message
     onSettled: if this was the last pending mutation → invalidateQueries() (everything)
```

Use `apply` for fire-and-forget calls. Use `applyAsync` when the next step
needs the server to have the change first; `createChecklist` and
`createTracker` resolve once the item is written, so the UI can navigate into
it. The builders (`createTask`, `setTag`, `setSpecialTag`, `moveToBacklog`,
`createTagResolver`, …) mint ids with `createId` and decide the shape of each
change in one place.

**Server side** (`src/data/change.server.ts`, `applyChange(scope, change)`):

1. `assertAllowed(scope, change)`. In your own space everything is allowed. In
   a team, three things are checked:
   - **Role capability** (`capabilityFor`): `task.update`, `entry.create` and
     `entry.update` need `updateTasks`. Every other kind needs `manageContent`.
   - **Named people** must be team members (assignees and access-list emails;
     see `namedPeople`).
   - **Access level** on the thing touched (`assertLevel` / `assertTaskAllowed`),
     e.g. `full` to update or delete a checklist, `edit` to update a task or
     record a reading.
2. `assertReachesAdded`: tagging a task, or making it wait on something,
   needs read access to that thing; `task.create` checks each tag too.
3. `keepingHiddenTags`: an edit's tag list keeps the tags the editor cannot
   see, so emptying a task's tags cannot uncover it to the whole team.
4. `includingActor(scope, change)`. When a change sets an access list, the
   person making it is added at `full`, so nobody locks themselves out.
5. `run(ownerId, change, actor)`. A `switch` that dispatches to the repository
   function. After it, `sendAssigned` notifies anyone the change newly
   assigned (teams only); a failure there is logged, not thrown.
6. Errors: an `AppError` passes through with its user-facing message. Anything
   else is logged and replaced with "Something went wrong while saving."

**Guarantees:**

- **Ids are minted in the browser** (`src/lib/ids.ts`), so a change can be drawn
  and referenced before the server has it, and a replay is the same change.
- **Every operation is idempotent.** Creating something that already exists
  returns it; deleting something already gone does nothing.
- **Not transactional.** Multi-write operations are ordered so the safest
  failure wins. For example, deleting a checklist deletes its tasks first, and
  changing a checklist's tags or stages rewrites its tasks before the checklist
  itself. A retry finishes the job.
- The owner (`scope.ownerId`) comes from the session, never from the request.
  A change naming someone else's id is therefore a no-op, not an edit.

### 5.5 Optimistic updates (`src/lib/optimistic.ts`)

`applyOptimistically(client, change)` patches **every cache that shows the
change**: checklist summaries and pages, stage counts, tag pages and summaries,
the search index, Across pages, tracker summaries and histories, plans,
countdowns, groups, task types and arrangements. Rules:

- **Every change is patched**, including ones made from dialogs. This is a
  project principle: nothing waits for a round trip to appear.
- **Counts are shifted, not recounted**, because a page holds one page of
  tasks, not the whole list (`shift`, `moveStage`).
- **What the browser cannot know is not guessed** (for example, the title of a
  checklist it has never read). It arrives with the refetch.
- A wrong guess is visible for one round trip at most: it is replaced by the
  refetch, or rolled back from the snapshot on error.
- `findCachedTask` finds a task in any cache. `undo.ts` and `depends.ts` both
  use it.

The `switch` in `patchFor` has a `default` branch, so **the compiler will not
tell you** when a new change kind is missing. Add the case yourself (see
[Recipes](#121-add-a-new-change-kind)).

Tests: `src/lib/optimistic.test.ts` and `src/lib/optimistic-spread.test.ts`
seed a `QueryClient` with `setQueryData`, call `applyOptimistically`, and
assert on the caches.

### 5.6 Undo (`src/lib/undo.ts`)

A `Change` carries only what to do, not what was there before. So
`invertChange(client, change)` works out the undo **from the cache before the
change is applied**; `useApplyChange` calls `remember(change)` in `onMutate`.
`UndoProvider` (`src/components/shell/undo-provider.tsx`) keeps a stack of up
to **20** steps and applies the top one on **Ctrl+Z** (but not while you are
typing in a field).

| Change | Undo | Asks first? |
|---|---|---|
| `task.update` | `task.update` with the previous values of the patched fields. Stage and completion are restored via `stageId`. | no |
| `task.move` | Move back to the previous checklist, then a `task.update` restoring its stage, `completedAt`, `addedAt` and tags, which the move reset | no |
| `task.create` | `task.delete` | yes |
| `task.delete` | `task.create` with the same id and number, plus a `task.update` for the caption, notes, assignees, type, dependencies and stage; tasks that waited on it wait on it again (`putBack`) | yes |
| `task.deleteMany` | Recreate only the tasks this browser has cached | yes |
| anything else | not undoable (it was done in a dialog) | — |

The undo itself is applied from outside the provider's `remember`, so it is
not recorded. Pressing Ctrl+Z twice goes back two steps.

### 5.7 Query keys (`src/queries/keys.ts`)

Keys are hierarchical, so invalidating a prefix covers every page beneath it:

```
["checklists"]                                   list
["checklists", id]                               one checklist (figures)
["checklists", id, "filtered", filter]           figures under a filter
["checklists", id, "pages", view]                one page of one stage
["checklists", id, "completed"]                  finished tasks
["tags"], ["tags", id], ["tags", id, "open", view], ["tags", id, "completed"], ["tags", id, "filtered", filter]
["tag-summaries"]
["trackers"], ["trackers", id], ["trackers", id, "entries"]
["across"], ["across", view]
["search-index"], ["space"], ["teams"], ["task-types"], ["arrangements"], ["groups"],
["plans"], ["plans", id], ["countdowns"], ["notification-codes"],
["backdrops"], ["session"], ["setup-status"], ["push-key"]
```

After a change settles, everything is invalidated rather than a chosen few
keys. Working out exactly what each change touches would mean keeping a second
copy of the data model in step.

### 5.8 Errors

- `AppError(code, message)` (`src/lib/errors.ts`) has the codes
  `not_configured`, `unauthorized`, `not_found`, `invalid_data` and
  `upstream_failed`. **Its message must be safe to show a user.**
- `guard(label, fn)` (`src/functions/guard.ts`) wraps every server function
  that touches data. It logs `[thunderlist] label: …` and passes an `AppError`
  message through. Any other error becomes a generic message, so driver
  errors, stack traces and the connection string never leave the server.
- `validator(schema)` (`src/schemas/validate.ts`) throws the first Valibot
  issue's message, e.g. "Title is required".
- Mongo connection failures are translated into specific messages (bad
  string, wrong credentials, unreachable host) by `describeConnectFailure`.
- On the client, `errorMessage(error)` gives a displayable string; failed
  changes appear as toasts.

### 5.9 Auth and the root gate

- `src/routes/__root.tsx` `beforeLoad` is **the only screen guard**. It checks
  `sessionQuery` (cached, re-validated after 60 s), redirects signed-out users
  to `/login` and signed-in users away from it, primes backdrops, and reads
  the colour-scheme cookie.
- Data protection is **separate and per request**. Every data server function
  calls `requireUser()` (usually via `requireScope()`), which reads the session
  from Better Auth's cookie. No user id is ever read from the request body,
  the URL or a header the browser controls.
- `getSessionFn` is deliberately unguarded. For an anonymous visitor it
  returns `null`.

### 5.10 Scope: which space a request works in (`src/functions/scope.ts`)

`requireScope()` returns a `Scope` (`src/data/team.server.ts`):

```ts
type Scope = {
  ownerId: string;   // the person's own user id, or the team id
  email: string;     // lower-cased
  team: { teamId; role; emails } | null;
  hidden: Hidden;    // ids of checklists/tags/trackers this person cannot see (+ the Inbox id)
  levels: Levels;    // per-id access level, or null when nothing narrows them
};
```

The team comes from the `thunderlist-space` cookie (httpOnly, one year). That
cookie is **only a request**: membership is checked on every call, and a
cookie naming a team you are not in falls back to your own space.
`requireScope` also runs `ensureNumbered` once per space per server process
(see [Numbers](#78-numbers)).

---

## 6. Teams, roles and access

Everyone has a personal space. A **team** is another space, stored exactly like
anyone's but owned by the team id (`team_…`) instead of a user id, so nothing
from one space can be read from another. Settings lists your teams (name, your
role, member count) and switches between them. The admin adds people by the
Google address they sign in with, even before they have used the app.

### 6.1 Roles (`src/schemas/team.ts`)

|  | Admin | Project manager | Collaborator | Viewer |
|---|:-:|:-:|:-:|:-:|
| See everything, whatever its access list says | ✓ | | | ✓ |
| See what is shared with them | ✓ | ✓ | ✓ | ✓ |
| Tick tasks, move them through stages, edit, flag, assign; record tracker readings (`updateTasks`) | ✓ | ✓ | ✓ | |
| Add and delete tasks, move them between checklists; create, change and delete checklists, trackers, tags, task types, groups, plans, countdowns; set access lists (`manageContent`) | ✓ | ✓ | | |
| Add and remove people, change roles, delete the team (`manageTeam`) | ✓ | | | |

- There is exactly **one admin**, whoever made the team. Making someone else
  admin hands the team over, and the old admin becomes a project manager
  (`setMemberRole`).
- A stored role of `"member"`, from before roles were split, is read as
  project manager (`storedRole`).
- The UI only *hides* what a role cannot do (`usePermissions`,
  `useItemPermissions` in `src/lib/use-team.ts`). **The server is the
  protection.** A role change takes effect on the person's next request.
- Notification codes and team messages in a team need `manageContent`.

### 6.2 Access lists (`src/schemas/access.ts`)

Each checklist, tracker and tag has `access`: either `null` (everyone in the
team, at their role's ceiling) or a list of `{ email, level }`.

| Level | Meaning |
|---|---|
| `read` | Sees it and everything in it. |
| `edit` | Works its tasks (tick, stage, edit, flag, assign); records readings. |
| `full` | Also adds, deletes and moves tasks, and changes or deletes the thing itself, including its access list. |

**The effective level is the lower of the list's level and the role's
ceiling** (`levelFor`, `roleCeiling`). The ceilings are: admin and manager →
`full`, collaborator → `edit`, viewer → `read`. The admin and viewers see
everything regardless of lists.

Rules to remember:

- **Adding someone to a team gives them nothing.** A new checklist, tracker or
  tag starts with only its author on the list (the server adds the actor; see
  `includingActor`). Tags created inline (`#name`) are the exception: they
  start as `null`, meaning everyone.
- **Special items are everyone's.** The Inbox, Backlog and Today are always
  visible at the role ceiling.
- **Tasks inherit from where they live.** A task in a checklist follows the
  checklist's access. A task in the Inbox follows its tags: it is visible if
  any of its tags is, or if it has no tags. For write checks, the best level
  among its tags applies (`isTaskVisible`, `assertTaskAllowed`).
- **Hidden means nonexistent.** Hidden items are left out of every list, count
  and search. Naming one by id gets "no longer exists", not "forbidden"
  (`src/data/visibility.server.ts`).
- **Legacy `visibleTo`.** Older documents carry `visibleTo: string[]`. It is
  read as those people at `full` (then capped by role), which is what they
  could already do (`accessFromVisibleTo`). It is dropped the next time that
  document's list is saved.

### 6.3 Working together

- A task can be assigned to several people. **Space** toggles yourself on the
  task under the pointer, and **Assign people…** picks anyone.
- Checklist, Priority and Across lists pages filter by person, tag and type;
  a tag's page by person, type and stage; trackers by person. On checklist and
  tag pages everything on the screen follows the filter — progress, speed
  figures, chart, stage counts and the list — except the tag page's stage
  filter, which narrows only the list. The server computes the filtered
  figures (`checklistFilteredQuery`, `tagForQuery`). The sort and filters are
  kept in the address (`?sort=`, `?who=`, `?tag=`, `?type=`; see
  `filterSearch`), so a reload, Back or a shared link shows the same rows.
- The admin can delete a team, which deletes everything in its space,
  including its notification codes, and then its members
  (`deleteTeam`).
- Tracker readings record `recordedBy`, which the server sets from the
  session.

---

## 7. Domain behaviour

### 7.1 Stages

- A checklist has 2–12 uniquely named stages (`stagesSchema`). Without its own
  `stages` it uses `DEFAULT_STAGES` (`todo` "To do" → `done` "Done").
- **The last stage is done.** Ticking moves a task to the next stage, so it is
  done once ticked at the stage before the last. Unticking a finished task
  moves it back to the stage before done. **Stage** in a task's menu sends it
  to any stage.
- Stage ids survive renames. A task whose `stageId` is missing or removed is
  at the first stage while open, and the last once done (`stageOf`). The
  server keeps `completed` in step with the stage, and progress counts
  `completed`.
- Removing a stage moves its tasks to the nearest earlier stage that remains.
- A task linked to a tracker or checklist never passes the stage before done
  by hand (`nextStageId`).
- Stage colours default by position counting back from done (`stageColor`).
  A tag can override colours per stage name (`Tag.stageColors`).
- **Across lists** groups tasks by stage *name* across checklists
  (`stagesByName`), or by type (`tasksByType`).

### 7.2 Today, Inbox and Backlog

- **Today** is a tag with `special: "today"`. It is created on the first read
  of a space's tags, and a partial unique index on `(userId, special)`
  resolves races. Its page is `/tags/today`. The bolt / **T** writes `#today`
  at the end of a title, and removing it deletes the `#name` wherever it was
  written (`setSpecialTag`). It starts with a 06:00–22:00 daily window.
  Clearing completed tasks on Today removes the tag rather than deleting the
  tasks. **Clear #today** takes it off every task on it; every tag page has the
  same button (§7.3).
- **Inbox** (`special: "inbox"`). `task.create` with `checklistId: null` goes
  into the Inbox (`createTask` in `checklist.server.ts`). On first sight of a
  space, `ensureInbox` moves any legacy task that has no checklist into it.
- **Backlog** (`special: "backlog"`). **B** / **Move to Backlog** sends a
  `task.update` (removing Today) and a `task.move`. The move waits for the
  update to land (`moveToBacklog`). Moving work is a project manager's action.
  Any move into the Backlog adds "Added from <checklist>" to the end of the task's
  notes, and any move out adds "Moved from backlog", each led by when; the
  caption is never touched (`notesAfterMove` in `src/lib/tasks/tasks.ts`,
  applied by `moveTask` and drawn by `patchFor`). Each line goes on the next
  line with no blank line between, joined with a Markdown hard break (two
  spaces, then a newline), since notes are Markdown and a bare newline would
  run the lines together in Preview.
  The Backlog used to be a special tag; `ensureBacklog` migrates such tasks
  into the checklist and deletes the old tag.
- Special checklists and tags are identified by `special`, never by title,
  because users can rename them. `specialChecklist()` and `specialTag()` find
  them in a list.

### 7.3 Tags

- Tasks reference tags **by id** (`tagIds`) and also write them into the
  title **by name**. The `#name` is markup that stays in the title.
- **Renaming** a tag rewrites `#old` to `#new` in the titles of the tasks
  carrying it (`renameInTitles`). **Deleting** a tag strips its id from every
  task, checklist and tracker (`deleteTag`), and from dependency lists.
- A checklist's `tagIds` are copied onto every task in it, including tasks
  added later. They are removed again when the checklist drops the tag, or
  when a task leaves the checklist, unless the task's title still says
  `#name`: that tag was typed, not inherited (`untypedTags`).
- A tag can have a start date, a deadline (with time), a daily window, a
  description, an access list and per-stage colours. Every field is optional,
  because tags are usually born mid-sentence.
- Autocomplete on `#` offers existing tags, and also offers new names, which
  become real tags.
- Every tag's page (`src/routes/tags.$tagId.tsx`) has the same filters —
  person, type, stage and order — and, for anyone who can update tasks, a
  **Clear #name** button that takes the tag off every task on it, open and
  done, after asking. Each task stays in its checklist; the tag is untagged
  the way the tag picker (or Today's bolt) would, so title and `tagIds` move
  together (`clearTag`, `setTag`). It ignores the filters, as Today's always
  did, and leaves trackers alone.

### 7.4 Task types

A per-space list stored in `settings.taskTypes` and edited in Settings (or from
the type picker's **Manage types**). With no settings document, a space has
`DEFAULT_TASK_TYPES`: Deliverable, Milestone, Issue, Routine, Meeting,
Follow-up and Idea. Their ids (`feature`, `story`, `bug`, `chore`, …) are
fixed so untouched spaces need no write. A space can have up to 30 types, and
names must be unique. Removing a type removes it from every task. Lists can be
filtered and sorted by type; untyped tasks come last.

### 7.5 Linked tasks and dependencies

- `trackerId` / `linkedChecklistId`: a task that **stands for** a tracker or
  another checklist. Its completion is **computed on every read**
  (`withTrackedCompletion`) and cannot be set by hand. The server refuses a
  link that would put a checklist inside itself.
- `dependsOn: ItemRef[]` (task, checklist, tracker or tag; up to 50): the task
  cannot be completed until each dependency is done. A task is done when
  ticked; a checklist or tag when it has tasks and all of them are done; a
  tracker when it reaches its target. The client refuses early
  (`whyBlocked`), and the server checks again in `updateTask`. Deleting a
  dependency removes it from waiting tasks (`clearDependencies`).
- Deleting a tracker or checklist turns the tasks linked to it into ordinary
  tasks, done if it was finished (`releaseFollowers`).

### 7.6 Ordering and paging

- The sort orders are `newest` (the default, by `addedAt` with ties broken by
  `taskId`), `priority`, `stage` and `type` (`SORT_ORDERS`). There is **no
  stored position**.
- Lists of cards (checklists, trackers, tags) can be ordered by hand. That
  order is stored per space as `settings.arrangements` and written in one
  `arrangement.set`. Ids that no longer exist are ignored when drawing and
  kept when writing. Which order a viewer sees (the space's own order, newest,
  or most behind) is remembered only while the app is open. It is not saved
  anywhere, because someone else in the team may want to look at the list
  another way.
- A task moved to another stage, or to another checklist, goes to the top:
  its `addedAt` is re-stamped. A move to another checklist also starts it at
  the first stage.
- Pages have 20 rows. A `?task=` link opens on the page and stage holding
  that task, and highlights it (`reveal` in `taskPageSchema`,
  `useFocusTask`).

### 7.7 Trackers, pace and velocity

- **You enter the reading, not the increment.** After reading to page 78, you
  type 78. `delta` is **never stored**: it is derived on read from the
  previous reading (`withDeltas`), so back-dating re-spaces the neighbours
  automatically.
- `currentValue` is denormalised onto the tracker (the latest reading by
  `recordedAt`, then `entryId`) and recomputed whenever a reading changes
  (`deriveCurrentValue`). The tracker list is therefore one query.
- `startValue` is where the count stood on day one. Progress, pace and charts
  measure from there. With no readings yet, changing `startValue` moves
  `currentValue` with it.
- Types are `book`, `course`, `project`, `fitness` and `custom`, each with a
  default unit. Books and courses cannot overshoot their target
  (`allowsOvershoot`).
- **Pace** (`paceStatus` in `src/lib/progress.ts`) compares the fraction done
  with the fraction of time elapsed. The result is `ahead`, `on_track` or
  `behind`, with a **tolerance of one percentage point** (`PACE_TOLERANCE =
  0.01`). There is no status without a deadline or a daily window. Pace is
  computed **in the browser**, on the viewer's clock (`useNow`, `usePace`),
  because the server does not know the viewer's time zone.
- A daily window is measured in hours against today's window
  (`src/lib/day-pace.ts`).
- **Velocity** (`computeVelocity`, type in `src/schemas/progress.ts`) gives
  the current speed, the expected speed, the speed needed from now, and a
  projected finish date. It covers checklists and trackers alike. Any figure
  the data cannot support is `null` and is not shown.

### 7.8 Numbers

Every checklist, task, tracker, tag, reading, plan, countdown and group gets a
per-space sequential number (`T-42`, `C-3`, `TR-7`, `TG-2`, `E-15`, `P-4`,
`CD-2`, `G-1`; see `NUMBER_PREFIXES`). The server hands them out at creation
with an atomic `$inc` on `counters` (`nextNumber`). Something drawn
optimistically therefore has no number until its save lands. `ensureNumbered`
backfills unnumbered documents once per space per server process. Search
accepts `T-42`, `t42`, `tr 7`, `#42` or a bare `42` (`parseNumberQuery`).
An undone delete puts the task back under its old number, if no other task
has taken it.

### 7.9 Groups, plans and countdowns

- **Groups** are stored in `settings.groups`. Each has a name, a colour, and
  items (`{ kind: checklist|tracker|tag, id }`, up to 500). Deleting a group
  never deletes its items. Items you cannot see are kept when the group is
  written. The first read migrates older per-list groups (`listGroups`).
- **Plans** are one document each, with a body of up to 2,000,000 characters
  of Markdown, rendered with Astryx's `Markdown`. The list reads everything
  except the body. An imported file's title comes from its first `# Heading`
  or its file name (`planTitleFrom`).
- **Countdowns** have a title, a date, a colour and a format: `seconds`,
  `calendar`, `weeks` or `days` (`countdownParts`).

Groups, plans and countdowns carry an access list too, as checklists, trackers
and tags do: a new one starts with its maker alone on it, and one made before
had none, so it stays the whole team's. A group's list covers the group
itself, not what it holds; each of those keeps its own.

### 7.10 Feedback

"Send feedback…" (`sendFeedbackFn`) creates a task in a checklist with id
`chk_feedback_<ownerId>`, titled `thunderlist-feedback`, in the account of the
hard-coded `RECIPIENT` address in `src/data/feedback.server.ts`. If that
account has never signed in, sending fails with a friendly error. Change
`RECIPIENT` if you fork the app. The dialog also credits the author, with a
link to their LinkedIn profile (`AUTHOR_LINKEDIN` in
`src/components/shell/feedback-dialog.tsx`), which opens in a new tab.

---

## 8. Data model

One database, `thunderlist`. Collection types are declared in
`src/lib/mongo/client.server.ts`, and domain types in `src/schemas/`.

### 8.1 Collections

| Collection | One document per | Owner field | Notes |
|---|---|---|---|
| `checklists` | checklist | `userId` | `special`: `"inbox"` / `"backlog"` / absent |
| `tasks` | task | `userId` | linked by `checklistId` |
| `trackers` | tracker | `userId` | `currentValue` denormalised |
| `entries` | tracker reading | `userId` | linked by `trackerId`; no stored `delta` |
| `tags` | tag | `userId` | `special`: `"today"` / absent |
| `settings` | space | `userId` | `taskTypes`, `arrangements`, `groups`; absent until something changes |
| `plans` | plan | `userId` | Markdown `body` |
| `countdowns` | countdown | `userId` | |
| `counters` | (space, kind) | `userId` | `last` number handed out |
| `pushSubscriptions` | device | `email` | web-push endpoint + keys |
| `notificationCodes` | code | `userId` + `createdBy` | secret `ntf_…` |
| `aiTokens` | AI access token | `userId` (always a person) | only the SHA-256 `tokenHash` of `tla_…`; `teamId` is the space it works in |
| `preferences` | **person** (account, not space) | `userId` | `backdrops` per section |
| `teams` | team | — | `teamId`, `name`, `createdAt` |
| `members` | (team, person) | — | `teamId`, lower-cased `email`, `role`, `addedAt` |
| `taskRefs` | legacy list entry | `userId` | old Today/Backlog lists; migrated and emptied on first read (`moveListsIntoTags`) |
| `user`, `session`, `account` | — | — | **Better Auth's own**. The app only reads `user` (for names, pictures, and the hex `_id` that is a person's `userId`). |

Every app document (except teams, members and push subscriptions, which are
keyed differently) carries `userId`, and **every query filters on
it**. `userId` is a person's own id or a team's id, and it always comes from
the server-side scope. Reads project `_id` and `userId` away
(`DOMAIN_FIELDS`). Nothing is nested: a task is its own document so that
edits, moves and searches are single targeted writes.

### 8.2 Key fields

| Entity | Fields |
|---|---|
| Checklist | `checklistId`, `number`, `title`, `description`, `startDate`, `deadline`, `deadlineTime`, `dailyWindow`, `tagIds`, `access`, `stages`, `special`, `createdAt`, `updatedAt` (legacy `visibleTo`) |
| Task | `taskId`, `number`, `checklistId`, `title`, `completed`, `completedAt` (set by the server, except when an undo sends back the old value), `addedAt`, `tagIds`, `trackerId`, `linkedChecklistId`, `urgent`, `important`, `caption`, `notes` (Markdown), `assignees`, `stageId`, `typeId`, `dependsOn`. There is no `updatedAt` and no position. |
| Tracker | `trackerId`, `number`, `title`, `caption`, `type`, `description`, `unit`, `targetValue`, `startValue`, `currentValue`, `coverUrl`, `author`, `startDate`, `deadline`, `deadlineTime`, `tagIds`, `assignees`, `access`, `createdAt`, `updatedAt` |
| Entry | `entryId`, `number`, `trackerId`, `recordedAt` (`YYYY-MM-DD`), `value`, `note`, `recordedBy`, `updatedAt` |
| Tag | `tagId`, `number`, `name`, `color`, `special`, `description`, `startDate`, `deadline`, `deadlineTime`, `dailyWindow`, `access`, `stageColors`, `createdAt`, `updatedAt` |
| Settings | `userId`, `taskTypes`, `arrangements` (`{ checklists?, trackers?, tags? }` → `{ order: id[] }`), `groups`, `updatedAt` |
| Group | `groupId`, `number`, `name`, `color`, `items`, `createdAt`, `updatedAt` |
| Plan | `planId`, `number`, `title`, `body`, `createdAt`, `updatedAt` |
| Countdown | `countdownId`, `number`, `title`, `date`, `color`, `format`, `createdAt`, `updatedAt` |
| Push subscription | `endpoint`, `email`, `keys { p256dh, auth }`, `createdAt` |
| Notification code | `code`, `label`, `to` (`device` \| `people` \| `team`), `createdBy`, `teamId`, `createdAt`, `lastUsedAt` |

Dates are stored as `YYYY-MM-DD` strings and times as `HH:MM` on the viewer's
own clock. Timestamps are ISO strings.

### 8.3 Ids (`src/lib/ids.ts`)

`createId(prefix)` returns `<prefix>_<Date.now() base36><6 random base36
chars>`. The ids are unique, roughly time-sortable, and **minted in the
browser**. `idSchema` accepts 1–64 characters of `[A-Za-z0-9_-]`.

| Prefix | Entity | Prefix | Entity |
|---|---|---|---|
| `chk_` | checklist | `stg_` | stage |
| `tsk_` | task | `typ_` | task type |
| `trk_` | tracker | `grp_` | group |
| `ent_` | tracker reading | `pln_` | plan |
| `tag_` | tag | `cdn_` | countdown |
| `team_` | team (**minted on the server**) | `chg_` | queued change (browser only, never stored) |

Notification codes are `ntf_` + 32 random characters (`createNotificationCode`).
They are secrets, not ids. Default stage ids (`todo`, `done`) and default task
type ids (`feature`, `bug`, …) are fixed strings.

### 8.4 Indexes

Indexes are created on first connect and are idempotent. Each app-minted id
has a globally unique index; every other index leads with `userId`.

| Collection | Indexes |
|---|---|
| `checklists` | `checklistId` unique; `userId`; `userId, special` unique where `special` is a string |
| `tasks` | `taskId` unique; `userId, checklistId` |
| `trackers` | `trackerId` unique; `userId` |
| `entries` | `entryId` unique; `userId, trackerId, recordedAt` |
| `tags` | `tagId` unique; `userId`; `userId, special` unique where set |
| `settings` | `userId` unique |
| `plans` | `planId` unique; `userId, updatedAt` |
| `countdowns` | `countdownId` unique; `userId, date` |
| `preferences` | `userId` unique |
| `counters` | `userId, kind` unique |
| `pushSubscriptions` | `endpoint` unique; `email` |
| `notificationCodes` | `code` unique; `userId, createdBy` |
| `aiTokens` | `tokenHash` unique; `tokenId` unique; `userId` |
| `teams` | `teamId` unique |
| `members` | `teamId, email` unique; `email` |
| `taskRefs` | `itemId` unique; `userId, taskId`; `userId, list, sortOrder` |

### 8.5 Lazy migrations

There is no migration runner. Old data is upgraded when it is first read or
written:

| What | Where |
|---|---|
| Tasks with no checklist → Inbox | `ensureInbox` |
| Old Backlog tag → Backlog checklist | `ensureBacklog` |
| `taskRefs` (old Today/Backlog lists) → `#today` tag, then deleted | `moveListsIntoTags` in `tag.server.ts` |
| `visibleTo` → `access` | `withAccess`, `accessFromVisibleTo` |
| Role `"member"` → `manager` | `storedRole` |
| Per-list groups → `settings.groups` | `listGroups` |
| Missing `number` fields | `ensureNumbered` |
| Retired colour names | drawn as the nearest pickable colour (`pickableColor`, CSS) |

Several of these (`ensureInbox`, `ensureBacklog`, `ensureNumbered`) cache
"already done" in memory per server process.

---

## 9. UI, theme and look and feel

- **Astryx** components come from per-component entry points
  (`@astryxdesign/core/Card`, `…/Stack`, `…/DropdownMenu`, `…/Markdown`,
  `…/Toast`, …). The repo ships an `astryx-ui` agent skill in
  `.claude/skills/`. The Astryx CLI (`bunx astryx …`) is a dev dependency.
- **Tailwind v4** utilities sit on top of Astryx tokens. `src/styles.css`
  declares the CSS layer order (`reset, theme, base, astryx-base,
  astryx-theme, components, utilities`), so a utility class can override a
  component default. App-specific classes are named `thunderlist-*`.
- **Theme**: `src/theme/thunderlist.theme.ts` is the source. Astryx generates
  the palette from seeds; only the four accent tokens are set by hand. It is
  compiled by `bun run theme:build` into `thunderlist.css` / `.js` / `.d.ts`,
  which are generated and must not be edited. They are imported by
  `styles.css`, so the server's first paint already has the right colours.
  `bun run build` recompiles the theme; `bun run theme:check` detects a stale
  build.
- **Light, dark or system** is chosen from the bar and stored per browser in
  `localStorage` (`thunderlist.theme.v1`) and a cookie (`thunderlist-theme`).
  The server reads the cookie to render the right scheme, and an inline head
  script (`THEME_INIT_SCRIPT`) sets it before the first paint.
  `vite.config.ts` sets `build.cssTarget` to browsers with native
  `light-dark()` support. Without that, the minifier would polyfill it and
  break the toggle.
- **Colours** for tags, stages and types: `TAG_COLORS` has 16 names, and
  `PICKABLE_COLORS` offers 8 (red, orange, yellow, green, teal, blue, purple,
  pink), plus gray for "no colour". The other names are accepted for old data
  and drawn as the nearest pickable colour. Each colour is a single hex in
  `--thunderlist-color-*` (`styles.css`), the same in both schemes and at
  least 3:1 against the card and page. Chips use a 20% wash with a label of
  at least 4.5:1. The bar track is `--thunderlist-track`. Six extra colour
  names are added to Astryx's `Token` via module augmentation in
  `src/schemas/tag.ts`.
- **Backdrops**: each section (Today, Checklists, …) draws a background of
  Matisse-style paper cut-outs (`src/schemas/backdrop-designs.ts`, `BackdropArt`, `Scenery`).
  They are drawn in code, with no image files. Each person picks a design and
  palette per section; the choice is stored in `preferences`. Moving to a
  section drawn differently cross-fades the two drawings over
  `--duration-slow` and eases the wash colour across (a registered
  `--deco-1`). The fade is on each shape's opacity through `--deco-fade`,
  not on the drawing as a whole, so shapes keep blending into the wash
  throughout. The app animates the same with or without a reduced-motion
  setting.
- **Touch targets**: on a coarse pointer the buttons on a task row are drawn
  at their mouse size (so a lit flag or pressed button is the same small
  square), with an invisible 44px pressable area around each, spaced so no
  two overlap (`.thunderlist-row-buttons` in `styles.css`). The checkbox's
  hit area grows the same way.
- **Phone layout**: at 768px and below, a bottom bar replaces the side nav:
  Today, Checklists, Priority, Tags and **More** (Across lists, Trackers,
  Groups, Plans, Countdowns; `isInMore` in `nav-items.ts`). The shortcuts
  button is hidden on touch screens (`thunderlist-keyboard-only`), and the
  page's background choice moves into the account menu.
- **Copying tasks**: when a text selection runs across several task titles,
  the clipboard gets just their titles and captions, one blank line apart
  (`src/lib/use-task-copy.ts`).
- **Dates** are shown one way everywhere: `8th Oct, 2026`
  (`src/lib/format-date.ts`). The formatting is English and not
  locale-driven, so server and client output match.
- **Sounds** are synthesised per change kind (`soundFor` in `src/lib/sounds.ts`).
  A kind without its own sound gets a soft tap.
- **Translucent bars** blur what is beneath them. Browsers without
  `backdrop-filter`, and users who ask for reduced transparency or more
  contrast, get an opaque surface.
- **No autofill**: every text field opts out of browser and password-manager
  suggestions (`src/lib/use-no-autofill.ts`, `src/types/astryx-autofill.d.ts`).

Project UI preferences to follow:

- Keep pages uncluttered. Summary lists belong on pages; details and editing
  belong in popups. Put a setting next to what it applies to (user, space or
  item).
- Everything is optimistic, dialogs included.
- Leave no dead UI: no dialogs that nothing opens, no empty menus, no inert
  buttons.
- Third-party illustrations and images must be CC0.

---

## 10. PWA, offline and notifications

### 10.1 Installing and the service worker

Open the app on a phone and choose **Add to Home Screen** (Safari) or
**Install app** (Chrome). The manifest (`public/manifest.webmanifest`) starts
at `/tags/today`. Nitro serves it with `cache-control: no-cache`, so Chrome
picks up changes to it by itself. Other public files are cached for a day
with stale-while-revalidate (`vite.config.ts`).

`public/sw.js` is **registered only in production builds** (in
`src/routes/__root.tsx`):

1. `/assets/*` (hashed files) is served cache-first (`thunderlist-assets-v1`,
   trimmed to 200 entries).
2. Pages come from the network, with navigation preload.
3. The last copy of `/tags/today` and what it loads is kept
   (`thunderlist-pages-v1`), so the app can launch instantly and offline.
   `/tags/today` (with no query string) opens from that copy at once and is
   refreshed behind it. A copy is used only while every `/assets/` file it
   loads is still cached, and nothing is kept from a redirect or an error, so
   a signed-out launch never shows the last account's list. It is cleared on
   sign-out (`user-menu.tsx`) and on a space switch.
4. A page that cannot be fetched and has no kept copy shows
   `public/offline.html` (`thunderlist-fallback-v1`). **Bump `FALLBACK`** in
   `sw.js` when that page changes, or installed copies keep the old one.
5. A push is shown as a notification with `icon-192` and the monochrome
   `badge-96.png`, plus an image if a notification code sends one. Tapping it
   focuses an open app window and navigates there; an outside link opens a
   new window.

Server functions, auth and cross-origin requests bypass the worker. When a new
worker takes over during a visit, the page reloads.

**Stale chunks after a deploy**: if a page left open asks for code the server
no longer has, `src/lib/chunk-reload.ts` shows the loading screen and reloads.
It holds off if a reload was just tried or the connection is down, and keeps
retrying.

**Offline**: `useIsOnline()` shows `OfflineBanner` above the page, which stays
on screen as it was, half-typed text included. New changes are refused with a
toast until the connection is back (`useApplyChange`). Changes that fail because
the connection dropped are retried when it returns. A spinner in the top bar
shows while a save is in flight (`save-indicator.tsx`), and leaving the page
then asks first (`beforeunload` in `__root.tsx`).

`src/lib/first-open.ts` rearranges history on a fresh open so that **Back** from
Today goes to Checklists instead of leaving the app.

### 10.2 Team messages

A project manager or admin can push a message (title up to 60 characters,
body up to 300) to the whole team, everyone with a given role, everyone who
can see a checklist, tag or tracker ("Message its people…" in its menu), or one
person (`teamMessageInputSchema`,
`MessageDialog`). The push service holds it for up to four weeks for offline
devices (`MESSAGE_TTL`).

**Assignments**: when someone in a team is added to a task's assignees, they
get a push ("Priya gave you a task") that opens the task. The person who did
the assigning is not notified, and neither is anyone the task is hidden from
(`sendAssigned`, called from `applyChange`).

### 10.3 Notification codes and `/api/notify`

A notification code lets anything that can make an HTTP request notify people
without signing in. Codes are created in Settings → Notification codes.

| Kind | Notifies | Who can make it |
|---|---|---|
| `device` | The browser it was made on | Anyone in their own space; a team's project managers and admin |
| `people` | Every enabled device of each person picked | In your own space, you; in a team, its project managers and admin, for anyone in it |
| `team` | Everyone in the team when the code is used | A team's project managers and admin |

A team's code stops working once its maker is no longer a project manager or
admin there. Codes are secrets: if one leaks, delete it and make a new one.

```js
await fetch("https://your-app/api/notify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    code: "ntf_…",                       // required
    title: "Deploy finished",            // required, up to 100 characters
    body: "main is live in production.", // optional, up to 500
    image: "https://example.com/a.png",  // optional
    url: "/tags/today",                  // optional: an app path or any http(s) link
  }),
});
```

Responses: `200 { people, devices }`; or `{ error }` with status 400 (bad
input), 403 (the team code's maker can no longer message the team), 404 (no
such code), 503 (push keys missing), 502 or 500 (send failure). CORS allows
any origin. **There is no rate limit.**

### 10.4 AI agents: MCP and WebMCP

Every feature can be driven by an AI agent. There is **one tool catalog**,
`AI_TOOLS` in `src/schemas/ai-tools.ts` (55 tools: reading, tasks, checklists,
tags, trackers and readings, groups, plans, countdowns, task types, ordering,
sharing, backdrops, spaces, teams, team messages, notification codes and
feedback), served two ways:

| | MCP (`/api/mcp`) | WebMCP (in the tab) |
|---|---|---|
| For | An assistant outside the browser: Claude Code, Claude Desktop, Cursor, VS Code | An agent in the browser that supports WebMCP (`document.modelContext`; `navigator.modelContext` in Chrome before 150) |
| Who it acts as | Whoever made the AI access token sent as `Authorization: Bearer tla_…` | Whoever the tab is signed in as |
| Space | The token's `teamId`; `switch_space` changes it for later calls | The `thunderlist-space` cookie, as Settings sets it |
| Changes are made | On the server, by `applyAiChanges` → `applyChange` | In the tab, by `useApplyChange`: drawn at once, undoable with Ctrl+Z |
| Extra tool | — | `open_page`, to navigate the tab |

How a call runs (`runAiTool` in `src/data/ai-tools.server.ts`):

1. The input is checked against the tool's Valibot schema. Things are named
   by id, number (`T-42`) or exact name (`src/data/ai-lookup.server.ts`); a
   name several things share is refused with their numbers.
2. Reads and account operations (`ai-reads.server.ts`, `ai-account.server.ts`)
   run there, through the same repositories and checks as the screens.
3. Content tools (`ai-writes.server.ts`) **write nothing**: they return the
   `Change`s that do the job, built the way `src/lib/changes.ts` builds them
   (ids minted, `#tags` written into titles, new tags made first, many tasks
   as one `task.batch`). Each is validated against the `Change` schema, then
   made by the caller, so roles, access lists and the app's rules apply
   exactly as for a screen.

The tab gets its tool list from `listAiToolsFn` and calls `runAiToolFn`
(`src/lib/use-webmcp.ts`, mounted by `AppFrame`); nothing is requested in a
browser without WebMCP. The MCP route is stateless (a server per request,
JSON responses), so it runs wherever the app does.

**AI access tokens** are made in Settings → AI assistants, which shows the
`claude mcp add` command and a JSON config. A token is minted in the browser
(`createAiTokenSecret`), shown once, and stored only as a SHA-256 hash; it
works in the space it was made in. Deleting it stops it at once. Every use
updates `lastUsedAt`. **There is no rate limit**, and claude.ai web
connectors (which need OAuth) are not supported.

To add a tool: add it to `AI_TOOLS`, then a handler under the same name in
one of the three `ai-*.server.ts` files. `AiHandlers` makes the compiler
insist on both.

---

## 11. Conventions

### 11.1 Code style

- **Biome** formats and lints `src/**`, `.vscode/**` and `vite.config.ts`. It
  excludes `routeTree.gen.ts`, `styles.css` and the generated theme files. The
  style is tab indentation and double quotes, with imports organised by
  Biome. VS Code is set up to format with Biome and organise imports on save
  (`.vscode/settings.json`).
- **TypeScript** is strict and flags unused locals and parameters. Use
  `import type` for types (`verbatimModuleSyntax`). Use the `#/` alias for
  anything under `src/`.
- Prefer `ReadonlyArray` in signatures and `Array<T>` over `T[]`. Keep small
  pure functions in `src/lib` or `src/schemas`, and I/O in `src/data`.

### 11.2 Naming

| Thing | Convention | Example |
|---|---|---|
| Server-only module | `*.server.ts` | `src/data/tag.server.ts` |
| Server functions | `*.functions.ts`, exports end in `Fn` | `getTagFn`, `applyChangeFn` |
| Query factories | `<thing>Query` in `src/queries/<area>.ts` | `checklistPageQuery` |
| Input schemas | `<verb><Thing>InputSchema` | `updateTaskInputSchema` |
| Change kinds | `"<entity>.<verb>"` | `"task.move"`, `"taskTypes.set"` |
| Components | kebab-case files, PascalCase exports, grouped by domain | `components/tags/tag-card.tsx` → `TagCard` |
| Hooks | `src/lib/use-*.ts` | `use-task-selection.ts` |
| Routes | TanStack flat file names | `checklists.$checklistId.tsx`, `tags.index.tsx` |
| CSS classes | `thunderlist-*` in `styles.css` | `.thunderlist-row` |
| Browser storage keys | `thunderlist.<name>.v<N>` | `thunderlist.arrangements.v1` |
| Logs | `[thunderlist] <label>: …` | |
| Booleans | `is…` / `can…` / `has…` | `isConfigured`, `canManageContent` |

### 11.3 Comments

The codebase comments generously, and the comments explain **why**, in plain
prose: the reason for a decision and what would break otherwise. Exported
functions and types carry a JSDoc block. Comments cross-reference other code
with `` see `symbolName` ``. When you change behaviour, update the nearby
comment. When a comment names a symbol, keep that symbol's name stable, or
update every reference to it.

### 11.4 Server rules

- **The owner id is always the first argument** of every `src/data` function,
  and it appears in **every** filter, reads and writes alike.
- Read the owner id only from `requireScope()` or `requireUser()`, never from
  input.
- Check access in the server function (`assertLevel`) or in
  `change.server.ts` (`assertAllowed`), and filter reads with `scope.hidden`.
- Throw `AppError` with a user-safe message. Wrap every data-touching server
  function in `guard`.
- Make writes idempotent. Order multi-write operations so a partial failure
  leaves recoverable data.
- Project `_id` and `userId` away (`DOMAIN_FIELDS`). Never use `_id` as an
  identity.
- Use `createServerFn()` for reads and `createServerFn({ method: "POST" })`
  for writes. Validate with `.validator(validator(schema))`.

### 11.5 Schemas

- Every user-facing validation message is written for people ("Title is
  required"), because `validator` shows it verbatim.
- Patch schemas use `v.optional` fields plus a
  `v.check(patch => Object.keys(patch).length > 0, "Nothing to update")`.
- Reuse the building blocks in `src/schemas/common.ts`: `idSchema`,
  `titleSchema`, `emailSchema` (lower-cases), `dateOnlySchema`,
  `timeOfDaySchema`, `dailyWindowSchema`, `tagIdsSchema`, `assigneesSchema`
  and `itemRefSchema`.
- A domain type is derived with `v.InferOutput<typeof schema>` where a schema
  exists.

---

## 12. Recipes

### 12.1 Add a new change kind

Nothing forces all of these steps at compile time, so work through the list.

1. **Payload schema** in `src/schemas/<entity>.ts`, e.g.
   `archiveChecklistInputSchema = v.object({ checklistId: idSchema })`.
2. **Register the kind** in `src/schemas/change.ts`:
   `v.object({ kind: v.literal("checklist.archive"), ...archiveChecklistInputSchema.entries })`.
3. **Repository function** in `src/data/<entity>.server.ts`. It takes
   `userId` first, filters on it everywhere, and is idempotent.
4. **Dispatch** it in `run()` in `src/data/change.server.ts`.
5. **Authorise** it in `change.server.ts`:
   - `capabilityFor`: add it next to `task.update` if it only *updates
     existing work*. Otherwise the default `manageContent` applies.
   - `assertAllowed`: add a case with `assertLevel(...)` or `assertTaskAllowed(...)`.
   - `namedPeople` if it carries emails; `includingActor` if it sets `access`.
6. **Client builder** in `src/lib/changes.ts` if it needs a minted id, or if
   screens should say *what* the user did rather than build a payload. If it
   touches tasks or needs a checklist to exist first, update `tasksOf` /
   `checklistNeeded`.
7. **Optimistic patch**: a `case` in `patchFor` in `src/lib/optimistic.ts`
   covering every cache that shows the change.
8. **Undo**, if it is a task-level action: a case in `invertChange`
   (`src/lib/undo.ts`).
9. **Sound**, if it deserves its own: `soundFor` in `src/lib/sounds.ts`.
10. **Tests**: add cases to `src/lib/optimistic.test.ts` (and to the schema
    test, if the rules are non-trivial).
11. Verify with `bun test`, `bun run typecheck`, `bun run check`, and try it
    in the running app, both in your own space and in a team with a
    collaborator.

### 12.2 Add a read (server function + query)

1. Repository function in `src/data/*.server.ts` (`ownerId`, …, `hidden`).
2. Server function in `src/functions/<area>.functions.ts`:
   ```ts
   export const getThingFn = createServerFn()
     .validator(validator(thingIdInputSchema))
     .handler(({ data }) =>
       guard("getThing", async () => {
         const scope = await requireScope();
         assertLevel(scope, "checklists", data.checklistId, "read"); // if access-listed
         return getThing(scope.ownerId, data.thingId, scope.hidden);
       }),
     );
   ```
3. A key in `src/queries/keys.ts`, nested under the parent key so broad
   invalidation reaches it.
4. A `queryOptions` factory in `src/queries/<area>.ts`. Add `retry: false`
   where "not found" is a real answer rather than a hiccup.
5. If any change affects it, patch its cache in `optimistic.ts`.

### 12.3 Add a route

1. Create `src/routes/<name>.tsx` with
   `export const Route = createFileRoute("/<path>")({ loader, component })`.
   The dev server regenerates `src/routeTree.gen.ts`; commit the regenerated
   file.
2. In the loader, `primeQuery` what the page is about and `deferQuery` the
   rest. Parse search params with `validateSearch` (see
   `checklists.$checklistId.tsx`).
3. It is protected automatically by the root gate. Data access is protected
   by its server functions.
4. For a primary destination, add it to `NAV_ITEMS` in
   `src/components/shell/nav-items.ts` (label, short label, icon, digit key,
   `isInMore`). Consider a backdrop section in `src/schemas/backdrop.ts`.
5. For a legacy address, use a `beforeLoad` redirect, as `today.tsx` and
   `backlog.tsx` do.

### 12.4 Add a field to an entity

1. Add it to the domain schema, as `v.optional(...)` so old documents stay
   valid, and to the create and patch input schemas.
2. Write it in the repository create and update functions, and read it back
   (check the projections; many reads project only specific fields).
3. Update `optimistic.ts` (and `undo.ts` `previousPatch` / `restOfTask` for a
   task field).
4. If it is searchable, add it to `SearchIndex`.

### 12.5 Add a new entity / collection

1. Schema and type in `src/schemas/<entity>.ts`.
2. A `<Entity>Doc` type, a `collectionsOf` entry, and indexes in
   `ensureIndexes` (`src/lib/mongo/client.server.ts`). Use a unique index on
   its id, plus indexes leading with `userId`.
3. An id prefix in `ID_PREFIX` (`src/lib/ids.ts`). If it is numbered, add it
   to `NUMBER_PREFIXES` (`src/schemas/number.ts`) and to `collectionFor` in
   `numbers.server.ts`, and call `nextNumber` on create.
4. Change kinds (12.1), reads (12.2), and a route (12.3).
5. If a team must be able to narrow access to it, that is a larger change:
   `Hidden`, `Levels`, `readAccess` and `assertLevel` only know checklists,
   tags and trackers.

### 12.6 Change the theme or colours

- Brand and accent: edit `src/theme/thunderlist.theme.ts`, run
  `bun run theme:build`, and commit the generated files.
- Tag, stage and type colours: `--thunderlist-color-*` in `src/styles.css`,
  and `TAG_COLORS` / `PICKABLE_COLORS` in `src/schemas/tag.ts`. Keep the
  contrast rules in §9.

---

## 13. Testing

- **Runner**: `bun test`, using `import { describe, expect, it } from "bun:test"`.
  Tests are colocated as `*.test.ts` next to the code (17 files at the time of
  writing). The `#/` alias resolves through `package.json` `imports`.
- **What is covered**: pure logic, namely task ordering and paging
  (`tasks.test.ts`), progress, pace and velocity (`progress.test.ts`), date
  formatting, inline tag parsing, dependencies, access levels, visibility
  (`visibility.server.test.ts`, which tests pure helpers only), schemas
  (arrangement, countdown, notification code, number), search
  result ranking, undo (`undo.test.ts`), where tasks land when a checklist's
  stages change (`checklist.test.ts`), and optimistic cache patching (the
  largest suite).
- **Pattern for optimistic tests**: create a `new QueryClient()`, seed the
  relevant keys with `setQueryData` using `queryKeys`, call
  `applyOptimistically(client, change)`, and assert with `getQueryData`.
- **No database in tests.** Do not import `#/lib/auth` or anything that calls
  `collections()` at module load. `src/lib/auth.ts` opens a Mongo connection
  when it is imported. If you need to exercise `src/data` against a real
  database, use a throwaway MongoDB (for example `mongodb-memory-server`)
  from a Node script outside `src/`, never your `.env.local` database. Per
  §3.7, run it under Node.
- **UI checks**: there is no browser test suite. For signed-out pages and PWA
  behaviour, run `bun --bun run build && bun --bun run preview` and check
  in a browser. Signed-in screens need a real Google sign-in, so they are
  checked by hand.

---

## 14. Deployment

The repo targets **Vercel** (`vercel.json`: `"framework": "tanstack-start"`).

1. Push the repo to GitHub, GitLab or Bitbucket, and in Vercel choose **Add New → Project** and import it.
2. Under **Settings → Environment Variables**, add `MONGO_CONN_STR`,
   `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the deployed origin),
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Add `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY` and optionally `VAPID_SUBJECT` for notifications.
3. Add `https://<your-domain>/api/auth/callback/google` to the Google OAuth
   client's redirect URIs.
4. On Atlas, allow Vercel's egress under **Network Access**.
5. Deploy. The build command is the `build` script, which compiles the theme
   and then runs `vite build`.

Nitro chooses its output preset from the build environment; the repo does not
pin one. A local build writes the preset it used to `.output/nitro.json`. When
this guide was written, it was `node-server`. Serve a build with the runtime
it was built for (see [Troubleshooting](#15-troubleshooting)).

After a deploy, open tabs recover by themselves (chunk reload), and installed
PWAs pick up the new service worker and reload.

---

## 15. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `403 Invalid callbackURL` or a Google `redirect_uri_mismatch` | The app is not served from the exact `BETTER_AUTH_URL` origin (port included), or the redirect URI is missing from the OAuth client. The server logs the configured origin on start. Keep port 4000 free. |
| `X is not set. Sign-in cannot work without it` at start | A required auth variable is missing from `.env.local`. Restart the server after editing env files. |
| Banner: "Thunderlist is not connected to a database yet" | `MONGO_CONN_STR` is empty. |
| "MONGO_CONN_STR is not a valid MongoDB connection string" | Malformed string. Check for unencoded special characters in the password. |
| "The database rejected those credentials" | Wrong Atlas user or password (codes 18/8000). |
| "Could not reach the database" | Host is wrong, or your IP is not in Atlas **Network Access**. |
| Dev server or script crashes in `bson` mentioning `v8.startupSnapshot` | You are running the MongoDB driver under a Bun-incompatible path: the driver was upgraded to v7, or a standalone script ran under Bun. Keep `mongodb` on `^6` and run scripts with Node (§3.7). |
| Preview returns 500 with `ERR_INVALID_ARG_VALUE … 'source.type' … 'direct'` | The build was made for the Bun preset but is being served by Node, or the reverse. Build and preview with the same runtime (`bun --bun run build` then `bun --bun run preview`) and check `.output/nitro.json`. |
| `bun run check` fails on files you didn't touch | The tree was not fully Biome-clean when this guide was written (§3.6). Fix only your own files, or run `bunx biome check --write <files>`. |
| `npx biome` does nothing | `npx biome` can resolve to an unrelated npm package. Use `bun run check`, `bunx biome`, or `./node_modules/.bin/biome`. |
| Service worker, push or offline not working locally | The worker only registers in production builds, so use `preview`. Push also needs VAPID keys and, on iOS, a home-screen install. |
| Theme looks wrong after editing `thunderlist.theme.ts` | Run `bun run theme:build`. `bun run theme:check` tells you whether it is stale. |
| A change "undoes itself" or flickers | Something refetched mid-mutation, or the optimistic patch misses a cache. Check `patchFor` and that refetches are gated on `isMutating()`. |
| Route file added but not found | The dev server was not running to regenerate `routeTree.gen.ts`. Run `bun run generate-routes`. |
| Feedback fails with "can't be received just now" | The `RECIPIENT` account in `feedback.server.ts` has never signed in to this database. |

---

## 16. Notes, limitations and open questions

- **Google sign-in only.** Better Auth with Google as the only provider, so
  there are no passwords.
- **Not transactional.** See §5.4. Operations are idempotent and ordered so a
  retry completes them.
- **Other devices catch up** within about 30 s while visible, on focus, or
  after your next change. There is no push-based sync.
- **Roles are checked on every server call**, and visibility on every read. A
  person removed from a team loses access on their next request.
- **`mongodb` is pinned to v6.** The v7 driver's BSON package calls
  `v8.startupSnapshot.isBuildingSnapshot()` at import time, which Bun does not
  implement, so v7 crashes the dev server on Bun.
- **`/api/notify` has no rate limit**, and it allows any origin; its secret is
  the only protection.
- **In-memory "already done" caches** (`ensureInbox`, `ensureBacklog`,
  `ensureNumbered`) are per server process. They are safe to repeat, and races
  are settled by unique indexes.
- **Several TanStack packages use `latest`** in `package.json`.

Things this guide could not fully verify:

- **The live Vercel setup** (project settings, env vars). The repo only has
  `vercel.json` with the framework preset.
- **Which Nitro preset Vercel builds use.** It is auto-detected, not pinned.
- **Signed-in UI flows.** These were read from code, not exercised in a
  browser.
- **Contrast figures** in §9 are quoted from comments in `styles.css`, not
  re-measured.
