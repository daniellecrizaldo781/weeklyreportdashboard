/* png-export.js — exports every slide as a high-res PNG, bundled into one ZIP (for Google Slides).
   The deck holds only ONE slide in the DOM at a time, so we navigate slide-by-slide
   (window.__goTo from deck.js) and capture each after it renders. */
(function(){
"use strict";
function weekLabel(){
  var s=document.getElementById('weekSel');
  return s?s.value:'report';
}
function exportPNGs(){
  if(typeof JSZip==='undefined'||typeof html2canvas==='undefined'||typeof window.__goTo!=='function'){
    alert('Export libraries not loaded yet. Please reload the page and try again.');
    return;
  }
  var TOTAL = (typeof window.__slideCount==='function')?window.__slideCount():9;
  var week=weekLabel();
  var zip=new JSZip();
  var folder=zip.folder('TL_Danielle_Weekly_Report_'+week);
  var startSlide=0; // will capture from 0..TOTAL-1
  var i=0;
  function next(){
    if(i>=TOTAL){
      zip.generateAsync({type:'blob'}).then(function(blob){
        var a=document.createElement('a');
        a.download='TL_Danielle_Weekly_Report_'+week+'.zip';
        a.href=URL.createObjectURL(blob);
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
        window.__goTo(0);
        alert('Downloaded '+TOTAL+' PNGs as a ZIP (TL_Danielle_Weekly_Report_'+week+'.zip).');
      });
      return;
    }
    window.__goTo(i); // render slide i (deck replaces #deck innerHTML)
    setTimeout(function(){
      var slide=document.querySelector('#deck .slide');
      if(!slide){ console.error('slide '+(i+1)+' not rendered'); i++; next(); return; }
      html2canvas(slide,{scale:2,backgroundColor:'#FFF7FA',useCORS:true,logging:false}).then(function(canvas){
        folder.file('slide'+(i+1)+'.png', canvas.toDataURL('image/png').split(',')[1], {base64:true});
        i++; next();
      }).catch(function(e){ console.error('PNG export slide '+(i+1)+' failed',e); i++; next(); });
    }, 60);
  }
  next();
}
document.addEventListener('DOMContentLoaded', function(){
  var btn=document.getElementById('btnPng');
  if(btn) btn.onclick=exportPNGs;
});
})();