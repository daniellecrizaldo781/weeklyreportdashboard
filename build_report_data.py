#!/usr/bin/env python3
"""
build_report_data.py — Weekly Report Dashboard data aggregator.

Pulls the PUBLISHED data.js snapshots from the three existing dashboards
(Sales Dashboard, Call EOD Stats Dashboard, Team Dashboard — all on GitHub
Pages) and rolls them up into a single weekly `report-data.js` that the
weekly-report presentation deck reads SAME-ORIGIN.

WHY a build script and not a live browser fetch:
  Each dashboard's github.io data.js 301-redirects to its *HTTP* custom
  subdomain, which a browser on an HTTPS page refuses to follow (mixed
  content). So the browser can never fetch these cross-origin. Instead this
  script runs server-side (GitHub Actions cron) where curl/Python can follow
  the redirect to http and read the bytes. It does NOT copy or fake data — it
  reads the SAME source-of-truth snapshots and only re-shapes them weekly.

No credentials, no tokens, no secrets: every source is a public GitHub Pages
static file.

Usage:
  python build_report_data.py <srcdir> <outfile>
  e.g. python build_report_data.py /tmp/wrd-src report-data.js
where <srcdir> contains `sales.js`, `call.js`, `team.js` (already downloaded).

Output: window.REPORT_DATA = { weeks, weekOrder, meta } — JSON.
"""

import json, os, sys
from datetime import date, timedelta
from collections import defaultdict

NO_IVR = "No IVR Branch / Unassigned"
BACK_OFFICE = "doing_back_office"

# ---------------------------------------------------------------------------
# source parsers
# ---------------------------------------------------------------------------

def load_js(path):
    """Extract the JSON object assigned in `window.X = {...};` from a data.js."""
    s = open(path, encoding="utf-8").read()
    # find assignment to a variable (SALES_DATA / CALL_DATA / DASHBOARD_DATA)
    import re
    m = re.search(r"window\.\w+\s*=\s*", s)
    if not m:
        m = re.search(r"=\s*(\{)")  # fallback: first brace
        body = s[m.start(1) - 1:]
    else:
        body = s[m.end():]
    body = body.strip().rstrip(";").strip()
    return json.loads(body[: body.rfind("}") + 1])


def decode_team(data, only=None):
    """Decode the compressed DASHBOARD_DATA packed datasets (strings + columnar).
    `only` = optional whitelist of dataset names to decode (skips the object/
    HTML-rich datasets like cascades/products whose cells nest arrays)."""
    strings = data["strings"]
    packed = data["packed"]
    out = {}
    for name, v in packed.items():
        if only and name not in only:
            continue
        d = json.loads(v) if isinstance(v, str) else v
        cols, rows = d["c"], []
        for r in d["r"]:
            row = {}
            for ci, col in enumerate(cols):
                cell = r[ci] if ci < len(r) else None
                # skip nested-array cells (string-index arrays are single [i])
                if isinstance(cell, list) and cell and isinstance(cell[0], list):
                    row[col] = None
                else:
                    row[col] = strings[cell[0]] if isinstance(cell, list) else cell
            rows.append(row)
        out[name] = rows
    return out


# ---------------------------------------------------------------------------
# week helpers (Monday = start, matches all three dashboards)
# ---------------------------------------------------------------------------

def week_of(iso):
    try:
        d = date.fromisoformat(iso)
    except Exception:
        return None
    return (d - timedelta(days=d.weekday())).isoformat()


MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

def fmt_day(iso):
    d = date.fromisoformat(iso)
    return f"{MONTHS[d.month - 1]} {d.day}"

def fmt_week(ws):
    we = (date.fromisoformat(ws) + timedelta(days=6)).isoformat()
    return f"{fmt_day(ws)} – {fmt_day(we)}"


def pct(v):
    """Normalise a percent that may be stored as 0.99 or 99 -> 99."""
    if v is None: return None
    return v if v > 1.5 else v * 100

def fmt_clock(sec):
    sec = int(round(sec or 0))
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"

# ---------------------------------------------------------------------------
# per-source weekly aggregation
# ---------------------------------------------------------------------------

def agg_sales(sales):
    """rows: {ch,d,b,amt,ws,we,ord,by} -> {week: {...}}"""
    weeks = defaultdict(lambda: {
        "total": 0.0, "orders": 0,
        "byChannel": defaultdict(lambda: {"amt": 0.0, "orders": 0}),
        "byBrand": defaultdict(float),
        "byAgent": defaultdict(float),
    })
    for r in sales.get("rows", []):
        w = week_of(r.get("d"))
        if not w:
            continue
        amt = r.get("amt") or 0
        ch = r.get("ch") or "Unspecified"
        acc = weeks[w]
        acc["total"] += amt
        acc["orders"] += 1
        c = acc["byChannel"][ch]
        c["amt"] += amt
        c["orders"] += 1
        acc["byBrand"][r.get("b") or "Unspecified"] += amt
        acc["byAgent"][r.get("by") or "Unspecified"] += amt

    out = {}
    for w, acc in weeks.items():
        total = round(acc["total"], 2)
        orders = acc["orders"]
        bc = {k: {"amt": round(v["amt"], 2), "orders": v["orders"]}
              for k, v in sorted(acc["byChannel"].items())}
        brand = sorted(acc["byBrand"].items(), key=lambda x: -x[1])[:10]
        agent = sorted(acc["byAgent"].items(), key=lambda x: -x[1])[:10]
        out[w] = {
            "total": total, "orders": orders,
            "avg": round(total / orders, 2) if orders else 0,
            "byChannel": bc,
            "byBrand": [{"b": k, "amt": round(v, 2)} for k, v in brand],
            "byAgent": [{"a": k, "amt": round(v, 2)} for k, v in agent],
        }
    return out


def agg_call(call):
    """cube: {date\1hour\1channel\1brand\1branch\1status: [count,value]} + breakdown + status."""
    weeks = {}
    for wk in week_union([k.split("\x01")[0] for k in call.get("cube", {})]):
        per = {ch: {"total": 0, "answered": 0, "missed": 0, "abandoned": 0,
                    "ooh": 0, "aht_sum": 0.0, "noIvrAband": 0,
                    "ivr": defaultdict(lambda: {"total": 0, "answered": 0,
                                                "abandoned": 0, "aht_sum": 0.0})}
              for ch in ("OHA", "NON-OHA")}
        for key, val in call.get("cube", {}).items():
            parts = key.split("\x01")
            if len(parts) < 6:
                continue
            date_s, _h, ch, _brand, branch, status = parts[:6]
            if week_of(date_s) != wk or ch not in per:
                continue
            cnt, sec = val[0], (val[1] or 0)
            p = per[ch]
            p["total"] += cnt
            p[status] = p.get(status, 0) + cnt
            if status == "answered":
                p["aht_sum"] += sec
            if status == "abandoned" and branch == NO_IVR:
                p["noIvrAband"] += cnt
            iv = p["ivr"][branch]
            iv["total"] += cnt
            iv[status] = iv.get(status, 0) + cnt
            if status == "answered":
                iv["aht_sum"] += sec

        wk_dict = {}
        combined = {"total": 0, "answered": 0, "abandoned": 0, "ooh": 0,
                    "aht_sum": 0.0, "agentReceived": 0}
        for ch in ("OHA", "NON-OHA"):
            p = per[ch]
            agentReceived = p["answered"] + p["missed"] + p["noIvrAband"]
            aht = (p["aht_sum"] / p["answered"]) if p["answered"] else 0
            ivr = [{"branch": b, "total": v["total"], "answered": v["answered"],
                    "abandoned": v["abandoned"],
                    "aht": round(v["aht_sum"] / v["answered"], 1) if v["answered"] else 0}
                   for b, v in sorted(p["ivr"].items(), key=lambda x: -x[1]["total"])]
            wk_dict[ch] = {
                "total": p["total"], "answered": p["answered"],
                "missed": p["missed"], "abandoned": p["abandoned"], "ooh": p["ooh"],
                "agentReceived": agentReceived,
                "answerRate": round(p["answered"] / agentReceived, 4) if agentReceived else 0,
                "aht": fmt_clock(aht), "ahtSec": round(aht, 1),
                "ivr": ivr,
            }
            combined["total"] += p["total"]
            combined["answered"] += p["answered"]
            combined["abandoned"] += p["abandoned"]
            combined["ooh"] += p["ooh"]
            combined["aht_sum"] += p["aht_sum"]
            combined["agentReceived"] += agentReceived
        combined["aht"] = fmt_clock(combined["aht_sum"] / combined["answered"]) if combined["answered"] else 0
        combined["answerRate"] = round(combined["answered"] / combined["agentReceived"], 4) if combined["agentReceived"] else 0
        combined.pop("aht_sum")
        wk_dict["combined"] = combined

        # --- breakdown, split by channel via brand heuristic (OHA = Oricle brands) ---
        def is_oricle(b): return isinstance(b, str) and b.lower().startswith("oricle")
        rows_wk = [r for r in call.get("breakdown", []) if week_of(r.get("d")) == wk]
        def agg_bd(rows):
            bd = defaultdict(lambda: {"n": 0, "refund": 0.0})
            for r in rows:
                sub = r.get("sub") or "Unspecified"
                cat = r.get("cat") or "General"
                b = bd[(sub, cat)]
                b["n"] += 1
                b["refund"] += (r.get("refund") or 0)
            refund_tk = sum(1 for r in rows if (r.get("refund") or 0) > 0)
            refund_amt = round(sum((r.get("refund") or 0) for r in rows), 2)
            def top(key, refund_only=False):
                t = defaultdict(float); n = defaultdict(int)
                for (s_, c_), b in bd.items():
                    if refund_only and b["refund"] <= 0:
                        continue
                    k = s_ if key == "sub" else c_
                    t[k] += b["refund"]; n[k] += b["n"]
                agg2 = [(k, n[k], round(t[k], 2)) for k in t]
                agg2.sort(key=lambda x: -x[1])
                return [{"k": k, "count": n, "refund": r} for k, n, r in agg2[:8]]
            return {
                "tickets": len(rows),
                "refundTickets": refund_tk,
                "refundAmount": refund_amt,
                "avgRefund": round(refund_amt / refund_tk, 2) if refund_tk else 0,
                "topDrivers": top("cat"),
                "topRefundReason": top("sub", refund_only=True),
            }
        oha_rows = [r for r in rows_wk if is_oricle(r.get("brand"))]
        nonoha_rows = [r for r in rows_wk if not is_oricle(r.get("brand"))]
        # top main refund reason per brand
        bybrand = defaultdict(lambda: {"n": 0, "refund": 0.0, "reasons": defaultdict(float)})
        for r in rows_wk:
            if (r.get("refund") or 0) > 0:
                b = bybrand[r.get("brand") or "Unspecified"]
                b["n"] += 1
                b["refund"] += r["refund"]
                b["reasons"][r.get("sub") or "Unspecified"] += r["refund"]
        bybrand_list = []
        for brand, b in bybrand.items():
            top_reason = max(b["reasons"].items(), key=lambda x: x[1])[0] if b["reasons"] else "—"
            bybrand_list.append({"brand": brand, "tickets": b["n"], "refund": round(b["refund"], 2), "topReason": top_reason})
        bybrand_list.sort(key=lambda x: -x["refund"])
        wk_dict["breakdown"] = {
            "totalTickets": len(rows_wk),
            "refundTickets": agg_bd(rows_wk)["refundTickets"],
            "refundAmount": agg_bd(rows_wk)["refundAmount"],
            "avgRefund": agg_bd(rows_wk)["avgRefund"],
            "topDrivers": agg_bd(rows_wk)["topDrivers"],
            "topRefundReason": agg_bd(rows_wk)["topRefundReason"],
            "oha": agg_bd(oha_rows),
            "nonoha": agg_bd(nonoha_rows),
            "byBrand": bybrand_list,
        }

        weeks[wk] = wk_dict

    # --- back-office hours per agent per week (from status) ---
    bo = defaultdict(lambda: defaultdict(float))
    for r in call.get("status", {}).get("rows", []):
        w = week_of(r.get("d"))
        if w and r.get("status") == BACK_OFFICE:
            bo[w][r.get("agent")] += (r.get("min") or 0)
    for w, agents in bo.items():
        if w in weeks:
            weeks[w]["backOffice"] = sorted(
                [{"a": a, "hrs": round(m / 60.0, 1)} for a, m in agents.items()],
                key=lambda x: -x["hrs"])

    return weeks


def agg_team(team):
    d = decode_team(team, only=("scorecards", "weeklyCallStats"))
    weeks = defaultdict(lambda: {
        "rank": [], "callStats": [], "count": 0, "avgOverall": 0, "rankRaw": {}
    })
    sc = d.get("scorecards", [])
    byweek = defaultdict(lambda: defaultdict(dict))
    for r in sc:
        byweek[r["week"]][r["agent"]][r["metric"]] = r.get("value")
    for w, agents in byweek.items():
        rows = []
        overalls = []
        for agent, metrics in agents.items():
            total = metrics.get("TOTAL SCORE (out of 100)")
            overall = metrics.get("Overall %")
            rank = metrics.get("TEAM RANKING") or ""
            if total is None:
                continue
            rows.append({"a": agent, "total": round(total, 2),
                         "pct": round(pct(overall), 1) if overall is not None else None,
                         "rank": rank,
                         "att": round(pct(metrics.get("Attendance %")), 1) if metrics.get("Attendance %") is not None else None,
                         "qual": round(pct(metrics.get("Quality %")), 1) if metrics.get("Quality %") is not None else None,
                         "prod": round(pct(metrics.get("Productivity %")), 1) if metrics.get("Productivity %") is not None else None,
                         "we": round(pct(metrics.get("Work Ethic %")), 1) if metrics.get("Work Ethic %") is not None else None})
            overalls.append(total)
        rows.sort(key=lambda x: -x["total"])
        weeks[w]["rank"] = rows
        weeks[w]["count"] = len(rows)
        weeks[w]["avgOverall"] = round(sum(overalls) / len(overalls), 2) if overalls else 0

    wc = d.get("weeklyCallStats", [])
    for r in wc:
        w = r.get("week")
        if w in weeks:
            weeks[w]["callStats"].append({
                "a": r.get("agent"), "attempts": r.get("attempts"),
                "pickedUp": r.get("pickedUp"), "notPickedUp": r.get("notPickedUp"),
                "pickupRate": round((r.get("pickupRate") or 0) * 100, 1),
                "aht": r.get("aht"),
            })
    # attach call stats to rank rows (by agent name)
    for w in weeks:
        cs = {c["a"]: c for c in weeks[w]["callStats"]}
        for row in weeks[w]["rank"]:
            row["calls"] = cs.get(row["a"])
    return weeks


def week_union(dates):
    wk = set()
    for dd in dates:
        w = week_of(dd)
        if w:
            wk.add(w)
    return sorted(wk)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    srcdir, outfile = sys.argv[1], sys.argv[2]
    sfx = lambda n: os.path.join(srcdir, n)
    sales = load_js(sfx("sales.js"))
    call = load_js(sfx("call.js"))
    team = load_js(sfx("team.js"))

    s_weeks = agg_sales(sales)
    c_weeks = agg_call(call)
    t_weeks = agg_team(team)

    all_ws = sorted(set(list(s_weeks) + list(c_weeks) + list(t_weeks)))
    weeks = {}
    for i, w in enumerate(all_ws):
        prev = all_ws[i - 1] if i > 0 else None
        weeks[w] = {
            "ws": w, "we": (date.fromisoformat(w) + timedelta(days=6)).isoformat(),
            "label": fmt_week(w), "prev": prev,
            "sales": s_weeks.get(w, {"total": 0, "orders": 0, "avg": 0,
                                     "byChannel": {}, "byBrand": [], "byAgent": []}),
            "call": c_weeks.get(w, {}),
            "team": t_weeks.get(w, {"rank": [], "callStats": [], "count": 0}),
        }

    report = {
        "meta": {
            "generated": "2026-09-21",
            "sources": {
                "sales": sales.get("generated", ""),
                "call": call.get("generated", ""),
                "team": team.get("lastUpdated", ""),
            },
            "noIvrLabel": NO_IVR,
        },
        "weekOrder": all_ws,
        "weeks": weeks,
    }

    js = "window.REPORT_DATA = " + json.dumps(report) + ";"
    with open(outfile, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"Wrote {outfile} ({os.path.getsize(outfile)} bytes) for {len(all_ws)} weeks")


if __name__ == "__main__":
    main()