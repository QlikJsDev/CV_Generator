/**
 * Browser-compatible Select Advisory .docx generator.
 * Requires PizZip to be loaded (CDN).
 * Fetches the template from ./word_templates/select_advisory.docx
 */
;(function (global) {

// ── XML helpers ────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function run(text, o = {}) {
  if (text === null) return '<w:r><w:br/></w:r>';
  const rp = [
    o.bold   ? '<w:b/><w:bCs/>'                                           : '',
    o.italic ? '<w:i/><w:iCs/>'                                           : '',
    o.color  ? `<w:color w:val="${esc(o.color.replace('#',''))}"/>`        : '',
    o.font   ? `<w:rFonts w:ascii="${esc(o.font)}" w:hAnsi="${esc(o.font)}" w:cs="${esc(o.font)}"/>` : '',
    o.sz     ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`          : '',
  ].join('');
  const rPr = rp ? `<w:rPr>${rp}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(styleId, runsOrText, ppExtra = '') {
  const runs = typeof runsOrText === 'string'
    ? run(runsOrText)
    : Array.isArray(runsOrText) ? runsOrText.join('') : (runsOrText || '');
  const pPr = styleId || ppExtra
    ? `<w:pPr>${styleId ? `<w:pStyle w:val="${styleId}"/>` : ''}${ppExtra}</w:pPr>`
    : '';
  return `<w:p>${pPr}${runs}</w:p>`;
}

const h1      = t => para('Heading1', run(t));
const h2      = t => para('Heading2', run(t));
const pNormal = r => para('Normal', r);
const pList   = t => para('ListParagraph', run(t));
const pDates  = t => para('JobDates', run(t, { font:'Barlow', sz:22 }));
const pDetail = t => para('JobDetails', run(t));
const pDesc   = (t, bold=false) => para('Whitetext', run(t, { bold }));

function sec1Boundary(hfRefs) {
  return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>
    <w:sectPr>${hfRefs}<w:cols w:space="720"/><w:titlePg/></w:sectPr>
  </w:pPr></w:p>`;
}
function sec2Boundary() {
  return `<w:p><w:pPr><w:sectPr>
    <w:type w:val="continuous"/>
    <w:cols w:num="2" w:space="720"/>
    <w:titlePg/>
  </w:sectPr></w:pPr></w:p>`;
}

function buildTable(personalSkills, areasOfExpertise) {
  const noBorder = ['top','left','bottom','right','insideH','insideV']
    .map(n => `<w:${n} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`).join('');
  function cell(title, items) {
    return `<w:tc>
      <w:tcPr><w:tcBorders>${noBorder}</w:tcBorders></w:tcPr>
      ${para('Normal', run(title, {bold:true,italic:true}))}
      ${(items||[]).map(i => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:spacing w:after="0"/></w:pPr>${run('\u2022\t'+i)}</w:p>`).join('')}
    </w:tc>`;
  }
  return `<w:tbl>
    <w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${noBorder}</w:tblBorders></w:tblPr>
    <w:tblGrid><w:gridCol w:w="2972"/><w:gridCol w:w="2410"/></w:tblGrid>
    <w:tr>${cell('Personal skills',personalSkills)}${cell('Areas of expertise',areasOfExpertise)}</w:tr>
  </w:tbl>`;
}

// ── Extract final sectPr ───────────────────────────────────────────────────
function extractFinalSectPr(docXml) {
  const lastPara = docXml.lastIndexOf('</w:p>');
  if (lastPara === -1) return '';
  const after = docXml.slice(lastPara + 6);
  const start = after.indexOf('<w:sectPr');
  const end   = after.indexOf('</w:sectPr>');
  if (start === -1) return '';
  if (end   === -1) { const sc = after.indexOf('/>'); return sc !== -1 ? after.slice(start, sc+2) : ''; }
  return after.slice(start, end + '</w:sectPr>'.length);
}
function extractHFRefs(sectPr) {
  return (sectPr.match(/<w:(?:header|footer)Reference[^/]*\/>/g) || []).join('');
}

// ── Build body ─────────────────────────────────────────────────────────────
function buildBody(data, finalSectPr) {
  const hfRefs = extractHFRefs(finalSectPr);
  const out    = [];

  // Name
  out.push(h1(`${data.firstName||''} ${data.lastName||''}`.trim()));

  // Birthdate + titles
  const bioLines = [data.birthDate, ...(data.titles||[]).filter(Boolean)].filter(Boolean);
  if (bioLines.length) {
    const runs = bioLines.flatMap((line, i) => [i > 0 ? run(null) : '', run(line)]);
    out.push(pNormal(runs.join('')));
  }

  if (data.bio) out.push(pNormal(run(data.bio)));

  // Professional summary
  const tl = (data.careerTimeline||[]).filter(e => e.dates||e.role);
  if (tl.length) {
    out.push(h2('Professional summary'));
    tl.forEach(e => {
      const t = [e.dates, [e.role, e.company].filter(Boolean).join(' \u2013 ')].filter(Boolean).join(': ');
      out.push(pNormal(run(t)));
    });
  }

  // Know-how
  out.push(h2('Know-how'));
  if (data.knowHow) out.push(pNormal(run(data.knowHow)));

  if ((data.personalSkills||[]).length || (data.areasOfExpertise||[]).length)
    out.push(buildTable(data.personalSkills||[], data.areasOfExpertise||[]));

  out.push(h2('Technical expertise'));
  out.push(sec1Boundary(hfRefs));

  (data.technicalSkills||[]).filter(Boolean).forEach(s => out.push(pList(s)));
  out.push(sec2Boundary());

  // Education (oldest first)
  const edu = [...(data.education||[])].reverse();
  if (edu.length) {
    out.push(h2('Education & training'));
    edu.forEach(e => {
      out.push(pList((e.years ? e.years+': ' : '') + (e.degree||'')));
      if (e.institution) out.push(pList(e.institution));
    });
  }

  // Certifications
  if ((data.certifications||[]).length) {
    out.push(h2('Certifications'));
    data.certifications.forEach(c => out.push(pList(c.year ? `${c.year}: ${c.name}` : c.name||'')));
  }

  // Languages
  if ((data.languages||[]).length) {
    out.push(h2('Languages'));
    data.languages.forEach(l => {
      const prof  = Math.max(1, Math.min(5, parseInt(l.proficiency)||5));
      const stars = '\u2605'.repeat(prof) + '\u2606'.repeat(5-prof);
      out.push(pList(`${l.language||''}: ${stars}`));
    });
  }

  // Experiences
  const saExps  = (data.experiences||[]).filter(e => e.category !== 'pre_advisory');
  const preExps = (data.experiences||[]).filter(e => e.category === 'pre_advisory');

  function pushExps(exps) {
    exps.forEach(exp => {
      if (exp.dates) out.push(pDates(exp.dates));
      const title = [exp.title, exp.company].filter(Boolean).join(' \u2013 ');
      if (title) out.push(pDetail(title));
      (exp.description||[]).filter(Boolean).forEach(d => out.push(pDesc(d)));
      if (exp.tools) out.push(pDesc(`Tools: ${exp.tools}`, true));
    });
  }

  if (saExps.length) { out.push(h2('Professional experience with Select Advisory / Beyond Data')); pushExps(saExps); }
  if (preExps.length){ out.push(h2('Professional experience before Select Advisory / Beyond Data')); pushExps(preExps); }

  out.push('<w:p/>');
  out.push(finalSectPr);
  return out.join('\n');
}

// ── Public API ─────────────────────────────────────────────────────────────
let _templateCache = null;

async function generateCV(data) {
  if (!_templateCache) {
    const resp = await fetch('word_templates/select_advisory.docx');
    if (!resp.ok) throw new Error('Failed to load template');
    _templateCache = await resp.arrayBuffer();
  }

  const zip    = new PizZip(_templateCache.slice(0)); // fresh copy each time
  const docXml = zip.file('word/document.xml').asText();
  const bodyXml = docXml.slice(docXml.indexOf('<w:body>')+8, docXml.lastIndexOf('</w:body>'));
  const sectPr  = extractFinalSectPr(bodyXml);
  const newBody = buildBody(data, sectPr);

  const newDocXml = docXml.slice(0, docXml.indexOf('<w:body>')+8)
    + newBody
    + '</w:body>'
    + docXml.slice(docXml.lastIndexOf('</w:body>')+9);

  zip.file('word/document.xml', newDocXml);
  return zip.generate({ type: 'blob', compression: 'DEFLATE' });
}

global.generateCV = generateCV;

})(window);
