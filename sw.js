const VER='nurharian-v3';
const SHELL=['./','index.html','css/style.css','js/app.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
const OPTIONAL=['audio/adzan.mp3'];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VER);
    await c.addAll(SHELL);
    await Promise.all(OPTIONAL.map(u=>c.add(u).catch(()=>{})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const ks=await caches.keys();
    await Promise.all(ks.filter(k=>k!==VER).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return; // API (aladhan, equran) ditangani aplikasi + localStorage/IndexedDB
  if(url.pathname.includes('/api/'))return; // endpoint server (push) jangan di-cache
  // audio: cache-first (dengan dukungan Range sederhana: simpan respons penuh)
  e.respondWith((async()=>{
    const c=await caches.open(VER);
    const hit=await c.match(req,{ignoreSearch:true});
    const net=fetch(req).then(r=>{if(r&&r.ok&&r.status===200)c.put(req,r.clone());return r}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit}
    const r=await net;
    if(r)return r;
    if(req.mode==='navigate')return (await c.match('index.html'))||Response.error();
    return Response.error();
  })());
});

/* Web Push dari server */
self.addEventListener('push',e=>{
  let d={};
  try{d=e.data?e.data.json():{}}catch(_){}
  e.waitUntil(self.registration.showNotification(d.title||'Nur Harian',{
    body:d.body||'',
    icon:'icons/icon-192.png',
    badge:'icons/icon-192.png',
    tag:d.tag||'sholat',
    vibrate:[200,100,200],
    data:{adzan:!!d.adzan,t:d.t||Date.now()}
  }));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const data=e.notification.data||{};
  e.waitUntil((async()=>{
    const all=await clients.matchAll({type:'window',includeUncontrolled:true});
    if(all.length){
      const c=all[0];
      try{await c.focus()}catch(_){}
      if(data.adzan)c.postMessage({type:'play-adzan',t:data.t});
      return;
    }
    return clients.openWindow(data.adzan?`./?adzan=1&t=${data.t}`:'./');
  })());
});
