// Netlify (v2) serverless entry for the REST API. Mirrors the Express
// routes in src/server.js; the shared logic lives in src/holidays.js.
import { readFile } from 'node:fs/promises';
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
} from '../../src/holidays.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=3600',
};

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { ...CORS, ...headers } });
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return ['1', 'true', 'yes', 'il'].includes(String(value).toLowerCase());
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const q = url.searchParams;
  const route = url.pathname.replace(/\/+$/, '');

  try {
    switch (route) {
      case '/api/v1/health':
        return json({ status: 'ok', version: '2.0.0', time: new Date().toISOString() });

      case '/api/v1/holidays': {
        const year = parseYear(q.get('year') ?? undefined, new Date().getFullYear());
        const il = parseBool(q.get('il'));
        let categories = null;
        if (q.get('categories')) {
          categories = new Set(
            q.get('categories').toLowerCase().split(',').map((t) => t.trim()).filter(Boolean)
          );
        }
        const holidays = getHolidays(year, { il, categories });
        return json({ year, israel: il, count: holidays.length, holidays });
      }

      case '/api/v1/holidays/next': {
        const after = q.get('after') ? new Date(`${q.get('after')}T00:00:00`) : new Date();
        if (Number.isNaN(after.getTime())) {
          throw new RangeError('"after" must be an ISO date (YYYY-MM-DD).');
        }
        const count = Math.min(Math.max(Number(q.get('count')) || 5, 1), 50);
        const il = parseBool(q.get('il'));
        const upcoming = nextHolidays(after, { il, count });
        return json({ after: isoDate(after), count: upcoming.length, holidays: upcoming });
      }

      case '/api/v1/workdays': {
        const year = parseYear(q.get('year') ?? undefined, new Date().getFullYear());
        const il = parseBool(q.get('il'));
        const include = parseIncludes(q.get('include') ?? undefined);
        const weekendDays = parseWeekend(q.get('weekend') ?? undefined);
        return json(getWorkdays(year, { il, include, weekendDays }));
      }

      case '/api/v1/workdays/compare': {
        const from = parseYear(q.get('from') ?? undefined);
        const to = parseYear(q.get('to') ?? undefined);
        const il = parseBool(q.get('il'));
        const include = parseIncludes(q.get('include') ?? undefined);
        const weekendDays = parseWeekend(q.get('weekend') ?? undefined);
        const series = compareWorkdays(from, to, { il, include, weekendDays });
        return json({ from, to, israel: il, included: ['yomtov', ...include], series });
      }

      case '/api/v1/calendar.ics': {
        const from = parseYear(q.get('from') ?? q.get('year') ?? undefined, new Date().getFullYear());
        const to = parseYear(q.get('to') ?? undefined, from);
        if (to < from || to - from > 25) {
          throw new RangeError('"to" must be >= "from" and span at most 25 years.');
        }
        const il = parseBool(q.get('il'));
        const include = parseIncludes(q.get('include') ?? undefined);
        const weekendDays = parseWeekend(q.get('weekend') ?? undefined);
        const ics = buildICS(from, to, { il, include, weekendDays });
        return new Response(ics, {
          headers: {
            ...CORS,
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="jewish-holidays-${from}-${to}.ics"`,
          },
        });
      }

      case '/api/v1/about':
        return json({ includeTokens: INCLUDE_TOKENS, holidays: HOLIDAY_BLURBS });

      case '/api/v1/openapi.yaml': {
        try {
          const yaml = await readFile(new URL('../../public/openapi.yaml', import.meta.url), 'utf8');
          return new Response(yaml, {
            headers: { ...CORS, 'Content-Type': 'text/yaml; charset=utf-8' },
          });
        } catch {
          return Response.redirect(new URL('/openapi.yaml', url.origin), 302);
        }
      }

      default:
        return json(
          { error: 'not_found', message: 'Unknown endpoint. See /docs or /api/v1/openapi.yaml.' },
          404
        );
    }
  } catch (err) {
    if (err instanceof RangeError) {
      return json({ error: 'bad_request', message: err.message }, 400);
    }
    console.error(err);
    return json({ error: 'internal', message: 'Unexpected server error.' }, 500);
  }
};

export const config = { path: '/api/*' };
