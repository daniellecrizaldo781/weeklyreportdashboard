/* TL Danielle Weekly Report — deck renderer. Reads window.REPORT_DATA. */
(function(){
"use strict";
var R = window.REPORT_DATA || { weeks:{}, weekOrder:[] };
var weeks = R.weeks, order = R.weekOrder || [];
var sel = (function(){ for(var i=order.length-1;i>=0;i--){ var w=weeks[order[i]]; if(w && w.call && w.call.combined && w.call.combined.total>0) return order[i]; } return order.length?order[order.length-1]:null; })();
var si = 0;

function cur(){ return weeks[sel] || null; }
function prevWeek(){ return weeks[sel] && weeks[sel].prev ? weeks[weeks[sel].prev] : null; }

/* ---------- formatters ---------- */
function num(x){ return (x==null?0:x).toLocaleString(); }
function money(x){ x=x||0; return (x<0?'-':'') + '$' + Math.abs(x).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function moneyS(x){ x=x||0; return (x>=0?'+':'-') + '$' + Math.abs(x).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function pctS(x){ x=x||0; return (x>=0?'+':'-') + Math.abs(x).toFixed(1) + '%'; }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function delta(cur, prevVal, opts){
  opts = opts||{};
  var d = (cur==null?0:cur) - (prevVal==null?0:prevVal);
  var cls = d===0 ? 'flat' : ((d>0) ? (opts.invert?'down':'up') : (opts.invert?'up':'down'));
  var arrow = d>0 ? '▲' : (d<0 ? '▼' : '•');
  var f = opts.fmt ? opts.fmt(d) : moneyS(d);
  return '<span class="delta '+cls+'">'+arrow+' '+f+'</span>';
}

function kpi(lbl, val, sub, cls){
  return '<div class="kpi '+(cls||'')+'"><div class="lbl">'+esc(lbl)+'</div>'+
         '<div class="val">'+val+'</div>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div>';
}
function mk(l,v){ return '<div class="mk"><div class="l">'+l+'</div><div class="v">'+v+'</div></div>'; }

function bars(rows, color, valFmt){
  if(!rows || !rows.length) return '<div class="small" style="padding:10px">No data for this week.</div>';
  var max = Math.max.apply(null, rows.map(function(r){ return r.v||0; }));
  var out = '<div class="bars">';
  rows.forEach(function(r){
    var w = max>0 ? Math.max(4, (r.v/max)*100) : 0;
    var vs = r.vs||'';
    out += '<div class="bar-row"><div class="bar-lbl" title="'+esc(r.l)+'">'+esc(r.l)+'</div>'+
      '<div class="bar-track"><div class="bar-fill" style="width:'+w+'%;background:'+color+'"></div></div>'+
      '<div class="bar-val">'+value(r.v,valFmt)+' <span class="small">'+vs+'</span></div></div>';
  });
  return out + '</div>';
}
function value(v,fmt){ return fmt?fmt(v):num(v); }

function stackedBars(rows, colorA, colorB){
  if(!rows || !rows.length) return '<div class="small" style="padding:10px">No data.</div>';
  var max = Math.max.apply(null, rows.map(function(r){ return (r.a||0)+(r.b||0); }));
  var out = '<div class="bars">';
  rows.forEach(function(r){
    var tot=(r.a||0)+(r.b||0);
    var wa=max>0?(r.a||0)/max*100:0, wb=max>0?(r.b||0)/max*100:0;
    out += '<div class="bar-row"><div class="bar-lbl" title="'+esc(r.l)+'">'+esc(r.l)+'</div>'+
      '<div class="bar-track" style="display:flex">'+
        '<div class="bar-fill" style="width:'+wa+'%;background:'+colorA+';border-radius:8px 0 0 8px"></div>'+
        '<div class="bar-fill" style="width:'+wb+'%;background:'+colorB+';border-radius:0 8px 8px 0"></div>'+
      '</div><div class="bar-val"><b>'+num(tot)+'</b></div></div>';
  });
  return out + '</div>';
}
function donut(parts, colors){
  if(!parts || !parts.length) return '<div class="small" style="padding:10px">No data.</div>';
  var total = parts.reduce(function(a,b){return a+(b.v||0);},0);
  var R=42, C=2*Math.PI*R, acc=0;
  var segs = parts.map(function(p,i){
    var frac = total>0 ? (p.v||0)/total : 0;
    var dash=frac*C, gap=C-dash, off=-acc*C; acc+=frac;
    return '<circle r="'+R+'" cx="50" cy="50" fill="none" stroke="'+(colors[i%colors.length])+'" stroke-width="16" stroke-dasharray="'+dash+' '+gap+'" stroke-dashoffset="'+off+'"/>';
  }).join('');
  var legend = parts.map(function(p,i){
    var pc = total>0 ? ((p.v||0)/total*100).toFixed(0) : 0;
    return '<div class="li"><span class="sw" style="background:'+(colors[i%colors.length])+'"></span><span class="nm">'+esc(p.l)+'</span><span class="pc">'+pc+'%</span></div>';
  }).join('');
  return '<div class="donut-wrap"><div class="donut"><svg viewBox="0 0 100 100">'+segs+'</svg><div class="center"><div class="v">'+num(total)+'</div><div class="l">calls</div></div></div><div class="legend">'+legend+'</div></div>';
}

function slide(num, title, sub, bodyHtml, note){
  var wb = sel ? '<span class="weekbadge">'+esc(weeks[sel].label)+'</span>' : '';
  return '<section class="slide"><div class="shead">'+
    '<div class="snum">'+num+'</div><div><div class="stitle">'+esc(title)+'</div>'+
    '<div class="ssub">'+esc(sub||'')+'</div></div>'+wb+'</div>'+
    '<div class="sbody">'+bodyHtml+'</div>'+
    (note?'<div class="snote">'+note+'</div>':'')+
    '<div class="foot"><div class="small">TL Danielle Weekly Report · Oricle · data from Sales / Call EOD / Team dashboards</div>'+
    '<div class="nvg"><span class="dots" id="dots"></span></div></div></section>';
}

/* =====================================================================
   SLIDE 1 — Weekly Sales & Business Overview
   ===================================================================== */
function s1(){
  var c = cur(), p = prevWeek(), s = c.sales;
  var sPrev = p ? (p.sales.total||0) : null;
  var dCh = s.byChannel || {};
  var chanPills = Object.keys(dCh).map(function(ch){
    var o = dCh[ch];
    var pillCls = /inbound/i.test(ch) ? 'pink' : 'blue';
    return '<span class="pill '+pillCls+'"><span class="sw" style="background:'+(pillCls==='pink'?'#E8578E':'#4E9BE5')+'"></span>'+
      esc(ch)+' &nbsp;<b>'+money(o.amt)+'</b> &middot; '+num(o.orders)+' orders</span>';
  }).join('') || '<span class="small">No channel data</span>';
  var topBrand = (s.byBrand||[]).map(function(b){ return {l:b.b, v:b.amt}; });
  var topAgent = (s.byAgent||[]).map(function(a){ return {l:a.a, v:a.amt}; });
  var hero =
    '<div class="hero"><div class="lbl">Weekly Sales</div>'+
    '<div class="herorow"><div class="heroL">'+
      '<div class="bigv">'+money(s.total)+' <small>/ '+num(s.orders)+' orders</small></div>'+
      '<div class="sub" style="margin-top:6px">Avg order '+money(s.avg)+' '+
         (sPrev!=null ? delta(s.total, sPrev, {fmt:function(d){return moneyS(d)+' ('+pctS(sPrev?d/sPrev*100:0)+')';}, invert:false}) : '<span class="small">first week</span>')+
      '</div></div>'+
      '<div class="heroR">'+chanPills+'</div></div></div>';
  var sec =
    '<div class="hero">'+hero+'</div>'+
    '<div class="cols"><div class="col"><h3>★ Top Selling Products</h3>'+
      bars(topBrand, '#E8578E', money)+
      '<h3 style="margin-top:10px">🏆 Top Sellers (by value)</h3>'+bars(topAgent, '#B99BDD', money)+
    '</div>'+
    '<div class="col"><h3>💼 Sales by Channel</h3>'+
      '<div class="scrollbox"><table><thead><tr><th>Channel</th><th>Sales</th><th>Orders</th><th>Avg</th></tr></thead><tbody>'+
      Object.keys(dCh).map(function(ch){
        var o=dCh[ch]; var avg=o.orders?o.amt/o.orders:0;
        return '<tr><td>'+esc(ch)+'</td><td>'+money(o.amt)+'</td><td>'+num(o.orders)+'</td><td>'+money(avg)+'</td></tr>';
      }).join('')+'</tbody></table></div></div></div>';
  return slide(1, 'Weekly Sales & Business Overview',
    'How did we perform this week?'+(sPrev!=null?'  ·  Compared to '+weeks[weeks[sel].prev].label+' ('+money(sPrev)+')':''), sec);
}

/* =====================================================================
   SLIDE 2 — Detailed Sales Performance
   ===================================================================== */
function sales_series(n){
  var arr = [];
  for(var i=order.length-1;i>=0 && arr.length<n;i--){
    var wk=weeks[order[i]];
    arr.push({l:wk.label, v:wk.sales.total||0});   // latest first (top of chart)
  }
  return arr;
}
function s2(){
  var c = cur(), s = c.sales, p = prevWeek();
  var sPrev = p?p.sales.total:null;
  var kw = s.byChannel||{};
  var krow = '<div class="kpis">'+
    kpi('Weekly Sales', money(s.total), 'this week'+ (sPrev!=null? ' · '+delta(s.total,sPrev,{fmt:moneyS,invert:false}):''), 'accent')+
    kpi('Orders', num(s.orders), 'avg '+money(s.avg||0))+
    kpi('Inbound', money(kw.Inbound?kw.Inbound.amt:0), (kw.Inbound?num(kw.Inbound.orders)+' orders':'') )+
    kpi('SMS Callback', money(kw['SMS CB']?kw['SMS CB'].amt:0), (kw['SMS CB']?num(kw['SMS CB'].orders)+' orders':'') )+'</div>';
  var tr = sales_series(5);
  var body = krow +
    '<div class="cols"><div class="col"><h3>📈 Weekly Sales Trend (last '+tr.length+' weeks)</h3>'+bars(tr,'#E8578E',money)+
      '<h3 style="margin-top:10px">🏆 Top Sellers</h3>'+bars((s.byAgent||[]).map(function(a){return {l:a.a,v:a.amt};}),'#B99BDD',money)+'</div>'+
    '<div class="col"><h3>🛍 Products</h3>'+bars((s.byBrand||[]).map(function(b){return {l:b.b,v:b.amt};}),'#4E9BE5',money)+'</div></div>';
  return slide(2,'Detailed Sales Performance','Week-over-week sales, channels, products & sellers', body);
}

/* =====================================================================
   SLIDE 3 — IVR Branch Performance  (top 5 per channel, no chips)
   ===================================================================== */
function s3(){
  function ivrBlock(ch){
    var cv = cur().call[ch]||{};
    var top = (cv.ivr||[]).slice(0,5);
    var stacked = top.map(function(x){ return {l:x.branch, a:x.answered, b:x.abandoned}; });
    var share = top.map(function(x){ return {l:x.branch, v:x.total}; });
    return '<div class="col"><h3>'+esc(ch)+' IVR — Top 5</h3>'+
      '<div class="small" style="flex:none">Answered vs Abandoned by IVR Branch</div>'+stackedBars(stacked,'#E8578E','#B99BDD')+
      '<div class="small" style="flex:none">Branch Share</div>'+donut(share,['#E8578E','#B99BDD','#4E9BE5','#7FCBA6','#F0A579'])+'</div>';
  }
  return slide(3,'IVR Branch Performance','Top 5 IVR branches — answered vs abandoned & share',
    '<div class="cols">'+ivrBlock('OHA')+ivrBlock('NON-OHA')+'</div>');
}

function s4(){
  var c = cur(), p = prevWeek();
  var bd = c.call.breakdown||{};
  var pbd = p && p.call.breakdown ? p.call.breakdown : null;
  var oha = bd.oha||{}, nonoha = bd.nonoha||{};
  var ohaDrivers = (oha.topDrivers||[]).map(function(x){ return {l:x.k, v:x.count}; });
  var nonohaDrivers = (nonoha.topDrivers||[]).map(function(x){ return {l:x.k, v:x.count}; });
  var krow = '<div class="kpis">'+
    kpi('Total Tickets', num(bd.totalTickets||0), pbd?delta(bd.totalTickets||0,pbd.totalTickets||0,{fmt:function(d){return (d>0?'+':'-')+num(Math.abs(d));},invert:false}):'')+
    kpi('OHA Tickets', num(oha.tickets||0), bd.totalTickets? Math.round(oha.tickets/bd.totalTickets*100)+'% of total':'')+
    kpi('Non-OHA Tickets', num(nonoha.tickets||0), bd.totalTickets? Math.round(nonoha.tickets/bd.totalTickets*100)+'% of total':'')+
    kpi('Refund Tickets', num(bd.refundTickets||0), pbd?delta(bd.refundTickets||0,pbd.refundTickets||0,{fmt:function(d){return (d>0?'+':'-')+num(Math.abs(d));},invert:true}):'')+'</div>';
  var body = krow + '<div class="cols">'+
    '<div class="col"><h3><span class="dot" style="background:#E8578E"></span>OHA Top Call Drivers</h3>'+bars(ohaDrivers,'#E8578E',num)+'</div>'+
    '<div class="col"><h3><span class="dot" style="background:#4E9BE5"></span>Non-OHA Top Call Drivers</h3>'+bars(nonohaDrivers,'#4E9BE5',num)+'</div></div>';
  return slide(4,'Call Breakdown','Why customers contacted us this week', body);
}

/* =====================================================================
   SLIDE 5 — Refund Overview  (per channel + by brand)
   ===================================================================== */
function s5(){
  var c = cur(), p = prevWeek();
  var bd = c.call.breakdown||{};
  var pbd = p && p.call.breakdown ? p.call.breakdown : null;
  var oha = bd.oha||{}, nonoha = bd.nonoha||{};
  var poha = pbd && pbd.oha ? pbd.oha : null, pnon = pbd && pbd.nonoha ? pbd.nonoha : null;
  var ohaReasons = (oha.topRefundReason||[]).map(function(x){ return {l:x.k, v:x.refund, vs:num(x.count)+' tk'}; });
  var nonohaReasons = (nonoha.topRefundReason||[]).map(function(x){ return {l:x.k, v:x.refund, vs:num(x.count)+' tk'}; });
  var krow = '<div class="kpis">'+
    kpi('OHA Tickets', num(oha.tickets||0), '')+
    kpi('OHA Refund Tickets', num(oha.refundTickets||0), '')+
    kpi('Non-OHA Tickets', num(nonoha.tickets||0), '')+
    kpi('Non-OHA Refund Tickets', num(nonoha.refundTickets||0), '')+
    kpi('OHA Refunded', money(oha.refundAmount||0), poha?delta(oha.refundAmount||0,poha.refundAmount||0,{fmt:moneyS,invert:true}):'')+
    kpi('Non-OHA Refunded', money(nonoha.refundAmount||0), pnon?delta(nonoha.refundAmount||0,pnon.refundAmount||0,{fmt:moneyS,invert:true}):'')+'</div>';
  var body = krow + '<div class="cols">'+
    '<div class="col"><h3><span class="dot" style="background:#E8578E"></span>OHA Top Refund Reasons</h3>'+bars(ohaReasons,'#E8578E',money)+'</div>'+
    '<div class="col"><h3><span class="dot" style="background:#4E9BE5"></span>Non-OHA Top Refund Reasons</h3>'+bars(nonohaReasons,'#4E9BE5',money)+'</div></div>'+
    '<div class="col" style="flex:1"><h3>🏷 Top Refund Reason per Brand</h3>'+
    '<div class="scrollbox"><table><thead><tr><th>Brand</th><th>Refunded</th><th>Tickets</th><th>Top Reason</th></tr></thead><tbody>'+
    (bd.byBrand||[]).map(function(x){ return '<tr><td>'+esc(x.brand)+'</td><td>'+money(x.refund)+'</td><td>'+num(x.tickets)+'</td><td>'+esc(x.topReason)+'</td></tr>'; }).join('')+
    '</tbody></table></div></div>';
  return slide(5,'Refund Overview','Refund tickets, amounts & top reasons per channel', body);
}

/* =====================================================================
   SLIDE 6 — Week-over-Week Refund Trends
   ===================================================================== */
function refund_series(n){
  var arr = [];
  for(var i=order.length-1;i>=0 && arr.length<n;i--){
    var wk = weeks[order[i]];
    var ref = wk.call && wk.call.breakdown ? wk.call.breakdown.refundAmount : 0;
    arr.unshift({l:wk.label, v:ref||0});
  }
  return arr;
}
function s6(){
  var c = cur(), p = prevWeek();
  var bd = c.call.breakdown||{}, pbd = p && p.call.breakdown ? p.call.breakdown : null;
  var tr = refund_series(8);
  var hi = tr.reduce(function(a,b){ return (b.v>a.v)?b:a; }, tr[0]||{v:0});
  var rows = '<div class="kpis">'+
    kpi('Refund $ — now', money(bd.refundAmount||0), pbd?'vs '+money(pbd.refundAmount||0):'','accent')+
    kpi('Refund Tickets', num(bd.refundTickets||0), pbd?'vs '+num(pbd.refundTickets||0):'')+
    kpi('Highest Refund Week', hi.l? '<span style="font-size:14px">'+esc(hi.l)+'</span>':'—', hi.v? money(hi.v):'')+'</div>';
  var body = rows + '<div class="col" style="flex:1"><h3>📈 Refund Trend — refunded amount, last '+tr.length+' weeks</h3>'+bars(tr,'#D9455F',money)+'</div>';
  return slide(6,'Week-over-Week Refund Trends','Refunded amount across recent weeks', body,
    'Green = fewer refunds (good).');
}

/* =====================================================================
   SLIDE 7 — Team Weekly Performance  (per-line call stats + WoW + prev chips)
   ===================================================================== */
function ahtToSec(s){ if(!s) return null; var p=s.split(':'); return (+p[0])*3600+(+p[1])*60+(+p[2]||0); }
function secToAht(sec){ sec=Math.round(sec||0); var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return (h?h+':':'')+(m<10&&h?'0':'')+m+':'+(s<10?'0':'')+s; }
function s7(){
  var t = cur().team||{}, pt = prevWeek()?prevWeek().team:null;
  var rows = t.rank||[];
  var top = rows[0];
  var cs = t.callStats||[], pcs = pt?pt.callStats:[];
  function avgPick(arr){ if(!arr.length) return null; return arr.reduce(function(a,b){return a+(b.pickupRate||0);},0)/arr.length; }
  function avgAht(arr){ var secs=arr.map(function(b){return ahtToSec(b.aht);}).filter(function(x){return x!=null;}); if(!secs.length) return null; return secs.reduce(function(a,b){return a+b;},0)/secs.length; }
  var ap=avgPick(cs), apP=avgPick(pcs), aa=avgAht(cs), aaP=avgAht(pcs);
  var krow = '<div class="kpis">'+
    kpi('Agents', num(t.count||0), 'this week')+
    kpi('Team Avg Score', (t.avgOverall||0)+'%', 'week total / 100','accent')+
    kpi('Top Performer', top?'<span style="font-size:16px">'+esc(top.a)+'</span>':'—', top? (top.total+'% this week') : '')+
    kpi('Avg Pick Up', ap!=null? ap.toFixed(1)+'%':'—', apP!=null? delta(ap,apP,{fmt:function(d){return pctS(d);},invert:false}):'')+
    kpi('Avg AHT', aa!=null? secToAht(aa):'—', aaP!=null? delta(aa,aaP,{fmt:function(d){return (d>0?'+':'-')+Math.abs(d).toFixed(0)+'s';},invert:true}):'')+'</div>';
  var chips = '<div class="chiprow">'+
    '<span class="pill pink">Prev Week Pick Up: '+(apP!=null? apP.toFixed(1)+'%':'—')+'</span>'+
    '<span class="pill blue">Prev Week Avg AHT: '+(aaP!=null? secToAht(aaP):'—')+'</span></div>';
  var pcsMap = {}; pcs.forEach(function(x){ pcsMap[x.a]=x; });
  var tr = '<tr><th>Rank</th><th>Agent</th><th>Overall</th><th>Pick Up %</th><th>Δ</th><th>AHT</th><th>Δ</th><th>Attempts</th></tr>';
  var tb = rows.map(function(r,i){
    var cs2=r.calls||{}; var pc=pcsMap[r.a]||{};
    var pu = cs2.pickupRate!=null? cs2.pickupRate+'%':'—';
    var puD = (cs2.pickupRate!=null && pc.pickupRate!=null)? delta(cs2.pickupRate,pc.pickupRate,{fmt:function(d){return pctS(d);},invert:false}):'';
    var aht = cs2.aht? esc(cs2.aht):'—';
    var ahtD = (cs2.aht && pc.aht)? delta(ahtToSec(cs2.aht),ahtToSec(pc.aht),{fmt:function(d){return (d>0?'+':'-')+Math.abs(d).toFixed(0)+'s';},invert:true}):'';
    return '<tr><td>'+(i+1)+'</td><td>'+esc(r.a)+'</td><td><b>'+r.total+'%</b></td>'+
      '<td>'+pu+'</td><td>'+puD+'</td><td>'+aht+'</td><td>'+ahtD+'</td>'+
      '<td>'+(cs2.attempts?num(cs2.attempts):'—')+'</td></tr>';
  }).join('') || '<tr><td colspan="8" class="small">No scorecard for this week.</td></tr>';
  var body = krow + chips + '<div class="scrollbox"><table><thead>'+tr+'</thead><tbody>'+tb+'</tbody></table></div>'+
    '<div class="small">Overall = TOTAL SCORE (out of 100). Δ = change vs previous week. Green = better (pickup up, AHT down).</div>';
  return slide(7,'Team Weekly Performance','Individual CSR scorecards & call productivity','<div style="display:flex;flex-direction:column;gap:16px;min-height:0;flex:1">'+body+'</div>');
}

/* =====================================================================
   SLIDE 8 — Scorecard Record  (raw scores, top performer standout)
   ===================================================================== */
function s8(){
  var t = cur().team||{};
  var rows = t.rank||[];
  var top = rows[0];
  var krow = '<div class="kpis">'+
    kpi('Top Performing CSR', top?'<span style="font-size:20px">'+esc(top.a)+'</span>':'—', top? (top.total+'% this week'):'','accent')+
    kpi('Team Avg Score', (t.avgOverall||0)+'%', 'week total / 100')+'</div>';
  var tr = '<tr><th>Rank</th><th>Agent</th><th>Attendance</th><th>Quality</th><th>Productivity</th><th>Work Ethic</th><th>Overall</th><th>TOTAL</th></tr>';
  var tb = rows.map(function(r,i){
    var hl = (i===0)?' style="background:#FFF0F6"':'';
    return '<tr'+hl+'><td>'+(i+1)+'</td><td>'+esc(r.a)+'</td>'+
      '<td>'+(r.att!=null?r.att+'%':'—')+'</td>'+
      '<td>'+(r.qual!=null?r.qual+'%':'—')+'</td>'+
      '<td>'+(r.prod!=null?r.prod+'%':'—')+'</td>'+
      '<td>'+(r.we!=null?r.we+'%':'—')+'</td>'+
      '<td>'+(r.pct!=null?r.pct+'%':'—')+'</td>'+
      '<td><b>'+r.total+'%</b></td></tr>';
  }).join('') || '<tr><td colspan="8" class="small">No scorecard for this week.</td></tr>';
  var body = krow + '<div class="scrollbox"><table><thead>'+tr+'</thead><tbody>'+tb+'</tbody></table></div>'+
    '<div class="small">Scores as recorded in the Weekly Scorecard (not capped). Top performer highlighted.</div>';
  return slide(8,'Scorecard Record','All CSR scores this week','<div style="display:flex;flex-direction:column;gap:16px;min-height:0;flex:1">'+body+'</div>');
}

/* =====================================================================
   SLIDE 9 — Back Office Hours
   ===================================================================== */
function s9(){
  var bo = (cur().call && cur().call.backOffice) || [];
  var total = bo.reduce(function(a,b){return a+b.hrs;},0);
  var rows = bo.map(function(b){ return {l:b.a, v:b.hrs}; });
  var krow = '<div class="kpis">'+
    kpi('Agents (back office)', num(bo.length), 'this week')+
    kpi('Total Back-Office Hours', num(Math.round(total*10)/10)+' h', 'all agents','accent')+
    kpi('Avg per Agent', bo.length? (Math.round(total/bo.length*10)/10)+' h':'0 h', 'active this week')+'</div>';
  var body = krow + '<div class="col" style="flex:1"><h3>🕐 Back-Office Hours by Agent</h3>'+
    (rows.length?'':'<div class="small" style="padding:12px">No back-office activity recorded this week.</div>')+
    bars(rows,'#B99BDD',function(v){return v+' h';})+'</div>';
  return slide(9,'Back Office Hours','Individual agent back-office time','<div style="display:flex;flex-direction:column;gap:16px;min-height:0;flex:1">'+body+'</div>');
}

var SLIDES = [s1,s2,s3,s4,s5,s6,s7,s8,s9];

/* ---------- nav ---------- */
function render(){
  if(!sel){ document.getElementById('deck').innerHTML='<div class="small" style="padding:40px">No report data loaded.</div>'; return; }
  si = Math.max(0, Math.min(si, SLIDES.length-1));
  var holder = document.getElementById('deck');
  holder.innerHTML = SLIDES[si]();
  var act = holder.querySelector('.slide'); if(act) act.classList.add('active');
  var dots = document.getElementById('dots');
  if(dots){
    dots.innerHTML = SLIDES.map(function(f,i){
      return '<span class="dot'+(i===si?' on':'')+'" data-i="'+i+'" title="Slide '+(i+1)+'"></span>';
    }).join('');
    dots.querySelectorAll('.dot').forEach(function(d){ d.onclick=function(){ si=+d.getAttribute('data-i'); render(); }; });
  }
}
function goTo(i){ si = Math.max(0, Math.min(SLIDES.length-1, i)); render(); }
/* exposed for png-export.js */
window.__goTo = goTo;
window.__slideCount = function(){ return SLIDES.length; };
function next(){ goTo(si+1); }
function prev(){ goTo(si-1); }

/* ---------- wire ---------- */
window.addEventListener('DOMContentLoaded', function(){
  var selEl = document.getElementById('weekSel');
  selEl.innerHTML = order.slice().reverse().map(function(w){
    return '<option value="'+w+'"'+(w===sel?' selected':'')+'>'+esc(weeks[w].label)+'</option>';
  }).join('');
  selEl.onchange = function(){ sel = selEl.value; si=0; render(); };
  document.getElementById('btnPrint').onclick = function(){ window.print(); };
  document.getElementById('btnFull').onclick = function(){
    if(document.fullscreenElement){ document.exitFullscreen(); } else { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(function(){}); }
  };
  document.addEventListener('keydown', function(e){
    if(e.target && e.target.tagName==='SELECT') return;
    if(e.key==='ArrowRight'||e.key==='PageDown'){ next(); }
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){ prev(); }
    else if(e.key==='Home'){ goTo(0); }
    else if(e.key==='End'){ goTo(SLIDES.length-1); }
  });
  document.getElementById('deck').addEventListener('click', function(e){
    if(e.target.closest('.dot') || e.target.closest('.foot') || e.target.closest('table') || e.target.closest('.scrollbox')) return;
    var r = document.getElementById('deck').getBoundingClientRect();
    if(e.clientX > r.left + r.width*0.55){ next(); } else { prev(); }
  });
  render();
});

})();