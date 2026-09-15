/*
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Dongtube API - https://api.dongtube.id
 * scrape moviesublk (https://moviesublk.com/) movie & series streaming/download
 * api.dongtube.id 300++ endpoint 🔥
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Docs: https://api.dongtube.id/docs
 */
const BASE_URL = 'https://www.moviesublk.com';
const FEED_URL = `${BASE_URL}/feeds/posts/default`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
};

function cleanHtmlText(html) {
  return String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEntry(entry) {
  const title = (entry.title && entry.title.$t) || '';
  const altLink = (entry.link || []).find((l) => l.rel === 'alternate');
  const url = (altLink && altLink.href) || '';
  const published = (entry.published && entry.published.$t) || '';
  const updated = (entry.updated && entry.updated.$t) || '';

  const thumbnail =
    (entry.media$thumbnail && entry.media$thumbnail.url) ||
    (entry.content && entry.content.$t && entry.content.$t.match(/src="([^"]+\.(?:jpe?g|png|webp))"/i)?.[1]) ||
    '';

  const categories = (entry.category || []).map((c) => c.term);

  return {
    title,
    url,
    thumbnail,
    categories,
    published,
    updated,
  };
}

function parseDetailFromHtml(html, url = '') {
  let seriesData = null;
  const matchSeries = html.match(/seriesData\s*=\s*(\{[\s\S]*?\n\s*\});/);
  if (matchSeries) {
    try {
      const fn = new Function('return ' + matchSeries[1]);
      seriesData = fn();
    } catch {}
  }

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? cleanHtmlText(titleMatch[1]) : '';

  const thumbnailMatch = html.match(/<div class="separator"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i)
    || html.match(/<img[^>]+src="([^"]+\.(?:jpe?g|png|webp))"/i);
  const thumbnail = thumbnailMatch ? thumbnailMatch[1] : '';

  const info = {};
  const metaRegex = /<b[^>]*>([^:<]+):?<\/b>\s*([^<]+)/gi;
  let m;
  while ((m = metaRegex.exec(html)) !== null) {
    const k = m[1].trim().toLowerCase();
    const v = m[2].trim();
    if (k && v) info[k] = v;
  }

  const singleButtons = [];
  const btnRegex = /<a[^>]+href="([^"]+)"[^>]*class="[^"]*download-btn[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let bMatch;
  while ((bMatch = btnRegex.exec(html)) !== null) {
    singleButtons.push({
      label: cleanHtmlText(bMatch[2]),
      url: bMatch[1],
    });
  }

  return {
    title,
    url,
    thumbnail,
    info,
    series: seriesData,
    downloads: singleButtons.length ? singleButtons : undefined,
  };
}

async function moviesublk(action = 'latest', params = {}) {
  const q = params.q || '';
  const targetUrl = params.url || '';
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const maxResults = 15;
  const startIndex = (page - 1) * maxResults + 1;

  if (action === 'detail' || targetUrl) {
    if (!targetUrl) throw new Error('Parameter url diperlukan untuk action detail');
    const res = await fetch(targetUrl, { headers: HEADERS });
    const html = await res.text();
    return {
      status: true,
      data: parseDetailFromHtml(html, targetUrl),
    };
  }

  let feedUrl = `${FEED_URL}?alt=json&start-index=${startIndex}&max-results=${maxResults}`;
  if (action === 'search' || q) {
    feedUrl += `&q=${encodeURIComponent(q)}`;
  }

  const res = await fetch(feedUrl, { headers: HEADERS });
  const data = await res.json();
  const feed = data && data.feed;
  if (!feed) throw new Error('Feed tidak valid dari moviesublk');

  const totalResults = parseInt((feed.openSearch$totalResults && feed.openSearch$totalResults.$t) || '0', 10);
  const items = (feed.entry || []).map(parseEntry);

  return {
    status: true,
    page,
    total: totalResults,
    hasNext: startIndex + items.length <= totalResults,
    items,
  };
}

module.exports = moviesublk;

// Contoh penggunaan:
// moviesublk('latest').then(console.log).catch(console.error);
// moviesublk('search', { q: 'love' }).then(console.log).catch(console.error);
// moviesublk('detail', { url: 'https://www.moviesublk.com/2026/09/blossom-through-cloud-s01-2026-sinhala.html' }).then(console.log).catch(console.error);
