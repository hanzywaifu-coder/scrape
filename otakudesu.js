/*
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Dongtube API - https://api.dongtube.id
 * scrape Otakudesu (https://otakudesu.blog) Anime Streaming & Download
 * Menggunakan Puppeteer & Puppeteer-Extra Stealth (Headless Browser)
 * api.dongtube.id 300++ endpoint 🔥
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Docs: https://api.dongtube.id/docs
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://otakudesu.blog';

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
];

/**
 * Buka halaman dengan Puppeteer Stealth dan ambil HTML setelah Cloudflare lolos
 */
async function getPageHtml(url) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: LAUNCH_ARGS,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // Navigasi ke URL target
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Tunggu jika ada Cloudflare challenge
    try {
      await page.waitForFunction(
        () => !document.title.includes('Cloudflare') && !document.title.includes('Attention Required'),
        { timeout: 15000 }
      );
    } catch {}

    const html = await page.content();
    return html;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Parsing daftar anime on-going
 */
function parseOngoing(html) {
  const results = [];
  const regex =
    /<div class="detpost">[\s\S]*?<div class="epz"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="thumb"><a href="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h2 class="jdlflm">([^<]+)<\/h2>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const epText = m[1].replace(/<[^>]+>/g, '').trim();
    const link = m[2];
    const thumb = m[3];
    const title = m[4].trim();

    results.push({
      title,
      url: link,
      thumbnail: thumb,
      episode: epText,
    });
  }
  return results;
}

/**
 * Parsing detail anime & episode list
 */
function parseDetail(html) {
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<div class="jdlflm"[^>]*>([^<]+)<\/div>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const thumbMatch = html.match(/<div class="fotoanime">[\s\S]*?<img[^>]+src="([^"]+)"/i);
  const thumbnail = thumbMatch ? thumbMatch[1] : '';

  const sinopsisMatch = html.match(/<div class="sinopc">[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  const sinopsis = sinopsisMatch ? sinopsisMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  const episodes = [];
  const epRegex = /<a href="([^"]+)"[^>]*>([^<]+Episode\s+\d+[^<]*)<\/a>/gi;
  let em;
  while ((em = epRegex.exec(html)) !== null) {
    episodes.push({
      title: em[2].trim(),
      url: em[1],
    });
  }

  return {
    title,
    thumbnail,
    sinopsis,
    episodes,
  };
}

async function otakudesu(action = 'ongoing', params = {}) {
  if (action === 'ongoing' || action === 'home') {
    const html = await getPageHtml(`${BASE_URL}/ongoing-anime/`);
    return {
      status: true,
      data: parseOngoing(html),
    };
  }

  if (action === 'detail') {
    const target = params.url || (params.slug ? `${BASE_URL}/anime/${params.slug}` : '');
    if (!target) throw new Error('Parameter url atau slug diperlukan untuk detail');
    const html = await getPageHtml(target);
    return {
      status: true,
      data: parseDetail(html),
    };
  }

  if (action === 'search') {
    const q = params.q || '';
    if (!q) throw new Error('Parameter q diperlukan untuk pencarian');
    const html = await getPageHtml(`${BASE_URL}/?s=${encodeURIComponent(q)}&post_type=anime`);
    return {
      status: true,
      data: parseOngoing(html),
    };
  }

  throw new Error(`Aksi "${action}" tidak didukung`);
}

module.exports = otakudesu;

// Contoh penggunaan:
// otakudesu('ongoing').then(console.log).catch(console.error);
