const { createClient } = require('@libsql/client');
const webpush = require('web-push');

let db = null, ready = null, vapidSet = false;

function getDb() {
  if (!db) db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  return db;
}

async function init() {
  if (!ready) {
    ready = getDb().batch([
      `CREATE TABLE IF NOT EXISTS subs (
        endpoint TEXT PRIMARY KEY, sub TEXT NOT NULL,
        lat REAL NOT NULL, lon REAL NOT NULL, tz TEXT NOT NULL,
        pre INTEGER NOT NULL DEFAULT 0, adzan INTEGER NOT NULL DEFAULT 0,
        name TEXT, updated INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS sent (k TEXT PRIMARY KEY, ts INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS tcache (k TEXT PRIMARY KEY, d TEXT NOT NULL, v TEXT NOT NULL)`
    ], 'write').catch(e => { ready = null; throw e; });
  }
  return ready;
}

function setupVapid() {
  if (vapidSet) return;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY belum diatur');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  vapidSet = true;
}

module.exports = { getDb, init, setupVapid, webpush };
