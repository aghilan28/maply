import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// Foursquare API configuration
const FSQ_PLACES_API_BASE = 'https://places-api.foursquare.com/places';
const FSQ_API_VERSION = '2025-06-17';

function getFoursquareApiKey(): string {
  return (
    process.env.FOURSQUARE_API_KEY?.trim() ||
    process.env.VITE_FOURSQUARE_API_KEY?.trim() ||
    'SYX10PQDXJLER5BP2CNNETB5BUSVXMP4OCR1KSFZAROGJSDK'
  );
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    foursquareConfigured: Boolean(getFoursquareApiKey()),
    timestamp: new Date().toISOString(),
  });
});

// Foursquare Place Search proxy
app.get('/api/foursquare/search', async (req: Request, res: Response) => {
  const apiKey = getFoursquareApiKey();
  if (!apiKey) {
    res.status(503).json({ error: 'Foursquare API key not configured' });
    return;
  }

  const { ll, query, radius, limit } = req.query;
  if (!ll || !query) {
    res.status(400).json({ error: 'Missing required query parameters: ll, query' });
    return;
  }

  try {
    const url = new URL(`${FSQ_PLACES_API_BASE}/search`);
    url.searchParams.set('ll', String(ll));
    url.searchParams.set('query', String(query));
    url.searchParams.set('radius', String(radius || '600'));
    url.searchParams.set('limit', String(limit || '5'));

    const upstreamResponse = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Places-Api-Version': FSQ_API_VERSION,
        Accept: 'application/json',
      },
    });

    const data = await upstreamResponse.json();
    res.status(upstreamResponse.status).json(data);
  } catch (error: any) {
    console.error('Error proxying Foursquare search:', error);
    res.status(500).json({ error: 'Failed to query Foursquare API' });
  }
});

// Foursquare Venue Photos proxy
app.get('/api/foursquare/photos', async (req: Request, res: Response) => {
  const apiKey = getFoursquareApiKey();
  if (!apiKey) {
    res.status(503).json({ error: 'Foursquare API key not configured' });
    return;
  }

  const placeId = req.query.id || req.query.fsq_place_id;
  if (!placeId || typeof placeId !== 'string') {
    res.status(400).json({ error: 'Missing required parameter: id' });
    return;
  }

  try {
    const url = new URL(`${FSQ_PLACES_API_BASE}/${encodeURIComponent(placeId)}/photos`);
    url.searchParams.set('limit', String(req.query.limit || '5'));

    const upstreamResponse = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Places-Api-Version': FSQ_API_VERSION,
        Accept: 'application/json',
      },
    });

    const data = await upstreamResponse.json();
    res.status(upstreamResponse.status).json(data);
  } catch (error: any) {
    console.error('Error proxying Foursquare photos:', error);
    res.status(500).json({ error: 'Failed to fetch venue photos' });
  }
});

async function startServer() {
  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Maply server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
