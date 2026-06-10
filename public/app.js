/* Frontend for whenarethejewishholidays — talks to its own /api/v1. */
(() => {
  const $ = (sel) => document.querySelector(sel);

  const state = {
    year: new Date().getFullYear(),
    include: new Set(),
    weekend: 'sat-sun',
    il: false,
  };

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const fmtDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const qs = () => {
    const p = new URLSearchParams({ year: state.year, weekend: state.weekend, il: state.il });
    if (state.include.size) p.set('include', [...state.include].join(','));
    return p;
  };

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json()).message || res.statusText);
    return res.json();
  }

  /* ————— Hero: next holiday ————— */
  async function loadNext() {
    try {
      const data = await getJSON('/api/v1/holidays/next?count=1');
      const h = data.holidays[0];
      if (!h) return;
      $('#nextTitle').textContent = h.title;
      $('#nextHebrew').textContent = h.hebrew || '';
      $('#nextDays').textContent = h.daysUntil;
      $('#nextDate').textContent = `${h.weekday}, ${fmtDate(h.date)} · ${h.hebrewDate}`;
      if (h.daysUntil === 0) {
        $('#nextDays').textContent = '✶';
        $('#nextCard').querySelector('.lbl').innerHTML = 'today —<br>chag sameach';
      }
    } catch {
      $('#nextTitle').textContent = 'Could not load';
    }
  }

  /* ————— Planner ————— */
  function holidayRow(h, withGcal) {
    const li = document.createElement('li');
    const tag = h.category === 'yomtov' ? 'Yom Tov'
      : h.category === 'cholhamoed' ? 'Chol HaMoed'
      : h.category.includes('fast') ? 'Fast'
      : h.category === 'modern' ? 'Modern' : 'Minor';
    li.innerHTML = `
      <span class="d">${fmtDate(h.date)}</span>
      <span class="t">${h.title}<span class="he">${h.hebrew || ''}</span><span class="tag ${h.category}">${tag}</span></span>
      ${withGcal ? `<a class="gcal" target="_blank" rel="noopener" href="${gcalUrl(h)}">+ GCal</a>` : ''}`;
    return li;
  }

  function gcalUrl(h) {
    const start = h.date.replace(/-/g, '');
    const endD = new Date(`${h.date}T00:00:00`);
    endD.setDate(endD.getDate() + 1);
    const end = endD.toISOString().slice(0, 10).replace(/-/g, '');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + `&text=${encodeURIComponent(h.title)}`
      + `&dates=${start}/${end}`
      + `&details=${encodeURIComponent(`${h.hebrewDate}. ${h.about || ''} via whenarethejewishholidays.com`)}`;
  }

  let lastWorkdays = null;

  async function loadPlanner() {
    const panel = $('#resultPanel');
    panel.classList.add('loading');
    try {
      const data = await getJSON(`/api/v1/workdays?${qs()}`);
      lastWorkdays = data;
      $('#bigNumber').textContent = data.daysOffRequired;
      $('#bigLabel').textContent = `workday${data.daysOffRequired === 1 ? '' : 's'} off in ${data.year}`;
      $('#bigSub').textContent =
        `${data.totalObserved} observed holidays · ${data.weekendHolidays.length} already fall on your weekend`;

      const wd = $('#weekdayList'); wd.replaceChildren();
      data.weekdayHolidays.forEach((h, i) => {
        const row = holidayRow(h, true); row.style.setProperty('--i', i); wd.append(row);
      });
      const we = $('#weekendList'); we.replaceChildren();
      data.weekendHolidays.forEach((h, i) => {
        const row = holidayRow(h, false); row.style.setProperty('--i', i); we.append(row);
      });

      $('#icsBtn').href = `/api/v1/calendar.ics?${qs()}`;
      renderCalendar(data);
      renderAbout(data);
    } catch (err) {
      $('#bigSub').textContent = err.message;
    } finally {
      panel.classList.remove('loading');
    }
  }

  /* ————— Calendar grid ————— */
  function renderCalendar(data) {
    const byDate = new Map();
    for (const h of [...data.weekdayHolidays, ...data.weekendHolidays]) byDate.set(h.date, h);
    const todayIso = new Date().toLocaleDateString('sv-SE');
    const wrap = $('#months');
    wrap.replaceChildren();

    for (let m = 0; m < 12; m++) {
      const first = new Date(state.year, m, 1).getDay();
      const daysIn = new Date(state.year, m + 1, 0).getDate();
      const month = document.createElement('div');
      month.className = 'month';
      month.innerHTML = `<h5>${MONTHS[m]} <span class="mono">${state.year}</span></h5>`;
      const grid = document.createElement('div');
      grid.className = 'grid7';
      DOW.forEach((d) => {
        const el = document.createElement('span');
        el.className = 'dow'; el.textContent = d; grid.append(el);
      });
      for (let i = 0; i < first; i++) grid.append(document.createElement('span'));
      for (let d = 1; d <= daysIn; d++) {
        const iso = `${state.year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cell = document.createElement('span');
        const dow = new Date(state.year, m, d).getDay();
        cell.className = 'day';
        if (dow === 0 || dow === 6) cell.classList.add('we');
        const h = byDate.get(iso);
        if (h) {
          cell.classList.add('hol', `c-${h.category}`);
          cell.dataset.tip = `${h.title} · ${h.hebrewDate}`;
          cell.setAttribute('aria-label', `${h.title}, ${h.hebrewDate}`);
        }
        if (iso === todayIso) cell.classList.add('today');
        cell.textContent = d;
        grid.append(cell);
      }
      month.append(grid);
      wrap.append(month);
    }
  }

  /* ————— About cards ————— */
  function renderAbout(data) {
    const groups = new Map();
    for (const h of [...data.weekdayHolidays, ...data.weekendHolidays]) {
      if (!groups.has(h.basename)) groups.set(h.basename, { ...h, dates: [] });
      groups.get(h.basename).dates.push(h.date);
    }
    const grid = $('#aboutGrid');
    grid.replaceChildren();
    for (const g of groups.values()) {
      if (!g.about) continue;
      const card = document.createElement('article');
      card.className = 'about-card';
      card.dataset.he = (g.hebrew || '')
        .split(':')[0]
        .replace(/\s+(?:[א-ת][׳']|\d+)$/, '')
        .trim();
      const first = fmtDate(g.dates[0]);
      const last = fmtDate(g.dates[g.dates.length - 1]);
      card.innerHTML = `
        <h4>${g.basename}</h4>
        <div class="dates">${g.dates.length > 1 ? `${first} – ${last}` : first}, ${state.year}</div>
        <p>${g.about}</p>`;
      grid.append(card);
    }
  }

  /* ————— Comparison chart (hand-drawn SVG) ————— */
  async function loadCompare() {
    const from = Number($('#fromYear').value);
    const to = Number($('#toYear').value);
    if (!from || !to || to < from) return;
    const p = new URLSearchParams({ from, to, weekend: state.weekend, il: state.il });
    if (state.include.size) p.set('include', [...state.include].join(','));
    try {
      const data = await getJSON(`/api/v1/workdays/compare?${p}`);
      drawChart(data.series);
    } catch (err) {
      console.error(err);
    }
  }

  function drawChart(series) {
    const svg = $('#compareChart');
    const W = 960, H = 380, padL = 56, padR = 28, padT = 34, padB = 46;
    const xs = (i) => padL + (i / Math.max(series.length - 1, 1)) * (W - padL - padR);
    const maxV = Math.max(...series.map((s) => s.daysOffRequired), 1) + 1;
    const minV = Math.max(Math.min(...series.map((s) => s.daysOffRequired)) - 1, 0);
    const ys = (v) => padT + (1 - (v - minV) / (maxV - minV)) * (H - padT - padB);

    const ink = '#292017', pom = '#9e3a28', gold = '#a8821f', faint = '#a3957d';
    let out = `<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${pom}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${pom}" stop-opacity="0"/></linearGradient></defs>`;

    for (let v = Math.ceil(minV); v <= maxV; v++) {
      const y = ys(v);
      out += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${gold}" stroke-opacity="0.25" stroke-dasharray="2 5"/>
        <text x="${padL - 12}" y="${y + 4}" text-anchor="end" font-family="Spline Sans Mono" font-size="12" fill="${faint}">${v}</text>`;
    }

    const pts = series.map((s, i) => [xs(i), ys(s.daysOffRequired)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    out += `<path d="${line} L${pts.at(-1)[0]},${H - padB} L${pts[0][0]},${H - padB} Z" fill="url(#area)"/>`;
    out += `<path d="${line}" fill="none" stroke="${pom}" stroke-width="2.5" stroke-linejoin="round"/>`;

    series.forEach((s, i) => {
      const [x, y] = pts[i];
      const showLabel = series.length <= 16 || i % Math.ceil(series.length / 16) === 0;
      out += `<circle cx="${x}" cy="${y}" r="4.5" fill="${pom}" stroke="#faf5ea" stroke-width="2">
          <title>${s.year}: ${s.daysOffRequired} workdays off (${s.weekendHolidays} on weekend)</title></circle>
        <text x="${x}" y="${y - 12}" text-anchor="middle" font-family="Fraunces" font-style="italic" font-size="15" fill="${ink}">${s.daysOffRequired}</text>`;
      if (showLabel) {
        out += `<text x="${x}" y="${H - padB + 24}" text-anchor="middle" font-family="Spline Sans Mono" font-size="12" fill="${faint}">${s.year}</text>`;
      }
    });
    svg.innerHTML = out;
  }

  /* ————— Wiring ————— */
  function setYear(y) {
    state.year = Math.min(Math.max(y, 1900), 2200);
    $('#yearInput').value = state.year;
    loadPlanner();
  }

  $('#yearInput').value = state.year;
  $('#yearPrev').addEventListener('click', () => setYear(state.year - 1));
  $('#yearNext').addEventListener('click', () => setYear(state.year + 1));
  $('#yearInput').addEventListener('change', (e) => setYear(Number(e.target.value)));

  $('#chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const token = chip.dataset.token;
    chip.classList.toggle('on');
    state.include.has(token) ? state.include.delete(token) : state.include.add(token);
    loadPlanner();
    loadCompare();
  });

  $('#weekendSelect').addEventListener('change', (e) => {
    state.weekend = e.target.value;
    loadPlanner();
    loadCompare();
  });
  $('#ilSelect').addEventListener('change', (e) => {
    state.il = e.target.value === 'true';
    loadPlanner();
    loadCompare();
  });
  $('#compareBtn').addEventListener('click', loadCompare);
  ['fromYear', 'toYear'].forEach((id) =>
    $(`#${id}`).addEventListener('change', loadCompare));

  loadNext();
  loadPlanner();
  loadCompare();
})();
