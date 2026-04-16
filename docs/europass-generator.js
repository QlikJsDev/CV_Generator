;(function (global) {

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// EU flag SVG (12 stars on blue circle)
const EU_FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 810 540" width="48" height="32">
  <rect width="810" height="540" fill="#003399"/>
  <g fill="#FFCC00">
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(0,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(30,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(60,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(90,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(120,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(150,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(180,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(210,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(240,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(270,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(300,405,270)"/>
    <polygon points="405,90 411,109 431,109 415,121 421,140 405,128 389,140 395,121 379,109 399,109" transform="rotate(330,405,270)"/>
  </g>
</svg>`;

function stars(n, total) {
  let s = '';
  for (let i = 0; i < total; i++) {
    s += i < n
      ? `<span style="color:#003399;font-size:14px;">&#9733;</span>`
      : `<span style="color:#ccc;font-size:14px;">&#9733;</span>`;
  }
  return s;
}

function sectionHeader(title) {
  return `<div class="ep-section-header"><span class="ep-section-icon"></span><h2>${esc(title)}</h2></div>`;
}

function buildEuropassHTML(d) {
  const fullName = `${d.firstName||''} ${d.lastName||''}`.trim();

  // ── PERSONAL INFORMATION ──────────────────────────────────────────────
  const personalRows = [];
  if (d.birthDate) personalRows.push(`<tr><td class="ep-label">Date of birth</td><td>${esc(d.birthDate)}</td></tr>`);
  const nationality = '';  // not stored — leave blank
  if ((d.languages||[]).length) {
    const mother = (d.languages||[]).find(l => (parseInt(l.proficiency)||0) === 5);
    if (mother) personalRows.push(`<tr><td class="ep-label">Mother tongue</td><td>${esc(mother.language||'')}</td></tr>`);
  }

  // ── WORK EXPERIENCE ───────────────────────────────────────────────────
  const expBlocks = (d.experiences||[]).map(exp => {
    const descList = (exp.description||[]).filter(Boolean)
      .map(item => `<li>${esc(item)}</li>`).join('');
    const tools = exp.tools ? `<p class="ep-tools"><strong>Tools:</strong> ${esc(exp.tools)}</p>` : '';
    return `<div class="ep-entry">
      <div class="ep-entry-left">${esc(exp.dates||'')}</div>
      <div class="ep-entry-right">
        ${exp.title ? `<strong>${esc(exp.title)}</strong>` : ''}
        ${exp.company ? `<br><span class="ep-org">${esc(exp.company)}</span>` : ''}
        ${descList ? `<ul>${descList}</ul>` : ''}
        ${tools}
      </div>
    </div>`;
  }).join('');

  // ── EDUCATION ─────────────────────────────────────────────────────────
  const eduBlocks = (d.education||[]).map(e => `<div class="ep-entry">
    <div class="ep-entry-left">${esc(e.years||'')}</div>
    <div class="ep-entry-right">
      <strong>${esc(e.degree||'')}</strong>
      ${e.institution ? `<br><span class="ep-org">${esc(e.institution)}</span>` : ''}
    </div>
  </div>`).join('');

  // ── CERTIFICATIONS ────────────────────────────────────────────────────
  const certRows = (d.certifications||[]).map(c =>
    `<li>${c.year ? `<strong>${esc(c.year)}</strong> — ` : ''}${esc(c.name||'')}</li>`
  ).join('');

  // ── LANGUAGES ────────────────────────────────────────────────────────
  const langRows = (d.languages||[]).map(l => {
    const p = Math.max(0, Math.min(5, parseInt(l.proficiency)||0));
    const cefrMap = ['', 'A1', 'A2', 'B1', 'B2', 'C2'];
    const cefr = cefrMap[p] || '';
    return `<tr>
      <td class="ep-lang-name">${esc(l.language||'')}</td>
      <td>${cefr}</td><td>${cefr}</td><td>${cefr}</td><td>${cefr}</td><td>${cefr}</td>
      <td class="ep-stars">${stars(p, 5)}</td>
    </tr>`;
  }).join('');

  // ── SKILLS ────────────────────────────────────────────────────────────
  const allSkills = [
    ...(d.personalSkills||[]),
    ...(d.areasOfExpertise||[]).map(a => typeof a === 'string' ? a : (a.label||'')),
    ...(d.technicalSkills||[]),
  ].filter(Boolean);

  const skillsHtml = allSkills.length
    ? `<p class="ep-skills-list">${allSkills.map(s => `<span class="ep-skill-tag">${esc(s)}</span>`).join(' ')}</p>`
    : '';

  // ── CAREER SUMMARY ────────────────────────────────────────────────────
  const tlItems = (d.careerTimeline||[]).filter(e => e.dates||e.role).map(e => {
    const parts = [e.dates, [e.role, e.company].filter(Boolean).join(' – ')].filter(Boolean);
    return `<li>${parts.map(p => esc(p)).join(': ')}</li>`;
  }).join('');

  const bioSection = (d.bio || tlItems) ? `
    <section class="ep-section">
      ${sectionHeader('About me')}
      ${d.bio ? `<p class="ep-bio">${esc(d.bio)}</p>` : ''}
      ${tlItems ? `<ul class="ep-timeline">${tlItems}</ul>` : ''}
    </section>` : '';

  const expSection = expBlocks ? `
    <section class="ep-section">
      ${sectionHeader('Work experience')}
      ${expBlocks}
    </section>` : '';

  const eduSection = eduBlocks ? `
    <section class="ep-section">
      ${sectionHeader('Education and training')}
      ${eduBlocks}
    </section>` : '';

  const certSection = certRows ? `
    <section class="ep-section">
      ${sectionHeader('Certifications')}
      <ul class="ep-cert-list">${certRows}</ul>
    </section>` : '';

  const langSection = langRows ? `
    <section class="ep-section">
      ${sectionHeader('Language skills')}
      <table class="ep-lang-table">
        <thead>
          <tr>
            <th>Language</th>
            <th colspan="2">Understanding</th>
            <th colspan="2">Speaking</th>
            <th>Writing</th>
            <th>Level</th>
          </tr>
          <tr class="ep-lang-sub">
            <th></th><th>Listening</th><th>Reading</th>
            <th>Production</th><th>Interaction</th><th></th><th></th>
          </tr>
        </thead>
        <tbody>${langRows}</tbody>
      </table>
      <p class="ep-cefr-note">Levels: A1–A2 Basic · B1–B2 Independent · C1–C2 Proficient</p>
    </section>` : '';

  const skillsSection = skillsHtml ? `
    <section class="ep-section">
      ${sectionHeader('Skills')}
      ${d.knowHow ? `<p class="ep-bio" style="margin-bottom:12px">${esc(d.knowHow)}</p>` : ''}
      ${skillsHtml}
    </section>` : '';

  const titlesHtml = (d.titles||[]).filter(Boolean)
    .map(t => `<span class="ep-title-tag">${esc(t)}</span>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Europass CV – ${esc(fullName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Open Sans', Arial, sans-serif; font-size: 10pt; color: #222; background: #f2f2f2; }
    .ep-page { background: #fff; max-width: 210mm; margin: 0 auto; padding: 0; }

    /* ── Header ── */
    .ep-header { background: #003399; color: #fff; padding: 24px 32px; display: flex; align-items: flex-start; gap: 24px; }
    .ep-header-flag { flex-shrink: 0; margin-top: 4px; }
    .ep-header-name { flex: 1; }
    .ep-header-name h1 { font-size: 22pt; font-weight: 700; letter-spacing: .5px; margin-bottom: 6px; }
    .ep-title-tag { display: inline-block; background: rgba(255,255,255,.18); border-radius: 4px; padding: 2px 8px; font-size: 9pt; margin: 2px 3px 2px 0; }
    .ep-header-meta { margin-top: 10px; font-size: 8.5pt; opacity: .85; }
    .ep-header-meta span { display: inline-block; margin-right: 16px; }

    /* ── Sections ── */
    .ep-section { padding: 18px 32px; border-bottom: 1px solid #e8e8e8; }
    .ep-section:last-child { border-bottom: none; }
    .ep-section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #003399; }
    .ep-section-header h2 { color: #003399; font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; }

    /* ── Entry (work/edu) ── */
    .ep-entry { display: flex; gap: 20px; margin-bottom: 14px; }
    .ep-entry:last-child { margin-bottom: 0; }
    .ep-entry-left { width: 110px; flex-shrink: 0; font-size: 8.5pt; color: #555; font-weight: 600; padding-top: 1px; }
    .ep-entry-right { flex: 1; }
    .ep-entry-right strong { font-size: 10pt; color: #111; }
    .ep-org { font-size: 9pt; color: #003399; font-weight: 600; }
    .ep-entry-right ul { margin: 6px 0 0 16px; }
    .ep-entry-right li { margin-bottom: 3px; font-size: 9pt; }
    .ep-tools { font-size: 8.5pt; color: #555; margin-top: 5px; }

    /* ── Bio / Timeline ── */
    .ep-bio { font-size: 9.5pt; line-height: 1.6; color: #333; }
    .ep-timeline { margin: 10px 0 0 16px; }
    .ep-timeline li { font-size: 9pt; margin-bottom: 4px; color: #333; }

    /* ── Certifications ── */
    .ep-cert-list { margin-left: 16px; }
    .ep-cert-list li { font-size: 9pt; margin-bottom: 4px; }

    /* ── Languages ── */
    .ep-lang-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px; }
    .ep-lang-table th { background: #003399; color: #fff; padding: 5px 8px; text-align: center; font-weight: 600; font-size: 8pt; }
    .ep-lang-table td { padding: 5px 8px; text-align: center; border-bottom: 1px solid #eee; }
    .ep-lang-name { text-align: left !important; font-weight: 600; }
    .ep-lang-sub th { background: #1a4daa; font-size: 7.5pt; }
    .ep-stars { text-align: left !important; }
    .ep-cefr-note { font-size: 7.5pt; color: #777; margin-top: 4px; }

    /* ── Skills ── */
    .ep-skills-list { margin-top: 4px; }
    .ep-skill-tag { display: inline-block; background: #eef2fa; border: 1px solid #c5d3ef; border-radius: 3px; padding: 2px 7px; font-size: 8.5pt; margin: 2px 3px 2px 0; color: #003399; }

    /* ── Print ── */
    @media print {
      body { background: #fff; }
      .ep-page { max-width: 100%; margin: 0; box-shadow: none; }
      @page { margin: 0; size: A4; }
    }
    @media screen { .ep-page { box-shadow: 0 2px 24px rgba(0,0,0,.15); margin: 20px auto; } }
  </style>
</head>
<body>
<div class="ep-page">
  <div class="ep-header">
    <div class="ep-header-flag">${EU_FLAG_SVG}</div>
    <div class="ep-header-name">
      <h1>${esc(fullName)}</h1>
      ${titlesHtml}
      <div class="ep-header-meta">
        ${d.birthDate ? `<span>📅 ${esc(d.birthDate)}</span>` : ''}
      </div>
    </div>
  </div>

  ${bioSection}
  ${expSection}
  ${eduSection}
  ${certSection}
  ${langSection}
  ${skillsSection}
</div>
</body>
</html>`;
}

global.generateEuropassCV = function(data) {
  const html = buildEuropassHTML(data);
  return new Blob([html], { type: 'text/html;charset=utf-8' });
};

})(window);
