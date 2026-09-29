# VRM Account MIS

A team dashboard to track daily account openings (client-code activations) per
Relationship Manager (VRM), with a **Google Sheet as the database**.

The app is split into two pieces so it can be **hosted on Git (GitHub Pages)**:

```
┌────────────────────────┐        fetch (JSON)        ┌───────────────────────────┐
│  Static frontend        │  ───────────────────────▶ │  Google Apps Script        │
│  index.html             │                            │  Web App = JSON API        │
│  (GitHub Pages / any    │  ◀─────────────────────── │  (backend/Code.gs)         │
│   static host)          │        { vrms, entries }   │        │                   │
└────────────────────────┘                            └────────┼───────────────────┘
                                                                ▼
                                                        ┌───────────────┐
                                                        │ Google Sheet   │  ← the database
                                                        │ VRMs · Entries │
                                                        └───────────────┘
```

- **Frontend** — `index.html`: a single self-contained file (HTML + CSS + JS, SheetJS from
  CDN for import/export). No build step. Deployable to GitHub Pages, Netlify, S3, anywhere.
- **Backend** — `backend/Code.gs`: a Google Apps Script Web App exposing a small JSON API.
  The Google Sheet it's bound to is the database. Tabs + seed data are created automatically.

---

## Repository layout

| Path                     | What it is                                                     |
|--------------------------|---------------------------------------------------------------|
| `index.html`             | The whole frontend (served as a static file).                 |
| `backend/Code.gs`        | Apps Script JSON API (`doGet`/`doPost` + all data operations). |
| `backend/appsscript.json`| Apps Script manifest (timezone + web-app access).             |
| `sample-import.csv`      | Example import layout (`VRM, Date, Client Code`).             |
| `README.md`              | This file.                                                    |

---

## Part 1 — Deploy the backend (Google Apps Script + Sheet)  ~5 min

1. **Create the Sheet.** Go to [sheets.google.com](https://sheets.google.com) → **Blank**
   spreadsheet → rename it **VRM Account MIS**. (No tabs/headers needed — created on first run.)
2. **Open Apps Script.** In the Sheet: **Extensions → Apps Script**.
3. **Paste the code.** Replace the default `Code.gs` contents with all of
   [`backend/Code.gs`](backend/Code.gs). Save (`Ctrl+S`).
4. **Set the manifest.** ⚙ **Project Settings** → tick *Show `appsscript.json` in editor* →
   back in the editor, replace `appsscript.json` with [`backend/appsscript.json`](backend/appsscript.json). Save.
5. **Deploy.** **Deploy → New deployment** → type **Web app**:
   - **Execute as:** *Me*
   - **Who has access:** ***Anyone*** (required — the static site calls it without a Google
     login). See *Security* below to lock it down.
   - **Deploy** → **Authorize access** → choose your account → *Advanced* →
     *Go to VRM Account MIS (unsafe)* → **Allow**.
6. **Copy the Web app URL** ending in **`/exec`**. This is your API endpoint.
7. **Test it:** open `<your-/exec-URL>?action=getData` in a browser — you should see JSON with
   the seven seeded VRMs.

## Part 2 — Host the frontend on GitHub Pages

1. **Create a repo** on GitHub (e.g. `vrm-account-mis`) and push this folder (see
   *Push to GitHub* below).
2. **Wire the backend URL** — two options:
   - **Recommended (team-wide):** open `index.html`, set
     `const API_URL_HARDCODED = "https://script.google.com/macros/s/…/exec";` near the top of
     the `<script>`, commit & push. Everyone then uses it with zero setup.
   - **Per-browser:** leave it blank — on first open the app shows a *Connect your data
     backend* screen; paste the `/exec` URL once and it's saved in that browser.
3. **Enable Pages:** repo **Settings → Pages → Build and deployment → Source: Deploy from a
   branch → Branch: `main` / `(root)` → Save.** After a minute your site is live at
   `https://<user>.github.io/<repo>/`.
4. Open the Pages URL — the sidebar shows **● Synced to Google Sheets** when connected.

### Push to GitHub (from this folder)
The repo is already initialised and committed locally. Add your remote and push:

```bash
git remote add origin https://github.com/<your-username>/vrm-account-mis.git
git branch -M main
git push -u origin main
```

---

## Using the dashboard
- **Signing in** — the app is gated by a full-screen **Sign in** screen (brand panel on the left,
  form on the right; it collapses to the form alone on narrow screens). You pick a tab —
  **Team member** or **Admin** — and enter the matching password:
  - *Team member* also asks **which VRM you are**, chosen from the live dropdown of names in the
    Sheet (no free typing, so the log can never carry a misspelt name). The form remembers your
    last selection in that browser.
  - *Admin* needs no name — just the admin password.

  The screen validates before and after the call: missing name, missing password, wrong password,
  server unreachable, and **using the wrong tab for the password you hold** each get their own
  inline message. Extras: a **show/hide** eye on the password box, a **Caps Lock is on** warning,
  a spinner + disabled form while signing in, and a theme toggle so you can switch light/dark
  before you're even in. **Keep me signed in** (on by default) stores the password in
  `localStorage`; unticked, it uses `sessionStorage` instead, so closing the tab signs you out.
  Your name is attached to every change in the activity log. A **Log out** button sits in the
  sidebar footer and clears both stores. (See *Login & password* below.)
- **Dashboard** — KPI cards (today / month / year / active VRMs), a **monthly trend chart**
  (year + VRM filter), the **MIS – VRM wise summary** table ranked by month, a period + VRM +
  **date-range** filter with Excel/CSV export, an **All data** export, and per-VRM cards.
- **Analysis & Input** — add / **rename** / remove VRMs; record accounts by pasting one or many
  client codes (comma / newline separated); **import** Excel/CSV (with **template** downloads);
  a **client-code lookup** that shows which VRM already owns a code; and a searchable entries
  table.
- **Theme** — **light mode is the default** for everyone (the fabric.vc-style off-white look),
  regardless of the viewer's OS setting. The sun/moon toggle in the top bar switches to dark,
  and each person's explicit choice is remembered in their own browser. Clearing a browser's
  saved choice (or a first-time visitor) returns to the light default. A live **connection
  indicator** sits in the sidebar footer.

### Import formats (see `sample-import.csv`)
- **Structured**: columns for **VRM**, **Date**, **Client Code** (headers matched loosely).
  Dates accept `dd/mm/yyyy`, `yyyy-mm-dd`, or Excel serials. Unknown VRMs are created.
- **Plain list**: a single column of codes → assigned to the VRM & date selected in the form.

### AliasKey — automatic name normalization
Uploaded files often carry messy or variant VRM names. On import, each row's VRM name is
resolved through the **`Aliases`** tab in the Google Sheet:

| Column A — Alias (as uploaded) | Column B — Canonical VRM name |
|--------------------------------|-------------------------------|
| `parth sharma vijay`           | Parth Vijay Sharma            |
| `aakanksha baranwal bhanupratap` | Baranwal Aakanksha Bhanupratap |
| …                              | …                             |

Matching ignores case and extra spaces. If a row matches an alias, it's filed under the
canonical name; otherwise the name is used as-is (creating the VRM if new).
**To add or change mappings, just edit rows in the `Aliases` tab — no redeploy needed.**

---

## The JSON API (reference)
Base URL = your Apps Script `/exec` URL.

Every call is a `POST` with a plain-text JSON body (no `Content-Type: application/json`, so the
browser skips the CORS preflight — Apps Script has no `OPTIONS` handler). **Every call except
`login` must include the password** as `"pw"`, or it returns `{ "error":"Unauthorized" }`.

| Call | Body |
|------|------|
| `login` | `{ "action":"login", "pw":"…" }` → `{ "ok":true/false }` |
| `getData` | `{ "action":"getData", "pw":"…" }` |
| `addVRM` | `{ "action":"addVRM", "name":"…", "pw":"…" }` |
| `renameVRM` | `{ "action":"renameVRM", "oldName":"…", "newName":"…", "pw":"…" }` |
| `deleteVRM` | `{ "action":"deleteVRM", "name":"…", "pw":"…" }` |
| `addEntries` | `{ "action":"addEntries", "vrm":"…", "date":"yyyy-mm-dd", "codes":["…"], "pw":"…" }` |
| `deleteEntry` | `{ "action":"deleteEntry", "id":"…", "pw":"…" }` |
| `importRows` | `{ "action":"importRows", "rows":[{ "vrm":"…","date":"…","clientCode":"…" }], "pw":"…" }` |
| `getLogs` | `{ "action":"getLogs", "limit":300, "pw":"…" }` |

Writes also carry `"by"` (name) and `"ip"` for the audit log. Every write is guarded by a
`LockService` lock, and client codes are globally unique (case-insensitive).

## Login & password
Access is gated by **two shared passwords — one per role**. The API rejects any request that
doesn't carry a valid password (verified **server-side**, so neither is ever exposed in the
static site).

| Role | Signs in as | Can do |
|------|-------------|--------|
| **Admin** | the “Admin” tab, no name needed | everything: add / rename / remove VRMs, delete entries, read the activity log |
| **Team member** | the “Team member” tab + their own VRM from the dropdown | record and import accounts **against their own VRM only**; read the dashboard |

The server decides the role purely from the password (`roleOf_`), so the tab you pick is only a
UI hint — picking Admin with the member password is refused, and vice-versa. Admin-only actions
are blocked server-side too, not just hidden in the UI.

- **Both passwords are defined once**, in `backend/Code.gs`:
  ```js
  const ADMIN_PASSWORD  = '…admin password…';
  const MEMBER_PASSWORD = '…team password…';
  ```
  They are **not stored in this public repository** — share them privately (chat, password
  manager). Do not commit the literal passwords to this README or any public file.
- **To change one:** edit it in `Code.gs` → **Deploy → Manage deployments → ✏ Edit →
  New version → Deploy** (never *New deployment* — that mints a new `/exec` URL). Everyone on
  that role re-enters the new password at next sign-in.
- **How it travels:** sent in the request **body over HTTPS**, never in the URL. It's kept in
  `localStorage` when *Keep me signed in* is ticked, otherwise in `sessionStorage` for that tab
  only; **Log out** clears both.

> This is a shared-password role gate, not per-user accounts — appropriate for an internal team
> tool. For verified individual identity you'd switch to a Google-login-restricted deployment.

## Notes
- Import / export / templates use SheetJS from a CDN → those need internet. Core data flow
  only needs your Apps Script URL.
- After editing `backend/Code.gs`, redeploy via **Deploy → Manage deployments → ✏ Edit →
  New version → Deploy** (the `/exec` URL stays the same).
- The UI follows a **fabric.vc-inspired** look: off-white (#f5f7fa) paper with faint editorial
  gridlines, a single warm-orange accent (#F37021), Inter Tight body text, and an extended bold
  display face (Archivo) for the wordmark, headings, and KPI numbers. Light is the default;
  dark is an opt-in toggle, remembered per browser.
