const { getDb, init } = require('./_lib');

function validTz(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch (e) { return false; }
}

module.exports = async (req, res) => {
  try {
    await init();
    const db = getDb();
    const b = req.body && typeof req.body === 'object' ? req.body : {};

    if (req.method === 'DELETE') {
      if (typeof b.endpoint !== 'string' || b.endpoint.length > 1000) return res.status(400).json({ error: 'endpoint tidak valid' });
      await db.execute({ sql: 'DELETE FROM subs WHERE endpoint=?', args: [b.endpoint] });
      return res.status(200).json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

    const s = b.subscription;
    if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000 ||
        !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string')
      return res.status(400).json({ error: 'subscription tidak valid' });
    const lat = Number(b.lat), lon = Number(b.lon);
    if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) return res.status(400).json({ error: 'lokasi tidak valid' });
    if (typeof b.tz !== 'string' || !validTz(b.tz)) return res.status(400).json({ error: 'zona waktu tidak valid' });
    const pre = [0, 5, 10, 15, 60].includes(Number(b.pre)) ? Number(b.pre) : 0;
    const adzan = b.adzan ? 1 : 0;
    const name = String(b.name || '').slice(0, 80);

    await db.execute({
      sql: `INSERT INTO subs(endpoint,sub,lat,lon,tz,pre,adzan,name,updated) VALUES(?,?,?,?,?,?,?,?,?)
            ON CONFLICT(endpoint) DO UPDATE SET sub=excluded.sub,lat=excluded.lat,lon=excluded.lon,
            tz=excluded.tz,pre=excluded.pre,adzan=excluded.adzan,name=excluded.name,updated=excluded.updated`,
      args: [s.endpoint, JSON.stringify({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }),
        Math.round(lat * 100) / 100, Math.round(lon * 100) / 100, b.tz, pre, adzan, name, Date.now()]
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'server', detail: String(e.message || e) });
  }
};