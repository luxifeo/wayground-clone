import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { searchImages, downloadImage, imageProviders } from '../images.js';

export const imageRouter = Router();

imageRouter.get('/images/search', requireAuth, async (req, res) => {
  try {
    const results = await searchImages(req.query.q, { limit: Math.min(40, parseInt(req.query.limit, 10) || 24) });
    res.json({ results, providers: imageProviders() });
  } catch (e) {
    res.status(502).json({ error: `Image search failed: ${e.message}` });
  }
});

/** Copy a search result into our uploads so the quiz keeps working if the source disappears. */
imageRouter.post('/images/import', requireAuth, async (req, res) => {
  const { url, fallback } = req.body || {};
  for (const src of [url, fallback].filter(Boolean)) {
    try { return res.json({ url: await downloadImage(src) }); } catch { /* try fallback */ }
  }
  res.status(502).json({ error: 'Could not download this image. Try another one.' });
});
