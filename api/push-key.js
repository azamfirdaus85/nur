module.exports = (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(500).json({ error: 'VAPID belum diatur di server' });
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ key });
};
