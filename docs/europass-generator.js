;(function (global) {

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const EU_FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 810 540" width="44" height="30">
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

// proficiency → CEFR: 1=A1, 2=A2, 3=B1, 4=C1, 5=C2
function toCEFR(p) {
  return ['', 'A1', 'A2', 'B1', 'C1', 'C2'][Math.max(0, Math.min(5, parseInt(p) || 0))] || '';
}

function secHead(title) {
  return `<div class="ep-sec-head">
    <span class="ep-sec-bullet">&#9679;</span>
    <span class="ep-sec-title">${esc(title)}</span>
  </div>
  <hr class="ep-sec-hr">`;
}

function buildEuropassHTML(d) {
  const fullName = `${d.firstName || ''} ${d.lastName || ''}`.trim();

  // ── PERSONAL INFO ─────────────────────────────────────────────────────
  const personalParts = [];
  if (d.birthDate) personalParts.push(`<strong>Date of birth:</strong> ${esc(d.birthDate)}`);

  // ── ABOUT ME ──────────────────────────────────────────────────────────
  const tlItems = (d.careerTimeline || []).filter(e => e.dates || e.role).map(e => {
    const right = [e.role, e.company].filter(Boolean).join(' – ');
    return `<li>${[e.dates, right].filter(Boolean).join(': ')}</li>`;
  }).join('');

  const aboutSection = (d.bio || tlItems) ? `
  <section class="ep-section">
    ${secHead('About me')}
    <div class="ep-body">
      ${d.bio ? `<p class="ep-bio-italic">${esc(d.bio)}</p>` : ''}
      ${tlItems ? `<ul class="ep-timeline">${tlItems}</ul>` : ''}
    </div>
  </section>` : '';

  // ── WORK EXPERIENCE ───────────────────────────────────────────────────
  const expBlocks = (d.experiences || []).map(exp => {
    const titlePart = [exp.title, exp.company].filter(Boolean).join(' – ');
    const fullHeader = [titlePart, exp.dates].filter(Boolean).join(' – ');
    const descItems = (exp.description || []).filter(Boolean)
      .map(item => `<li>– ${esc(item)}</li>`).join('');
    const tools = exp.tools
      ? `<p class="ep-tools"><strong>Tools:</strong> ${esc(exp.tools)}</p>`
      : '';
    return `<div class="ep-work-entry">
      ${fullHeader ? `<div class="ep-work-title">${esc(fullHeader)}</div>` : ''}
      <hr class="ep-entry-hr">
      ${descItems ? `<ul class="ep-work-bullets">${descItems}</ul>` : ''}
      ${tools}
    </div>`;
  }).join('');

  const expSection = expBlocks ? `
  <section class="ep-section">
    ${secHead('Work experience')}
    <div class="ep-body">${expBlocks}</div>
  </section>` : '';

  // ── EDUCATION ─────────────────────────────────────────────────────────
  const eduBlocks = (d.education || []).map(e => {
    const titlePart = [e.degree, e.institution].filter(Boolean).join(' – ');
    const fullHeader = [titlePart, e.years].filter(Boolean).join(' – ');
    return `<div class="ep-work-entry">
      <div class="ep-work-title">${esc(fullHeader)}</div>
      <hr class="ep-entry-hr">
    </div>`;
  }).join('');

  const eduSection = eduBlocks ? `
  <section class="ep-section">
    ${secHead('Education and training')}
    <div class="ep-body">${eduBlocks}</div>
  </section>` : '';

  // ── CERTIFICATIONS ────────────────────────────────────────────────────
  const certItems = (d.certifications || [])
    .map(c => `<li>– ${c.year ? `<strong>${esc(c.year)}</strong> — ` : ''}${esc(c.name || '')}</li>`)
    .join('');

  const certSection = certItems ? `
  <section class="ep-section">
    ${secHead('Certifications')}
    <div class="ep-body">
      <ul class="ep-work-bullets">${certItems}</ul>
    </div>
  </section>` : '';

  // ── LANGUAGE SKILLS ───────────────────────────────────────────────────
  const motherTongues = (d.languages || []).filter(l => parseInt(l.proficiency) === 5);
  const otherLangs    = (d.languages || []).filter(l => parseInt(l.proficiency) < 5);

  const motherRow = motherTongues.length
    ? `<p class="ep-mother"><strong>Mother tongue(s):</strong> ${motherTongues.map(l => esc(l.language)).join(', ')}</p>`
    : '';

  const langTableRows = otherLangs.map(l => {
    const cefr = toCEFR(l.proficiency);
    return `<tr>
      <td class="ep-lang-name">${esc(l.language || '')}</td>
      <td>${cefr}</td><td>${cefr}</td><td>${cefr}</td><td>${cefr}</td><td>${cefr}</td>
    </tr>`;
  }).join('');

  const langTable = langTableRows ? `
    <p class="ep-lang-sub-label"><strong>Other language(s):</strong></p>
    <table class="ep-lang-table">
      <thead>
        <tr class="ep-lang-group">
          <th rowspan="2"></th>
          <th colspan="2">UNDERSTANDING</th>
          <th colspan="2">SPEAKING</th>
          <th rowspan="2">WRITING</th>
        </tr>
        <tr>
          <th>Listening</th><th>Reading</th>
          <th>Spoken production</th><th>Spoken interaction</th>
        </tr>
      </thead>
      <tbody>${langTableRows}</tbody>
    </table>
    <p class="ep-cefr-note">Levels: A1 and A2: Basic user &nbsp;&middot;&nbsp; B1 and B2: Independent user &nbsp;&middot;&nbsp; C1 and C2: Proficient user</p>`
    : '';

  const langSection = (motherRow || langTable) ? `
  <section class="ep-section">
    ${secHead('Language skills')}
    <div class="ep-body">
      ${motherRow}
      ${langTable}
    </div>
  </section>` : '';

  // ── SKILLS ────────────────────────────────────────────────────────────
  const allSkills = [
    ...(d.personalSkills || []),
    ...(d.areasOfExpertise || []).map(a => typeof a === 'string' ? a : (a.label || '')),
    ...(d.technicalSkills || []),
  ].filter(Boolean);

  const skillsSection = (allSkills.length || d.knowHow) ? `
  <section class="ep-section">
    ${secHead('Skills')}
    <div class="ep-body">
      ${d.knowHow ? `<p class="ep-bio-italic" style="margin-bottom:8px">${esc(d.knowHow)}</p>` : ''}
      ${allSkills.length ? `<p class="ep-skills-text">${esc(allSkills.join(', '))}</p>` : ''}
    </div>
  </section>` : '';

  // ── TITLES ────────────────────────────────────────────────────────────
  const titlesText = (d.titles || []).filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Europass CV – ${esc(fullName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Open Sans', Arial, sans-serif;
      font-size: 9.5pt;
      color: #1a1a1a;
      background: #d8d8d8;
      line-height: 1.45;
    }

    .ep-page {
      background: #fff;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px 28px 28px;
    }

    /* ── Top logo row ── */
    .ep-logo-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .ep-logo-text {
      font-size: 20pt;
      font-weight: 700;
      color: #003399;
      letter-spacing: -0.5px;
      font-style: italic;
    }

    /* ── Name block ── */
    .ep-name {
      font-size: 18pt;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 2px;
    }
    .ep-subtitle {
      font-size: 9.5pt;
      color: #444;
      font-style: italic;
      margin-bottom: 8px;
    }
    hr.ep-main-hr {
      border: none;
      border-top: 1px solid #aaa;
      margin: 8px 0;
    }

    /* ── Personal info block ── */
    .ep-personal {
      font-size: 8.5pt;
      color: #1a1a1a;
      margin: 8px 0;
      line-height: 1.8;
    }
    .ep-personal strong { font-weight: 700; }
    .ep-personal .ep-pi-sep {
      display: inline-block;
      margin: 0 10px;
      color: #999;
    }

    /* ── Section header ── */
    .ep-sec-head {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-top: 16px;
      margin-bottom: 4px;
    }
    .ep-sec-bullet {
      font-size: 9pt;
      color: #555;
      flex-shrink: 0;
    }
    .ep-sec-title {
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #1a1a1a;
    }
    hr.ep-sec-hr {
      border: none;
      border-top: 1px solid #aaa;
      margin: 0 0 10px;
    }

    /* ── Section body ── */
    .ep-body { padding: 0 0 6px; }

    /* ── About me ── */
    .ep-bio-italic {
      font-style: italic;
      font-size: 9.5pt;
      color: #1a1a1a;
      line-height: 1.55;
      text-align: justify;
    }
    .ep-timeline {
      margin: 8px 0 0 0;
      list-style: none;
      padding: 0;
    }
    .ep-timeline li {
      font-size: 9pt;
      color: #333;
      margin-bottom: 3px;
      padding-left: 12px;
    }
    .ep-timeline li::before { content: "– "; }

    /* ── Work / project entry ── */
    .ep-work-entry { margin-bottom: 14px; }
    .ep-work-entry:last-child { margin-bottom: 0; }

    .ep-work-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #005a8e;
      text-transform: uppercase;
    }
    hr.ep-entry-hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 5px 0 6px;
      width: 60%;
    }

    .ep-work-bullets {
      list-style: none;
      padding: 0;
      margin: 0 0 4px;
    }
    .ep-work-bullets li {
      font-size: 9pt;
      color: #005a8e;
      margin-bottom: 3px;
      padding-left: 2px;
    }

    .ep-tools {
      font-size: 8.5pt;
      color: #555;
      margin-top: 4px;
    }

    /* ── Language skills ── */
    .ep-mother {
      font-size: 9.5pt;
      margin-bottom: 8px;
    }
    .ep-lang-sub-label {
      font-size: 9pt;
      margin-bottom: 5px;
    }
    .ep-lang-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-bottom: 6px;
    }
    .ep-lang-table th {
      background: #003399;
      color: #fff;
      padding: 4px 8px;
      text-align: center;
      font-weight: 600;
      font-size: 8pt;
      border: 1px solid #002580;
    }
    .ep-lang-group th { font-size: 8.5pt; }
    .ep-lang-table td {
      padding: 4px 8px;
      text-align: center;
      border: 1px solid #dde4f5;
    }
    .ep-lang-name {
      text-align: left !important;
      font-weight: 700;
    }
    .ep-cefr-note {
      font-size: 7.5pt;
      color: #666;
      font-style: italic;
      margin-top: 4px;
    }

    /* ── Skills ── */
    .ep-skills-text {
      font-size: 9pt;
      color: #1a1a1a;
      line-height: 1.7;
    }

    /* ── Print ── */
    @media print {
      body { background: #fff; }
      .ep-page { max-width: 100%; margin: 0; box-shadow: none; padding: 0 18mm; }
      @page { margin: 15mm 0; size: A4; }
    }
    @media screen {
      .ep-page { box-shadow: 0 2px 24px rgba(0,0,0,.2); margin: 20px auto; }
    }
  </style>
</head>
<body>
<div class="ep-page">

  <!-- Top-right logo -->
  <div class="ep-logo-row">
    ${EU_FLAG_SVG}
    <span class="ep-logo-text">europass</span>
  </div>

  <!-- Name -->
  <div class="ep-name">${esc(fullName)}</div>
  ${titlesText ? `<div class="ep-subtitle">${esc(titlesText)}</div>` : ''}
  <hr class="ep-main-hr">

  <!-- Personal info -->
  ${personalParts.length ? `<div class="ep-personal">${personalParts.join('<span class="ep-pi-sep">|</span>')}</div><hr class="ep-main-hr">` : ''}

  ${aboutSection}
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
