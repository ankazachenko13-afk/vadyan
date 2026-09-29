const DB='vadyan-db', STORE='tracks';
let db, tracks=[], current=null, objectUrl=null;
const audio=document.querySelector('#audio');

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
function all(){return new Promise((res,rej)=>{const t=db.transaction(STORE,'readonly').objectStore(STORE).getAll();t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)})}
function put(x){return new Promise((res,rej)=>{const t=db.transaction(STORE,'readwrite').objectStore(STORE).put(x);t.onsuccess=res;t.onerror=()=>rej(t.error)})}
function del(id){db.transaction(STORE,'readwrite').objectStore(STORE).delete(id)}
function fmt(s){if(!isFinite(s))return'0:00';return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function coverHTML(t,big=false){return t.cover?`<div class="${big?'big-cover':'cover'}"><img src="${t.cover}"></div>`:`<div class="${big?'big-cover':'cover'}"><span class="note">♫</span></div>`}

async function readTags(file){
  // Lightweight ID3 reader for common MP3 tags.
  const buf=await file.arrayBuffer(), u=new Uint8Array(buf);
  let title='',artist='',album='',pic=null;
  if(u[0]===73&&u[1]===68&&u[2]===51){
    const ver=u[3], size=(u[6]<<21)|(u[7]<<14)|(u[8]<<7)|u[9], end=Math.min(u.length,10+size);
    let p=10;
    while(p+10<end){
      const id=String.fromCharCode(u[p],u[p+1],u[p+2],u[p+3]); let n=ver===4?((u[p+4]<<21)|(u[p+5]<<14)|(u[p+6]<<7)|u[p+7]):((u[p+4]<<24)|(u[p+5]<<16)|(u[p+6]<<8)|u[p+7]); if(!n||p+10+n>end)break;
      const d=u.slice(p+10,p+10+n);
      const text=()=>{let off=d[0]===1||d[0]===2?1:1;try{return new TextDecoder(d[0]===1?'utf-16':'utf-8').decode(d.slice(off)).replace(/\0/g,'').trim()}catch{return''}};
      if(id==='TIT2')title=text(); else if(id==='TPE1')artist=text(); else if(id==='TALB')album=text();
      else if(id==='APIC'){let q=1;while(q<d.length&&d[q]!==0)q++;q++;q++;while(q<d.length&&d[q]!==0)q++;q++;let start=q+1;pic=new Blob([d.slice(start)],{type:'image/jpeg'})}
      p+=10+n;
    }
  }
  return {title:title||file.name.replace(/\.mp3$/i,''),artist:artist||'Неизвестный исполнитель',album:album||'Неизвестный альбом',pic};
}
async function importFiles(files){
  for(const file of files){if(!/mp3/i.test(file.type+file.name))continue;const m=await readTags(file);tracks.push({id:crypto.randomUUID(),title:m.title,artist:m.artist,album:m.album,blob:file,cover:m.pic?URL.createObjectURL(m.pic):null});await put(tracks.at(-1))}
  render();
}
function render(){
  document.querySelector('#empty').hidden=tracks.length>0;document.querySelector('#library').hidden=tracks.length===0;
  const albumsEl=document.querySelector('#albums'), map=new Map();
  tracks.forEach(t=>{if(!map.has(t.album))map.set(t.album,t)});
  albumsEl.innerHTML=[...map.values()].map(t=>`<button class="album" data-id="${t.id}">${coverHTML(t)}<div class="album-name">${esc(t.album)}</div><div class="artist">${esc(t.artist)}</div></button>`).join('');
  albumsEl.querySelectorAll('.album').forEach(b=>b.onclick=()=>play(tracks.find(t=>t.id===b.dataset.id)));
  drawTracks();
}
function drawTracks(){
  const q=document.querySelector('#search').value.toLowerCase(), el=document.querySelector('#tracks');
  const list=tracks.filter(t=>(t.title+' '+t.artist+' '+t.album).toLowerCase().includes(q));
  el.innerHTML=list.map(t=>`<div class="track"><button data-play="${t.id}">${coverHTML(t)}</button><div class="track-info" data-open="${t.id}"><div class="track-title">${esc(t.title)}</div><div class="track-artist">${esc(t.artist)} · ${esc(t.album)}</div></div><button data-del="${t.id}">•••</button></div>`).join('');
  el.querySelectorAll('[data-play],[data-open]').forEach(x=>x.onclick=()=>play(tracks.find(t=>t.id===x.dataset.play||x.dataset.open)));
  el.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>{del(x.dataset.del);tracks=tracks.filter(t=>t.id!==x.dataset.del);if(current?.id===x.dataset.del)stop();render()});
}
function setArtwork(el,t){el.innerHTML=t.cover?`<img src="${t.cover}">`:`<span class="note">♫</span>`}
function play(t){
  if(!t)return;current=t;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(t.blob);audio.src=objectUrl;audio.play();
  document.querySelector('#mini').hidden=false;document.querySelector('#mini').innerHTML=`<div class="mini-inner"><div class="cover">${t.cover?`<img src="${t.cover}">`:'<span class="note">♫</span>'}</div><div class="mini-info"><div class="mini-title">${esc(t.title)}</div><div class="mini-artist">${esc(t.artist)}</div></div><button id="miniPlay">Ⅱ</button></div>`;
  document.querySelector('#miniPlay').onclick=e=>{e.stopPropagation();audio.paused?audio.play():audio.pause()};document.querySelector('#mini').onclick=()=>openPlayer();audio.onplay=updateButtons;audio.onpause=updateButtons;
}
function updateButtons(){const b=document.querySelector('#miniPlay');if(b)b.textContent=audio.paused?'▶':'Ⅱ';document.querySelector('#play').textContent=audio.paused?'▶':'Ⅱ'}
function openPlayer(){if(!current)return;document.querySelector('#player').hidden=false;setArtwork(document.querySelector('#bigCover'),current);document.querySelector('#nowTitle').textContent=current.title;document.querySelector('#nowArtist').textContent=current.artist;updateButtons()}
function stop(){audio.pause();audio.removeAttribute('src');current=null;document.querySelector('#mini').hidden=true;document.querySelector('#player').hidden=true}
document.querySelector('#fileInput').onchange=e=>importFiles([...e.target.files]);
document.querySelectorAll('.primary input').forEach(i=>i.onchange=e=>importFiles([...e.target.files]));
document.querySelector('#search').oninput=drawTracks;
document.querySelector('#closePlayer').onclick=()=>document.querySelector('#player').hidden=true;
document.querySelector('#play').onclick=()=>audio.paused?audio.play():audio.pause();
document.querySelector('#back').onclick=()=>audio.currentTime=Math.max(0,audio.currentTime-15);
document.querySelector('#forward').onclick=()=>audio.currentTime=Math.min(audio.duration||0,audio.currentTime+30);
audio.ontimeupdate=()=>{document.querySelector('#seek').value=audio.duration?audio.currentTime/audio.duration*100:0;document.querySelector('#cur').textContent=fmt(audio.currentTime);document.querySelector('#dur').textContent=fmt(audio.duration)};
document.querySelector('#seek').oninput=e=>{if(audio.duration)audio.currentTime=audio.duration*e.target.value/100};
audio.onended=()=>updateButtons();
openDB().then(async()=>{tracks=await all();render();});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
