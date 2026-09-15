/*
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Dongtube API - https://api.dongtube.id
 * scrape Otakudesu (https://otakudesu.blog) Anime Streaming & Download
 * Multi-Engine / Multi-Fallback: Gateway Solver, Web Archive Mirror, & Google Cache Fallback
 * api.dongtube.id 300++ endpoint 🔥
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Docs: https://api.dongtube.id/docs
 */
const https = require('https');

const BASE_URL = 'https://otakudesu.blog';
const SOLVER_GATEWAY = 'https://cf.dongtube.cyou/v1';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Helper request HTTP standar native fetch / https
 */
async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      ...(options.headers || {}),
    },
    ...options,
  });
  return res.text();
}

/**
 * Strategi 1: Melalui Anti-bot Gateway (Solvearr / TLS Impersonator / Got-scraping)
 */
async function ambilViaGateway(targetUrl) {
  try {
    const res = await fetch(SOLVER_GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        engine: 'auto',
        maxTimeout: 30000,
      }),
    });
    const json = await res.json();
    if (json.status === 'ok' && json.solution && json.solution.status === 200) {
      if (json.solution.body) {
        return Buffer.from(json.solution.body, 'base64').toString('utf8');
      }
      if (json.solution.response) {
        return json.solution.response;
      }
    }
  } catch (e) {
    // Gateway tidak merespon / gagal
  }
  return null;
}

/**
 * Strategi 2: Melalui Web Archive Mirror (Wayback CDN) jika origin Cloudflare memblokir IP
 */
async function ambilViaArchive(targetUrl) {
  try {
    const cleanUrl = targetUrl.replace(/^https?:\/\//i, '');
    const archiveUrl = `https://web.archive.org/web/20260310111111/https://${cleanUrl}`;
    const html = await fetchText(archiveUrl, { timeout: 15000 });
    if (html && html.includes('otakudesu')) {
      return html;
    }
  } catch (e) {
    // Fallback error
  }
  return null;
}

/**
 * Multi-layer fetcher dengan fallback adaptif
 */
async function fetchOtakudesu(url) {
  // Coba langsung (Direct Fetch)
  try {
    const directHtml = await fetchText(url);
    if (directHtml && !directHtml.includes('Attention Required! | Cloudflare') && directHtml.includes('otakudesu')) {
      return directHtml;
    }
  } catch {}

  // Coba Anti-bot solver gateway
  const gatewayHtml = await ambilViaGateway(url);
  if (gatewayHtml && !gatewayHtml.includes('Attention Required! | Cloudflare') && gatewayHtml.includes('otakudesu')) {
    return gatewayHtml;
  }

  // Coba Archive / Cache mirror
  const archiveHtml = await ambilViaArchive(url);
  if (archiveHtml) {
    return archiveHtml;
  }

  throw new Error('Gagal memuat halaman otakudesu.blog dari semua jalur fallback (Cloudflare block)');
}

/**
 * Parsing daftar anime on-going dari HTML otakudesu
 */
function parseOngoing(html) {
  const results = [];
  const regex = /<div class="detpost">[\s\S]*?<div class="epz"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="thumb"><a href="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h2 class="jdlflm">([^<]+)<\/h2>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const epText = m[1].replace(/<[^>]+>/g, '').trim();
    const rawLink = m[2];
    const link = rawLink.includes('otakudesu.blog')
      ? 'https://otakudesu.blog' + rawLink.substring(rawLink.indexOf('otakudesu.blog') + 'otakudesu.blog'.length)
      : rawLink;
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
      url: em[1].replace(/.*https?:\/\/[^/]+(?:\/web\/[0-9]+\/https?:\/\/[^/]+)?/i, BASE_URL),
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
    const html = await fetchOtakudesu(`${BASE_URL}/`);
    return {
      status: true,
      data: parseOngoing(html),
    };
  }

  if (action === 'detail') {
    const target = params.url || (params.slug ? `${BASE_URL}/anime/${params.slug}` : '');
    if (!target) throw new Error('Parameter url atau slug diperlukan untuk detail');
    const html = await fetchOtakudesu(target);
    return {
      status: true,
      data: parseDetail(html),
    };
  }

  if (action === 'search') {
    const q = params.q || '';
    if (!q) throw new Error('Parameter q diperlukan untuk pencarian');
    const html = await fetchOtakudesu(`${BASE_URL}/?s=${encodeURIComponent(q)}&post_type=anime`);
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
