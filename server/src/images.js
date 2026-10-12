// Free image search for question illustrations.
// Keyless providers (always on): Openverse, Wikimedia Commons.
// Optional providers when a free API key is set: Pixabay (PIXABAY_API_KEY), Pexels (PEXELS_API_KEY),
// Unsplash (UNSPLASH_ACCESS_KEY).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
const UA = 'WaygroundClone/1.0 (educational quiz app; image search)';
const MAX_BYTES = 6 * 1024 * 1024;

async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const PROVIDERS = {
  async pixabay(q, n) {
    const key = process.env.PIXABAY_API_KEY;
    if (!key) return null;
    const d = await getJson(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&per_page=${Math.max(3, n)}&safesearch=true&image_type=all`);
    return (d.hits || []).map((h) => ({
      url: h.webformatURL, thumb: h.previewURL, width: h.webformatWidth, height: h.webformatHeight,
      title: h.tags, creator: h.user, license: 'Pixabay License', source: 'pixabay', landing: h.pageURL,
    }));
  },
  async pexels(q, n) {
    const key = process.env.PEXELS_API_KEY;
    if (!key) return null;
    const d = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}`, { Authorization: key });
    return (d.photos || []).map((p) => ({
      url: p.src.large, thumb: p.src.medium, width: p.width, height: p.height,
      title: p.alt, creator: p.photographer, license: 'Pexels License', source: 'pexels', landing: p.url,
    }));
  },
  async unsplash(q, n) {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) return null;
    const d = await getJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${n}&content_filter=high`, { Authorization: `Client-ID ${key}` });
    return (d.results || []).map((p) => ({
      url: p.urls.regular, thumb: p.urls.small, width: p.width, height: p.height,
      title: p.alt_description, creator: p.user?.name, license: 'Unsplash License', source: 'unsplash', landing: p.links?.html,
    }));
  },
  async openverse(q, n) {
    const d = await getJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${n}&mature=false&extension=jpg,png,webp`);
    return (d.results || []).map((r) => ({
      url: r.url, thumb: r.thumbnail, width: r.width, height: r.height,
      title: r.title, creator: r.creator, license: `CC ${String(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim(),
      source: `openverse/${r.source}`, landing: r.foreign_landing_url,
    }));
  },
  async wikimedia(q, n) {
    const d = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(`filetype:bitmap ${q}`)}&gsrnamespace=6&gsrlimit=${n}&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=800`);
    const pages = Object.values(d.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();
    return pages
      .map((p) => ({ p, ii: p.imageinfo?.[0] || {} }))
      .filter(({ ii }) => /^image\/(jpeg|png|webp|gif)/.test(ii.mime || '') && (ii.thumburl || ii.url))
      .map(({ p, ii }) => {
        const meta = ii.extmetadata || {};
        return {
          url: ii.thumburl || ii.url, thumb: ii.thumburl || ii.url, width: ii.thumbwidth, height: ii.thumbheight,
          title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''), creator: strip(meta.Artist?.value),
          license: strip(meta.LicenseShortName?.value) || 'Wikimedia Commons', source: 'wikimedia', landing: ii.descriptionurl,
        };
      });
  },
};

const ORDER = ['pixabay', 'pexels', 'unsplash', 'wikimedia', 'openverse'];

export function imageProviders() {
  return ORDER.filter((p) => (p === 'pixabay' ? process.env.PIXABAY_API_KEY : p === 'pexels' ? process.env.PEXELS_API_KEY : p === 'unsplash' ? process.env.UNSPLASH_ACCESS_KEY : true));
}

/** Search all available providers in parallel; results are interleaved by provider priority. */
export async function searchImages(query, { limit = 18, providers = imageProviders() } = {}) {
  const q = String(query || '').trim().slice(0, 100);
  if (!q) return [];
  const per = Math.max(4, Math.ceil(limit / Math.max(1, providers.length)) + 2);
  const lists = await Promise.all(providers.map((p) => PROVIDERS[p](q, per).catch(() => [])));
  const out = []; const seen = new Set();
  for (let i = 0; out.length < limit && lists.some((l) => l && l[i]); i++) {
    for (const l of lists) {
      const r = l && l[i];
      if (r && r.url && !seen.has(r.url) && out.length < limit) { seen.add(r.url); out.push(r); }
    }
  }
  return out;
}

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

/** Download a remote image into /uploads so quizzes do not depend on hot-linking. */
export async function downloadImage(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Invalid image URL');
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Image download failed (HTTP ${r.status})`);
  const type = (r.headers.get('content-type') || '').split(';')[0].trim();
  if (!EXT[type]) throw new Error('Not a supported image type');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('Image is too large');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.createHash('sha1').update(url).digest('hex').slice(0, 20)}${EXT[type]}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

/** Find and store one illustration for a search query. Returns {url, credit} or null. */
export async function illustrate(query) {
  const results = await searchImages(query, { limit: 6 });
  for (const r of results) {
    for (const src of [r.url, r.thumb]) {
      if (!src) continue;
      try {
        const url = await downloadImage(src);
        return { url, credit: { title: r.title, creator: r.creator, license: r.license, source: r.source, landing: r.landing } };
      } catch { /* try the next candidate */ }
    }
  }
  return null;
}

/** Run async tasks with a concurrency limit. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k).catch(() => null); }
  }));
  return out;
}
