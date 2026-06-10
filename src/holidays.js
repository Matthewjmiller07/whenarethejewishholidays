/**
 * Core holiday engine for whenarethejewishholidays.com
 * Computes Jewish holidays locally with @hebcal/core — no external API calls.
 */
import { HebrewCalendar, flags } from '@hebcal/core';

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2200;

/** Optional observance groups that can be added to the always-included Yom Tov days. */
export const INCLUDE_TOKENS = [
  'cholhamoed',
  'tisha-bav',
  'minor-fasts',
  'purim',
  'shushan-purim',
  'chanukah',
  'modern',
];

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const WEEKEND_PRESETS = {
  'sat-sun': [6, 0],
  'fri-sat': [5, 6],
  sun: [0],
  none: [],
};

/** Short descriptions keyed by event basename, surfaced in the API + frontend. */
export const HOLIDAY_BLURBS = {
  'Rosh Hashana':
    'The Jewish New Year — two days of synagogue services, shofar blasts, and festive meals with apples and honey. Work is traditionally prohibited.',
  'Yom Kippur':
    'The Day of Atonement, the holiest day of the Jewish year. A 25-hour fast spent largely in synagogue. Work is prohibited.',
  Sukkot:
    'The week-long Feast of Booths. The first two days (one in Israel) are full holidays with work prohibited; the intermediate days are Chol HaMoed.',
  'Shmini Atzeret':
    'The "Eighth Day of Assembly" closing the Sukkot season. A full holiday — work is prohibited.',
  'Simchat Torah':
    'Celebrates completing the annual Torah reading cycle with dancing and processions. A full holiday outside Israel.',
  Chanukah:
    'The eight-night Festival of Lights commemorating the rededication of the Temple. Work is permitted — no days off required.',
  'Tu BiShvat':
    'The New Year for Trees, marked by eating fruit and planting. Work is permitted.',
  Purim:
    'Celebrates the rescue of Persian Jewry as told in the Book of Esther. Costumes, feasting, and gifts of food. Work is permitted but many take the day off.',
  Pesach:
    'Passover, the eight-day festival of freedom (seven in Israel). The first two and last two days are full holidays with work prohibited; the middle days are Chol HaMoed.',
  Shavuot:
    'The Festival of Weeks, marking the giving of the Torah at Sinai. Two full days outside Israel — work is prohibited.',
  "Tish'a B'Av":
    'A 25-hour fast mourning the destruction of both Temples. Work is permitted but many observant Jews take the day off.',
  'Tzom Gedaliah':
    'A minor dawn-to-dusk fast the day after Rosh Hashana. Work is permitted.',
  "Asara B'Tevet":
    'A minor dawn-to-dusk fast marking the siege of Jerusalem. Work is permitted.',
  "Ta'anit Esther":
    'The Fast of Esther, a minor dawn-to-dusk fast on the eve of Purim. Work is permitted.',
  'Tzom Tammuz':
    'A minor dawn-to-dusk fast beginning the Three Weeks of mourning. Work is permitted.',
  'Lag BaOmer':
    'The 33rd day of the Omer count — bonfires, weddings, and outings. Work is permitted.',
  'Shushan Purim':
    'Purim as observed in walled cities such as Jerusalem, one day after regular Purim.',
  'Rosh Chodesh':
    'The minor monthly festival marking the new moon. Work is permitted.',
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Derive a single primary category from a hebcal event's flag mask. */
function primaryCategory(mask) {
  if (mask & flags.EREV) return 'erev';
  if (mask & flags.CHAG) return 'yomtov';
  if (mask & flags.CHOL_HAMOED) return 'cholhamoed';
  if (mask & flags.MAJOR_FAST) return 'major-fast';
  if (mask & flags.MINOR_FAST) return 'minor-fast';
  if (mask & flags.MODERN_HOLIDAY) return 'modern';
  if (mask & flags.ROSH_CHODESH) return 'rosh-chodesh';
  if (mask & flags.SPECIAL_SHABBAT) return 'special-shabbat';
  if (mask & flags.MINOR_HOLIDAY) return 'minor';
  return 'other';
}

function eventToHoliday(ev, weekendDays) {
  const greg = ev.getDate().greg();
  const mask = ev.getFlags();
  const dow = greg.getDay();
  const isWeekend = weekendDays.includes(dow);
  const category = primaryCategory(mask);
  const yomTov = Boolean(mask & flags.CHAG);
  let url;
  try {
    url = ev.url();
  } catch {
    url = undefined;
  }
  return {
    title: ev.getDesc(),
    hebrew: ev.render('he'),
    basename: ev.basename(),
    date: isoDate(greg),
    hebrewDate: ev.getDate().toString(),
    weekday: WEEKDAY_NAMES[dow],
    isWeekend,
    category,
    yomTov,
    workRestricted: yomTov,
    about: HOLIDAY_BLURBS[ev.basename()],
    url,
  };
}

export function parseWeekend(value) {
  if (!value) return WEEKEND_PRESETS['sat-sun'];
  const preset = WEEKEND_PRESETS[value.toLowerCase()];
  if (preset) return preset;
  const names = value.toLowerCase().split(',');
  const days = names
    .map((n) => WEEKDAY_NAMES.findIndex((w) => w.toLowerCase().startsWith(n.trim().slice(0, 3))))
    .filter((i) => i >= 0);
  if (!days.length) {
    throw new RangeError(
      `Unrecognized weekend "${value}". Use "sat-sun", "fri-sat", "none", or comma-separated day names.`
    );
  }
  return days;
}

export function parseYear(value, fallback) {
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new RangeError('Missing required "year" parameter.');
  }
  const year = Number(value);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`"year" must be an integer between ${MIN_YEAR} and ${MAX_YEAR}.`);
  }
  return year;
}

export function parseIncludes(value) {
  if (!value) return new Set();
  const tokens = value
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const bad = tokens.filter((t) => !INCLUDE_TOKENS.includes(t));
  if (bad.length) {
    throw new RangeError(
      `Unrecognized include token(s): ${bad.join(', ')}. Valid tokens: ${INCLUDE_TOKENS.join(', ')}.`
    );
  }
  return new Set(tokens);
}

function rawEvents(year, il) {
  return HebrewCalendar.calendar({
    year,
    isHebrewYear: false,
    il,
    noRoshChodesh: false,
    noSpecialShabbat: true,
    noModern: false,
    sedrot: false,
    omer: false,
  });
}

/**
 * All holidays in a Gregorian year, mapped to plain JSON objects.
 * `categories` (Set) optionally filters by primary category.
 */
export function getHolidays(year, { il = false, categories = null, weekendDays } = {}) {
  const weekend = weekendDays ?? WEEKEND_PRESETS['sat-sun'];
  const events = rawEvents(year, il)
    .map((ev) => eventToHoliday(ev, weekend))
    .filter((h) => !categories || categories.has(h.category));
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return events;
}

/** Decide whether an event belongs in the workday-off calculation. */
function observedForWork(holiday, include) {
  if (holiday.yomTov) return true; // Rosh Hashana, Yom Kippur, Sukkot I–II, etc.
  switch (holiday.category) {
    case 'cholhamoed':
      return include.has('cholhamoed');
    case 'major-fast':
      return holiday.basename === "Tish'a B'Av" && include.has('tisha-bav');
    case 'minor-fast':
      return include.has('minor-fasts');
    case 'minor':
      if (holiday.title === 'Purim') return include.has('purim');
      if (holiday.title === 'Shushan Purim') return include.has('shushan-purim');
      if (holiday.basename === 'Chanukah') return include.has('chanukah');
      return false;
    case 'modern':
      return include.has('modern');
    default:
      return false;
  }
}

/**
 * Workday-off calculation for one year: which observed holidays land on
 * workdays (requiring time off) vs. the configured weekend.
 */
export function getWorkdays(year, { il = false, include = new Set(), weekendDays } = {}) {
  const weekend = weekendDays ?? WEEKEND_PRESETS['sat-sun'];
  const observed = getHolidays(year, { il, weekendDays: weekend }).filter(
    (h) => h.category !== 'erev' && observedForWork(h, include)
  );
  const weekdayHolidays = observed.filter((h) => !h.isWeekend);
  const weekendHolidays = observed.filter((h) => h.isWeekend);
  return {
    year,
    israel: il,
    weekend: weekend.map((d) => WEEKDAY_NAMES[d]),
    included: ['yomtov', ...include],
    daysOffRequired: weekdayHolidays.length,
    totalObserved: observed.length,
    weekdayHolidays,
    weekendHolidays,
  };
}

/** Multi-year comparison of required workdays off. */
export function compareWorkdays(fromYear, toYear, opts = {}) {
  if (toYear < fromYear) throw new RangeError('"to" year must be >= "from" year.');
  if (toYear - fromYear > 100) throw new RangeError('Range is limited to 100 years.');
  const series = [];
  for (let year = fromYear; year <= toYear; year++) {
    const w = getWorkdays(year, opts);
    series.push({
      year,
      daysOffRequired: w.daysOffRequired,
      totalObserved: w.totalObserved,
      weekendHolidays: w.weekendHolidays.length,
    });
  }
  return series;
}

export { isoDate };

const NEXT_DEFAULT_CATEGORIES = new Set([
  'yomtov',
  'cholhamoed',
  'major-fast',
  'minor-fast',
  'minor',
  'modern',
]);

/** The next `count` holidays on/after `afterDate`. Rosh Chodesh and erev days are excluded by default. */
export function nextHolidays(afterDate, { il = false, count = 5, categories = null } = {}) {
  if (!categories) categories = NEXT_DEFAULT_CATEGORIES;
  const after = isoDate(afterDate);
  const years = [afterDate.getFullYear(), afterDate.getFullYear() + 1];
  const all = years.flatMap((y) => getHolidays(y, { il, categories }));
  const upcoming = all.filter((h) => h.date >= after);
  const seen = new Set();
  const result = [];
  for (const h of upcoming) {
    const key = `${h.date}|${h.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const days = Math.round(
      (new Date(`${h.date}T00:00:00`) - new Date(`${after}T00:00:00`)) / 86400000
    );
    result.push({ ...h, daysUntil: days });
    if (result.length >= count) break;
  }
  return result;
}

function icsEscape(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

/**
 * Build an RFC 5545 iCalendar feed of observed holidays — importable into
 * Workday absence calendars, Outlook, and Google Calendar.
 */
export function buildICS(fromYear, toYear, { il = false, include = new Set(), weekendDays } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//whenarethejewishholidays.com//Holiday API v2//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Jewish Holidays (work-impacting)',
    'X-WR-CALDESC:Jewish holidays requiring or commonly involving time off work',
  ];
  for (let year = fromYear; year <= toYear; year++) {
    const w = getWorkdays(year, { il, include, weekendDays });
    for (const h of [...w.weekdayHolidays, ...w.weekendHolidays]) {
      const start = h.date.replace(/-/g, '');
      const endDate = new Date(`${h.date}T00:00:00`);
      endDate.setDate(endDate.getDate() + 1);
      const end = isoDate(endDate).replace(/-/g, '');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${start}-${h.title.replace(/[^A-Za-z0-9]/g, '')}@whenarethejewishholidays.com`,
        `DTSTAMP:${start}T000000Z`,
        `DTSTART;VALUE=DATE:${start}`,
        `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:${icsEscape(h.title)}`,
        `DESCRIPTION:${icsEscape(
          `${h.hebrewDate}. ${h.about ?? ''}${h.yomTov ? ' Work is traditionally prohibited.' : ''}`
        )}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT'
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
