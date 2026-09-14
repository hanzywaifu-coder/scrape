/*
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Dongtube API - https://api.dongtube.id
 * scrape jadwal sholat atau kalo mau pake api langsung bisa pake api.dongtube.id/info/jadwal-sholat
 * api.dongtube.id 300++ endpoint 🔥
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Docs: https://api.dongtube.id/docs
 */
const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

async function getJadwal(kota = 'jakarta', bulan = '', tahun = '') {
  const base = 'https://jadwalsholat.org/jadwal-sholat/monthly.php';
  const html = await get(base);

  let cityId = '308';
  let cityName = 'Jakarta';
  const input = String(kota).toLowerCase();

  const optRe = /<option\s+value="(\d+)"[^>]*>([^<]+)<\/option>/gi;
  let m;
  while ((m = optRe.exec(html)) !== null) {
    const id = m[1];
    const name = m[2].trim();
    if (id === input || name.toLowerCase() === input || name.toLowerCase().includes(input)) {
      cityId = id;
      cityName = name;
    }
  }

  let query = `?id=${cityId}`;
  if (bulan) query += `&m=${bulan}`;
  if (tahun) query += `&y=${tahun}`;

  const resHtml = await get(base + query);

  const periodeMatch = resHtml.match(/<h2 class="h2_edit">([^<]+)<\/h2>/i);
  const periode = periodeMatch ? periodeMatch[1].trim() : '';

  const schedule = [];
  const rowRe = /<tr class="table_(?:light|dark|highlight)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rMatch;
  while ((rMatch = rowRe.exec(resHtml)) !== null) {
    const tds = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRe.exec(rMatch[1])) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    if (tds.length >= 9) {
      schedule.push({
        tanggal: tds[0],
        imsak: tds[1],
        subuh: tds[2],
        terbit: tds[3],
        dhuha: tds[4],
        dzuhur: tds[5],
        ashar: tds[6],
        maghrib: tds[7],
        isya: tds[8],
      });
    }
  }

  const now = new Date();
  const day = String(new Date(now.getTime() + 7 * 3600 * 1000).getUTCDate()).padStart(2, '0');
  const today = schedule.find((s) => s.tanggal === day) || schedule[0];

  return {
    status: true,
    kota: cityName,
    kotaId: cityId,
    periode,
    today,
    monthly: schedule,
  };
}

(async () => {
  const result = await getJadwal(process.argv[2] || 'jakarta', process.argv[3] || '', process.argv[4] || '');
  console.log(JSON.stringify(result, null, 2));
})();
