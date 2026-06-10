/* Minimal assertion tests for the holiday engine. Run: npm test */
import assert from 'node:assert/strict';
import {
  getHolidays,
  getWorkdays,
  compareWorkdays,
  nextHolidays,
  buildICS,
  parseWeekend,
  parseIncludes,
  parseYear,
} from '../src/holidays.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

test('2026 diaspora has 13 yom tov days', () => {
  const w = getWorkdays(2026);
  assert.equal(w.totalObserved, 13);
  assert.equal(w.daysOffRequired + w.weekendHolidays.length, 13);
});

test('Israel scheme has fewer yom tov days than diaspora', () => {
  const diaspora = getWorkdays(2026).totalObserved;
  const israel = getWorkdays(2026, { il: true }).totalObserved;
  assert.ok(israel < diaspora, `expected ${israel} < ${diaspora}`);
});

test('Pesach I 2026 falls on Thursday April 2', () => {
  const w = getWorkdays(2026);
  const pesach = w.weekdayHolidays.find((h) => h.title === 'Pesach I');
  assert.ok(pesach, 'Pesach I should be a weekday holiday in 2026');
  assert.equal(pesach.date, '2026-04-02');
  assert.equal(pesach.weekday, 'Thursday');
  assert.equal(pesach.yomTov, true);
});

test('include=cholhamoed adds intermediate days', () => {
  const base = getWorkdays(2026).totalObserved;
  const withChm = getWorkdays(2026, { include: new Set(['cholhamoed']) }).totalObserved;
  assert.equal(withChm, base + 9); // 4 Pesach + 5 Sukkot (incl. Hoshana Raba)
});

test('include=purim adds exactly Purim', () => {
  const w = getWorkdays(2026, { include: new Set(['purim']) });
  const all = [...w.weekdayHolidays, ...w.weekendHolidays];
  assert.ok(all.some((h) => h.title === 'Purim'));
  assert.ok(!all.some((h) => h.title === 'Shushan Purim'));
});

test('fri-sat weekend changes the split', () => {
  const satSun = getWorkdays(2026);
  const friSat = getWorkdays(2026, { weekendDays: parseWeekend('fri-sat') });
  assert.equal(satSun.totalObserved, friSat.totalObserved);
  assert.notEqual(satSun.daysOffRequired, friSat.daysOffRequired);
});

test('weekend=none counts every observed day', () => {
  const w = getWorkdays(2026, { weekendDays: parseWeekend('none') });
  assert.equal(w.daysOffRequired, w.totalObserved);
});

test('compare returns one entry per year', () => {
  const series = compareWorkdays(2024, 2030);
  assert.equal(series.length, 7);
  assert.ok(series.every((s) => s.daysOffRequired >= 0 && s.daysOffRequired <= s.totalObserved));
});

test('nextHolidays excludes Rosh Chodesh and counts days', () => {
  const next = nextHolidays(new Date(2026, 5, 9), { count: 3 });
  assert.equal(next.length, 3);
  assert.ok(next.every((h) => h.category !== 'rosh-chodesh'));
  assert.ok(next.every((h) => h.daysUntil >= 0));
  assert.equal(next[0].title, 'Tzom Tammuz'); // 2026-07-02
});

test('ICS feed is valid-looking iCalendar', () => {
  const ics = buildICS(2026, 2026);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 13);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260402'));
});

test('holidays endpoint data includes Hebrew renderings', () => {
  const hols = getHolidays(2026, { categories: new Set(['yomtov']) });
  assert.ok(hols.length > 0);
  assert.ok(hols.every((h) => h.hebrew && h.hebrewDate && h.category === 'yomtov'));
});

test('parse helpers reject bad input', () => {
  assert.throws(() => parseYear('1850'), RangeError);
  assert.throws(() => parseYear('abc'), RangeError);
  assert.throws(() => parseIncludes('bogus-token'), RangeError);
  assert.throws(() => parseWeekend('xyzday'), RangeError);
  assert.deepEqual(parseWeekend('friday,saturday'), [5, 6]);
});

console.log(`\n${passed} tests passed`);
