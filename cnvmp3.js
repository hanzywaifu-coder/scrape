/*
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Dongtube API - https://api.dongtube.id
 * scrape cnvmp3 (https://cnvmp3.com/) converter/downloader YouTube/Shorts ke MP3 atau MP4
 * api.dongtube.id 300++ endpoint 🔥
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Docs: https://api.dongtube.id/docs
 */
const https = require('https');

const BASE_URL = 'https://cnvmp3.com';
const FETCH_URL = `${BASE_URL}/fetch.php`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': `${BASE_URL}/`,
  'Origin': BASE_URL,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

async function cnvmp3(url, format = 'mp3') {
  if (!url) throw new Error('Parameter url diperlukan');

  const downloadMode = String(format).toLowerCase() === 'mp4' || String(format).toLowerCase() === 'video' ? 'auto' : 'audio';

  let retries = 0;
  let lastRes = null;

  while (retries < 5) {
    const payload = {
      url,
      downloadMode,
      filenameStyle: 'basic',
    };

    const res = await fetch(FETCH_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    lastRes = await res.json().catch(() => null);

    if (lastRes && lastRes.status === 'rate-limit') {
      retries++;
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    break;
  }

  if (!lastRes) throw new Error('Tidak mendapat respon dari server cnvmp3');
  if (lastRes.error) throw new Error(lastRes.error.code || lastRes.error || 'Gagal memproses media');

  if (lastRes.url) {
    return {
      status: true,
      title: lastRes.filename || '',
      format: downloadMode === 'audio' ? 'mp3' : 'mp4',
      download_url: lastRes.url,
      original_url: url,
    };
  }

  throw new Error('URL download tidak ditemukan pada respon cnvmp3');
}

module.exports = cnvmp3;

// Contoh penggunaan:
// cnvmp3('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'mp3').then(console.log).catch(console.error);
