/* pptx-export.js — builds an editable .pptx (for Google Slides) from the current week's data. */
(function(){
"use strict";
var R = window.REPORT_DATA || { weeks:{}, weekOrder:[] };
var weeks = R.weeks, order = R.weekOrder || [];
function curWeek(){ var s=document.getElementById('weekSel'); return s?s.value:(order.length?order[order.length-1]:null); }
function cur(){ return weeks[curWeek()] || null; }
function prevWeek(){ var w=weeks[curWeek()]; return w && w.prev ? weeks[w.prev] : null; }

function num(x){ return (x==null?0:x).toLocaleString(); }
function money(x){ x=x||0; return (x<0?'-':'')+'$'+Math.abs(x).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function moneyS(x){ x=x||0; return (x>=0?'+':'-')+'$'+Math.abs(x).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function pctS(x){ x=x||0; return (x>=0?'+':'-')+Math.abs(x).toFixed(1)+'%'; }
function esc(s){ return String(s==null?'':s); }
function ahtToSec(s){ if(!s) return null; var p=s.split(':'); return (+p[0])*3600+(+p[1])*60+(+p[2]||0); }
function secToAht(sec){ sec=Math.round(sec||0); var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return (h?h+':':'')+(m<10&&h?'0':'')+m+':'+(s<10?'0':'')+s; }

var PINK='E8578E', BLUE='4E9BE5', LAV='B99BDD', RED='D9455F', INK='3A2A33', MUT='9A8A92', LINE='F3E3EA', CARD='FFF9FB';

function title(slide, num, t, sub){
  slide.addShape('rect',{x:0,y:0,w:13.33,h:0.9,fill:{color:'FFE6F1'}});
  slide.addText(num,{x:0.3,y:0.18,w:0.5,h:0.5,fontSize:18,bold:true,color:'FFFFFF',align:'center',fill:{color:PINK},shape:'roundRect',rectRadius:0.1});
  slide.addText(t,{x:0.95,y:0.12,w:9,h:0.4,fontSize:20,bold:true,color:INK});
  slide.addText(sub,{x:0.95,y:0.5,w:9,h:0.3,fontSize:10,color:MUT});
  slide.addText(esc(weeks[curWeek()]?weeks[curWeek()].label:''),{x:10.3,y:0.25,w:2.7,h:0.4,fontSize:10,bold:true,color:PINK,align:'center',fill:{color:'FFF3F8'},shape:'roundRect',rectRadius:0.5});
}
function kpi(slide,x,y,w,h,label,value,sub,accent){
  slide.addShape('roundRect',{x:x,y:y,w:w,h:h,fill:{color:accent?'FFE3EF':CARD},line:{color:LINE,width:1},rectRadius:0.08});
  slide.addText(label,{x:x+0.1,y:y+0.06,w:w-0.2,h:0.2,fontSize:8,bold:true,color:MUT});
  slide.addText(value,{x:x+0.1,y:y+0.22,w:w-0.2,h:0.35,fontSize:16,bold:true,color:accent?PINK:INK});
  if(sub) slide.addText(sub,{x:x+0.1,y:y+0.55,w:w-0.2,h:0.2,fontSize:7.5,color:MUT});
}
function barChart(slide,x,y,w,h,labels,values,color,titleTxt){
  slide.addText(titleTxt||'',{x:x,y:y-0.25,w:w,h:0.25,fontSize:10,bold:true,color:INK});
  slide.addChart('bar',[{name:'',labels:labels,values:values}],{x:x,y:y,w:w,h:h,barDir:'bar',barColor:color,chartColors:[color],dataLabelColor:INK,dataLabelFontSize:8,dataLabelPosition:'outEnd',catAxisLabelColor:INK,catAxisLabelFontSize:8,valAxisHidden:true,legendPos:'none'});
}
function doughnut(slide,x,y,w,h,labels,values,colors,titleTxt){
  slide.addText(titleTxt||'',{x:x,y:y-0.25,w:w,h:0.25,fontSize:10,bold:true,color:INK});
  slide.addChart('doughnut',[{name:'',labels:labels,values:values}],{x:x,y:y,w:w,h:h,holeSize:55,chartColors:colors,dataLabelColor:INK,dataLabelFontSize:8,dataLabelPosition:'ctr',legendPos:'r',legendColor:INK,legendFontSize:8});
}
function table(slide,x,y,w,rows,headerFill){
  var hdr = rows[0].map(function(c){ return {text:c,options:{bold:true,color:'FFFFFF',fill:{color:PINK},align:'left'}}; });
  var body = rows.slice(1).map(function(r){ return r.map(function(c){ return {text:String(c),options:{color:INK,align:'left'}}; }); });
  slide.addTable([hdr].concat(body),{x:x,y:y,w:w,colW:rows[0].map(function(){return w/rows[0].length;}),fontSize:8,rowH:0.22,border:{type:'solid',color:LINE,pt:0.5},fill:{color:'FFFFFF'}});
}

function s1(pptx,c,p){
  var s=c.sales, sPrev=p?p.sales.total:null;
  var sl=pptx.addSlide(); title(sl,1,'Weekly Sales & Business Overview','How did we perform this week?');
  sl.addText(money(s.total),{x:0.4,y:1.1,w:4,h:0.7,fontSize:40,bold:true,color:PINK});
  sl.addText(num(s.orders)+' orders · avg '+money(s.avg),{x:0.4,y:1.8,w:4,h:0.3,fontSize:12,color:MUT});
  if(sPrev!=null) sl.addText('vs prev week: '+moneyS(s.total-sPrev)+' ('+pctS(sPrev?((s.total-sPrev)/sPrev*100):0)+')',{x:0.4,y:2.1,w:4,h:0.3,fontSize:11,bold:true,color:(s.total>=sPrev?'2E9E6B':'D9455F')});
  var dCh=s.byChannel||{};
  var chRows=[['Channel','Sales','Orders','Avg']];
  Object.keys(dCh).forEach(function(ch){ var o=dCh[ch]; chRows.push([ch,money(o.amt),num(o.orders),money(o.orders?o.amt/o.orders:0)]); });
  table(sl,5.0,1.1,3.4,chRows);
  var brands=(s.byBrand||[]).slice(0,6), agents=(s.byAgent||[]).slice(0,6);
  barChart(sl,0.4,3.0,5.8,3.6,brands.map(function(b){return b.b;}),brands.map(function(b){return b.amt;}),PINK,'Top Selling Products');
  barChart(sl,6.6,3.0,6.2,3.6,agents.map(function(a){return a.a;}),agents.map(function(a){return a.amt;}),LAV,'Top Sellers (by value)');
}
function s2(pptx,c,p){
  var s=c.sales, sPrev=p?p.sales.total:null, kw=s.byChannel||{};
  var sl=pptx.addSlide(); title(sl,2,'Detailed Sales Performance','Week-over-week sales, channels, products & sellers');
  kpi(sl,0.4,1.1,2.4,0.9,'Weekly Sales',money(s.total),sPrev!=null?moneyS(s.total-sPrev):'',true);
  kpi(sl,2.9,1.1,2.4,0.9,'Orders',num(s.orders),'avg '+money(s.avg||0));
  kpi(sl,5.4,1.1,2.4,0.9,'Inbound',money(kw.Inbound?kw.Inbound.amt:0),kw.Inbound?num(kw.Inbound.orders)+' orders':'');
  kpi(sl,7.9,1.1,2.4,0.9,'SMS Callback',money(kw['SMS CB']?kw['SMS CB'].amt:0),kw['SMS CB']?num(kw['SMS CB'].orders)+' orders':'');
  var tr=[]; for(var i=order.length-1;i>=0&&tr.length<5;i--){ var wk=weeks[order[i]]; tr.push({l:wk.label,v:wk.sales.total||0}); }
  barChart(sl,0.4,2.4,6.2,4.6,tr.map(function(x){return x.l;}),tr.map(function(x){return x.v;}),PINK,'Weekly Sales Trend (last 5 weeks)');
  barChart(sl,6.9,2.4,6.0,2.2,(s.byAgent||[]).slice(0,6).map(function(a){return a.a;}),(s.byAgent||[]).slice(0,6).map(function(a){return a.amt;}),LAV,'Top Sellers');
  barChart(sl,6.9,4.8,6.0,2.2,(s.byBrand||[]).slice(0,6).map(function(b){return b.b;}),(s.byBrand||[]).slice(0,6).map(function(b){return b.amt;}),BLUE,'Products');
}
function s3(pptx,c){
  var sl=pptx.addSlide(); title(sl,3,'IVR Branch Performance','Top 5 IVR branches — answered vs abandoned & share');
  function block(ch,x){
    var cv=c.call[ch]||{}, top=(cv.ivr||[]).slice(0,5);
    sl.addText(ch+' IVR — Top 5',{x:x,y:1.05,w:6,h:0.3,fontSize:12,bold:true,color:INK});
    barChart(sl,x,1.5,6.2,2.6,top.map(function(b){return b.branch;}),top.map(function(b){return b.answered;}),PINK,'Answered');
    barChart(sl,x,4.3,6.2,2.6,top.map(function(b){return b.branch;}),top.map(function(b){return b.abandoned;}),LAV,'Abandoned');
  }
  block('OHA',0.4); block('NON-OHA',6.8);
}
function s4(pptx,c,p){
  var bd=c.call.breakdown||{}, pbd=p&&p.call.breakdown?p.call.breakdown:null;
  var oha=bd.oha||{}, nonoha=bd.nonoha||{};
  var sl=pptx.addSlide(); title(sl,4,'Call Breakdown','Why customers contacted us this week');
  kpi(sl,0.4,1.1,2.4,0.9,'Total Tickets',num(bd.totalTickets||0),pbd?moneyS(bd.totalTickets-pbd.totalTickets):'');
  kpi(sl,2.9,1.1,2.4,0.9,'OHA Tickets',num(oha.tickets||0),bd.totalTickets?Math.round(oha.tickets/bd.totalTickets*100)+'% of total':'');
  kpi(sl,5.4,1.1,2.4,0.9,'Non-OHA Tickets',num(nonoha.tickets||0),bd.totalTickets?Math.round(nonoha.tickets/bd.totalTickets*100)+'% of total':'');
  kpi(sl,7.9,1.1,2.4,0.9,'Refund Tickets',num(bd.refundTickets||0),pbd?moneyS(bd.refundTickets-pbd.refundTickets):'');
  barChart(sl,0.4,2.4,6.2,4.5,(oha.topDrivers||[]).map(function(x){return x.k;}),(oha.topDrivers||[]).map(function(x){return x.count;}),PINK,'OHA Top Call Drivers');
  barChart(sl,6.9,2.4,6.0,4.5,(nonoha.topDrivers||[]).map(function(x){return x.k;}),(nonoha.topDrivers||[]).map(function(x){return x.count;}),BLUE,'Non-OHA Top Call Drivers');
}
function s5(pptx,c,p){
  var bd=c.call.breakdown||{}, pbd=p&&p.call.breakdown?p.call.breakdown:null;
  var oha=bd.oha||{}, nonoha=bd.nonoha||{};
  var poha=pbd&&pbd.oha?pbd.oha:null, pnon=pbd&&pbd.nonoha?pbd.nonoha:null;
  var sl=pptx.addSlide(); title(sl,5,'Refund Overview','Refund tickets, amounts & top reasons per channel');
  kpi(sl,0.4,1.1,2.0,0.9,'OHA Tickets',num(oha.tickets||0),'');
  kpi(sl,2.5,1.1,2.0,0.9,'OHA Refund Tickets',num(oha.refundTickets||0),'');
  kpi(sl,4.6,1.1,2.0,0.9,'Non-OHA Tickets',num(nonoha.tickets||0),'');
  kpi(sl,6.7,1.1,2.0,0.9,'Non-OHA Refund Tickets',num(nonoha.refundTickets||0),'');
  kpi(sl,8.8,1.1,2.0,0.9,'OHA Refunded',money(oha.refundAmount||0),poha?moneyS(oha.refundAmount-poha.refundAmount):'');
  kpi(sl,10.9,1.1,2.0,0.9,'Non-OHA Refunded',money(nonoha.refundAmount||0),pnon?moneyS(nonoha.refundAmount-pnon.refundAmount):'');
  barChart(sl,0.4,2.4,6.2,2.2,(oha.topRefundReason||[]).map(function(x){return x.k;}),(oha.topRefundReason||[]).map(function(x){return x.refund;}),PINK,'OHA Top Refund Reasons');
  barChart(sl,6.9,2.4,6.0,2.2,(nonoha.topRefundReason||[]).map(function(x){return x.k;}),(nonoha.topRefundReason||[]).map(function(x){return x.refund;}),BLUE,'Non-OHA Top Refund Reasons');
  var br=[['Brand','Refunded','Tickets','Top Reason']];
  (bd.byBrand||[]).slice(0,8).forEach(function(x){ br.push([x.brand,money(x.refund),num(x.tickets),x.topReason]); });
  table(sl,0.4,4.9,12.5,br);
}
function s6(pptx,c,p){
  var bd=c.call.breakdown||{}, pbd=p&&p.call.breakdown?p.call.breakdown:null;
  var sl=pptx.addSlide(); title(sl,6,'Week-over-Week Refund Trends','Refunded amount across recent weeks');
  kpi(sl,0.4,1.1,3.0,0.9,'Refund $ — now',money(bd.refundAmount||0),pbd?'vs '+money(pbd.refundAmount||0):'',true);
  kpi(sl,3.5,1.1,3.0,0.9,'Refund Tickets',num(bd.refundTickets||0),pbd?'vs '+num(pbd.refundTickets||0):'');
  var tr=[]; for(var i=order.length-1;i>=0&&tr.length<8;i--){ var wk=weeks[order[i]]; var ref=wk.call&&wk.call.breakdown?wk.call.breakdown.refundAmount:0; tr.push({l:wk.label,v:ref||0}); }
  var hi=tr.reduce(function(a,b){return b.v>a.v?b:a;},tr[0]||{v:0});
  kpi(sl,6.6,1.1,3.0,0.9,'Highest Refund Week',esc(hi.l||'—'),hi.v?money(hi.v):'');
  barChart(sl,0.4,2.4,12.5,4.5,tr.map(function(x){return x.l;}),tr.map(function(x){return x.v;}),RED,'Refund Trend — refunded amount');
}
function s7(pptx,c,p){
  var t=c.team||{}, pt=p?p.team:null, rows=t.rank||[], top=rows[0];
  var cs=t.callStats||[], pcs=pt?pt.callStats:[];
  function avgPick(a){ if(!a.length)return null; return a.reduce(function(x,y){return x+(y.pickupRate||0);},0)/a.length; }
  function avgAht(a){ var s=a.map(function(y){return ahtToSec(y.aht);}).filter(function(x){return x!=null;}); if(!s.length)return null; return s.reduce(function(x,y){return x+y;},0)/s.length; }
  var ap=avgPick(cs), aa=avgAht(cs);
  var sl=pptx.addSlide(); title(sl,7,'Team Weekly Performance','Individual CSR scorecards & call productivity');
  kpi(sl,0.4,1.1,2.4,0.9,'Agents',num(t.count||0),'this week');
  kpi(sl,2.9,1.1,2.4,0.9,'Team Avg Score',(t.avgOverall||0)+'%','week total / 100',true);
  kpi(sl,5.4,1.1,2.4,0.9,'Top Performer',top?esc(top.a):'—',top?top.total+'% this week':'');
  kpi(sl,7.9,1.1,2.4,0.9,'Avg Pick Up',ap!=null?ap.toFixed(1)+'%':'—','');
  kpi(sl,10.4,1.1,2.4,0.9,'Avg AHT',aa!=null?secToAht(aa):'—','');
  var tr=[['Rank','Agent','Overall','Pick Up %','AHT','Attempts']];
  rows.forEach(function(r,i){ var cs2=r.calls||{}; tr.push([i+1,r.a,r.total+'%',cs2.pickupRate!=null?cs2.pickupRate+'%':'—',cs2.aht?cs2.aht:'—',cs2.attempts?num(cs2.attempts):'—']); });
  table(sl,0.4,2.3,12.5,tr);
}
function s8(pptx,c){
  var t=c.team||{}, rows=t.rank||[], top=rows[0];
  var sl=pptx.addSlide(); title(sl,8,'Scorecard Record','All CSR scores this week');
  kpi(sl,0.4,1.1,4.0,0.9,'Top Performing CSR',top?esc(top.a):'—',top?top.total+'% this week':'',true);
  kpi(sl,4.6,1.1,4.0,0.9,'Team Avg Score',(t.avgOverall||0)+'%','week total / 100');
  var tr=[['Rank','Agent','Attendance','Quality','Productivity','Work Ethic','Overall','TOTAL']];
  rows.forEach(function(r,i){ tr.push([i+1,r.a,(r.att!=null?r.att+'%':'—'),(r.qual!=null?r.qual+'%':'—'),(r.prod!=null?r.prod+'%':'—'),(r.we!=null?r.we+'%':'—'),(r.pct!=null?r.pct+'%':'—'),r.total+'%']); });
  table(sl,0.4,2.3,12.5,tr);
}
function s9(pptx,c){
  var bo=(c.call&&c.call.backOffice)||[];
  var total=bo.reduce(function(a,b){return a+b.hrs;},0);
  var sl=pptx.addSlide(); title(sl,9,'Back Office Hours','Individual agent back-office time');
  kpi(sl,0.4,1.1,3.0,0.9,'Agents (back office)',num(bo.length),'this week');
  kpi(sl,3.5,1.1,3.0,0.9,'Total Back-Office Hours',num(Math.round(total*10)/10)+' h','all agents',true);
  kpi(sl,6.6,1.1,3.0,0.9,'Avg per Agent',bo.length?(Math.round(total/bo.length*10)/10)+' h':'0 h','active this week');
  barChart(sl,0.4,2.4,12.5,4.5,bo.map(function(b){return b.a;}),bo.map(function(b){return b.hrs;}),LAV,'Back-Office Hours by Agent');
}

function build(){
  var c=cur(); if(!c){ alert('No data for the selected week.'); return; }
  var p=prevWeek();
  var pptx=new PptxGenJS();
  pptx.defineLayout({name:'WIDE',width:13.33,height:7.5});
  pptx.layout='WIDE';
  s1(pptx,c,p); s2(pptx,c,p); s3(pptx,c); s4(pptx,c,p); s5(pptx,c,p);
  s6(pptx,c,p); s7(pptx,c,p); s8(pptx,c); s9(pptx,c);
  pptx.writeFile({fileName:'TL_Danielle_Weekly_Report_'+curWeek()+'.pptx'});
}

document.addEventListener('DOMContentLoaded', function(){
  var btn=document.getElementById('btnPptx');
  if(btn) btn.onclick=build;
});
})();