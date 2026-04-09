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
  const runs = Array.isArray(runsOrText) ? runsOrText.join('') : (runsOrText || '');
  const pPr = styleId || ppExtra
    ? `<w:pPr>${styleId ? `<w:pStyle w:val="${styleId}"/>` : ''}${ppExtra}</w:pPr>`
    : '';
  return `<w:p>${pPr}${runs}</w:p>`;
}

const h1      = t => para('Heading1', run(t));
const h2      = t => para('Heading2', run(t));
const pNormal = r => para('Normal', r);
const pDates  = t => para('JobDates', run(t, { font:'Barlow', sz:22 }));
const pDesc   = (t, bold=false) => para('Whitetext', run(t, { bold }));

function sec1Boundary(hfRefs) {
  return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:sectPr>`
    + hfRefs
    + `<w:pgSz w:w="11906" w:h="16838"/>`
    + `<w:pgMar w:top="1276" w:right="566" w:bottom="993" w:left="709" w:header="0" w:footer="0" w:gutter="0"/>`
    + `<w:pgNumType w:start="1"/>`
    + `<w:cols w:space="720"/>`
    + `<w:titlePg/>`
    + `<w:docGrid w:linePitch="299"/>`
    + `</w:sectPr></w:pPr></w:p>`;
}
function sec2Boundary() {
  return `<w:p><w:pPr><w:sectPr>`
    + `<w:type w:val="continuous"/>`
    + `<w:pgSz w:w="11906" w:h="16838"/>`
    + `<w:pgMar w:top="1569" w:right="566" w:bottom="993" w:left="709" w:header="0" w:footer="0" w:gutter="0"/>`
    + `<w:pgNumType w:start="1"/>`
    + `<w:cols w:num="2" w:space="720"/>`
    + `<w:titlePg/>`
    + `<w:docGrid w:linePitch="299"/>`
    + `</w:sectPr></w:pPr></w:p>`;
}

function buildTable(personalSkills, areasOfExpertise) {
  const noBorder = ['top','left','bottom','right','insideH','insideV']
    .map(n => `<w:${n} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`).join('');
  function cell(title, items) {
    return `<w:tc>
      <w:tcPr><w:tcBorders>${noBorder}</w:tcBorders></w:tcPr>
      ${para('Normal', run(title, {bold:true,italic:true}))}
      ${(items||[]).map(i => `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${run('\u2022 '+i)}</w:p>`).join('')}
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
function buildBody(data, finalSectPr, hfRefs, listNumId) {
  const numId = listNumId || '9';
  const pList   = t => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${run(t)}</w:p>`;
  const pDetail = (title, company) => {
    const r1 = title   ? run(title,               { color: '3756F5' })              : '';
    const r2 = company ? run(' \u2022 ' + company, { color: '56AF89', bold: true }) : '';
    return para('JobDetails', r1 + r2);
  };
  const out = [];

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
      if (exp.title || exp.company) out.push(pDetail(exp.title||'', exp.company||''));
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
let _templateCache    = null;
let _bdTemplateCache  = null;

async function generateCV(data) {
  if (!_templateCache) {
    const resp = await fetch('word_templates/select_advisory.docx');
    if (!resp.ok) throw new Error('Failed to load template');
    _templateCache = await resp.arrayBuffer();
  }

  const zip    = new PizZip(_templateCache.slice(0));
  const docXml = zip.file('word/document.xml').asText();
  const bodyXml = docXml.slice(docXml.indexOf('<w:body>')+8, docXml.lastIndexOf('</w:body>'));
  const sectPr  = extractFinalSectPr(bodyXml);
  const hfRefs     = (bodyXml.match(/<w:(?:header|footer)Reference[^/]*\/>/g) || []).join('');
  const numIdMatch = bodyXml.match(/<w:pStyle w:val="ListParagraph"[\s\S]{0,500}?<w:numId w:val="([^"]+)"/);
  const listNumId  = numIdMatch ? numIdMatch[1] : '9';
  const newBody    = buildBody(data, sectPr, hfRefs, listNumId);

  const newDocXml = docXml.slice(0, docXml.indexOf('<w:body>')+8)
    + newBody
    + '</w:body>'
    + docXml.slice(docXml.lastIndexOf('</w:body>')+9);

  zip.file('word/document.xml', newDocXml);
  return zip.generate({ type: 'blob', compression: 'DEFLATE' });
}

// ── Beyond Data generator ──────────────────────────────────────────────────

/**
 * Find the end of each top-level <w:p> in bodyXml, skipping txbxContent/
 * v:textbox nesting and handling self-closing <w:p .../> correctly.
 * Returns array of {start, end} for each top-level paragraph.
 */
function findTopLevelParas(bodyXml) {
  const paras = [];
  let i = 0;
  const len = bodyXml.length;

  while (i < len) {
    if (bodyXml[i] !== '<') { i++; continue; }

    // Skip txbxContent / v:textbox entirely
    if (bodyXml.slice(i, i+16) === '<w:txbxContent>') {
      const e = bodyXml.indexOf('</w:txbxContent>', i);
      i = e === -1 ? len : e + 16; continue;
    }
    if (bodyXml.slice(i, i+11) === '<v:textbox>') {
      const e = bodyXml.indexOf('</v:textbox>', i);
      i = e === -1 ? len : e + 12; continue;
    }

    // Detect <w:p ...> or <w:p>  (not <w:pPr>, <w:pStyle>, etc.)
    if (bodyXml.slice(i, i+4) === '<w:p') {
      const ch = bodyXml[i+4];
      if (ch === '>' || ch === ' ' || ch === '\n' || ch === '\r') {
        const start = i;
        // Check if self-closing: scan for /> before next <
        let j = i + 4;
        while (j < len && bodyXml[j] !== '<') {
          if (bodyXml[j] === '/' && bodyXml[j+1] === '>') {
            // Self-closing <w:p ... /> — treat as empty paragraph
            paras.push({ start, end: j + 2 });
            i = j + 2;
            j = len; // exit inner loop
            break;
          }
          j++;
        }
        if (j < len && bodyXml[j] === '<') {
          // Regular open tag — find matching </w:p> tracking depth
          let depth = 1;
          let cursor = i + 4;
          while (depth > 0 && cursor < len) {
            if (bodyXml.slice(cursor, cursor+16) === '<w:txbxContent>') {
              const e = bodyXml.indexOf('</w:txbxContent>', cursor);
              cursor = e === -1 ? len : e + 16; continue;
            }
            if (bodyXml.slice(cursor, cursor+11) === '<v:textbox>') {
              const e = bodyXml.indexOf('</v:textbox>', cursor);
              cursor = e === -1 ? len : e + 12; continue;
            }
            if (bodyXml.slice(cursor, cursor+4) === '<w:p') {
              const c2 = bodyXml[cursor+4];
              if (c2 === '>' || c2 === ' ' || c2 === '\n' || c2 === '\r') {
                // Check self-closing
                let k = cursor + 4;
                let selfClose = false;
                while (k < len && bodyXml[k] !== '<') {
                  if (bodyXml[k] === '/' && bodyXml[k+1] === '>') { selfClose = true; cursor = k+2; break; }
                  k++;
                }
                if (!selfClose) { depth++; cursor = cursor + 4; }
                continue;
              }
            }
            if (bodyXml.slice(cursor, cursor+6) === '</w:p>') {
              depth--;
              cursor += 6;
              if (depth === 0) { paras.push({ start, end: cursor }); i = cursor; break; }
              continue;
            }
            cursor++;
          }
          if (depth > 0) i = len; // no close found
        }
        continue;
      }
    }
    i++;
  }
  return paras;
}

/**
 * Build the txbxContent XML for the BD name/titles floating text box.
 * Bold name (sz=40) on line 1, each title on its own line (sz=32), centred.
 */
function buildBDNameBox(firstName, lastName, titles) {
  const fullName = `${firstName||''} ${lastName||''}`.trim() || 'Name';
  const titleLines = (titles||[]).filter(Boolean);

  const nameRun = `<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr><w:t>${esc(fullName)}</w:t></w:r>`;
  // Each title on its own line via <w:br/>
  const titleRuns = titleLines.map(t =>
    `<w:r><w:rPr><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:br/></w:r>` +
    `<w:r><w:rPr><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>${esc(t)}</w:t></w:r>`
  ).join('');

  return `<w:txbxContent>`
    + `<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr>`
    + nameRun + titleRuns
    + `</w:p>`
    + `</w:txbxContent>`;
}

/**
 * Build the BD body content paragraphs.
 * Bio and titles are already injected into para0 (name box) and para2 (bio run).
 * This function produces everything from "Professional summary" onwards.
 */
function buildBDBody(data, finalSectPr, listNumId) {
  const numId = listNumId || '1';

  // BD-specific heading: numId=0 disables the auto-numbering inherited from BD Heading1 style
  const bdH1 = t => `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr></w:pPr>${run(t)}</w:p>`;

  const pList = t => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${run(t)}</w:p>`;

  const pDetail = (title, company) => {
    const r1 = title   ? run(title,               { color: '3756F5' })              : '';
    const r2 = company ? run(' \u2022 ' + company, { color: '56AF89', bold: true }) : '';
    return para('JobDetails', r1 + r2);
  };

  // BD-specific JobDates uses Urbanist (not Barlow)
  const bdPDates = t => para('JobDates', run(t, { font: 'Urbanist', sz: 22 }));

  // Career timeline: one Normal para per entry, date black + role blue + <w:br/> + "at company"
  // Urbanist 10pt (sz=20), spacing after=120
  const rprBDNormal = `<w:rFonts w:ascii="Urbanist" w:hAnsi="Urbanist"/><w:sz w:val="20"/><w:szCs w:val="20"/>`;
  const pTimeline = e => {
    const runs = [];
    if (e.dates) runs.push(`<w:r><w:rPr>${rprBDNormal}</w:rPr><w:t xml:space="preserve">${esc(e.dates + ': ')}</w:t></w:r>`);
    if (e.role)  runs.push(`<w:r><w:rPr>${rprBDNormal}<w:color w:val="3756F5"/></w:rPr><w:t>${esc(e.role)}</w:t></w:r>`);
    if (e.company) {
      runs.push(`<w:r><w:rPr>${rprBDNormal}<w:color w:val="3756F5"/></w:rPr><w:br/></w:r>`);
      runs.push(`<w:r><w:rPr>${rprBDNormal}</w:rPr><w:t>${esc('at ' + e.company)}</w:t></w:r>`);
    }
    return `<w:p><w:pPr><w:spacing w:after="120"/><w:rPr>${rprBDNormal}</w:rPr></w:pPr>${runs.join('')}</w:p>`;
  };

  const out = [];

  // Career timeline — Normal paragraphs directly after bio (no heading before them)
  (data.careerTimeline||[]).filter(e => e.dates||e.role).forEach(e => out.push(pTimeline(e)));

  // Training & certifications
  const certs = data.certifications||[];
  if (certs.length) {
    out.push(bdH1('Training & certifications'));
    certs.forEach(c => out.push(pList(c.year ? `${c.year}: ${c.name}` : c.name||'')));
  }

  // Education — original order (not reversed)
  const edu = data.education||[];
  if (edu.length) {
    out.push(bdH1('Education'));
    edu.forEach(e => {
      out.push(pList((e.years ? e.years+': ' : '') + (e.degree||'')));
      if (e.institution) out.push(pList(e.institution));
    });
  }

  // Experiences
  const saExps  = (data.experiences||[]).filter(e => e.category !== 'pre_advisory');
  const preExps = (data.experiences||[]).filter(e => e.category === 'pre_advisory');

  function pushBDExps(exps) {
    exps.forEach(exp => {
      if (exp.dates) out.push(bdPDates(exp.dates));
      if (exp.title || exp.company) out.push(pDetail(exp.title||'', exp.company||''));
      (exp.description||[]).filter(Boolean).forEach(d => out.push(pDesc(d)));
      if (exp.tools) out.push(pDesc(exp.tools, true));  // no "Tools:" prefix in BD format
    });
  }

  if (saExps.length)  { out.push(bdH1('Professional experiences with Agilos (Beyond Data)')); pushBDExps(saExps); }
  if (preExps.length) { out.push(bdH1('Professional experiences before Agilos (Beyond Data)')); pushBDExps(preExps); }

  out.push('<w:p/>');
  out.push(finalSectPr);
  return out.join('\n');
}

/**
 * Build the sidebar txbxContent blocks for the BD template.
 *
 * Verified block order in the Group 1494 sidebar (blocks 2-9, doubled for mc:Fallback):
 *   [0] Personal skills TITLE
 *   [1] Personal skills ITEMS  (bullet list, numId=24)
 *   [2] Areas of expertise ITEMS with star IMAGES (numId=15, rId12=filled, rId14=empty)
 *   [3] Areas of expertise TITLE (positioned above [2])
 *   [4] Languages TITLE
 *   [5] Languages ITEMS with star IMAGES (same rIds)
 *   [6] Technical skills ITEMS (bullet list, numId=16)
 *   [7] Technical skills TITLE (positioned above [6])
 *
 * Stars are inline SVG images already embedded in the template:
 *   rId12 = filled star (bitmap fallback), rId13 = filled star (SVG)
 *   rId14 = empty star (bitmap fallback),  rId15 = empty star (SVG)
 */
function buildBDSidebarBlocks(data) {
  const rPrItem  = `<w:rPr><w:rFonts w:ascii="Urbanist" w:hAnsi="Urbanist"/><w:color w:val="FFFFFF" w:themeColor="accent2"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>`;
  const rPrItemP = `<w:rPr><w:rFonts w:ascii="Urbanist" w:hAnsi="Urbanist"/><w:noProof/><w:color w:val="FFFFFF" w:themeColor="accent2"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>`;
  const rPrTitle = `<w:rPr><w:rFonts w:ascii="Urbanist" w:hAnsi="Urbanist"/><w:b/><w:color w:val="FFFFFF" w:themeColor="accent2"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>`;

  // Unique IDs for docPr — use a simple counter to avoid duplicates
  let _uid = 900000;
  const uid = () => ++_uid;

  // One inline star drawing. filled=true → rId12/rId13, filled=false → rId14/rId15
  function starDrawing(filled) {
    const rId  = filled ? 'rId12' : 'rId14';
    const rIds = filled ? 'rId13' : 'rId15';
    const desc = filled ? 'Star with solid fill' : 'Star outline';
    const id1  = uid(), id2 = uid();
    return `<w:r>${rPrItemP}<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="108000" cy="108000"/><wp:effectExtent l="0" t="0" r="6350" b="6350"/><wp:docPr id="${id1}" name="Picture ${id1}" descr="${desc}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id2}" name="Graphic ${id2}" descr="${desc}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"><a:extLst><a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}"><a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/></a:ext><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${rIds}"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="108000" cy="108000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  // Row with label + 2 tabs + 5 star images
  function starRow(label, prof, numId) {
    const n = Math.max(0, Math.min(5, parseInt(prof)||0));
    const tabRun = `<w:r>${rPrItem}<w:tab/></w:r>`;
    const stars  = Array.from({length:5}, (_,i) => starDrawing(i < n)).join('');
    return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>${rPrItem}</w:pPr><w:r>${rPrItem}<w:t>${esc(label)}</w:t></w:r>${tabRun}${tabRun}${stars}</w:p>`;
  }

  function titleBox(label) {
    return `<w:txbxContent><w:p><w:pPr>${rPrTitle}</w:pPr><w:r>${rPrTitle}<w:t>${esc(label)}</w:t></w:r></w:p></w:txbxContent>`;
  }

  function bulletBox(items, numId) {
    const paras = (items||[]).filter(Boolean).map(item =>
      `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr><w:ind w:left="630" w:hanging="270"/><w:suppressOverlap/>${rPrItem}</w:pPr><w:r>${rPrItem}<w:t xml:space="preserve">${esc(item)}</w:t></w:r></w:p>`
    ).join('');
    return `<w:txbxContent>${paras || '<w:p/>'}</w:txbxContent>`;
  }

  function starBox(items, numId) {
    const paras = (items||[]).filter(i => i.label||i.language||i.name).map(item => {
      const label = item.label || item.language || item.name || '';
      const prof  = item.proficiency !== undefined ? item.proficiency : (item.level || 4);
      return starRow(label, prof, numId);
    }).join('');
    return `<w:txbxContent>${paras || '<w:p/>'}</w:txbxContent>`;
  }

  const ps  = data.personalSkills    || [];
  const aoe = (data.areasOfExpertise || []).map(a =>
    typeof a === 'string' ? { label: a, proficiency: 4 } : a
  );
  const ts  = data.technicalSkills   || [];
  const lng = (data.languages || []).map(l =>
    typeof l === 'string' ? { language: l, proficiency: 4 } : l
  );

  // Exact block order (verified from JFD template):
  // 0=PS title, 1=PS items, 2=AoE items(stars), 3=AoE title,
  // 4=Lang title, 5=Lang items(stars), 6=TS items, 7=TS title
  const once = [
    titleBox('Personal skills'),
    bulletBox(ps, '24'),
    starBox(aoe, '15'),
    titleBox('Areas of expertise'),
    titleBox('Languages'),
    starBox(lng, '15'),
    bulletBox(ts, '16'),
    titleBox('Technical skills'),
  ];

  return [...once, ...once];  // doubled for mc:Choice + mc:Fallback
}

async function generateBDCV(data) {
  if (!_bdTemplateCache) {
    const resp = await fetch('word_templates/beyond_data.docx');
    if (!resp.ok) throw new Error('Failed to load Beyond Data template');
    _bdTemplateCache = await resp.arrayBuffer();
  }

  const zip     = new PizZip(_bdTemplateCache.slice(0));
  const docXml  = zip.file('word/document.xml').asText();
  const bodyXml = docXml.slice(docXml.indexOf('<w:body>')+8, docXml.lastIndexOf('</w:body>'));

  // The template body has exactly 2 meaningful top-level paragraphs before content:
  //   Para 0 — logo + name text box (Text Box 2) + decorative images
  //   Para 1 — sidebar (Group 1494: Personal skills / Areas of expertise /
  //             Technical skills / Languages) + bio paragraph text
  // We keep BOTH paragraphs verbatim from the template, only substituting
  // the name/titles in the first txbxContent of Para 0, and the sidebar
  // txbxContent blocks (blocks 2-9) in Para 1.
  const topParas = findTopLevelParas(bodyXml);

  // Template structure (verified):
  //   Para 0 [Normal]   — logo + name text box (2 txbxContent: Choice + Fallback)
  //   Para 1 [Normal]   — empty paragraph (no drawings)
  //   Para 2 [Heading1] — sidebar Group 1494 (16 txbxContent) + bio text body
  //   Para 3..N         — career timeline, certifications, education, experiences

  // Para 0: replace first txbxContent (name box) in both mc:Choice and mc:Fallback
  let para0 = bodyXml.slice(topParas[0].start, topParas[0].end);
  const nameTxbx = buildBDNameBox(data.firstName, data.lastName, data.titles);
  let nameReplaceCount = 0;
  para0 = para0.replace(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/g, () => {
    nameReplaceCount++;
    return nameTxbx;  // replace both Choice and Fallback copies with same content
  });

  // Para 1: keep verbatim (empty paragraph, no changes needed)
  const para1 = bodyXml.slice(topParas[1].start, topParas[1].end);

  // Para 2 [Heading1]: sidebar drawing (16 txbxContent) + bio text runs at the end.
  // Structure: <w:p> [pPr] [drawing run] </mc:AlternateContent></w:r> [text runs] </w:p>
  // Strategy:
  //   1. Replace the 16 sidebar txbxContent blocks with candidate data
  //   2. Trim off the old bio text runs (everything after the drawing run's closing tag)
  //      and replace with the candidate's bio
  let para2raw = bodyXml.slice(topParas[2].start, topParas[2].end);
  const sidebarBlocks = buildBDSidebarBlocks(data);
  let sidebarIdx = 0;
  para2raw = para2raw.replace(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/g, () => {
    const replacement = sidebarBlocks[sidebarIdx] || '<w:txbxContent><w:p/></w:txbxContent>';
    sidebarIdx++;
    return replacement;
  });

  // Split at the end of the drawing run — keep everything up to and including
  // </mc:AlternateContent></w:r>, then add bio runs + "Professional summary" heading text + close </w:p>
  //
  // Template Para 2 structure after the drawing:
  //   <w:r rPr=Urbanist22><w:t>bio text</w:t></w:r>
  //   <w:r rPr=Urbanist22><w:br/></w:r>          ← line break within bio
  //   <w:r rPr=Urbanist22><w:br/></w:r>          ← empty line before heading
  //   <w:r><w:t>Professional summary</w:t></w:r> ← plain run → inherits Heading1 style
  //
  // "Professional summary" MUST be here as the Heading1 paragraph's text.
  const DRAW_END = '</mc:AlternateContent></w:r>';
  const splitAt = para2raw.lastIndexOf(DRAW_END);
  let para2;
  if (splitAt !== -1) {
    const drawingPart = para2raw.slice(0, splitAt + DRAW_END.length);
    const bioRpr = `<w:rPr><w:rFonts w:ascii="Urbanist" w:hAnsi="Urbanist" w:cs="Urbanist"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>`;
    const brRpr  = `<w:rPr><w:rFonts w:ascii="Urbanist" w:eastAsiaTheme="minorEastAsia" w:hAnsi="Urbanist" w:cstheme="minorBidi"/><w:color w:val="auto"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>`;
    const bioRun = data.bio
      ? `<w:r>${bioRpr}<w:t xml:space="preserve">${esc(data.bio)}</w:t></w:r>`
      : '';
    // Two line breaks + "Professional summary" plain run (no rPr → Heading1 style)
    const tailRuns = `<w:r>${brRpr}<w:br/></w:r><w:r>${brRpr}<w:br/></w:r><w:r><w:t>Professional summary</w:t></w:r>`;
    para2 = drawingPart + bioRun + tailRuns + '</w:p>';
  } else {
    para2 = para2raw; // fallback: keep as-is
  }

  const sectPr     = extractFinalSectPr(bodyXml);
  const numIdMatch = bodyXml.match(/<w:pStyle w:val="ListParagraph"[\s\S]{0,500}?<w:numId w:val="([^"]+)"/);
  const listNumId  = numIdMatch ? numIdMatch[1] : '1';

  const newBody = para0 + para1 + para2 + '\n' + buildBDBody(data, sectPr, listNumId);

  const newDocXml = docXml.slice(0, docXml.indexOf('<w:body>')+8)
    + newBody
    + '</w:body>'
    + docXml.slice(docXml.lastIndexOf('</w:body>')+9);

  zip.file('word/document.xml', newDocXml);
  return zip.generate({ type: 'blob', compression: 'DEFLATE' });
}

global.generateCV   = generateCV;
global.generateBDCV = generateBDCV;

})(window);
