# Nur Harian

Aplikasi web Islami (PWA): waktu sholat, adzan, Al-Qur'an offline, kiblat, kalender Hijriah,
jadwal puasa + imsakiyah, tracker sholat, tasbih & doa. Tanpa login, data tersimpan di perangkat.

## Menjalankan di laptop
Service worker (PWA/offline) butuh http://localhost atau https, bukan file://.

    cd nurharian
    python -m http.server 8080
    # buka http://localhost:8080

Atau VS Code: ekstensi "Live Server" -> klik kanan index.html -> Open with Live Server.

## Adzan asli
Letakkan file MP3 adzan (yang boleh Anda pakai) di `audio/adzan.mp3`.
Tanpa file itu, aplikasi memakai bunyi beep. Tombol "Tes adzan" ada di halaman Waktu Sholat.

## Deploy ke Vercel
Upload folder ini apa adanya (situs statis, tanpa build). Setelah online lewat https,
tombol "Pasang" muncul di Chrome/Edge, dan di ponsel pakai menu "Tambahkan ke layar utama".

## Web Push dari server (notifikasi saat aplikasi tertutup)
Butuh server + internet. Tanpa ini, aplikasi tetap berjalan offline seperti sebelumnya.

1. Buat database Turso (gratis), catat URL dan token-nya.
2. Buat kunci VAPID: `npx web-push generate-vapid-keys`
3. Di Vercel > Settings > Environment Variables, isi (lihat `.env.example`):
   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
4. Deploy ulang. Vercel otomatis memasang dependensi dari package.json.
5. Penjadwal: Vercel Hobby hanya mengizinkan cron 1x sehari, jadi pakai penjadwal luar gratis
   (mis. cron-job.org): panggil `GET https://DOMAIN-ANDA/api/cron` setiap 1 menit dengan header
   `Authorization: Bearer ISI_CRON_SECRET`. (Alternatif: `?key=ISI_CRON_SECRET` di URL.)
   Di Vercel Pro, boleh pakai `crons` di vercel.json dengan jadwal `* * * * *`.
6. Buka aplikasi > Setelan > centang "Notifikasi walau aplikasi tertutup".

Catatan: suara adzan penuh tidak bisa diputar oleh push (notifikasi memakai suara bawaan perangkat).
Adzan diputar bila aplikasi sedang terbuka, atau saat notifikasi diketuk (jika adzan diaktifkan).
iPhone: wajib dipasang ke layar utama (iOS 16.4+).

## Struktur
index.html, css/style.css, js/app.js, sw.js, manifest.webmanifest, icons/, audio/,
api/ (push-key, subscribe, cron, _lib), package.json, .env.example
Sumber data: Aladhan API (metode Kemenag RI) dan equran.id.
