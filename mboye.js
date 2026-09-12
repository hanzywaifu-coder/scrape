const DEFAULT_API_KEY = "5a61a8e1df2f614dc83609925720c35d";
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

const SERVERS = {
  peachify: { movie: id => `https://peachify.top/embed/movie/${id}`, tv: (id, s, e) => `https://peachify.top/embed/tv/${id}/${s}/${e}` },
  vidplays: { movie: id => `https://vidplays.fun/embed/movie/${id}`, tv: (id, s, e) => `https://vidplays.fun/embed/tv/${id}/${s}/${e}` },
  xpass: { movie: id => `https://play.xpass.top/e/movie/${id}`, tv: (id, s, e) => `https://play.xpass.top/e/tv/${id}/${s}/${e}` },
  vidsrc: { movie: id => `https://vidsrc.to/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  embedsu: { movie: id => `https://embed.su/embed/movie/${id}`, tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}` },
  vidlink: { movie: id => `https://vidlink.pro/movie/${id}`, tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}` }
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchTmdb(path, params = {}) {
  const q = new URLSearchParams({ api_key: DEFAULT_API_KEY, ...params });
  const url = `${TMDB_BASE}${path}?${q.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/json" }
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`TMDB HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

function normalizeItem(x) {
  const t = x.media_type === "tv" ? "tv" : "movie";
  return {
    id: x.id,
    type: t,
    title: x.title ?? x.name,
    original_title: x.original_title ?? x.original_name,
    poster_path: x.poster_path,
    poster_url: x.poster_path ? imgUrl(x.poster_path) : null,
    backdrop_path: x.backdrop_path,
    release_date: t === "movie" ? x.release_date : x.first_air_date,
    vote_average: x.vote_average,
    vote_count: x.vote_count,
    popularity: x.popularity,
    overview: x.overview,
    adult: x.adult,
    genre_ids: x.genre_ids,
    media_type: x.media_type
  };
}

function imgUrl(path) {
  return path ? `${IMG_BASE}${path}` : null;
}

async function search(query, page = 1, limit = 20) {
  if (!query || query.trim().length < 2) throw new Error("Query minim 2 karakter");
  const data = await fetchTmdb("/search/multi", {
    query: query.trim(),
    page,
    language: "id-ID",
    include_adult: false
  });
  const results = (data.results || [])
    .filter(x => x.media_type === "movie" || x.media_type === "tv")
    .slice(0, limit)
    .map(normalizeItem);
  return { query, page, total_results: data.total_results ?? 0, total_pages: data.total_pages ?? 0, results };
}

async function searchTv(query, page = 1, limit = 10) {
  const data = await fetchTmdb("/search/tv", {
    query: query.trim(),
    page,
    language: "id-ID",
    include_adult: false
  });
  const results = (data.results || [])
    .filter(x => x.media_type === "tv")
    .slice(0, limit)
    .map(normalizeItem);
  return { query, results, total_results: data.total_results ?? 0 };
}

async function latest(moviePage = 1, tvPage = 1, limit = 40) {
  const [movies, tv] = await Promise.allSettled([
    fetchTmdb("/discover/movie", {
      sort_by: "popularity.desc",
      page: moviePage,
      language: "id-ID",
      with_watch_monetizable: 2,
      with_release_date: "2024-01-01"
    }),
    fetchTmdb("/discover/tv", {
      sort_by: "popularity.desc",
      page: tvPage,
      language: "id-ID",
      with_watch_monetizable: 2,
      first_air_date: "2024-01-01"
    })
  ]);
  const movieResults = (movies.value?.results || []).slice(0, limit).map(normalizeItem);
  const tvResults = (tv.value?.results || []).slice(0, limit).map(normalizeItem);
  return {
    movie: { page: moviePage, total_results: movies.value?.total_results ?? 0, results: movieResults },
    tv: { page: tvPage, total_results: tv.value?.total_results ?? 0, results: tvResults }
  };
}

async function detail(id, type, lang = "id-ID") {
  const t = type === "tv" ? "tv" : "movie";
  const data = await fetchTmdb(`/${t}/${id}`, {
    language: lang,
    append_to_response: "videos,images,similar,genres,credits,release_dates,watch/providers"
  });
  const videos = (data.videos?.results || []).filter(v => v.site === "YouTube" && v.type === "Trailer").slice(0, 5);
  const trailer = videos.find(v => v.official) || videos[0] || null;
  const posters = (data.images?.posters || []).slice(0, 12).map(p => ({ path: p.file_path, url: imgUrl(p.file_path) }));
  const backdrops = (data.images?.backdrops || []).slice(0, 8).map(b => ({ path: b.file_path, url: imgUrl(b.file_path) }));
  const genres = (data.genres || []).map(g => ({ id: g.id, name: g.name }));
  const cast = (data.credits?.cast || [])
    .filter(c => c.profile_path)
    .slice(0, 10)
    .map(c => ({ name: c.name, id: c.id ?? null, profile: imgUrl(c.profile_path), character: c.character }));
  const similar = (data.similar?.results || []).slice(0, 10).map(normalizeItem);

  return {
    id,
    type: t,
    title: data.title ?? data.name,
    original_title: data.original_title ?? data.original_name,
    overview: data.overview,
    tagline: data.tagline ?? null,
    release_date: data.release_date ?? null,
    first_air_date: data.first_air_date ?? null,
    runtime: data.runtime ?? null,
    episode_run_time: data.episode_run_time ?? null,
    status: data.status,
    vote_average: data.vote_average,
    vote_count: data.vote_count,
    popularity: data.popularity,
    homepage: data.homepage ?? null,
    imdb_id: data.imdb_id ?? null,
    backdrop_path: data.backdrop_path,
    poster_path: data.poster_path,
    genres,
    cast,
    videos: videos.map(v => ({ key: v.key, name: v.name, site: v.site, type: v.type, official: v.official, url: v.key ? `https://www.youtube.com/watch?v=${v.key}` : null })),
    posters,
    backdrops,
    similar,
    trailer: trailer ? { key: trailer.key, name: trailer.name, site: trailer.site, type: trailer.type, official: trailer.official, url: trailer.key ? `https://www.youtube.com/watch?v=${trailer.key}` : null } : null,
    images: { posters, backdrops },
    watch_providers: data["watch/providers"] ?? null
  };
}

async function serversFor(id, type, season = 1, episode = 1) {
  const t = type === "tv" ? "tv" : "movie";
  const list = [];
  for (const name of Object.keys(SERVERS)) {
    const mk = SERVERS[name][t];
    if (!mk) continue;
    const url = t === "movie" ? mk(id) : mk(id, season, episode);
    list.push({ name, type: t, id, url, ...(t === "tv" ? { season, episode } : {}) });
  }
  return list;
}

async function streamUrl(id, type, server = "peachify", season = 1, episode = 1) {
  const list = await serversFor(id, type, season, episode);
  const entry = list.find(u => u.name === server) || list[0];
  if (!entry) throw new Error(`Server tidak dikenal: ${server}`);
  return entry;
}

async function searchAndDetail(query, opts = {}) {
  const s = await search(query, opts.page, opts.limit);
  if (!s.results.length) return s;
  const item = s.results[0];
  const d = await detail(item.id, item.type, opts.lang);
  return { search: s, detail: d };
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || "help";
  try {
    if (cmd === "search") {
      const q = args.slice(1).join(" ") || "spiderman";
      console.log(JSON.stringify(await search(q), null, 2));
    } else if (cmd === "search:tv") {
      const q = args.slice(1).join(" ") || "one piece";
      console.log(JSON.stringify(await searchTv(q), null, 2));
    } else if (cmd === "latest") {
      console.log(JSON.stringify(await latest(), null, 2));
    } else if (cmd === "detail") {
      const id = Number(args[1]);
      const type = args[2] || "movie";
      if (!id) throw new Error("pakai: node index.js detail <id> [movie|tv]");
      console.log(JSON.stringify(await detail(id, type), null, 2));
    } else if (cmd === "servers") {
      const id = Number(args[1]);
      const type = args[2] || "movie";
      const s = Number(args[3]) || 1;
      const e = Number(args[4]) || 1;
      if (!id) throw new Error("pakai: node index.js servers <id> [movie|tv] [season] [episode]");
      console.log(JSON.stringify(await serversFor(id, type, s, e), null, 2));
    } else if (cmd === "stream") {
      const id = Number(args[1]);
      const type = args[2] || "movie";
      const server = args[3] || "peachify";
      if (!id) throw new Error("pakai: node index.js stream <id> [movie|tv] [server]");
      console.log(JSON.stringify(await streamUrl(id, type, server), null, 2));
    } else if (cmd === "search:detail") {
      const q = args.slice(1).join(" ") || "gundam";
      console.log(JSON.stringify(await searchAndDetail(q), null, 2));
    } else if (cmd === "genres") {
      const g = await fetchTmdb("/genre/movie/list", { language: "id-ID" });
      console.log(JSON.stringify(g.genres, null, 2));
    } else {
      console.log("pakai:\n  node index.js search <query>\n  node index.js search:tv <query>\n  node index.js latest\n  node index.js detail <id> [movie|tv]\n  node index.js servers <id> [movie|tv] [season] [episode]\n  node index.js stream <id> [movie|tv] [server]\n  node index.js search:detail <query>\n  node index.js genres");
    }
  } catch (err) {
    console.error("ERROR:", err.message);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith("index.js")) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { search, searchTv, latest, detail, serversFor, streamUrl, searchAndDetail, fetchTmdb, SERVERS, DEFAULT_API_KEY, TMDB_BASE };
