# When Are the Jewish Holidays?

**[whenarethejewishholidays.com](https://whenarethejewishholidays.com)** — holiday dates,
a workday-off calculator, and a free REST API + iCal feed for HR systems
(Workday, BambooHR, Outlook, Google Calendar).

All dates are computed locally with [@hebcal/core](https://github.com/hebcal/hebcal-es6) —
no third-party API calls at request time.

## What's here

- **The site** — a year planner that counts how many workdays off Jewish holidays require,
  with configurable observance (Chol HaMoed, fasts, Purim, Chanukah…), weekend convention
  (Sat–Sun or Israeli Fri–Sat), Diaspora vs. Israel schemes, a year-at-a-glance calendar,
  and a multi-year comparison chart.
- **The API** — versioned JSON endpoints under `/api/v1`, plus an RFC 5545 `.ics` feed.
  No auth, open CORS. Full docs at [`/docs`](https://whenarethejewishholidays.com/docs),
  machine-readable spec at [`/api/v1/openapi.yaml`](https://whenarethejewishholidays.com/api/v1/openapi.yaml).

## API at a glance

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/holidays?year=2026` | Every holiday in a year, with Hebrew names/dates |
| `GET /api/v1/holidays/next?count=5` | Upcoming holidays with `daysUntil` |
| `GET /api/v1/workdays?year=2026&include=cholhamoed` | Days off required, split weekday/weekend |
| `GET /api/v1/workdays/compare?from=2026&to=2036` | Days-off totals per year |
| `GET /api/v1/calendar.ics?from=2026&to=2028` | iCal feed for Workday/Outlook/Google |
| `GET /api/v1/about` | Include tokens + holiday descriptions |
| `GET /api/v1/health` | Liveness probe |

Common parameters: `il=true` for the one-day Israeli Yom Tov scheme,
`weekend=sat-sun|fri-sat|sun|none`, and `include=` with any of
`cholhamoed, tisha-bav, minor-fasts, purim, shushan-purim, chanukah, modern`.

```bash
curl 'https://whenarethejewishholidays.com/api/v1/workdays?year=2026&include=cholhamoed,tisha-bav'
```

## Workday / HR integration

The `.ics` feed emits each observed holiday as an all-day `VEVENT` with the Hebrew date
and a work-permitted note — import it into **Maintain Holiday Calendars** (or load the
JSON from `/workdays` via EIB). See the [integration guide](https://whenarethejewishholidays.com/docs#workday).

## Running locally

```bash
npm install
npm start          # serves site + API on http://localhost:3000
npm run dev        # auto-reload on change
npm test           # holiday-engine test suite
```

Requires Node 20+. The app is a single Express process serving `public/` and `/api/v1`;
deploy anywhere Node runs (Render, Fly.io, Railway, a VPS). Note: GitHub Pages can host
the static frontend only — the API needs a Node host.

## Project layout

```
src/server.js     Express app + API routes
src/holidays.js   Holiday engine (hebcal wrapper, workday math, ICS builder)
public/           Frontend (index.html, app.js, styles.css, docs.html, openapi.yaml)
test/api.test.js  Engine tests
```
