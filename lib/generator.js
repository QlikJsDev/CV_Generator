'use strict';
/**
 * Generates a Select Advisory .docx from structured form data.
 * Strategy: open the template, preserve its header/footer/styles/media,
 * replace only the <w:body> content with freshly generated XML.
 */
const fs     = require('fs');
const path   = require('path');
const PizZip = require('pizzip');

const TEMPLATE = path.join(__dirname, '..', 'word_templates', 'select_advisory.docx');

/* ── XML escaping ─────────────────────────────────────────────────────── */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Run helpers ──────────────────────────────────────────────────────── */
function run(text, opts = {}) {
  if (text === null) return '<w:r><w:br/></w:r>';
  const rp = [
    opts.bold   ? '<w:b/><w:bCs/>'                                         : '',
    opts.italic ? '<w:i/><w:iCs/>'                                         : '',
    opts.color  ? `<w:color w:val="${esc(opts.color.replace('#',''))}"/>`   : '',
    opts.font   ? `<w:rFonts w:ascii="${esc(opts.font)}" w:hAnsi="${esc(opts.font)}" w:cs="${esc(opts.font)}"/>` : '',
    opts.sz     ? `<w:sz w:val="${opts.sz}"/><w:szCs w:val="${opts.sz}"/>`  : '',
    opts.caps   ? '<w:caps/>'                                               : '',
  ].join('');
  const rPr = rp ? `<w:rPr>${rp}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

/* ── Paragraph helpers ────────────────────────────────────────────────── */
function p(styleId, runsOrText, ppExtra = '') {
  const runs = typeof runsOrText === 'string'
    ? run(runsOrText)
    : Array.isArray(runsOrText) ? runsOrText.join('') : (runsOrText || '');
  const pPr = styleId || ppExtra
    ? `<w:pPr>${styleId ? `<w:pStyle w:val="${styleId}"/>` : ''}${ppExtra}</w:pPr>`
    : '';
  return `<w:p>${pPr}${runs}</w:p>`;
}

const h1       = (text)  => p('Heading1', run(text));
const h2       = (text)  => p('Heading2', run(text));
const pNormal  = (runs)  => p('Normal', runs);
const pList    = (text)  => p('ListParagraph', run(text));
const pDates   = (text)  => p('JobDates', run(text, { font: 'Barlow', sz: 22 }));
const pDetails = (text)  => p('JobDetails', run(text));
const pDesc    = (text, bold = false) => p('Whitetext', run(text, { bold }));

/* ── Section-boundary paragraphs ─────────────────────────────────────── */
function sectionBoundary1(headerFooterRefs) {
  // Ends section 1 (single col). Must carry header/footer refs + titlePg.
  return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>
    <w:sectPr>${headerFooterRefs}<w:cols w:space="720"/><w:titlePg/></w:sectPr>
  </w:pPr></w:p>`;
}

function sectionBoundary2() {
  // Ends section 2 (2-col technical skills).
  return `<w:p><w:pPr>
    <w:sectPr>
      <w:type w:val="continuous"/>
      <w:cols w:num="2" w:space="720"/>
      <w:titlePg/>
    </w:sectPr>
  </w:pPr></w:p>`;
}

/* ── Know-how table (Personal skills | Areas of expertise) ───────────── */
function buildKnowhowTable(personalSkills, areasOfExpertise) {
  const noBorder = ['top','left','bottom','right','insideH','insideV']
    .map(n => `<w:${n} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`)
    .join('');

  function cell(title, items) {
    const header = p('Normal', run(title, { bold: true, italic: true }));
    const rows = (items || []).map(item =>
      `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:spacing w:after="0"/></w:pPr>${run('\u2022\t' + item)}</w:p>`
    ).join('');
    return `<w:tc>
      <w:tcPr><w:tcBorders>${noBorder}</w:tcBorders></w:tcPr>
      ${header}${rows || p('Normal', '')}
    </w:tc>`;
  }

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="0" w:type="auto"/>
      <w:tblBorders>${noBorder}</w:tblBorders>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="2972"/><w:gridCol w:w="2410"/></w:tblGrid>
    <w:tr>${cell('Personal skills', personalSkills)}${cell('Areas of expertise', areasOfExpertise)}</w:tr>
  </w:tbl>`;
}

/* ── Extract parts of the original document XML ──────────────────────── */
function extractFinalSectPr(docXml) {
  const lastPara = docXml.lastIndexOf('</w:p>');
  if (lastPara === -1) return '';
  const after = docXml.slice(lastPara + 6);
  const start = after.indexOf('<w:sectPr');
  const end   = after.indexOf('</w:sectPr>');
  if (start === -1) return '';
  if (end === -1) {
    const sc = after.indexOf('/>');
    return sc !== -1 ? after.slice(start, sc + 2) : '';
  }
  return after.slice(start, end + '</w:sectPr>'.length);
}

function extractHeaderFooterRefs(sectPrXml) {
  return (sectPrXml.match(/<w:(?:header|footer)Reference[^/]*\/>/g) || []).join('');
}

/* ── Main body builder ────────────────────────────────────────────────── */
function buildBody(data, finalSectPr) {
  const hfRefs = extractHeaderFooterRefs(finalSectPr);
  const parts  = [];

  // ── SECTION 1 ────────────────────────────────────────────────────────
  // Full name
  parts.push(h1(`${data.firstName || ''} ${data.lastName || ''}`.trim()));

  // Birth date + titles on separate lines
  const bioLines = [
    data.birthDate,
    ...(data.titles || []).filter(Boolean)
  ].filter(Boolean);
  if (bioLines.length) {
    const runs = bioLines.map((line, i) => [
      i > 0 ? run(null) : '',   // line break before each title
      run(line),
    ]).flat().join('');
    parts.push(pNormal(runs));
  }

  // Bio paragraph
  if (data.bio) parts.push(pNormal(run(data.bio)));

  // Professional summary
  const timeline = (data.careerTimeline || []).filter(e => e.dates || e.role);
  if (timeline.length) {
    parts.push(h2('Professional summary'));
    for (const entry of timeline) {
      const txt = [entry.dates, [entry.role, entry.company].filter(Boolean).join(' \u2013 ')]
        .filter(Boolean).join(': ');
      parts.push(pNormal(run(txt)));
    }
  }

  // Know-how heading + free text
  parts.push(h2('Know-how'));
  if (data.knowHow) parts.push(pNormal(run(data.knowHow)));

  // Know-how table
  if ((data.personalSkills || []).length || (data.areasOfExpertise || []).length) {
    parts.push(buildKnowhowTable(data.personalSkills || [], data.areasOfExpertise || []));
  }

  // Technical expertise heading
  parts.push(h2('Technical expertise'));

  // ── SECTION BOUNDARY 1 → section 2 = 2-col ───────────────────────────
  parts.push(sectionBoundary1(hfRefs));

  // ── SECTION 2 (2-col technical skills) ───────────────────────────────
  for (const skill of (data.technicalSkills || [])) {
    if (skill) parts.push(pList(skill));
  }

  // ── SECTION BOUNDARY 2 → section 3 = 1-col ───────────────────────────
  parts.push(sectionBoundary2());

  // ── SECTION 3 ────────────────────────────────────────────────────────
  // Education (oldest first)
  const education = [...(data.education || [])].reverse();
  if (education.length) {
    parts.push(h2('Education & training'));
    for (const edu of education) {
      const line = [edu.years ? `${edu.years}: ` : '', edu.degree || ''].join('');
      parts.push(pList(line));
      if (edu.institution) parts.push(pList(edu.institution));
    }
  }

  // Certifications
  if ((data.certifications || []).length) {
    parts.push(h2('Certifications'));
    for (const cert of data.certifications) {
      parts.push(pList(cert.year ? `${cert.year}: ${cert.name}` : (cert.name || '')));
    }
  }

  // Languages
  if ((data.languages || []).length) {
    parts.push(h2('Languages'));
    for (const lang of data.languages) {
      const prof  = Math.max(1, Math.min(5, parseInt(lang.proficiency) || 5));
      const stars = '\u2605'.repeat(prof) + '\u2606'.repeat(5 - prof);
      parts.push(pList(`${lang.language || ''}: ${stars}`));
    }
  }

  // Experiences
  const saExps  = (data.experiences || []).filter(e => e.category !== 'pre_advisory');
  const preExps = (data.experiences || []).filter(e => e.category === 'pre_advisory');

  function pushExperiences(exps) {
    for (const exp of exps) {
      if (exp.dates) parts.push(pDates(exp.dates));
      const title = [exp.title, exp.company].filter(Boolean).join(' \u2013 ');
      if (title) parts.push(pDetails(title));
      for (const desc of (exp.description || [])) {
        if (desc) parts.push(pDesc(desc));
      }
      if (exp.tools) parts.push(pDesc(`Tools: ${exp.tools}`, true));
    }
  }

  if (saExps.length) {
    parts.push(h2('Professional experience with Select Advisory / Beyond Data'));
    pushExperiences(saExps);
  }
  if (preExps.length) {
    parts.push(h2('Professional experience before Select Advisory / Beyond Data'));
    pushExperiences(preExps);
  }

  // Final empty paragraph + preserved sectPr
  parts.push('<w:p/>');
  parts.push(finalSectPr);

  return parts.join('\n');
}

/* ── Entry point ──────────────────────────────────────────────────────── */
async function generateCV(data) {
  const templateBuf = fs.readFileSync(TEMPLATE);
  const zip = new PizZip(templateBuf);

  const docXml  = zip.file('word/document.xml').asText();
  const bodyXml = docXml.slice(docXml.indexOf('<w:body>') + 8,
                               docXml.lastIndexOf('</w:body>'));
  const finalSectPr = extractFinalSectPr(bodyXml);
  const newBody     = buildBody(data, finalSectPr);

  const newDocXml = docXml.slice(0, docXml.indexOf('<w:body>') + 8)
    + newBody
    + '</w:body>'
    + docXml.slice(docXml.lastIndexOf('</w:body>') + 9);

  zip.file('word/document.xml', newDocXml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { generateCV };
