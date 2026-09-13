/* ======================================================================
   RIBBON  ·  the control sections as a top bar
   Why: the left of the window belongs to the pages of the invoice, so the
   option sections (00 Source image … 07 Readout) move to a bar under the
   header, one tab each; a tab opens its section in a panel that drops
   down from the bar and closes on the next click outside. The sections'
   elements are MOVED, not copied, so every slider, checkbox and button
   keeps its id and its wiring. The Run and export buttons sit in the bar
   itself, always visible.
   ====================================================================== */
import { $ } from '../dom/dom.js';

const controls=$('controls'), bar=$('ribbon'), panel=$('ribbonPanel');
const tabs=[];
let open=-1;

function build(){
  const groups=[...controls.querySelectorAll(':scope > .grp')];
  for(const grp of groups){
    const h3=grp.querySelector(':scope > h3');
    if(!h3){                                            // the Run / export group: its buttons go into the bar
      const runGroup=$('runGroup'); for(const b of [...grp.querySelectorAll('button')]) runGroup.appendChild(b);
      grp.remove(); continue; }
    const ix=h3.querySelector('.ix'); const label=h3.textContent.replace(ix?ix.textContent:'','').trim();
    const tab=document.createElement('button'); tab.className='tab'; tab.type='button';
    tab.innerHTML=(ix?'<span class="ix">'+ix.textContent+'</span>':'')+label.replace(/\s*·.*$/,'');
    tab.title=label;
    const k=tabs.length; tab.onclick=e=>{ e.stopPropagation(); toggle(k); };
    bar.insertBefore(tab, $('ribbonSpacer'));
    grp.classList.add('ribbon-grp'); grp.style.display='none'; panel.appendChild(grp);
    tabs.push({tab, grp});
  }
}
function toggle(k){
  if(open===k){ close(); return; }
  open=k;
  tabs.forEach((t,i)=>{ t.tab.classList.toggle('on',i===k); t.grp.style.display=i===k?'block':'none'; });
  const r=tabs[k].tab.getBoundingClientRect(), b=bar.getBoundingClientRect();
  panel.style.left=Math.max(0,Math.min(r.left-b.left, b.width-panel.offsetWidth-4))+'px';
  panel.classList.add('show');
  const left=Math.max(0,Math.min(r.left-b.left, b.width-panel.getBoundingClientRect().width-4)); panel.style.left=left+'px';
}
export function close(){ open=-1; tabs.forEach(t=>{ t.tab.classList.remove('on'); t.grp.style.display='none'; }); panel.classList.remove('show'); }
export function openSection(n){ const k=tabs.findIndex(t=>t.tab.textContent.trim().startsWith(n)); if(k>=0 && open!==k) toggle(k); }

document.addEventListener('mousedown',e=>{ if(open<0) return; if(panel.contains(e.target) || bar.contains(e.target)) return; close(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
build();
