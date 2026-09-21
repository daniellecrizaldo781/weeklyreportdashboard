# 📊 Weekly Business Report — Oricle

A **Google Slides-style weekly business report** that consolidates the **Sales Dashboard**,
**Call EOD Dashboard**, and **Team Dashboard** into one cute, presentation-ready HTML deck.

It loads **`weeklyreport.daniellecrizaldo.com`** (or the GitHub Pages URL) and opens straight
to the report — a full-screen 16:9 slide deck with a **week selector** up top so you can
flip between the current week, the previous week, and any historical week.

## Slides
1. **Weekly Sales & Business Overview** — sales first & prominent (total, WoW, channels, top products/sellers) + a "This Week at a Glance" snapshot
2. **Call Performance** — **OHA and Non-OHA reported separately** (calls / answered / abandoned / AHT / answer rate)
3. **IVR Branch Performance** — OHA IVR and Non-OHA IVR kept separate
4. **Call Breakdown** — top call drivers & reasons *(combined — see note below)*
5. **Refund Overview** — refund tickets, amount, top reasons *(combined)*
6. **Week-over-Week Refund Trends** — prev vs current refunds + multi-week trend *(combined)*
7. **Detailed Sales Performance** — WoW, channels, products, sellers, sales trend
8. **Team Weekly Performance** — individual CSR scorecards + call productivity
9. **Back Office Hours** — individual agent names + hours

Use `← →` arrow keys, the dots at the bottom, or click the left/right edge of a slide to
navigate. **🖨️ Print / PDF** exports the deck to a PDF for meetings. **⛶ Full** toggles fullscreen.

## How the data stays fresh (auto-refresh)
| Dashboard | Where the data comes from |
|---|---|
| **Sales** | `window.SALES_DATA` in `Sales-Dashboard/data.js` (GitHub Pages) |
| **Call EOD** | `window.CALL_DATA` in `Call-Eod-Stats-Dashboard/data.js` |
| **Team** | `window.DASHBOARD_DATA` in `Team-Dashboard/data.js` |

Each of those dashboards already auto-syncs its own `data.js` from Google Sheets every hour.
**This repo's GitHub Action (`auto: refresh weekly report data`) runs right after them (hourly
at :23), pulls the three published `data.js` files, rolls them up into one local
`report-data.js`, and commits it.** So when you update the Sales / Call / Team sheets, the
weekly report reflects it within an hour — no manual work.

> **Why a build script and not a live browser fetch?** Each dashboard's github.io `data.js`
> 301-redirects to an *HTTP* custom subdomain (`http://sales…`, `http://callsstats…`,
> `http://teamdashboard…`). A browser on an HTTPS page refuses to follow that redirect
> (mixed content), so the deck can never fetch these cross-origin at runtime. The build
> script runs server-side where `curl` can follow the redirect to `http` and read the real
> bytes — it reads the **same** source-of-truth snapshots and only re-shapes them into weekly
> aggregates. No credentials, no tokens, no secrets.

## ⚠️ Important data note: most refund/breakdown numbers are COMBINED
Your **Call EOD dashboard’s Call Breakdown sheet has no OHA/Non-OHA field** in it — every
ticket row only carries `channel = "Aircall_Phone_Calls"`. So the source data physically
cannot split **tickets, refund amounts, refund reasons, or call drivers** by hotline.

What **CAN** be split by OHA / Non-OHA (from the call cube): **total calls, answered,
missed, abandoned, AHT, answer rate, and IVR branch volume** — those are reported separately
on Slides 2 & 3.

If you want true OHA / Non-OHA splits on the refund & call-breakdown slides, the fix is
**adding a "Channel" column (OHA / Non-OHA) to the Call Breakdown source sheet** — then the
report can split those too.

## Project structure
```
index.html              → the deck (CSS + shell), loads report-data.js + deck.js
deck.js                 → all 9 slides + week selector + navigation
report-data.js          → generated weekly aggregate (committed by the Action)
build_report_data.py    → pulls the 3 dashboards' data.js, aggregates weekly
.github/workflows/sync.yml → hourly auto-sync that regenerates report-data.js
CNAME                   → weeklyreport.daniellecrizaldo.com
```

## Deploy to GitHub Pages + custom domain
1. Push `main` to this repo.
2. Repo **Settings → Pages → Source: Deploy from a branch → main / (root)** → Save.
   It builds at `https://daniellecrizaldo781.github.io/weeklyreportdashboard/` in ~1–2 min.
3. The repo already has a `CNAME` file set to `weeklyreport.daniellecrizaldo.com`. To go live
   on that subdomain you only need to add the DNS record in Cloudflare (no dashboard code
   change needed) — **do that only when you explicitly want it live**:
   - **CNAME** `weeklyreport` → `daniellecrizaldo781.github.io`
   - (Proxied "orange cloud" is fine; add a Cache Rule to bypass `data.js`/`.js`/`.css` like
     your other dashboards so hourly refreshes aren't cached 4h.)

## Rebuild locally (optional)
```bash
curl -sL -o sales.js "https://daniellecrizaldo781.github.io/Sales-Dashboard/data.js"
curl -sL -o call.js   "https://daniellecrizaldo781.github.io/Call-Eod-Stats-Dashboard/data.js"
curl -sL -o team.js   "https://daniellecrizaldo781.github.io/Team-Dashboard/data.js"
python build_report_data.py . report-data.js
```