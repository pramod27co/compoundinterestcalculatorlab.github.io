# CompoundLab — Compound Interest Calculator

A free, no-signup compound interest calculator with a modern green UI: deposits, withdrawals,
a stacked growth chart, monthly/yearly breakdowns, summary view and CSV export.
Runs entirely in the browser — no backend, no build step.

**Live demo file:** open `index.html` (or serve the folder) — everything works offline except web fonts.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Main calculator page (SEO head, JSON-LD, OG tags) |
| `styles.css` | All styling, light + dark (green) themes |
| `app.js` | Calculation engine, chart, table, summary, shareable URLs |
| `chart.umd.min.js` | Chart.js v4.4.7, self-hosted (no CDN dependency) |
| `og.png` | Social share image (1200×630) |
| `favicon.svg` | Site icon |
| `privacy.html` / `disclaimer.html` / `about.html` | Required policy pages (AdSense-ready) |
| `robots.txt` / `sitemap.xml` | Crawl + index hints |

---

## ✅ Placeholders — already replaced (2026-11-27)

- GitHub username: **`compoundinterestcalculatorlab`** → site URL is `https://compoundinterestcalculatorlab.github.io/`
  (canonical, OG, Twitter, JSON-LD in `index.html` + `privacy.html` + `disclaimer.html` + `about.html`, plus `robots.txt` and `sitemap.xml`)
- Contact email: **`pramodandbusiness@gmail.com`** (in `about.html`)

The repo must be named **`compoundinterestcalculatorlab.github.io`** (user-site convention — that
name publishes to the root URL, with no path segment). If you ever rename the account or repo,
search the folder for `compoundinterestcalculatorlab` and update every occurrence to keep the
canonical URL, sitemap and social cards pointing at the right address.

---

## Deploy to GitHub Pages (from a phone or desktop)

1. Create a free account at [github.com](https://github.com) with username
   **`compoundinterestcalculatorlab`** (or rename an existing account:
   Settings → Account → Change username).
2. **New repository** → name it `compoundinterestcalculatorlab.github.io` → Public → Create repository.
3. On the repo page: **Add file → Upload files** → drag in every file from this folder
   (every file goes to the repo root — the project is intentionally flat, so a phone can
   multi-select all files in one upload) → **Commit changes**.
4. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder: `/root` → **Save**.
5. Wait ~1 minute, then open `https://compoundinterestcalculatorlab.github.io/`.

### Updating the site later
Re-upload only the files you changed (step 3). GitHub Pages redeploys automatically.
No build, no dependencies — that's the whole update flow.

---

## Local preview

```bash
python3 -m http.server 8765
# open http://localhost:8765/
```

---

## Features

- **Modes:** Compound · Daily · Forex · Simple interest
- **Inputs:** 8 currencies, rate period (daily→annual), 12 compounding frequencies + custom, term in years/months
- **Contributions:** deposits and/or withdrawals, any frequency, beginning/end of period, annual increases (% or fixed)
- **Results:** future value, total interest, total deposits/withdrawals, effective APY, nominal→effective, RoR, time to double
- **Views:** stacked growth chart (Initial Balance / Deposits / Accrued Interest / Withdrawals + balance line), table, summary
- **Export:** CSV download of the breakdown
- **Shareable URLs:** every setting is written into the query string, e.g.
  `index.html?p=10000&r=8&y=10&cf=365&c=EUR` — paste a link and it opens with those exact inputs
- **UX:** live recalculation, auto-scroll to results, dark/light theme, responsive, reduced-motion support

## Verification reference

Default inputs ($5,000 · 5% annual · monthly compounding · 5 years) produce:

- Future value **$6,416.79** · Interest **$1,416.79** · APY **5.12%** · RoR **28.34%** · Double in **13y 11m**

---

## Monetisation roadmap (when traffic arrives)

1. 500+ visits/mo → Ko-fi button + AdSense application (privacy/disclaimer pages already in place)
2. 1k+ visits/mo → Google AdSense (finance niche, decent RPM); Ezoic/Adsterra as fallbacks
3. Later → Pro tier via Stripe Payment Links (saved scenarios, PDF export, compare two investments)
4. Later → calculator suite pages (SIP, loan, savings goal) for more search traffic

---

## Changelog

- **v1.1 (2026-11-27)** — Deploy prep: self-hosted Chart.js, SEO/OG/JSON-LD, favicon, robots,
  sitemap, privacy/disclaimer/about pages, shareable URLs, footer links, README, deploy zip.
- **v1.0 (2026-11-26)** — Initial build: calculator engine, stacked chart, table/summary views,
  green compact UI, auto-scroll, CSV export, dark theme.
