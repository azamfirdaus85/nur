const crypto = require('crypto');
const { getDb, init, setupVapid, webpush } = require('./_lib');

const PR = ['Subuh', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'];
const PK = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const WINDOW = 8; // menit toleransi keterlambatan pemanggil cron

/* tanggal & menit-dalam-hari di zona waktu tertentu */
function localParts(tz, d) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
}

async function getTimes(db, lat, lon, date) {
  const k = `${lat}|${lon}|${date}`;
  const c = await db.execute({ sql: 'SELECT v FROM tcache WHERE k=?', args: [k] });
  if (c.rows.length) return JSON.parse(c.rows[0].v);
  const [y, m, d] = date.split('-');
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${lat}&longitude=${lon}&method=20`, { signal: ctl.signal });
    const j = await r.json();
    if (!j || j.code !== 200) throw new Error('aladhan');
    const t = {};
    PK.forEach(x => { t[x] = j.data.timings[x].slice(0, 5); });
    await db.execute({ sql: 'INSERT OR REPLACE INTO tcache(k,d,v) VALUES(?,?,?)', args: [k, date, JSON.stringify(t)] });
    return t;
  } finally { clearTimeout(to); }
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const qkey = (req.query && req.query.key) || '';
  if (!secret || (auth !== `Bearer ${secret}` && qkey !== secret)) return res.status(401).json({ error: 'unauthorized' });

  try {
    await init();
    setupVapid();
    const db = getDb();
    const now = new Date();

    // bersih-bersih data lama
    const cutoff = new Date(now.getTime() - 3 * 864e5);
    await db.execute({ sql: 'DELETE FROM sent WHERE ts<?', args: [cutoff.getTime()] });
    await db.execute({ sql: 'DELETE FROM tcache WHERE d<?', args: [cutoff.toISOString().slice(0, 10)] });

    const { rows } = await db.execute('SELECT endpoint,sub,lat,lon,tz,pre,adzan,name FROM subs');

    // tes cepat: /api/cron?key=SANDI&test=1 -> kirim "Tes notifikasi" ke semua perangkat terdaftar
    if (req.query && req.query.test === '1') {
      const t = { subs: rows.length, sent: 0, gone: 0, err: 0 };
      for (const r of rows) {
        try {
          await webpush.sendNotification(JSON.parse(r.sub), JSON.stringify({ title: 'Tes notifikasi', body: 'Notifikasi Nur Harian sudah aktif di perangkat ini.', tag: 'tes', adzan: false, t: Date.now() }), { TTL: 300, urgency: 'high' });
          t.sent++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) { await db.execute({ sql: 'DELETE FROM subs WHERE endpoint=?', args: [r.endpoint] }); t.gone++; }
          else t.err++;
        }
      }
      return res.status(200).json({ test: true, ...t });
    }

    const cache = new Map(), jobs = [];

    for (const r of rows) {
      let lp;
      try { lp = localParts(r.tz, now); } catch (e) { continue; }
      const tk = `${r.lat}|${r.lon}|${lp.date}`;
      if (!cache.has(tk)) cache.set(tk, getTimes(db, r.lat, r.lon, lp.date).catch(() => null));
      const T = await cache.get(tk);
      if (!T) continue;
      for (let i = 0; i < 5; i++) {
        const [h, m] = T[PK[i]].split(':').map(Number);
        const tm = h * 60 + m;
        const kinds = [['now', tm]];
        if (r.pre > 0) kinds.push(['pre', tm - r.pre]);
        for (const [kind, target] of kinds) {
          const diff = lp.min - target;
          if (diff >= 0 && diff <= WINDOW) jobs.push({ r, i, kind, date: lp.date });
        }
      }
    }

    const stat = { subs: rows.length, due: jobs.length, sent: 0, dup: 0, gone: 0, err: 0 };

    async function run(j) {
      const { r, i, kind, date } = j;
      const key = crypto.createHash('sha1').update(r.endpoint).digest('hex') + `|${date}|${PK[i]}|${kind}`;
      const ins = await db.execute({ sql: 'INSERT OR IGNORE INTO sent(k,ts) VALUES(?,?)', args: [key, Date.now()] });
      if (!ins.rowsAffected) return 'dup';
      const place = r.name ? ` untuk wilayah ${r.name}` : '';
      const payload = kind === 'now'
        ? { title: 'Waktu ' + PR[i], body: `Telah masuk waktu sholat ${PR[i]}${place}`, tag: `sholat-${PK[i]}-now`, adzan: !!r.adzan, t: Date.now() }
        : { title: `${r.pre % 60 === 0 ? (r.pre / 60) + ' jam' : r.pre + ' menit'} lagi ${PR[i]}`, body: `Bersiaplah, waktu ${PR[i]} sebentar lagi masuk.`, tag: `sholat-${PK[i]}-pre`, adzan: false, t: Date.now() };
      try {
        await webpush.sendNotification(JSON.parse(r.sub), JSON.stringify(payload), { TTL: 900, urgency: 'high' });
        return 'sent';
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await db.execute({ sql: 'DELETE FROM subs WHERE endpoint=?', args: [r.endpoint] });
          return 'gone';
        }
        await db.execute({ sql: 'DELETE FROM sent WHERE k=?', args: [key] }); // boleh dicoba lagi di panggilan berikutnya
        return 'err';
      }
    }

    for (let n = 0; n < jobs.length; n += 20) {
      const out = await Promise.allSettled(jobs.slice(n, n + 20).map(run));
      out.forEach(o => { stat[o.status === 'fulfilled' ? o.value : 'err']++; });
    }
    res.status(200).json(stat);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};