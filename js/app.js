(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const P='nh_';
const ls={
  get(k,d){try{const v=localStorage.getItem(P+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(P+k,JSON.stringify(v))}catch(e){}}
};
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n,12);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtLong=d=>d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const fmtHM=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
function toast(msg){
  let t=$('#toast');
  if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),3500);
}

/* ================= Routing ================= */
const PAGES=['beranda','quran','tracker','kalender','puasa','kiblat','dzikir','setelan'];
function route(){
  const h=(location.hash||'#beranda').slice(1);
  const p=PAGES.includes(h)?h:'beranda';
  $$('.page').forEach(e=>e.classList.toggle('on',e.id==='p-'+p));
  $$('.nav a').forEach(a=>a.classList.toggle('on',a.dataset.p===p));
  if(p==='kiblat')updateQibla();
  if(p==='tracker')renderTracker();
  if(p==='kalender')renderCal();
  if(p==='puasa')renderPuasa();
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);

/* ================= Tema & setelan ================= */
function applyTheme(){
  const t=ls.get('theme','auto');
  document.documentElement.dataset.theme=t;
  const dark=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);
  const m=document.querySelector('meta[name=theme-color]');
  if(m)m.content=dark?'#0A1814':'#0B5D4B';
}
applyTheme();

/* ================= Hijriah ================= */
const HM=['Muharram','Safar','Rabiul Awal','Rabiul Akhir','Jumadil Awal','Jumadil Akhir','Rajab','Syaban','Ramadhan','Syawal','Dzulkaidah','Dzulhijjah'];
const hfmt=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn',{day:'numeric',month:'numeric',year:'numeric'});
function hijri(d){
  const dd=new Date(d.getFullYear(),d.getMonth(),d.getDate()+(+ls.get('hadj',0)),12);
  const p=hfmt.formatToParts(dd);
  const g=t=>+p.find(x=>x.type===t).value;
  return {d:g('day'),m:g('month'),y:g('year')};
}
const hStr=h=>`${h.d} ${HM[h.m-1]} ${h.y} H`;
/* k: W wajib, S sunnah, H haram puasa, E hari besar */
function dayInfo(d){
  const h=hijri(d),w=d.getDay(),it=[];
  const add=(k,t)=>it.push({k,t});
  if(h.m===9){add('W','Ramadhan: puasa wajib');if(h.d===1)add('E','Awal Ramadhan');if(h.d===17)add('E',"Nuzulul Qur'an")}
  if(h.m===1){if(h.d===1)add('E','Tahun Baru Hijriah');if(h.d===9)add('S',"Puasa Tasu'a");if(h.d===10)add('S','Puasa Asyura')}
  if(h.m===3&&h.d===12)add('E','Maulid Nabi ﷺ');
  if(h.m===7&&h.d===27)add('E',"Isra Mi'raj");
  if(h.m===8&&h.d===15)add('E','Nisfu Syaban');
  if(h.m===10){if(h.d===1){add('H','Idul Fitri: haram berpuasa');add('E','Idul Fitri')}else if(h.d<=7)add('S','Puasa 6 hari Syawal')}
  if(h.m===12){
    if(h.d<=8)add('S','Puasa awal Dzulhijjah');
    if(h.d===9)add('S','Puasa Arafah');
    if(h.d===10){add('H','Idul Adha: haram berpuasa');add('E','Idul Adha')}
    if(h.d>=11&&h.d<=13)add('H','Hari Tasyrik: haram berpuasa');
  }
  const haram=it.some(x=>x.k==='H'),wajib=it.some(x=>x.k==='W');
  if(!haram&&!wajib){
    if(h.d>=13&&h.d<=15)add('S','Puasa Ayyamul Bidh');
    if(w===1)add('S','Puasa Senin');
    if(w===4)add('S','Puasa Kamis');
  }
  return {h,it};
}
const kindDot=it=>[...new Set(it.map(x=>x.k==='W'?'w':x.k==='H'?'h':x.k==='S'?'s':''))].filter(Boolean);
const tagHtml=x=>`<span class="tag ${x.k==='W'?'wajib':x.k==='H'?'haram':''}">${esc(x.t)}</span>`;

/* ================= Lokasi ================= */
const CITIES={Jakarta:[-6.2088,106.8456],Bandung:[-6.9175,107.6191],Surabaya:[-7.2575,112.7521],Yogyakarta:[-7.7956,110.3695],Semarang:[-6.9667,110.4167],Medan:[3.5952,98.6722],Makassar:[-5.1477,119.4327],Palembang:[-2.9761,104.7754],Denpasar:[-8.65,115.2167],Banjarmasin:[-3.3194,114.5908],Pontianak:[-0.0263,109.3425],Manado:[1.4748,124.8421],Mataram:[-8.5833,116.1167],Balikpapan:[-1.2379,116.8529],Jayapura:[-2.5337,140.7181],Padang:[-0.9471,100.4172],Pekanbaru:[0.5071,101.4478],Aceh:[5.5483,95.3238],Makkah:[21.4225,39.8262],Madinah:[24.4672,39.6111]};
let place=ls.get('place',{name:'Jakarta',lat:-6.2088,lon:106.8456});
const cs=$('#city');
Object.keys(CITIES).forEach(c=>cs.add(new Option(c,c)));
cs.add(new Option('Lokasi GPS','gps'));
cs.value=CITIES[place.name]?place.name:'gps';
cs.onchange=()=>{
  if(cs.value==='gps')return getGPS();
  const [la,lo]=CITIES[cs.value];setPlace(cs.value,la,lo);
};
$('#gps').onclick=getGPS;
function getGPS(){
  if(!navigator.geolocation)return toast('Perangkat tidak mendukung lokasi.');
  navigator.geolocation.getCurrentPosition(
    p=>{setPlace('Lokasi GPS',p.coords.latitude,p.coords.longitude);cs.value='gps'},
    ()=>{toast('Izin lokasi ditolak. Pilih kota dari daftar.');cs.value=CITIES[place.name]?place.name:'gps'},
    {timeout:15000}
  );
}
function setPlace(name,lat,lon){
  place={name,lat,lon};ls.set('place',place);
  loadTimes();updateQibla();
  if($('#p-puasa').classList.contains('on'))renderPuasa();
}

/* ================= Jadwal sholat ================= */
const NAMES=[['Fajr','Subuh'],['Sunrise','Terbit'],['Dhuhr','Dzuhur'],['Asr','Ashar'],['Maghrib','Maghrib'],['Isha','Isya']];
const PR=['Subuh','Dzuhur','Ashar','Maghrib','Isya'];
const PKEY=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
const API_T='https://api.aladhan.com/v1/calendar';
async function monthData(y,m){
  const key=`cal_${place.lat.toFixed(2)}_${place.lon.toFixed(2)}_${y}_${m}`;
  const c=ls.get(key,null);
  if(c)return c;
  const r=await fetch(`${API_T}/${y}/${m}?latitude=${place.lat}&longitude=${place.lon}&method=20`);
  const j=await r.json();
  if(!j||j.code!==200||!Array.isArray(j.data))throw new Error('api');
  const d=j.data.map(x=>({t:NAMES.map(([k])=>x.timings[k].slice(0,5)),tz:x.meta.timezone}));
  ls.set(key,d);
  return d;
}
/* ubah jam lokal di zona waktu lokasi menjadi Date absolut */
function zdate(y,mo,d,h,mi,tz){
  const guess=Date.UTC(y,mo-1,d,h,mi);
  try{
    const f=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric'});
    const off=t=>{const p=Object.fromEntries(f.formatToParts(new Date(t)).map(x=>[x.type,x.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute)-t};
    let t=guess-off(guess);t=guess-off(t);return new Date(t);
  }catch(e){return new Date(y,mo-1,d,h,mi)}
}
function toTimes(x,d){
  const o={};
  NAMES.forEach(([k],i)=>{const [h,m]=x.t[i].split(':');o[k]=zdate(d.getFullYear(),d.getMonth()+1,d.getDate(),+h,+m,x.tz)});
  return o;
}
let times=null,tomFajr=null,loadedDay='',fired={},placeTz='';
async function loadTimes(){
  $('#loc').textContent='📍 '+place.name;
  const now=new Date();
  try{
    const md=await monthData(now.getFullYear(),now.getMonth()+1);
    times=toTimes(md[now.getDate()-1],now);
    placeTz=md[now.getDate()-1].tz||'';
    const tm=addDays(now,1);
    let md2=md;
    if(tm.getMonth()!==now.getMonth()){try{md2=await monthData(tm.getFullYear(),tm.getMonth()+1)}catch(e){md2=null}}
    tomFajr=md2?toTimes(md2[tm.getDate()-1],tm).Fajr:new Date(times.Fajr.getTime()+864e5);
    loadedDay=ymd(now);
  }catch(e){
    $('#times').innerHTML='<div class="mut">Gagal memuat jadwal. Periksa koneksi internet (jadwal yang pernah dibuka tersimpan offline).</div>';
    return;
  }
  const h=hijri(now);
  $('#hdate').textContent=`${fmtLong(now)} • ${hStr(h)}`;
  renderTimes();tick();syncPush();
}
function nextPrayer(){
  const now=new Date();
  for(let i=0;i<5;i++){const t=times[PKEY[i]];if(t>now)return {i,n:PR[i],t}}
  return {i:0,n:'Subuh',t:tomFajr,tomorrow:true};
}
function renderTimes(){
  if(!times)return;
  const nx=nextPrayer(),trk=getTrk(ymd(new Date()));
  const imsak=new Date(times.Fajr.getTime()-10*60000);
  let html=`<div class="row sub"><span class="nmr">Imsak</span><span class="t">${fmtHM(imsak)}</span></div>`;
  NAMES.forEach(([k,n])=>{
    const pi=PKEY.indexOf(k);
    const isNow=pi>=0&&nx.i===pi&&!nx.tomorrow;
    html+=`<div class="row ${isNow?'now':''} ${pi<0?'sub':''}"><span class="nmr">${n}</span><span class="t">${fmtHM(times[k])}</span>${pi>=0?`<input type="checkbox" data-pr="${n}" ${trk[n]?'checked':''} aria-label="Sudah sholat ${n}" title="Tandai sudah sholat">`:''}</div>`;
  });
  $('#times').innerHTML=html;
  $$('#times [data-pr]').forEach(c=>c.onchange=()=>{setTrk(ymd(new Date()),c.dataset.pr,c.checked)});
}
let tickLock=false;
function tick(){
  if(!times)return;
  const now=new Date();
  if(ymd(now)!==loadedDay&&!tickLock){tickLock=true;loadTimes().finally(()=>tickLock=false);return}
  const nx=nextPrayer(),diff=Math.max(0,nx.t-now);
  const h=Math.floor(diff/36e5),m=Math.floor(diff%36e5/6e4),s=Math.floor(diff%6e4/1e3);
  $('#nname').textContent=nx.n;
  $('#ncd').textContent=`${pad(h)}:${pad(m)}:${pad(s)}`;
  $('#ntime').textContent=(nx.tomorrow?'Besok, ':'Pukul ')+fmtHM(nx.t);
  const pre=+$('#pre').value;
  for(let i=0;i<5;i++){
    const t=times[PKEY[i]],id=ymd(t)+PKEY[i];
    if(now>=t&&now-t<90000&&!fired[id]){
      fired[id]=1;
      notify('Waktu '+PR[i],`Telah masuk waktu sholat ${PR[i]}`+(ls.get('place',place).name?` untuk wilayah ${place.name}`:''),`sholat-${PKEY[i]}-now`);
      if($('#adzan').checked&&i!==undefined&&PKEY[i]!=='Sunrise')playAdzan();
      renderTimes();
    }
    if(pre>0&&now<t&&t-now<=pre*60000&&!fired[id+'p']){
      fired[id+'p']=1;
      notify(`${pre} menit lagi ${PR[i]}`,`Bersiaplah, waktu ${PR[i]} sebentar lagi masuk.`,`sholat-${PKEY[i]}-pre`);
    }
  }
}
setInterval(tick,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});

async function notify(title,body,tag){
  if(!ls.get('remind',false)||!('Notification' in window)||Notification.permission!=='granted')return;
  try{
    const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();
    if(reg)await reg.showNotification(title,{body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:tag||'sholat',vibrate:[200,100,200]});
    else new Notification(title,{body,icon:'icons/icon-192.png'});
  }catch(e){try{new Notification(title,{body})}catch(_){}}
}
/* adzan */
let adz=null;
function beep(){
  try{
    const c=new (window.AudioContext||window.webkitAudioContext)();
    [0,.5,1].forEach(o=>{const s=c.createOscillator(),g=c.createGain();s.connect(g);g.connect(c.destination);s.frequency.value=660;g.gain.setValueAtTime(.25,c.currentTime+o);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+o+.4);s.start(c.currentTime+o);s.stop(c.currentTime+o+.4)});
  }catch(e){}
}
let lastAdz=0;
function playAdzan(){
  stopAdzan();lastAdz=Date.now();
  adz=new Audio('audio/adzan.mp3');
  adz.onplay=()=>{$('#stopAdzanBar').hidden=false};
  adz.onended=()=>{$('#stopAdzanBar').hidden=true};
  adz.onerror=()=>{$('#stopAdzanBar').hidden=true;beep();toast('File audio/adzan.mp3 belum ada. Menggunakan bunyi beep.')};
  adz.play().catch(()=>{$('#stopAdzanBar').hidden=true;beep();toast('Browser menahan suara. Ketuk "Tes adzan" sekali agar adzan boleh berbunyi.')});
}
function stopAdzan(){if(adz){adz.pause();adz=null}$('#stopAdzanBar').hidden=true}
$('#stopAdzan').onclick=stopAdzan;
$('#testAdzan').onclick=playAdzan;

$('#remind').checked=ls.get('remind',false);
$('#adzan').checked=ls.get('adzan',false);
$('#pre').value=String(ls.get('pre',0));
$('#remind').onchange=async e=>{
  if(e.target.checked){
    if(!('Notification' in window)){toast('Browser tidak mendukung notifikasi.');e.target.checked=false}
    else if(Notification.permission!=='granted'&&await Notification.requestPermission()!=='granted'){toast('Izin notifikasi ditolak.');e.target.checked=false}
  }
  ls.set('remind',e.target.checked);
};
$('#adzan').onchange=e=>{ls.set('adzan',e.target.checked);if(e.target.checked)toast('Adzan diputar saat waktu sholat tiba jika aplikasi terbuka, atau saat Anda mengetuk notifikasi.');syncPush()};
$('#pre').onchange=e=>{ls.set('pre',+e.target.value);syncPush()};

/* ================= Web Push (dari server) ================= */
const pushOK='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const b64u=s=>{const p='='.repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(b,c=>c.charCodeAt(0))};
async function jpost(u,method,body){
  const r=await fetch(u,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error('HTTP '+r.status);
  return r.json().catch(()=>({}));
}
async function getSub(create){
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub&&create){
    const r=await fetch('api/push-key');
    if(!r.ok)throw new Error('Server push belum siap');
    const j=await r.json();
    sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(j.key)});
  }
  return sub;
}
async function pushSend(sub){
  await jpost('api/subscribe','POST',{subscription:sub.toJSON(),lat:place.lat,lon:place.lon,tz:placeTz,name:place.name,pre:+$('#pre').value,adzan:$('#adzan').checked});
}
let pushT=null;
function syncPush(){
  clearTimeout(pushT);
  pushT=setTimeout(async()=>{
    if(!pushOK||!ls.get('push',false)||!placeTz||!navigator.onLine||Notification.permission!=='granted')return;
    try{const s=await getSub(true);if(s)await pushSend(s)}catch(e){}
  },800);
}
$('#push').checked=pushOK&&ls.get('push',false);
$('#push').onchange=async e=>{
  const box=e.target;
  if(!box.checked){
    ls.set('push',false);
    try{const s=await getSub(false);if(s){await jpost('api/subscribe','DELETE',{endpoint:s.endpoint}).catch(()=>{});await s.unsubscribe()}}catch(_){}
    toast('Notifikasi server dimatikan.');
    return;
  }
  if(!pushOK||!location.protocol.startsWith('http')){toast('Browser/perangkat ini belum mendukung notifikasi server. Di iPhone, pasang aplikasi ke layar utama dulu.');box.checked=false;return}
  if(!navigator.onLine){toast('Perlu internet untuk mengaktifkan notifikasi server.');box.checked=false;return}
  if(!placeTz){toast('Jadwal belum termuat. Coba lagi sebentar.');box.checked=false;return}
  try{
    if(Notification.permission!=='granted'&&await Notification.requestPermission()!=='granted')throw new Error('Izin notifikasi ditolak.');
    const s=await getSub(true);
    await pushSend(s);
    ls.set('push',true);
    toast('Notifikasi server aktif. Pengingat akan muncul walau aplikasi tertutup.');
  }catch(err){
    box.checked=false;ls.set('push',false);
    toast('Gagal mengaktifkan: '+(err&&err.message?err.message:'coba lagi'));
  }
};
function adzanFromPush(t){
  if(!$('#adzan').checked||!t||Date.now()-t>15*60000||Date.now()-lastAdz<5*60000)return;
  playAdzan();
}
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='play-adzan')adzanFromPush(e.data.t)});
{
  const q=new URLSearchParams(location.search);
  if(q.get('adzan')==='1'){
    const t=+q.get('t');
    history.replaceState(null,'',location.pathname+location.hash);
    setTimeout(()=>adzanFromPush(t),500);
  }
}

/* ================= Al-Qur'an ================= */
const API='https://equran.id/api/v2';
const idb={
  db:null,
  open(){
    if(!this.db)this.db=new Promise((res,rej)=>{
      if(!window.indexedDB)return rej(new Error('no idb'));
      const r=indexedDB.open('nurharian',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('q');
      r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
    });
    return this.db;
  },
  async get(k){try{const db=await this.open();return await new Promise(res=>{const q=db.transaction('q').objectStore('q').get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)})}catch(e){return null}},
  async set(k,v){try{const db=await this.open();return await new Promise(res=>{const t=db.transaction('q','readwrite');t.objectStore('q').put(v,k);t.oncomplete=()=>res(true);t.onerror=()=>res(false)})}catch(e){return false}},
  async keys(){try{const db=await this.open();return await new Promise(res=>{const q=db.transaction('q').objectStore('q').getAllKeys();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>res([])})}catch(e){return []}}
};
let surahs=[];
async function loadSurahs(){
  surahs=await idb.get('list')||[];
  if(!surahs.length){
    try{surahs=(await (await fetch(API+'/surat')).json()).data;idb.set('list',surahs)}
    catch(e){$('#qlist').innerHTML='<div class="mut">Gagal memuat daftar surah. Periksa koneksi internet.</div>';showLast();renderOffline();return}
  }
  renderSurahs();showLast();renderOffline();
}
function renderSurahs(){
  const q=$('#qsearch').value.trim().toLowerCase();
  const f=surahs.filter(s=>!q||String(s.nomor)===q||s.namaLatin.toLowerCase().includes(q)||s.arti.toLowerCase().includes(q));
  $('#qlist').innerHTML=f.map(s=>`<div class="surah" data-n="${s.nomor}"><div class="no">${s.nomor}</div><div><b>${esc(s.namaLatin)}</b><div class="mut small">${esc(s.arti)} • ${s.jumlahAyat} ayat • ${esc(s.tempatTurun)}</div></div><div class="ar">${esc(s.nama)}</div></div>`).join('')||'<div class="mut">Tidak ditemukan.</div>';
  $$('.surah').forEach(e=>e.onclick=()=>openSurah(+e.dataset.n));
}
$('#qsearch').oninput=renderSurahs;
function showLast(){
  const l=ls.get('last',null),el=$('#qlast');
  if(!l){el.hidden=true;return}
  el.hidden=false;
  el.innerHTML=`<div class="card-h"><div><div class="mut small">Terakhir dibaca</div><b>${esc(l.nama)} : ${l.ayat}</b></div><button class="btn" id="resume">Lanjutkan</button></div>`;
  $('#resume').onclick=()=>openSurah(l.n,l.ayat);
}
async function renderOffline(){
  const ks=await idb.keys(),n=ks.filter(k=>typeof k==='number').length;
  const el=$('#qoffline');
  if(n>=114){el.innerHTML='✅ <b>Al-Qur\'an tersimpan offline</b> <span class="mut small">(teks Arab, latin &amp; terjemahan, 114 surah)</span>';return}
  el.innerHTML=`<div class="card-h"><div>📥 <b>Mode offline</b><div class="mut small">${n}/114 surah tersimpan. Audio tetap perlu internet.</div></div><button class="btn sm" id="dlAll">Unduh semua</button></div><div class="bar"><i id="dlbar" style="width:${n/114*100}%"></i></div>`;
  $('#dlAll').onclick=downloadAll;
}
async function downloadAll(){
  const btn=$('#dlAll');btn.disabled=true;btn.textContent='Mengunduh…';
  const have=new Set((await idb.keys()).filter(k=>typeof k==='number'));
  const todo=[];for(let i=1;i<=114;i++)if(!have.has(i))todo.push(i);
  let done=have.size,fail=0;
  const worker=async()=>{
    while(todo.length){
      const n=todo.shift();
      try{const d=(await (await fetch(`${API}/surat/${n}`)).json()).data;if(!d||!d.ayat)throw 0;await idb.set(n,d);done++}catch(e){fail++}
      const bar=$('#dlbar');if(bar)bar.style.width=(done/114*100)+'%';
    }
  };
  await Promise.all([worker(),worker(),worker(),worker()]);
  await renderOffline();
  toast(fail?`${fail} surah gagal diunduh. Coba lagi.`:'Selesai! Al-Qur\'an bisa dibaca tanpa internet.');
}
let cur=null,player=null,playIdx=-1;
async function getSurah(n){
  let d=await idb.get(n);
  if(d)return d;
  d=(await (await fetch(`${API}/surat/${n}`)).json()).data;
  if(!d||!d.ayat)throw new Error('bad');
  idb.set(n,d).then(renderOffline);
  return d;
}
async function openSurah(n,jump){
  stopQuranAudio();
  $('#qhome').hidden=true;$('#qread').hidden=false;
  $('#qread').innerHTML='<div class="card mut">Memuat surah…</div>';
  window.scrollTo(0,0);
  let d;
  try{d=await getSurah(n)}catch(e){$('#qread').innerHTML='<div class="card">Gagal memuat surah (periksa internet atau unduh dulu untuk offline). <button class="btn sm" id="bk">Kembali</button></div>';$('#bk').onclick=closeSurah;return}
  cur=d;
  const last=ls.get('last',{}),qori=ls.get('qori','05');
  $('#qread').innerHTML=`<div class="card"><div class="flex"><button class="btn ghost sm" id="bk">← Daftar surah</button>${d.audioFull?`<button class="btn sm" id="playAll">▶ Putar surah</button>`:''}${n>1?`<button class="btn ghost sm" id="pv">‹ Sebelumnya</button>`:''}${n<114?`<button class="btn ghost sm" id="nx">Berikutnya ›</button>`:''}</div>
    <h2 style="margin:14px 0 0">${n}. ${esc(d.namaLatin)} <span class="mut" style="font-weight:400">(${esc(d.arti)})</span></h2>
    <div class="mut small">${d.jumlahAyat} ayat • ${esc(d.tempatTurun)}</div>
    ${n!==1&&n!==9?'<div class="bismi ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>':''}
    ${d.ayat.map((a,i)=>`<div class="ayat ${last.n===n&&last.ayat===a.nomorAyat?'last':''}" id="a${a.nomorAyat}">
      <div class="ar">${a.teksArab} <span class="mut">﴿${a.nomorAyat}﴾</span></div>
      <div class="lt">${esc(a.teksLatin)}</div><div class="idn">${esc(a.teksIndonesia)}</div>
      <div class="act"><button data-p="${i}">▶ Audio</button><button data-m="${a.nomorAyat}">🔖 Tandai terakhir dibaca</button></div></div>`).join('')}</div>`;
  $('#bk').onclick=closeSurah;
  if($('#pv'))$('#pv').onclick=()=>openSurah(n-1);
  if($('#nx'))$('#nx').onclick=()=>openSurah(n+1);
  if($('#playAll'))$('#playAll').onclick=()=>{stopQuranAudio();player=new Audio(d.audioFull[qori]||Object.values(d.audioFull)[0]);player.play().catch(()=>toast('Audio gagal diputar. Periksa internet.'))};
  $$('#qread [data-p]').forEach(b=>b.onclick=()=>playAyat(+b.dataset.p));
  $$('#qread [data-m]').forEach(b=>b.onclick=()=>{
    ls.set('last',{n,nama:d.namaLatin,ayat:+b.dataset.m});
    $$('.ayat.last').forEach(x=>x.classList.remove('last'));
    b.closest('.ayat').classList.add('last');
    toast('Ditandai: '+d.namaLatin+' ayat '+b.dataset.m);
  });
  if(jump)setTimeout(()=>{const e=$('#a'+jump);if(e)e.scrollIntoView({block:'center'})},120);
}
function playAyat(i){
  if(!cur||i>=cur.ayat.length){stopQuranAudio();return}
  stopQuranAudio(true);
  const qori=ls.get('qori','05'),a=cur.ayat[i];
  const url=a.audio[qori]||Object.values(a.audio)[0];
  player=new Audio(url);playIdx=i;
  $$('.ayat.play').forEach(x=>x.classList.remove('play'));
  const el=$('#a'+a.nomorAyat);if(el){el.classList.add('play');el.scrollIntoView({block:'center',behavior:'smooth'})}
  player.onended=()=>playAyat(i+1);
  player.onerror=()=>{toast('Audio gagal diputar. Periksa internet.');stopQuranAudio()};
  player.play().catch(()=>stopQuranAudio());
}
function stopQuranAudio(keep){
  if(player){player.onended=null;player.onerror=null;player.pause();player=null}
  if(!keep)$$('.ayat.play').forEach(x=>x.classList.remove('play'));
}
function closeSurah(){stopQuranAudio();$('#qread').hidden=true;$('#qhome').hidden=false;showLast();window.scrollTo(0,0)}

/* ================= Tracker ================= */
function getTrk(k){return (ls.get('trk',{})[k])||{}}
function setTrk(k,name,v){
  const all=ls.get('trk',{}),o=all[k]||{};
  if(v)o[name]=1;else delete o[name];
  if(Object.keys(o).length)all[k]=o;else delete all[k];
  ls.set('trk',all);
  if($('#p-tracker').classList.contains('on'))renderTracker();
}
const cnt=k=>Object.keys(getTrk(k)).length;
let tDay=new Date(),tMon=new Date(new Date().getFullYear(),new Date().getMonth(),1);
function renderTracker(){
  const today=new Date(),k=ymd(tDay),isToday=k===ymd(today);
  $('#tDate').textContent=(isToday?'Hari ini • ':'')+tDay.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
  $('#tNext').disabled=k>=ymd(today);$('#tNext').style.opacity=$('#tNext').disabled?.4:1;
  const trk=getTrk(k);
  $('#tChecks').innerHTML=PR.map(n=>`<label class="sw">${n}<input type="checkbox" data-t="${n}" ${trk[n]?'checked':''}></label>`).join('');
  $$('#tChecks [data-t]').forEach(c=>c.onchange=()=>setTrk(k,c.dataset.t,c.checked));
  // statistik
  let streak=0,d=new Date(today);
  if(cnt(ymd(d))<5)d=addDays(d,-1);
  while(cnt(ymd(d))===5){streak++;d=addDays(d,-1)}
  const all=ls.get('trk',{});
  const mStart=new Date(today.getFullYear(),today.getMonth(),1);
  let sum=0;for(let i=1;i<=today.getDate();i++)sum+=cnt(ymd(new Date(today.getFullYear(),today.getMonth(),i)));
  const pct=Math.round(sum/(5*today.getDate())*100);
  const total=Object.values(all).reduce((a,o)=>a+Object.keys(o).length,0);
  $('#tStats').innerHTML=`<div class="card"><b>${streak}</b><span class="mut small">hari beruntun lengkap</span></div><div class="card"><b>${pct}%</b><span class="mut small">bulan ini</span></div><div class="card"><b>${total}</b><span class="mut small">total sholat tercatat</span></div>`;
  // 7 hari
  let wk='';for(let i=6;i>=0;i--){const x=addDays(today,-i),c=cnt(ymd(x));wk+=`<div><i style="height:${Math.max(4,c/5*80)}px"></i>${c}/5<br>${x.toLocaleDateString('id-ID',{weekday:'short'})}</div>`}
  $('#tWeek').innerHTML=wk;
  // bulan
  const y=tMon.getFullYear(),m=tMon.getMonth(),dim=new Date(y,m+1,0).getDate();
  $('#tMonthT').textContent=tMon.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  let h=['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=>`<div class="hh">${x}</div>`).join('');
  const off=(new Date(y,m,1).getDay()+6)%7;
  for(let i=0;i<off;i++)h+='<div class="hh"></div>';
  for(let i=1;i<=dim;i++){const dt=new Date(y,m,i),c=dt>today?0:cnt(ymd(dt));h+=`<div class="l${c} ${ymd(dt)===k?'sel':''}" data-d="${ymd(dt)}" title="${c}/5">${i}</div>`}
  $('#tMonth').innerHTML=h;
  $$('#tMonth [data-d]').forEach(e=>e.onclick=()=>{const [yy,mm,dd]=e.dataset.d.split('-');const nd=new Date(+yy,+mm-1,+dd,12);if(nd<=today){tDay=nd;renderTracker()}});
}
$('#tPrev').onclick=()=>{tDay=addDays(tDay,-1);renderTracker()};
$('#tNext').onclick=()=>{if(ymd(tDay)<ymd(new Date())){tDay=addDays(tDay,1);renderTracker()}};
$('#tmPrev').onclick=()=>{tMon=new Date(tMon.getFullYear(),tMon.getMonth()-1,1);renderTracker()};
$('#tmNext').onclick=()=>{tMon=new Date(tMon.getFullYear(),tMon.getMonth()+1,1);renderTracker()};

/* ================= Kalender Hijriah ================= */
let cMon=new Date(new Date().getFullYear(),new Date().getMonth(),1),cSel=new Date();
function renderCal(){
  const y=cMon.getFullYear(),m=cMon.getMonth(),dim=new Date(y,m+1,0).getDate(),todayK=ymd(new Date());
  $('#cTitle').textContent=cMon.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  const a=hijri(new Date(y,m,1,12)),b=hijri(new Date(y,m,dim,12));
  $('#cHijri').textContent=a.m===b.m?`${HM[a.m-1]} ${a.y} H`:`${HM[a.m-1]} ${a.y} – ${HM[b.m-1]} ${b.y} H`;
  let h=['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(x=>`<div class="hd">${x}</div>`).join('');
  for(let i=0;i<new Date(y,m,1).getDay();i++)h+='<div class="c empty"></div>';
  for(let i=1;i<=dim;i++){
    const dt=new Date(y,m,i,12),{h:hh,it}=dayInfo(dt),k=ymd(dt);
    h+=`<div class="c ${k===todayK?'today':''} ${k===ymd(cSel)?'sel':''}" data-d="${k}"><b>${i}</b><span class="dots">${kindDot(it).map(x=>`<i class="dot ${x}"></i>`).join('')}</span><small>${hh.d===1?HM[hh.m-1].slice(0,3):hh.d}</small></div>`;
  }
  $('#cal').innerHTML=h;
  $$('#cal [data-d]').forEach(e=>e.onclick=()=>{const [yy,mm,dd]=e.dataset.d.split('-');cSel=new Date(+yy,+mm-1,+dd,12);renderCal()});
  const {h:sh,it}=dayInfo(cSel);
  $('#cDetail').innerHTML=`<b>${fmtLong(cSel)}</b><div class="mut">${hStr(sh)}</div><div class="mt">${it.length?it.map(tagHtml).join(''):'<span class="mut small">Tidak ada hari besar atau puasa sunnah khusus.</span>'}</div>`;
}
$('#cPrev').onclick=()=>{cMon=new Date(cMon.getFullYear(),cMon.getMonth()-1,1);renderCal()};
$('#cNext').onclick=()=>{cMon=new Date(cMon.getFullYear(),cMon.getMonth()+1,1);renderCal()};

/* ================= Puasa & Imsakiyah ================= */
let iMon=new Date(new Date().getFullYear(),new Date().getMonth(),1);
function renderFastList(){
  const today=new Date();let h='';
  for(let i=0;i<45;i++){
    const d=addDays(today,i),{h:hh,it}=dayInfo(d),f=it.filter(x=>x.k==='S'||x.k==='H');
    if(!f.length)continue;
    const lbl=i===0?'Hari ini':i===1?'Besok':d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'short'});
    h+=`<div class="fl"><span><b>${lbl}</b><br><span class="mut small">${hStr(hh)}</span></span><span style="text-align:right">${f.map(tagHtml).join('')}</span></div>`;
  }
  $('#fastList').innerHTML=h||'<div class="mut">Tidak ada.</div>';
}
function minus10(s){const [h,m]=s.split(':').map(Number);const t=((h*60+m-10)%1440+1440)%1440;return `${pad(Math.floor(t/60))}:${pad(t%60)}`}
async function renderPuasa(){
  renderFastList();
  if(!$('#iRam')){
    $('#imsak').parentElement.insertAdjacentHTML('beforebegin','<button class="btn ghost sm" id="iRam">Lompat ke Ramadhan berikutnya</button>');
    $('#iRam').onclick=()=>{
      const t=new Date();
      for(let i=0;i<420;i++){const d=addDays(t,i);if(hijri(d).m===9){iMon=new Date(d.getFullYear(),d.getMonth(),1);renderPuasa();return}}
    };
  }
  const y=iMon.getFullYear(),m=iMon.getMonth();
  $('#iTitle').textContent='Imsakiyah '+iMon.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  $('#iLoc').textContent='📍 '+place.name;
  $('#imsak').innerHTML='<tr><td class="mut">Memuat…</td></tr>';
  let md;
  try{md=await monthData(y,m+1)}catch(e){$('#imsak').innerHTML='<tr><td class="mut">Gagal memuat. Periksa koneksi internet.</td></tr>';return}
  const todayK=ymd(new Date());
  let h='<tr><th>Tgl</th><th>Hijriah</th><th>Imsak</th><th>Subuh</th><th>Dzuhur</th><th>Ashar</th><th>Maghrib</th><th>Isya</th></tr>';
  md.forEach((x,i)=>{
    const d=new Date(y,m,i+1,12),hh=hijri(d);
    h+=`<tr class="${ymd(d)===todayK?'today':''}"><td>${i+1}</td><td>${hh.d} ${HM[hh.m-1].slice(0,3)}</td><td>${minus10(x.t[0])}</td><td>${x.t[0]}</td><td>${x.t[2]}</td><td>${x.t[3]}</td><td>${x.t[4]}</td><td>${x.t[5]}</td></tr>`;
  });
  $('#imsak').innerHTML=h;
}
$('#iPrev').onclick=()=>{iMon=new Date(iMon.getFullYear(),iMon.getMonth()-1,1);renderPuasa()};
$('#iNext').onclick=()=>{iMon=new Date(iMon.getFullYear(),iMon.getMonth()+1,1);renderPuasa()};

/* ================= Kiblat ================= */
const KAABA=[21.4225,39.8262];
function qiblaBearing(lat,lon){
  const r=Math.PI/180,p1=lat*r,p2=KAABA[0]*r,dl=(KAABA[1]-lon)*r;
  const y=Math.sin(dl),x=Math.cos(p1)*Math.tan(p2)-Math.sin(p1)*Math.cos(dl);
  return (Math.atan2(y,x)/r+360)%360;
}
let qb=0,heading=null,compassOn=false;
function updateQibla(){
  qb=qiblaBearing(place.lat,place.lon);
  const rot=qb-(heading||0);
  $('#needle').style.transform=`rotate(${rot}deg)`;
  let txt=`Arah kiblat dari ${place.name}: ${qb.toFixed(1)}° dari utara (searah jarum jam).`;
  if(compassOn&&heading!=null){
    const d=Math.abs(((rot%360)+540)%360-180);
    if(d>177)txt+=' ✅ Anda sudah menghadap kiblat.';
  }
  $('#qinfo').textContent=txt;
}
$('#compassBtn').onclick=async()=>{
  try{
    if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
      if(await DeviceOrientationEvent.requestPermission()!=='granted')return toast('Izin kompas ditolak.');
    }
    const h=e=>{
      const v=e.webkitCompassHeading!=null?e.webkitCompassHeading:(e.alpha!=null?360-e.alpha:null);
      if(v!=null){heading=v;compassOn=true;updateQibla()}
    };
    window.addEventListener('deviceorientationabsolute',h,true);
    window.addEventListener('deviceorientation',h,true);
    toast('Kompas aktif. Letakkan ponsel mendatar lalu putar badan.');
  }catch(e){toast('Kompas tidak tersedia di perangkat ini.')}
};

/* ================= Tasbih & Doa ================= */
let tc=ls.get('tas',0);
$('#tas').textContent=tc;
$('#tasTarget').value=String(ls.get('tasT',33));
$('#tasTarget').onchange=e=>ls.set('tasT',+e.target.value);
$('#tas').onclick=()=>{
  tc++;const t=+$('#tasTarget').value;
  $('#tas').textContent=tc;ls.set('tas',tc);
  if(navigator.vibrate)navigator.vibrate(t&&tc%t===0?[200,80,200]:12);
};
$('#tasReset').onclick=()=>{tc=0;$('#tas').textContent=0;ls.set('tas',0)};
const DOA=[
 ['Doa sebelum makan','بِسْمِ اللهِ','Bismillah','Dengan menyebut nama Allah.'],
 ['Doa sesudah makan','الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ','Alhamdulillahilladzi ath’amanaa wa saqoonaa wa ja’alanaa muslimiin','Segala puji bagi Allah yang telah memberi kami makan dan minum serta menjadikan kami muslim.'],
 ['Doa sebelum tidur','بِاسْمِكَ اللَّهُمَّ أَحْيَا وَبِاسْمِكَ أَمُوتُ','Bismika allahumma ahyaa wa bismika amuut','Dengan nama-Mu ya Allah aku hidup dan dengan nama-Mu aku mati.'],
 ['Doa bangun tidur','الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ','Alhamdulillahilladzi ahyaanaa ba’da maa amaatanaa wa ilaihin nusyuur','Segala puji bagi Allah yang telah menghidupkan kami setelah mematikan kami, dan kepada-Nya kami dikembalikan.'],
 ['Doa masuk rumah','بِسْمِ اللهِ وَلَجْنَا وَبِسْمِ اللهِ خَرَجْنَا وَعَلَى رَبِّنَا تَوَكَّلْنَا','Bismillahi walajnaa wa bismillahi kharajnaa wa ’alaa rabbinaa tawakkalnaa','Dengan nama Allah kami masuk, dengan nama Allah kami keluar, dan kepada Tuhan kami bertawakal.'],
 ['Doa keluar rumah','بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ','Bismillahi tawakkaltu ’alallahi laa hawla wa laa quwwata illaa billaah','Dengan nama Allah, aku bertawakal kepada Allah; tiada daya dan kekuatan kecuali dengan pertolongan Allah.'],
 ['Doa masuk masjid','اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ','Allahummaftah lii abwaaba rahmatik','Ya Allah, bukakanlah untukku pintu-pintu rahmat-Mu.'],
 ['Doa naik kendaraan','سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ','Subhaanalladzii sakhkhara lanaa haadzaa wa maa kunnaa lahu muqriniin, wa innaa ilaa rabbinaa lamunqalibuun','Maha Suci Allah yang telah menundukkan kendaraan ini bagi kami, padahal kami tidak mampu menguasainya, dan sesungguhnya kepada Tuhan kami pasti kembali.'],
 ['Doa untuk kedua orang tua','رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ وَارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا','Rabbighfir lii wa liwaalidayya warhamhumaa kamaa rabbayaanii shaghiiraa','Ya Tuhanku, ampunilah aku dan kedua orang tuaku, sayangilah mereka sebagaimana mereka mendidikku di waktu kecil.'],
 ['Doa sapu jagat','رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ','Rabbanaa aatinaa fid-dunyaa hasanah wa fil-aakhirati hasanah wa qinaa ’adzaaban-naar','Ya Tuhan kami, berilah kami kebaikan di dunia dan kebaikan di akhirat, dan lindungilah kami dari siksa neraka.'],
 ['Istighfar','أَسْتَغْفِرُ اللهَ الْعَظِيمَ','Astaghfirullahal ’azhiim','Aku memohon ampun kepada Allah Yang Maha Agung.'],
 ['Dzikir setelah sholat','سُبْحَانَ اللهِ ، الْحَمْدُ لِلَّهِ ، اللهُ أَكْبَرُ','Subhaanallah (33x), Alhamdulillah (33x), Allahu akbar (33x)','Maha Suci Allah, segala puji bagi Allah, Allah Maha Besar.']
];
$('#doa').innerHTML=DOA.map(d=>`<details><summary>${d[0]}</summary><div class="ar">${d[1]}</div><div class="lat">${d[2]}</div><div class="idn">${d[3]}</div></details>`).join('');

/* ================= Setelan ================= */
$('#theme').value=ls.get('theme','auto');
$('#theme').onchange=e=>{ls.set('theme',e.target.value);applyTheme()};
$('#hadj').value=String(ls.get('hadj',0));
$('#hadj').onchange=e=>{ls.set('hadj',+e.target.value);loadTimes();if($('#p-kalender').classList.contains('on'))renderCal()};
$('#qori').value=ls.get('qori','05');
$('#qori').onchange=e=>ls.set('qori',e.target.value);
$('#exp').onclick=()=>{
  const o={};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(P)&&!k.startsWith(P+'cal_'))o[k]=localStorage.getItem(k)}
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));
  a.download=`nurharian-cadangan-${ymd(new Date())}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
};
$('#imp').onclick=()=>$('#impFile').click();
$('#impFile').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const o=JSON.parse(await f.text());
    Object.entries(o).forEach(([k,v])=>{if(k.startsWith(P)&&typeof v==='string')localStorage.setItem(k,v)});
    toast('Cadangan dipulihkan. Memuat ulang…');setTimeout(()=>location.reload(),900);
  }catch(err){toast('File cadangan tidak valid.')}
};

/* ================= PWA ================= */
const net=$('#net');
function setNet(){net.textContent=navigator.onLine?'● Online':'● Offline';net.classList.toggle('off',!navigator.onLine)}
window.addEventListener('online',()=>{setNet();loadTimes()});
window.addEventListener('offline',setNet);setNet();
let dip=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(!dip)return;dip.prompt();await dip.userChoice;dip=null;$('#installBtn').hidden=true};
window.addEventListener('appinstalled',()=>{$('#installBtn').hidden=true;toast('Aplikasi terpasang.')});
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

/* ================= Mulai ================= */
route();loadTimes();loadSurahs();updateQibla();
})();
