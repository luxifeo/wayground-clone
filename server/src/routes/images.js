import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { searchImages, downloadImage, imageProviders, imageRef } from '../images.js';
import { log } from '../log.js';

export const imageRouter = Router();

imageRouter.get('/images/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').slice(0, 100);
  try {
    const results = await searchImages(req.query.q, { limit: Math.min(40, parseInt(req.query.limit, 10) || 24) });
    // everything the teacher was shown, so a reported picture can be traced to its source
    log.info('image.search', { q, results: results.map(imageRef) }, req);
    res.json({ results, providers: imageProviders() });
  } catch (e) {
    log.warn('image.search.failed', { q, err: e.message }, req);
    res.status(502).json({ error: `Image search failed: ${e.message}` });
  }
});

/** Copy a search result into our uploads so the quiz keeps working if the source disappears. */
imageRouter.post('/images/import', requireAuth, async (req, res) => {
  const { url, fallback } = req.body || {};
  const errors = [];
  for (const src of [url, fallback].filter(Boolean)) {
    try {
      const file = await downloadImage(src);
      log.info('image.import', { src, file }, req);
      return res.json({ url: file });
    } catch (e) { errors.push(e.message); /* try fallback */ }
  }
  log.warn('image.import.failed', { url, fallback, errors }, req);
  res.status(502).json({ error: 'Could not download this image. Try another one.' });
});
