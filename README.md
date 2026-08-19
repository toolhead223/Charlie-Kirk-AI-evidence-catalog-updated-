# Charlie Kirk Case — Evidence & Claims Explorer

A local, browser-based tool that maps out the public record around the September 10, 2025 assassination of Charlie Kirk at Utah Valley University and the prosecution of Tyler James Robinson (*State of Utah v. Tyler James Robinson*, Case No. 251403576, Fourth Judicial District Court, Provo, Utah) — alongside an honest tracker for the claims circulating about it online.

It is **not** a conspiracy generator and it is **not** a defense of any official narrative either. It's an attempt to hold every claim — official and unofficial — to the same standard: name the source, grade how solid it is, and say plainly when something isn't established, without pretending certainty that doesn't exist in either direction.

## The one rule everything else follows

**No claim is presented as fact unless it's sourced.** Every entry in this app carries an explicit rating (verified / supported / plausible / unproven / not established / refuted, or a tab-specific equivalent — see [Ratings vocabulary](#ratings-vocabulary) below) and a named source. Where accounts conflict, both sides are shown side by side rather than one being quietly dropped. Where the honest answer is "this isn't established," the app says that instead of guessing.

Association is not treated as evidence of involvement. Two people knowing each other, or being photographed near each other, is recorded as exactly that — and nothing more — unless something further actually connects them.

## Getting started

This is a static site: plain HTML, CSS, and JavaScript, with data served from local JSON files. No build step, no npm, no framework.

Because the app loads its data via `fetch()`, you need to serve it over HTTP rather than opening `index.html` directly from disk (browsers block local-file `fetch()` calls). The simplest way:

```bash
python -m http.server 8090
```

Then open `http://localhost:8090` in a browser. Any other static file server (`npx serve`, VS Code's Live Server, etc.) works the same way — just point it at this folder.

## What's inside

The app is organized into tabs across the top of the page:

| Tab | What it covers |
|---|---|
| **Verified Case Map** | An interactive relationship graph of people/entities in the case, each node sourced and rated |
| **Assessment** | The app's own working conclusion — a stated confidence range for each major proposition (e.g. whether Robinson was the shooter, whether a preventable security failure occurred), showing what evidence raised or lowered it each revision |
| **Court Record Timeline** | Timeline built only from filed court documents and named reporting, with a provenance tag on every entry |
| **Official Conduct** | Tracks findings against officials/agencies specifically — sanctioned violations, evidence gaps, and open transparency questions, kept separate from general case commentary |
| **Network & Backgrounds** | Government/military/institutional connections for people in the case, rated by connection tier (actual service vs. formal appointment vs. adjacent work vs. ideological alignment vs. none found) |
| **Contested Claims** | Circulating claims rated on their own scale (verified / supported / documented allegation / unproven / counterevidence / no evidence) — distinct from the Deep Dives scale, since "someone said this" and "this is true" are different questions |
| **Contradictions** | Places where two credible sources directly conflict, shown side by side with why it matters and current status |
| **External Fact-Check** | Cross-references against outside fact-checking coverage |
| **48-Hour Window** | A tight timeline of the first 48 hours, with per-person confidence tags (official / reported / self-reported / disputed) |
| **Trends Claims Tracker** | An evidence-graded (A–D) tracker for claims that spread via Google Trends / social virality specifically |
| **Flight Data** | Real ADS-B aircraft-tracking data for the region, used to check aviation-related claims against actual transponder records |
| **Scene Simulation** | A time-scrubbable reconstruction of the event overlaid on real satellite imagery of the UVU campus, with named individuals positioned according to sourced accounts |
| **Statement Ledger** | Cross-checks what different people have said against each other and against established ground truth |
| **Deep Dives** | The largest section — 100+ long-form investigations into specific claims, people, and evidence questions, each with individually-rated findings, source-quality grades, and an explicit list of what's still unresolved. Searchable and filterable by category |
| **Investigation Priorities** | What's most worth chasing next, and why |
| **Vehicle Analysis** | Specific analysis of vehicles appearing in campus footage |
| **Latest Assessment** | Most recent update to the app's overall conclusions |
| **Sources & Methodology** | Full source list and an explanation of how grading works |

## Ratings vocabulary

Different tabs use slightly different scales depending on what's being graded, but they all follow the same idea — separating *whether a claim was made* from *whether a claim is true*, and separating *what's certain* from *what's merely plausible*:

- **Deep Dives finding assessments:** `verified` → `supported` → `plausible` → `unproven` → `not_established` → `refuted`
- **Contested Claims ratings:** `verified` / `supported` / `documented_allegation` / `unproven` / `counterevidence` / `no_evidence`
- **Timeline provenance:** `official` (court/government primary source) / `reported` (named credible reporting) / `disputed` (outlets conflict) / `unverified`
- **Network connection tier:** `service` / `appointment` / `adjacent` / `advocacy` / `none_found` / `unverified`
- **48-Hour Window confidence:** `official` / `reported` / `self_reported` / `disputed`
- **Trends Tracker evidence grade:** A (original/reproducible primary source) → D (unsourced)

## Where things currently stand

As of the last update, the app's own working assessment (see the **Assessment** tab for full reasoning and sourcing on both):

- **Robinson was the actual shooter:** 79–92% confidence. Acoustic analysis, casing/fragment forensics, and the timeline all corroborate the mechanism and firing position independently of the contested chain-of-custody issues; what's weakened the identification specifically (not the mechanism) includes hearsay-based autopsy testimony, a fingerprint examiner excluding Robinson from unidentified prints at the scene, and unresolved video chain-of-custody problems.
- **A major, preventable security failure occurred:** 96–99% confidence. This is treated as the best-supported finding in the entire case file.

These numbers move as new information comes in — check the Assessment tab for the current figures and the reasoning behind any change, not this file.

## Project structure

```
index.html          — page shell, one <section> per tab
app.js               — one loadX() function per tab, fetches data/X.json and renders it
styles.css           — single stylesheet
data/*.json          — all content, one file per tab/domain (generated — see below)
scripts/*.py         — Python scripts that generate data/*.json; treat these as the source of truth
images/              — satellite imagery and other visual assets used by the Scene Simulation tab
GRAMA_REQUESTS.md    — drafted Utah GRAMA (public records) requests tied to open evidence gaps
REBUILD_PROMPT.md    — a from-scratch technical rebuild spec for this app (developer-oriented, not needed to just use the site)
```

If you're editing content: edit the relevant `scripts/build_X.py` file and re-run it to regenerate `data/X.json`, rather than hand-editing the JSON directly. When you change `app.js`, `styles.css`, or any `data/*.json` file, bump the `?v=N` cache-busting query string on the corresponding `<script>`/`<link>` tag in `index.html` and/or `fetch()` call in `app.js` — browsers cache these aggressively otherwise, and a stale mismatch between the two is the most common source of "my change isn't showing up."

## A note on sourcing standards

Sourcing quality varies across the file and is graded accordingly rather than treated as uniform. Preference is given to:

- Court filings and official government records
- Named, on-record statements from named reporters at established outlets
- Multiply-corroborated claims over single-source ones

Explicitly **excluded** as sourcing, regardless of how confidently a claim is stated: AI-generated content-farm sites, anonymous or pseudonymous "analysis" accounts with no verifiable credentials, and claims that rest on interpreting someone's body language or tone in existing footage rather than on documented fact. Where a claim can only be sourced to one of these, the app says so explicitly rather than repeating the claim as if it were established.

## Contributing / corrections

If you find a sourcing error, a broken link, or a claim that needs updating, the most useful thing you can do is point to the specific `data/*.json` entry (or the deep dive title) and what the correction should be, ideally with a source. This project's whole premise is that it should be easy to check and easy to correct.

## Disclaimer

This is a citizen research project, not a legal filing, not investigative journalism with editorial fact-checking, and not a substitute for the court record itself. Confidence ranges in the Assessment tab are the app's own evidentiary judgments, not findings of guilt or innocence — those are for the court to determine. Nothing here should be read as proof of any individual's or agency's involvement absent a clearly graded, primary source backing it up.

## License

This project is dual-licensed:

- **Code** (`index.html`, `app.js`, `styles.css`, `scripts/*.py`) — [MIT License](LICENSE). Free to use, copy, modify, and redistribute, including commercially.
- **Research content & data** (`data/*.json`, `GRAMA_REQUESTS.md`) — [Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE-DATA.md). Free to share and adapt for any purpose, as long as you credit the source.

Third-party material embedded in this project (quoted news excerpts, transcript passages, the satellite basemap used in the Scene Simulation tab) is **not** covered by either license and remains subject to its original source's terms — see [LICENSE-DATA.md](LICENSE-DATA.md) for specifics.
