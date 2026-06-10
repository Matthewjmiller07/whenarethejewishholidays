import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  getHolidays,
  getWorkdays,
  compareWorkdays,
  nextHolidays,
  buildICS,
  parseYear,
  parseIncludes,
  parseWeekend,
  INCLUDE_TOKENS,
  HOLIDAY_BLURBS,
  isoDate,
} from './holidays.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.disable('x-powered-by');

// Open CORS: this is public, read-only calendar data.
app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Cache-Control', 'public, max-age=3600');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function parseBool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'il'].includes(String(value).toLowerCase());
}

function handle(fn) {
  return (req, res) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err instanceof RangeError) {
        return res.status(400).json({ error: 'bad_request', message: err.message });
      }
      console.error(err);
      res.status(500).json({ error: 'internal', message: 'Unexpected server error.' });
    }
  };
}

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', time: new Date().toISOString() });
});

// GET /api/v1/holidays?year=2026&il=false&categories=yomtov,cholhamoed
app.get(
  '/api/v1/holidays',
  handle((req, res) => {
    const year = parseYear(req.query.year, new Date().getFullYear());
    const il = parseBool(req.query.il);
    let categories = null;
    if (req.query.categories) {
      categories = new Set(
        String(req.query.categories)
          .toLowerCase()
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }
    const holidays = getHolidays(year, { il, categories });
    res.json({ year, israel: il, count: holidays.length, holidays });
  })
);

// GET /api/v1/holidays/next?after=2026-06-09&count=5&il=false
app.get(
  '/api/v1/holidays/next',
  handle((req, res) => {
    const after = req.query.after ? new Date(`${req.query.after}T00:00:00`) : new Date();
    if (Number.isNaN(after.getTime())) {
      throw new RangeError('"after" must be an ISO date (YYYY-MM-DD).');
    }
    const count = Math.min(Math.max(Number(req.query.count) || 5, 1), 50);
    const il = parseBool(req.query.il);
    const upcoming = nextHolidays(after, { il, count });
    res.json({ after: isoDate(after), count: upcoming.length, holidays: upcoming });
  })
);

// GET /api/v1/workdays?year=2026&include=cholhamoed,minor-fasts&weekend=sat-sun&il=false
app.get(
  '/api/v1/workdays',
  handle((req, res) => {
    const year = parseYear(req.query.year, new Date().getFullYear());
    const il = parseBool(req.query.il);
    const include = parseIncludes(req.query.include);
    const weekendDays = parseWeekend(req.query.weekend);
    res.json(getWorkdays(year, { il, include, weekendDays }));
  })
);

// GET /api/v1/workdays/compare?from=2024&to=2030&include=...
app.get(
  '/api/v1/workdays/compare',
  handle((req, res) => {
    const from = parseYear(req.query.from);
    const to = parseYear(req.query.to);
    const il = parseBool(req.query.il);
    const include = parseIncludes(req.query.include);
    const weekendDays = parseWeekend(req.query.weekend);
    const series = compareWorkdays(from, to, { il, include, weekendDays });
    res.json({ from, to, israel: il, included: ['yomtov', ...include], series });
  })
);

// GET /api/v1/calendar.ics?from=2026&to=2027&include=...
app.get(
  '/api/v1/calendar.ics',
  handle((req, res) => {
    const from = parseYear(req.query.from ?? req.query.year, new Date().getFullYear());
    const to = parseYear(req.query.to, from);
    if (to < from || to - from > 25) {
      throw new RangeError('"to" must be >= "from" and span at most 25 years.');
    }
    const il = parseBool(req.query.il);
    const include = parseIncludes(req.query.include);
    const weekendDays = parseWeekend(req.query.weekend);
    const ics = buildICS(from, to, { il, include, weekendDays });
    res
      .set('Content-Type', 'text/calendar; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="jewish-holidays-${from}-${to}.ics"`)
      .send(ics);
  })
);

// GET /api/v1/about — reference data: include tokens and holiday descriptions
app.get('/api/v1/about', (req, res) => {
  res.json({ includeTokens: INCLUDE_TOKENS, holidays: HOLIDAY_BLURBS });
});

app.get('/api/v1/openapi.yaml', (req, res) => {
  res.set('Content-Type', 'text/yaml; charset=utf-8');
  res.sendFile(path.join(PUBLIC_DIR, 'openapi.yaml'));
});

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: 'Unknown endpoint. See /docs or /api/v1/openapi.yaml.',
  });
});

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('/docs', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'docs.html')));

// Only listen when run directly (`npm start`); on Netlify the app is
// imported by a serverless function instead.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`whenarethejewishholidays listening on http://localhost:${port}`);
  });
}

export default app;
