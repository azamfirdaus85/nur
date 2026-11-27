/**
 * api/send.js — pengirim notifikasi sholat (Web Push).
 * Dipanggil setiap menit oleh penjadwal luar (mis. cron-job.org):
 *   https://DOMAIN-ANDA/api/send?key=ISI_CRON_SECRET
 * Tes langsung (kirim "Tes notifikasi" ke semua perangkat terdaftar):
 *   https://DOMAIN-ANDA/api/send?key=ISI_CRON_SECRET&test=1
 */
const crypto = require('crypto');
const { getDb, init, setupVapid, webpush } = require('./_lib');

const PRAYERS = [['Fajr', 'Subuh'], ['Dhuhr', 'Dzuhur'], ['Asr', 'Ashar'], ['Maghrib', 'Maghrib'], ['Isha', 'Isya']];
const NOW_WINDOW = 6 * 60 * 1000; // notifikasi "waktu masuk" masih dikirim sampai 6 menit setelahnya

const sha = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 24);
const pad = n => String(n).padStart(2, '0');

function localParts(date, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'
  });
  return Object.fromEntries(f.formatToParts(date).map(p => [p.type, p.value]));
}

// jam lokal di zona waktu lokasi -> Date absolut (sama dengan logika di app.js)
function zdate(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off = t => {
    const p = localParts(new Date(t), tz);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - t;
  };
  let t = guess - off(guess);
  t = guess - off(t);
  return new Date(t);
}

async function monthData(db, lat, lon, y, m) {
  const k = `cal_${lat.toFixed(2)}_${lon.toFixed(2)}_${y}_${m}`;
  const hit = await db.execute({ sql: 'SELECT v FROM tcache WHERE k=?', args: [k] });
  if (hit.rows.length) return JSON.parse(hit.rows[0].v);
  const r = await fetch(`https://api.aladhan.com/v1/calendar/${y}/${m}?latitude=${lat}&longitude=${lon}&method=20`);
  if (!r.ok) throw new Error('aladhan HTTP ' + r.status);
  const j = await r.json();
  if (!j || j.code !== 200 || !Array.isArray(j.data)) throw new Error('data aladhan tidak valid');
  const v = j.data.map(x => ({ t: PRAYERS.map(([key]) => x.timings[key].slice(0, 5)), tz: x.meta.timezone }));
  await db.execute({
    sql: 'INSERT OR REPLACE INTO tcache(k,d,v) VALUES(?,?,?)',
    args: [k, `${y}-${pad(m)}`, JSON.stringify(v)]
  });
  return v;
}

module.exports = async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(500).json({ error: 'CRON_SECRET belum diatur di server' });
    const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || (req.query && req.query.key) || '';
    if (!crypto.timingSafeEqual(Buffer.from(sha(given)), Buffer.from(sha(secret))))
      return res.status(401).json({ error: 'tidak diizinkan' });

    await init();
    setupVapid();
    const db = getDb();
    const now = new Date();
    const test = req.query && req.query.test === '1';
    const subs = (await db.execute('SELECT endpoint,sub,lat,lon,tz,pre,adzan,name FROM subs')).rows;
    const stats = { subs: subs.length, sent: 0, removed: 0, failed: 0, errors: [] };

    // 'ok' | 'gone' | 'fail'
    async function push(row, payload) {
      try {
        await webpush.sendNotification(JSON.parse(row.sub), JSON.stringify(payload), { TTL: 600, urgency: 'high' });
        stats.sent++;
        return 'ok';
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await db.execute({ sql: 'DELETE FROM subs WHERE endpoint=?', args: [row.endpoint] });
          stats.removed++;
          return 'gone';
        }
        stats.failed++;
        console.error('push gagal', e.statusCode, e.message);
        return 'fail';
      }
    }

    if (test) {
      for (const row of subs) {
        await push(row, { title: 'Tes notifikasi', body: 'Notifikasi Nur Harian sudah aktif di perangkat ini.', tag: 'tes', t: Date.now() });
      }
      return res.status(200).json({ ok: true, test: true, ...stats });
    }

    const cache = new Map();
    const getMonth = async (row, y, m) => {
      const k = `${row.lat.toFixed(2)}|${row.lon.toFixed(2)}|${y}|${m}`;
      if (!cache.has(k)) cache.set(k, monthData(db, row.lat, row.lon, y, m).catch(e => { cache.delete(k); throw e; }));
      return cache.get(k);
    };

    for (const row of subs) {
      try {
        const lp = localParts(now, row.tz);
        const y = +lp.year, m = +lp.month, d = +lp.day;
        const md = await getMonth(row, y, m);
        const day = md[d - 1];
        if (!day) continue;

        for (let i = 0; i < PRAYERS.length; i++) {
          const [key, label] = PRAYERS[i];
          const [h, mi] = day.t[i].split(':');
          const t = zdate(y, m, d, +h, +mi, row.tz);
          const diff = t - now;
          const jobs = [];
          if (row.pre > 0 && diff > 0 && diff <= row.pre * 60000) jobs.push('pre');
          if (diff <= 0 && -diff < NOW_WINDOW) jobs.push('now');

          for (const kind of jobs) {
            const k = `${sha(row.endpoint)}|${y}-${m}-${d}|${key}|${kind}`;
            const claim = await db.execute({ sql: 'INSERT OR IGNORE INTO sent(k,ts) VALUES(?,?)', args: [k, Date.now()] });
            if (claim.rowsAffected !== 1) continue; // sudah pernah dikirim
            const payload = kind === 'now'
              ? {
                  title: 'Waktu ' + label,
                  body: `Telah masuk waktu sholat ${label}` + (row.name ? ` untuk wilayah ${row.name}` : ''),
                  tag: `sholat-${key}-now`, adzan: !!row.adzan, t: t.getTime()
                }
              : {
                  title: `${row.pre} menit lagi ${label}`,
                  body: `Bersiaplah, waktu ${label} sebentar lagi masuk.`,
                  tag: `sholat-${key}-pre`, adzan: false, t: t.getTime()
                };
            const r = await push(row, payload);
            if (r === 'fail') await db.execute({ sql: 'DELETE FROM sent WHERE k=?', args: [k] }); // coba lagi menit berikutnya
            if (r === 'gone') break;
          }
        }
      } catch (e) {
        stats.errors.push(String(e.message || e).slice(0, 120));
      }
    }

    // bersih-bersih
    const old = new Date(now.getTime() - 40 * 86400000);
    await db.execute({ sql: 'DELETE FROM sent WHERE ts<?', args: [Date.now() - 3 * 86400000] });
    await db.execute({ sql: 'DELETE FROM tcache WHERE d<?', args: [`${old.getUTCFullYear()}-${pad(old.getUTCMonth() + 1)}`] });

    res.status(200).json({ ok: true, at: now.toISOString(), ...stats });
  } catch (e) {
    res.status(500).json({ error: 'server', detail: String(e.message || e) });
  }
};