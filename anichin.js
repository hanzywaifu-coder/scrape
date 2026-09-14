/*
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Dongtube API - https://api.dongtube.id
 * scrape anime / donghua Anichin (Latest & Search)
 * api.dongtube.id 300++ endpoint 🔥
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Docs: https://api.dongtube.id/docs
 */
const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

async function searchAnime(query) {
  const base = 'https://anichin.cafe';
  const target = query ? `${base}/?s=${encodeURIComponent(query)}` : `${base}/`;
  const html = await get(target);

  const results = [];
  const seen = new Set();
  const re = /<a[^>]+href="([^"]+subtitle-indonesia[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);

    const rawText = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const epMatch = rawText.match(/Episode\s+(\d+)/i);
    const title = rawText.replace(/Episode\s+\d+/i, '').trim();

    if (title && url) {
      results.push({
        title,
        url,
        episode: epMatch ? epMatch[1] : undefined,
      });
    }
  }

  return {
    status: true,
    query: query || 'latest',
    total: results.length,
    result: results,
  };
}

(async () => {
  const q = process.argv[2] || '';
  const data = await searchAnime(q);
  console.log(JSON.stringify(data, null, 2));
})();
