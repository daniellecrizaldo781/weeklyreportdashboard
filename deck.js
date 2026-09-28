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

function value(v,fmt){ return fmt?fmt(v):num(v); }
function ahtToSec(s){ if(!s) return null; var p=s.split(':'); return (+p[0])*3600+(+p[1])*60+(+p[2]||0); }
function secToAht(sec){ sec=Math.round(sec||0); var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return (h?h+':':'')+(m<10&&h?'0':'')+m+':'+(s<10?'0':'')+s; }

function bars(rows, color, valFmt, valClass){
  if(!rows || !rows.length) return '<div class="small" style="padding:10px">No data for this week.</div>';
  var max = Math.max.apply(null, rows.map(function(r){ return r.v||0; }));
  var out = '<div class="bars">';
  rows.forEach(function(r){
    var w = max>0 ? Math.max(4, (r.v/max)*100) : 0;
    var vs = r.vs||'';
    out += '<div class="bar-row"><div class="bar-lbl" title="'+esc(r.l)+'">'+esc(r.l)+'</div>'+
      '<div class="bar-track"><div class="bar-fill" style="width:'+w+'%;background:'+color+'"></div></div>'+
      '<div class="bar-val'+(valClass?' '+valClass:'')+'">'+value(r.v,valFmt)+' <span class="small">'+vs+'</span></div></div>';
  });
  return out + '</div>';
}

function vBars(rows, color, valFmt){
  if(!rows || !rows.length) return '<div class="small" style="padding:10px">No data for this week.</div>';
  var max = Math.max.apply(null, rows.map(function(r){ return r.v||0; }));
  var out = '<div class="vbars">';
  rows.forEach(function(r){
    var h = max>0 ? Math.max(6, (r.v/max)*100) : 0;
    out += '<div class="vbar"><div class="vbar-val">'+value(r.v,valFmt)+'</div>'+
      '<div class="vbar-track"><div class="vbar-fill" style="height:'+h+'%;background:'+color+'"></div></div>'+
      '<div class="vbar-lbl" title="'+esc(r.l)+'">'+esc(r.l)+'</div></div>';
  });
  return out + '</div>';
}

function comboChart(rows, color, valFmt){
  if(!rows || !rows.length) return '<div class="small" style="padding:10px">No data for this week.</div>';
  var max = Math.max.apply(null, rows.map(function(r){ return r.v||0; }));
  var n = rows.length, stepW = 100/n;
  var cols=[], pts=[];
  for(var i=0;i<n;i++){
    var r=rows[i];
    var h = max>0 ? Math.max(2,(r.v/max)*100) : 0;
    var cx = (i*stepW)+(stepW/2);
    var topY = 100-h;
    pts.push(cx.toFixed(2)+','+topY.toFixed(2));
    var d='';
    if(i>0){
      var pv=rows[i-1].v||0, cv=r.v||0, dd=cv-pv;
      var ddcls=dd>0?'up':(dd<0?'down':'flat');
      d = dd!==0 ? '<span class="cb-delta '+ddcls+'">'+(dd>0?'&#9650;':'&#9660;')+' '+value(Math.abs(dd),valFmt)+'</span>' : '<span class="cb-delta flat">&#8226;</span>';
    }
    cols.push(
      '<div class="ct">'+
        '<div class="ct-delta">'+d+'</div>'+
        '<div class="ct-track">'+
          '<div class="ct-bar" style="height:'+h.toFixed(1)+'%;background:'+color+'"></div>'+
          '<span class="ct-val" style="bottom:calc('+h.toFixed(1)+'% + 2px)">'+value(r.v,valFmt)+'</span>'+
        '</div>'+
      '</div>');
  }
  var line='<polyline points="'+pts.join(' ')+'" fill="none" stroke="#3A2A33" stroke-width="2.5" stroke-linejoin="round"/>';
  var dots=pts.map(function(p){ var xy=p.split(','); return '<circle cx="'+xy[0]+'" cy="'+xy[1]+'" r="1.7" fill="#3A2A33"/>'; }).join('');
  var weeks=rows.map(function(r){ return '<div class="cw" title="'+esc(r.l)+'">'+esc(r.l)+'</div>'; }).join('');
  return '<div class="combo">'+
    '<div class="combo-plot">'+
      '<div class="combo-trax">'+cols.join('')+'</div>'+
      '<svg class="combo-line" viewBox="0 0 100 100" preserveAspectRatio="none">'+line+dots+'</svg>'+
    '</div>'+
    '<div class="combo-weeks">'+weeks+'</div>'+
    '</div>';
}function stackedBars(rows, colorA, colorB){
  if(!rows || !rows.length) return '<div class="small" style="padding:10px">No data.</div>';
  var max = Math.max.apply(null, rows.map(function(r){ return (r.a||0)+(r.b||0); }));
  var out = '<div class="bars">';
  rows.forEach(function(r){
    var tot=(r.a||0)+(r.b||0);
    var wa=max>0?(r.a||0)/max*100:0, wb=max>0?(r.b||0)/max*100:0;
    out += '<div class="bar-row"><div class="bar-lbl" title="'+esc(r.l)+'">'+esc(r.l)+'</div>'+
      '<div class="bar-track" style="display:flex">'+
        '<div class="bar-fill" style="width:'+wa+'%;background:'+colorA+';border-radius:8px 0 0 8px">'+(r.a>0?'<span class="seg-count">'+num(r.a)+'</span>':'')+'</div>'+
        '<div class="bar-fill" style="width:'+wb+'%;background:'+colorB+';border-radius:0 8px 8px 0">'+(r.b>0?'<span class="seg-count">'+num(r.b)+'</span>':'')+'</div>'+
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

function sales_series(n){
  var arr = [];
  var startIdx = order.indexOf(sel); if(startIdx<0) startIdx=order.length-1;
  for(var i=startIdx;i>=0 && arr.length<n;i--){
    var wk=weeks[order[i]];
    arr.push({l:wk.label, v:wk.sales.total||0});   // latest first (top of chart)
  }
  return arr;
}
function refund_series(n){
  var arr = [];
  var startIdx = order.indexOf(sel); if(startIdx<0) startIdx=order.length-1;
  for(var i=startIdx;i>=0 && arr.length<n;i--){
    var wk = weeks[order[i]];
    var ref = wk.call && wk.call.breakdown ? wk.call.breakdown.refundAmount : 0;
    arr.unshift({l:wk.label, v:ref||0});           // oldest first (left of chart)
  }
  return arr;
}
function weeklyTopSellers(n){
  var arr = [];
  var startIdx = order.indexOf(sel); if(startIdx<0) startIdx=order.length-1;
  for(var i=startIdx;i>=0 && arr.length<n;i--){
    var wk = weeks[order[i]];
    var agents = (wk.sales && wk.sales.byAgent) || [];
    var top = agents.reduce(function(a,b){ return (b.amt>a.amt)?b:a; }, {a:'—', amt:0});
    arr.push({week: wk.label, seller: top.a, amt: top.amt});
  }
  return arr;
}

function slide(num, title, sub, bodyHtml, note){
  var wb = sel ? '<span class="weekbadge">'+esc(weeks[sel].label)+'</span>' : '';
  return '<section class="slide"><div class="shead">'+
    '<div class="snum">'+num+'</div><div><div class="stitle">'+esc(title)+'</div>'+
    '<div class="ssub">'+esc(sub||'')+'</div></div>'+wb+'</div>'+
    '<div class="sbody">'+bodyHtml+'</div>'+
    (note?'<div class="snote">'+note+'</div>':'')+
    '<div class="foot"><div class="small">Danielle Ann Mari Crizaldo Weekly report</div>'+
    '<div class="nvg"><span class="dots" id="dots"></span></div></div></section>';
}

/* ================= SLIDE 1 — Weekly Sales & Business Overview ================= */
function s1(){
  var c = cur(), p = prevWeek(), s = c.sales;
  var sPrev = p ? (p.sales.total||0) : null;
  var dCh = s.byChannel || {};
  var kw = dCh;
  var chanPills = Object.keys(dCh).map(function(ch){
    var o = dCh[ch];
    var pillCls = /inbound/i.test(ch) ? 'pink' : 'blue';
    return '<span class="pill '+pillCls+'"><span class="sw" style="background:'+(pillCls==='pink'?'#E8578E':'#4E9BE5')+'"></span>'+
      esc(ch)+' &nbsp;<b>'+money(o.amt)+'</b> &middot; '+num(o.orders)+' orders</span>';
  }).join('') || '<span class="small">No channel data</span>';
  var topBrand = (s.byBrand||[]).slice(0,3).map(function(b){ return {l:b.b, v:b.amt}; });
  var curWk = weeks[sel];
  var prevWk = weeks[sel] && weeks[sel].prev ? weeks[weeks[sel].prev] : null;
  function top3(wk){ return ((wk && wk.sales && wk.sales.byAgent)||[]).slice(0,3).map(function(a){ return {seller:a.a, amt:a.amt}; }); }
  var curTop = top3(curWk);
  var prevTop = prevWk ? top3(prevWk) : [];
  var tr = sales_series(5);
  var hero =
    '<div class="hero"><div class="lbl">Weekly Sales</div>'+
    '<div class="herorow"><div class="heroL">'+
      '<div class="bigv">'+money(s.total)+' <small>/ '+num(s.orders)+' orders</small></div>'+
      '<div class="sub" style="margin-top:6px">Avg order '+money(s.avg)+
               (sPrev!=null ? ' &middot; Prev week '+money(sPrev)+' '+delta(s.total, sPrev, {fmt:function(d){return moneyS(d)+' ('+pctS(sPrev?d/sPrev*100:0)+')';}, invert:false}) : '<span class="small">first week</span>')+
            '</div></div>'
      '<div class="heroR">'+chanPills+'</div></div></div>';
  var krow = '<div class="kpis">'+
    kpi('Orders', num(s.orders), 'avg '+money(s.avg||0))+
    kpi('Inbound', money(kw.Inbound?kw.Inbound.amt:0), (kw.Inbound?num(kw.Inbound.orders)+' orders':''), 'tot')+
    kpi('SMS Callback', money(kw['SMS CB']?kw['SMS CB'].amt:0), (kw['SMS CB']?num(kw['SMS CB'].orders)+' orders':''), 'blue')+'</div>';
  var sec =
    '<div class="hero">'+hero+'</div>'+krow+
    '<div class="cols"><div class="col"><h3>📈 Weekly Sales Trend (last '+tr.length+' weeks)</h3>'+bars(tr,'#E8578E',money)+
      '<h3 style="margin-top:10px">💼 Sales by Channel</h3>'+
      '<div class="scrollbox"><table><thead><tr><th>Channel</th><th>Sales</th><th>Orders</th><th>Avg</th></tr></thead><tbody>'+
      Object.keys(dCh).map(function(ch){
        var o=dCh[ch]; var avg=o.orders?o.amt/o.orders:0;
        return '<tr><td>'+esc(ch)+'</td><td>'+money(o.amt)+'</td><td>'+num(o.orders)+'</td><td>'+money(avg)+'</td></tr>';
      }).join('')+'</tbody></table></div></div>'+
    '<div class="col"><h3>★ Top Selling Products</h3>'+bars(topBrand,'#E8578E',money)+
      '<h3 style="margin-top:10px">🏆 Weekly Top Sellers</h3>'+
      '<div class="scrollbox"><table><thead><tr><th>Week</th><th>#1</th><th>#2</th><th>#3</th></tr></thead><tbody>'+
      '<tr><td>'+esc(curWk.label)+'</td>'+curTop.map(function(s){ return '<td>'+esc(s.seller)+'<br><span class="small">'+money(s.amt)+'</span></td>'; }).join('')+'</tr>'+
      (prevWk ? '<tr><td>'+esc(prevWk.label)+'</td>'+prevTop.map(function(s){ return '<td>'+esc(s.seller)+'<br><span class="small">'+money(s.amt)+'</span></td>'; }).join('')+'</tr>' : '')+
      '</tbody></table></div></div></div>';
  return slide(1, 'Weekly Sales & Business Overview',
    'How did we perform this week?'+(sPrev!=null?'  ·  Compared to '+weeks[weeks[sel].prev].label+' ('+money(sPrev)+')':''), sec);
}

/* ================= SLIDE 2 — IVR Branch Performance ================= */
function s2(){
  function ivrBlock(ch){
    var cv = cur().call[ch]||{};
    var top = (cv.ivr||[]).slice(0,5);
    var stacked = top.map(function(x){ return {l:x.branch, a:x.answered, b:x.abandoned}; });
    var share = top.map(function(x){ return {l:x.branch, v:x.total}; });
    return '<div class="col"><h3>'+esc(ch)+' IVR — Top 5</h3>'+
      '<div class="small" style="flex:none">Answered vs Abandoned by IVR Branch</div>'+
      '<div class="legend-inline"><span class="li"><span class="sw" style="background:#E8578E"></span>Answered</span><span class="li"><span class="sw" style="background:#B99BDD"></span>Abandoned</span></div>'+
      stackedBars(stacked,'#E8578E','#B99BDD')+
      '<div class="small" style="flex:none">Branch Share</div>'+donut(share,['#E8578E','#B99BDD','#4E9BE5','#7FCBA6','#F0A579'])+'</div>';
  }
  return slide(2,'IVR Branch Performance','Top 5 IVR branches — answered vs abandoned & share',
    '<div class="cols ivr">'+ivrBlock('OHA')+ivrBlock('NON-OHA')+'</div>');
}

/* ================= SLIDE 3 — Call Breakdown ================= */
function s3(){
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
  return slide(3,'Call Breakdown','Why customers contacted us this week', body);
}

/* ================= SLIDE 4 — Refund Overview ================= */
function s4(){
  var c = cur(), p = prevWeek();
  var bd = c.call.breakdown||{};
  var pbd = p && p.call.breakdown ? p.call.breakdown : null;
  var oha = bd.oha||{}, nonoha = bd.nonoha||{};
  var poha = pbd && pbd.oha ? pbd.oha : null, pnon = pbd && pbd.nonoha ? pbd.nonoha : null;
  var ohaReasons = (oha.topRefundReason||[]).slice(0,4).map(function(x){ return {l:x.k, v:x.refund, vs:num(x.count)+' '+(x.count===1?'ticket':'tickets')}; });
  var nonohaReasons = (nonoha.topRefundReason||[]).slice(0,4).map(function(x){ return {l:x.k, v:x.refund, vs:num(x.count)+' '+(x.count===1?'ticket':'tickets')}; });
  var krow = '<div class="kpis">'+
    kpi('OHA Tickets', num(oha.tickets||0), '', 'tot')+
    kpi('OHA Refund Tickets', num(oha.refundTickets||0), '', 'tot')+
    kpi('Non-OHA Tickets', num(nonoha.tickets||0), '', 'blue')+
    kpi('Non-OHA Refund Tickets', num(nonoha.refundTickets||0), '', 'blue')+
    kpi('OHA Refunded', money(oha.refundAmount||0), poha? 'Prev '+money(poha.refundAmount||0)+' &middot; '+delta(oha.refundAmount||0,poha.refundAmount||0,{fmt:moneyS,invert:true}):'', 'tot')+
    kpi('Non-OHA Refunded', money(nonoha.refundAmount||0), pnon? 'Prev '+money(pnon.refundAmount||0)+' &middot; '+delta(nonoha.refundAmount||0,pnon.refundAmount||0,{fmt:moneyS,invert:true}):'', 'blue')+'</div>';
  var body = krow + '<div class="cols">'+
    '<div class="col"><h3><span class="dot" style="background:#E8578E"></span>OHA Top Refund Reasons</h3>'+bars(ohaReasons,'#E8578E',money,'hl')+'</div>'+
    '<div class="col"><h3><span class="dot" style="background:#4E9BE5"></span>Non-OHA Top Refund Reasons</h3>'+bars(nonohaReasons,'#4E9BE5',money,'hl')+'</div></div>'+
    '<div class="col" style="flex:1"><h3>🏷 Top Refund Reason per Brand</h3>'+
    '<div class="scrollbox"><table><thead><tr><th>Brand</th><th>Refunded</th><th>Tickets</th><th>Top Reason</th></tr></thead><tbody>'+
    (bd.byBrand||[]).map(function(x){ return '<tr><td>'+esc(x.brand)+'</td><td>'+money(x.refund)+'</td><td>'+num(x.tickets)+'</td><td>'+esc(x.topReason)+'</td></tr>'; }).join('')+
    '</tbody></table></div></div>';
  return slide(4,'Refund Overview','Refund tickets, amounts & top reasons per channel', body);
}

/* ================= SLIDE 5 — Week-over-Week Refund Trends ================= */
function s5(){
  var c = cur(), p = prevWeek();
  var bd = c.call.breakdown||{}, pbd = p && p.call.breakdown ? p.call.breakdown : null;
  var tr = refund_series(4); // 4 weeks, oldest to latest
  var curAmt = bd.refundAmount||0, prevAmt = pbd ? pbd.refundAmount : null;
  var rows = '<div class="kpis">'+
    kpi('Refund $ — now', money(curAmt), prevAmt!=null? 'vs '+money(prevAmt):'','accent')+
    kpi('Refund Tickets', num(bd.refundTickets||0), pbd?'vs '+num(pbd.refundTickets||0):'')+
    kpi('WoW Change', prevAmt!=null? moneyS(curAmt-prevAmt):'—', prevAmt? pctS((curAmt-prevAmt)/prevAmt*100):'')+'</div>';
  var body = rows + '<div class="col" style="flex:1"><h3>📈 Refund Trend — refunded amount, last '+tr.length+' weeks</h3>'+comboChart(tr,'#D9455F',money)+'</div>';
  return slide(5,'Week-over-Week Refund Trends','Refunded amount across recent weeks', body);
}

/* ================= SLIDE 6 — Back Office Hours ================= */
function s6(){
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
  return slide(6,'Back Office Hours','Individual agent back-office time','<div style="display:flex;flex-direction:column;gap:16px;min-height:0;flex:1">'+body+'</div>');
}

/* ================= SLIDE 7 — Team Weekly Performance ================= */
function s7(){
  var t = cur().team||{}, pt = prevWeek()?prevWeek().team:null;
  var rows = t.rank||[];
  var top = rows[0];
  var cs = t.callStats||[], pcs = pt?pt.callStats:[];
  function avgPick(arr){ if(!arr.length) return null; return arr.reduce(function(a,b){return a+(b.pickupRate||0);},0)/arr.length; }
  function avgAht(arr){ var secs=arr.map(function(b){return ahtToSec(b.aht);}).filter(function(x){return x!=null;}); if(!secs.length) return null; return secs.reduce(function(a,b){return a+b;},0)/secs.length; }
  var ap=avgPick(cs), apP=avgPick(pcs), aa=avgAht(cs), aaP=avgAht(pcs);
  var krow = '<div class="kpis">'+
    kpi('Team Avg Score', (t.avgOverall||0)+'%', 'week total / 100','accent')+
    kpi('Top Performer', top?'<span style="font-size:16px">'+esc(top.a)+'</span>':'—', top? (top.total+'% this week') : '')+
    kpi('Avg Pick Up', ap!=null? ap.toFixed(1)+'%':'—', apP!=null? delta(ap,apP,{fmt:function(d){return pctS(d);},invert:false}):'')+
    kpi('Avg AHT', aa!=null? secToAht(aa):'—', aaP!=null? delta(aa,aaP,{fmt:function(d){return (d>0?'+':'-')+Math.abs(d).toFixed(0)+'s';},invert:true}):'')+'</div>';
  var chips = '<div class="chiprow">'+
    '<span class="pill pink">Prev Week Pick Up: '+(apP!=null? apP.toFixed(1)+'%':'—')+'</span>'+
    '<span class="pill blue">Prev Week Avg AHT: '+(aaP!=null? secToAht(aaP):'—')+'</span></div>';
  var tr = '<tr><th>Rank</th><th>Agent</th><th>Ringing Attempts</th><th>Picked Up</th><th>Not Picked</th><th>Pick Up %</th><th>AHT</th></tr>';
  var tb = rows.map(function(r,i){
    var cs2=r.calls||{};
    return '<tr><td>'+(i+1)+'</td><td>'+esc(r.a)+'</td>'+
      '<td>'+(cs2.attempts!=null?num(cs2.attempts):'—')+'</td>'+
      '<td>'+(cs2.pickedUp!=null?num(cs2.pickedUp):'—')+'</td>'+
      '<td>'+(cs2.notPickedUp!=null?num(cs2.notPickedUp):'—')+'</td>'+
      '<td>'+(cs2.pickupRate!=null?cs2.pickupRate+'%':'—')+'</td>'+
      '<td>'+(cs2.aht?esc(cs2.aht):'—')+'</td></tr>';
  }).join('') || '<tr><td colspan="7" class="small">No scorecard for this week.</td></tr>';
  var body = krow + chips + '<div class="scrollbox"><table><thead>'+tr+'</thead><tbody>'+tb+'</tbody></table></div>'+
    '<div class="small">Picked Up = calls answered · Not Picked = calls missed.</div>';
  return slide(7,'Team Weekly Performance','Individual CSR scorecards & call productivity','<div style="display:flex;flex-direction:column;gap:16px;min-height:0;flex:1">'+body+'</div>');
}

/* ================= SLIDE 8 — Scorecard Record ================= */
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

var ALL_SLIDES = [s1,s2,s3,s4,s5,s6,s7,s8];
// Optional slide filter: set window.__REPORT_SLIDES to a 1-based array of slide
// indices to render (e.g. [2,3,4,5,6] to skip slide 1 and the last 2). When unset,
// all 8 slides render. This lets the Call EOD dashboard reuse this same deck.js
// while showing only the call slides, and stay in sync with layout changes here.
var SLIDES = (window.__REPORT_SLIDES && window.__REPORT_SLIDES.length)
  ? window.__REPORT_SLIDES.map(function(i){ return ALL_SLIDES[i-1]; })
  : ALL_SLIDES;

/* ---------- nav ---------- */
function render(){
  if(!sel){ document.getElementById('deck').innerHTML='<div class="small" style="padding:40px">No report data loaded.</div>'; return; }
  si = Math.max(0, Math.min(si, SLIDES.length-1));
  var holder = document.getElementById('deck');
  holder.innerHTML = SLIDES[si]();
  var act = holder.querySelector('.slide'); if(act) act.classList.add('active');
  // renumber the slide badge to its position in the (possibly filtered) deck
  var sn = holder.querySelector('.snum'); if(sn) sn.textContent = (si+1);
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
  var bp=document.getElementById('btnPrev'), bn=document.getElementById('btnNext');
  if(bp) bp.onclick = prev;
  if(bn) bn.onclick = next;
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