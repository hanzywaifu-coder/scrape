const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://manwhaku.my.id';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

function httpGet(url, redirect = true) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity'
      },
      timeout: 25000
    };
    const req = https.get(u.toString(), options, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (redirect) {
          const loc = res.headers.location;
          res.resume();
          if (loc) return resolve(httpGet(loc));
          return reject(new Error('Redirect tanpa location'));
        }
        resolve({ body: '', statusCode: res.statusCode });
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), statusCode: res.statusCode }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpHead(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      method: 'HEAD',
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
      timeout: 10000
    };
    const req = https.request(u.toString(), options, res => {
      resolve({ statusCode: res.statusCode, headers: res.headers });
      res.resume();
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function getMangaList(html) {
  const slugs = new Set();
  const titles = new Map();
  const re1 = /href="\/manga\/([^\"]+)"/g;
  let m;
  while ((m = re1.exec(html))) slugs.add(m[1]);
  const re2 = /<a[^>]*href="\/manga\/([^\"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = re2.exec(html))) {
    const t = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (t && t.length > 0 && t.length < 200) titles.set(m[1], t);
  }
  return [...slugs].map(s => ({
    slug: s,
    title: titles.get(s) || s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    url: BASE + '/manga/' + s
  }));
}

function getChapters(html, slug) {
  const seen = new Set();
  const chapters = [];
  const slugEsc = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const re1 = new RegExp('href="\/read/' + slugEsc + '-chapter-(\\d+)"', 'g');
  let m;
  while ((m = re1.exec(html))) {
    const num = parseInt(m[1], 10);
    if (!seen.has(num)) {
      seen.add(num);
      chapters.push({ number: num, url: BASE + '/read/' + slug + '-chapter-' + num, type: 'direct' });
    }
  }

  if (chapters.length === 0) {
    const re2 = /href="\/read\/bkch_([^:"]+)"/g;
    while ((m = re2.exec(html))) {
      try {
        const decoded = decodeURIComponent(m[1]);
        const chMatch = decoded.match(/[Cc]hapter[-_]?(\d+)/);
        if (chMatch) {
          const num = parseInt(chMatch[1], 10);
          if (!seen.has(num)) {
            seen.add(num);
            chapters.push({ number: num, url: BASE + '/read/bkch_' + encodeURIComponent(decoded), type: 'redirect', sourceUrl: decoded });
          }
        }
      } catch {}
    }
  }

  return chapters.sort((a, b) => b.number - a.number);
}

function extractFirstImageUrl(html) {
  const candidates = [];
  const reNextImage = /_next\/image\?url=([^&"']+)/gi;
  let m;
  while ((m = reNextImage.exec(html))) {
    try { candidates.push(decodeURIComponent(m[1])); } catch {}
  }
  const reDirectUrl = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]+)?)/gi;
  while ((m = reDirectUrl.exec(html))) {
    let u = m[1].replace(/\\+$/, '');
    if (!candidates.includes(u)) candidates.push(u);
  }
  return candidates[0] || null;
}

function guessCdnPatterns(firstUrl, chapterNum, slug) {
  const patterns = [];
  try {
    const first = new URL(firstUrl);
    const pathname = first.pathname;

    const cdncidMatch = pathname.match(/\/uploads\/(\d{4})\/(\d{2})\/([^\/]+)-(\d+)-(\d{2})\.(jpg|jpeg|png|webp)/);
    if (cdncidMatch) {
      const [, year, month, name, ch, num, ext] = cdncidMatch;
      patterns.push({
        build: n => `https://cdncid.csmcscns.id/uploads/${year}/${month}/${name}-${chapterNum}-${String(n).padStart(2, '0')}.${ext}`,
        test: n => n >= 1
      });
    }

    const skyfileMatch = pathname.match(/\/wp-content\/uploads\/images\/b\/([^\/]+)\/chapter-(\d+)\/(\d+)\.(jpg|jpeg|png|webp)/);
    if (skyfileMatch) {
      const [, name, ch, num, ext] = skyfileMatch;
      patterns.push({
        build: n => `https://csid.skyfile.me/wp-content/uploads/images/b/${name}/chapter-${chapterNum}/${n}.${ext}`,
        test: n => n >= 1
      });
    }

    const genericMatch = pathname.match(/([^\/]+)\/(\d+)\.(jpg|jpeg|png|webp)$/);
    if (genericMatch && !patterns.length) {
      const [, name, num, ext] = genericMatch;
      patterns.push({
        build: n => firstUrl.replace(name + '/' + num + '.' + ext, name + '/' + n + '.' + ext),
        test: n => n >= 1
      });
    }
  } catch {}
  return patterns;
}

async function downloadImage(url, outFile) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA }, timeout: 30000 }, res => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); res.resume(); return; }
      const ws = fs.createWriteStream(outFile);
      res.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function downloadChapter(slug, chapterNum, outputDir) {
  const chapterUrl = BASE + '/read/' + slug + '-chapter-' + chapterNum;
  let firstUrl = null;
  try {
    const { body } = await httpGet(chapterUrl, true);
    firstUrl = extractFirstImageUrl(body);
  } catch {}

  if (!firstUrl) {
    console.error('Tidak ditemukan gambar di chapter ' + chapterNum);
    return 0;
  }

  const patterns = guessCdnPatterns(firstUrl, chapterNum, slug);
  const dir = path.resolve(outputDir, slug, 'chapter-' + String(chapterNum).padStart(3, '0'));
  fs.mkdirSync(dir, { recursive: true });

  if (patterns.length === 0) {
    const ext = path.extname(new URL(firstUrl).pathname).split('?')[0] || '.jpg';
    const outFile = path.join(dir, '001' + ext);
    try {
      await downloadImage(firstUrl, outFile);
      console.log('Download 1 gambar (fallback) untuk chapter ' + chapterNum);
      console.log('Done: 1/1');
      return 1;
    } catch {
      console.error('Gagal download: ' + firstUrl);
      return 0;
    }
  }

  const pattern = patterns[0];
  let total = 0;
  for (let n = 1; n <= 500; n++) {
    const url = pattern.build(n);
    const outFile = path.join(dir, String(n).padStart(3, '0') + path.extname(new URL(url).pathname).split('?')[0]);
    try {
      await downloadImage(url, outFile);
      total++;
      process.stdout.write('.' + (n % 20 === 0 ? '\n' : ''));
    } catch {
      if (total > 0) break;
    }
  }
  console.log('\nDone: ' + total + ' gambar untuk chapter ' + chapterNum);
  return total;
}

if (require.main === module) {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  const outDir = arg2 || './downloads';

  if (cmd === 'search') {
    (async () => {
      const { body } = await httpGet(BASE + '/');
      const list = getMangaList(body);
      const ql = arg1.toLowerCase();
      const results = list.filter(m => m.title.toLowerCase().includes(ql) || m.slug.toLowerCase().includes(ql));
      console.log('Hasil search: ' + results.length);
      results.forEach((m, i) => console.log((i + 1) + '. ' + m.title + ' (' + m.slug + ')'));
    })().catch(e => console.error(e.message));
  } else if (cmd === 'detail') {
    (async () => {
      const { body } = await httpGet(BASE + '/manga/' + arg1);
      const chapters = getChapters(body, arg1);
      const titleMatch = body.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(/\s*-\s*Manwhaku.*$/i, '').trim() : arg1.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      console.log('Judul: ' + title);
      console.log('Slug: ' + arg1);
      console.log('Total chapter: ' + chapters.length);
      console.log('10 chapter terbaru:');
      chapters.slice(0, 10).forEach(c => console.log('  Chapter ' + c.number));
    })().catch(e => console.error(e.message));
  } else if (cmd === 'download') {
    const parts = arg1.split(':');
    const slug = parts[0];
    const chapter = parseInt(parts[1], 10);
    if (!slug || !chapter) {
      console.error('Usage: node manwhaku.js download <slug>:<chapter>');
      console.error('Contoh: node manwhaku.js download bad-person:100');
      process.exit(1);
    }
    (async () => {
      await downloadChapter(slug, chapter, outDir);
    })().catch(e => console.error(e.message));
  } else if (cmd === 'list') {
    (async () => {
      const { body } = await httpGet(BASE + '/');
      const list = getMangaList(body);
      console.log('Total manga: ' + list.length);
      list.forEach((m, i) => console.log((i + 1) + '. ' + m.title + ' (' + m.slug + ')'));
    })().catch(e => console.error(e.message));
  } else {
    console.log('Usage:');
    console.log('  node manwhaku.js list                  # tampilkan semua manga');
    console.log('  node manwhaku.js search <kata>        # cari manga');
    console.log('  node manwhaku.js detail <slug>        # lihat detail + daftar chapter');
    console.log('  node manwhaku.js download <slug>:<chapter>  # download chapter');
    console.log('Contoh:');
    console.log('  node manwhaku.js search lookism');
    console.log('  node manwhaku.js detail bad-person');
    console.log('  node manwhaku.js download bad-person:100');
  }
}
