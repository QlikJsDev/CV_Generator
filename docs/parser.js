/**
 * Browser-compatible Beyond Data Group .docx parser.
 * Requires PizZip to be loaded (CDN).
 * Uses the browser's native DOMParser.
 */
;(function (global) {

const W   = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const WP  = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const WPS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape';

function allNS(el, ns, local) {
  const list = el.getElementsByTagNameNS(ns, local);
  return Array.from({ length: list.length }, (_, i) => list[i]);
}
function childrenNS(el, ns, local) {
  const out = [];
  for (let n = el.firstChild; n; n = n.nextSibling)
    if (n.namespaceURI === ns && n.localName === local) out.push(n);
  return out;
}
function wAttr(el, name) {
  return el.getAttributeNS(W, name) || el.getAttribute('w:' + name) || '';
}
function getText(el) {
  const texts = [];
  const tNodes = allNS(el, W, 't');
  for (let i = 0; i < tNodes.length; i++) {
    let node = tNodes[i].parentNode;
    let skip = false;
    while (node && node !== el) {
      if (node.localName === 'anchor' || node.localName === 'inline' || node.localName === 'txbxContent') { skip = true; break; }
      node = node.parentNode;
    }
    if (!skip) texts.push(tNodes[i].textContent || '');
  }
  return texts.join('');
}
function getPStyle(paraEl) {
  const ps = allNS(paraEl, W, 'pStyle')[0];
  return ps ? wAttr(ps, 'val') : '';
}
function hasFloatingTxbx(paraEl) {
  const anchors = allNS(paraEl, WP, 'anchor');
  for (let i = 0; i < anchors.length; i++) {
    if (anchors[i].getElementsByTagName('wps:txbx').length > 0) return true;
    // Walk manually in case namespace lookup fails
    let found = false;
    (function walk(n) {
      if (!n) return;
      if (n.localName === 'txbx') { found = true; return; }
      for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
    })(anchors[i]);
    if (found) return true;
  }
  return false;
}

// Find all txbxContent at any depth
function findAllTxbxContents(root) {
  const result = [];
  (function walk(n) {
    if (!n) return;
    if (n.localName === 'txbxContent') result.push(n);
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
  })(root);
  return result;
}

/* ── Header parsing ───────────────────────────────────────────────────── */
function parseHeader(boxes, result) {
  for (const box of boxes) {
    const paras = allNS(box, W, 'p');
    if (!paras.length) continue;
    const firstPara = paras[0];
    const runs = allNS(firstPara, W, 'r');
    const brs  = allNS(firstPara, W, 'br');

    // JFD format: name + BR + title in same paragraph
    if (runs.length >= 2 && brs.length >= 1) {
      let nameParts = [], titleParts = [], pastBreak = false;
      for (const r of runs) {
        const hasBr = allNS(r, W, 'br').length > 0;
        const text  = getText(r).trim();
        if (hasBr) { pastBreak = true; continue; }
        if (!pastBreak) nameParts.push(text);
        else if (text)  titleParts.push(text);
      }
      const fullName = nameParts.join(' ').trim();
      if (fullName) {
        const words = fullName.split(/\s+/);
        result.lastName  = words.pop() || '';
        result.firstName = words.join(' ');
        const moreTitles = paras.slice(1).map(p => getText(p).trim()).filter(Boolean);
        result.titles = [...titleParts, ...moreTitles];
        return;
      }
    }

    // MGE format: last word ALL-CAPS = last name
    const first = getText(paras[0]).trim();
    const words = first.split(/\s+/);
    const last  = words[words.length - 1];
    if (last === last.toUpperCase() && last.length >= 2 && /[A-Z]/.test(last)) {
      result.lastName  = last[0] + last.slice(1).toLowerCase();
      result.firstName = words.slice(0, -1).join(' ');
      result.titles    = paras.slice(1).map(p => getText(p).trim()).filter(Boolean);
      return;
    }

    // Fallback
    if (first.length > 3 && first.length < 60) {
      const parts = first.split(/\s+/);
      result.firstName = parts.slice(0, -1).join(' ');
      result.lastName  = parts[parts.length - 1] || '';
      result.titles    = paras.slice(1).map(p => getText(p).trim()).filter(Boolean);
      return;
    }
  }
}

/* ── Sidebar / skills parsing ─────────────────────────────────────────── */
const SECTION_HEADERS = new Set([
  'personal skills','areas of expertise','technical skills','languages',
  'personal skill','area of expertise','technical expertise',
]);

function parseSidebar(boxes, result) {
  for (const box of boxes) {
    const paras = allNS(box, W, 'p');
    if (!paras.length) continue;
    const items  = paras.map(p => getText(p).trim()).filter(Boolean);
    if (!items.length) continue;
    const joined = items.join(' ').toLowerCase();
    if (items.length === 1 && SECTION_HEADERS.has(items[0].toLowerCase())) continue;
    if (result.firstName && items[0].includes(result.firstName)) continue;

    const isLang     = /\b(english|french|dutch|german|spanish|italian)\b/i.test(joined);
    const isTech     = /\b(office|excel|sql|qlik|java|python|azure|power bi|sap|jira|snowflake)\b/i.test(joined);
    const isArea     = /\b(finance|healthcare|automotive|industry|retail|public|logistics)\b/i.test(joined);
    const isPersonal = !isLang && !isTech && !isArea && items.length >= 2 && items[0].length < 40;

    if      (isLang     && !result.languages.length)        result.languages        = parseLangs(items);
    else if (isTech     && !result.technicalSkills.length)  result.technicalSkills  = items;
    else if (isArea     && !result.areasOfExpertise.length) result.areasOfExpertise = items;
    else if (isPersonal && !result.personalSkills.length)   result.personalSkills   = items;
  }

  // MGE-style single large text box
  for (const box of boxes) {
    const paras = allNS(box, W, 'p');
    if (paras.length < 5) continue;
    const full = getText(box);
    if (!full.includes('Personal skills') && !full.includes('Languages')) continue;
    const sections = {};
    let cur = null;
    for (const p of paras) {
      const sty  = getPStyle(p).toLowerCase();
      const t    = getText(p).trim();
      if (!t) continue;
      const bull = sty.includes('paragraphe') || sty.includes('list');
      if (bull && cur !== null) { sections[cur].push(t); }
      else if (!bull)           { cur = t; sections[cur] = []; }
    }
    for (const [sec, its] of Object.entries(sections)) {
      const sl = sec.toLowerCase();
      if (sl.includes('personal skill') && !result.personalSkills.length)
        result.personalSkills = its.join(',').split(',').map(s=>s.trim()).filter(Boolean);
      else if (sl.includes('expertise') && !result.areasOfExpertise.length)
        result.areasOfExpertise = its.join(',').split(',').map(s=>s.trim()).filter(Boolean);
      else if (sl.includes('technical') && !result.technicalSkills.length)
        result.technicalSkills = its;
      else if (sl.includes('language') && !result.languages.length)
        result.languages = parseLangs(its);
    }
  }
}

function parseLangs(items) {
  const out = [];
  for (const item of items) {
    if (item.includes(':')) {
      const [l, p] = item.split(':', 2);
      out.push({ language: l.trim(), proficiency: profToStars(p.trim()) });
    } else if (item.includes(',')) {
      item.split(',').forEach(l => { const t = l.trim(); if (t) out.push({ language: t, proficiency: 5 }); });
    } else if (item.trim()) {
      out.push({ language: item.trim(), proficiency: 5 });
    }
  }
  return out;
}
function profToStars(t) {
  const tl = t.toLowerCase();
  if (/native|mother/.test(tl))    return 5;
  if (/fluent|proficient/.test(tl))return 4;
  if (/advanced|upper/.test(tl))   return 4;
  if (/intermediate/.test(tl))     return 3;
  if (/elementary/.test(tl))       return 2;
  if (/basic|beginner/.test(tl))   return 1;
  return 4;
}

/* ── Body parsing ─────────────────────────────────────────────────────── */
function parseBody(bodyEl, result) {
  const paras = childrenNS(bodyEl, W, 'p').filter(p => !hasFloatingTxbx(p));

  const sections = {};
  let curH = null;
  for (const para of paras) {
    const style = getPStyle(para).toLowerCase();
    const text  = getText(para).trim();
    const isH1  = style.includes('heading1') || style.includes('titre1') || style === 'titre 1';
    if (isH1) { curH = text; sections[curH] = []; }
    else if (curH !== null) { sections[curH].push(para); }
  }

  for (const [heading, entries] of Object.entries(sections)) {
    const hl = heading.toLowerCase();
    if (hl.includes('summary') || hl.includes('sommaire'))       parseSummary(entries, result);
    else if (hl.includes('certif') || hl.includes('training'))   parseCertifications(entries, result);
    else if (hl.includes('education') && !hl.includes('certif')) parseEducation(entries, result);
    else if (hl.includes('experience') || hl.includes('expérience') || hl.includes('experiences')) parseExperiences(entries, result);
    // For any section: also scan for bio and career timeline (BD CV format)
    parseBioAndTimeline(entries, result);
  }
}

function parseBodySkills(bodyEl, result) {
  const paras = childrenNS(bodyEl, W, 'p').filter(p => !hasFloatingTxbx(p));
  const sections = {}; let cur = null;
  for (const para of paras) {
    const style = getPStyle(para).toLowerCase();
    const text  = getText(para).trim();
    const isH1  = style.includes('heading1');
    const isLbl = style === '' || style === 'normal';
    const isBul = style.includes('list') || style.includes('paragraphe');
    if (isH1 || (isLbl && text && text.length < 40 && !isBul &&
      /^(Personal skills|Areas of expertise|Technical|Languages)/i.test(text))) {
      cur = text; sections[cur] = [];
    } else if (cur !== null && isBul && text) {
      sections[cur].push(text);
    }
  }
  for (const [sec, its] of Object.entries(sections)) {
    const sl = sec.toLowerCase();
    if (sl.includes('personal skill') && !result.personalSkills.length)  result.personalSkills = its;
    else if (sl.includes('expertise') && !result.areasOfExpertise.length) result.areasOfExpertise = its;
    else if (sl.includes('technical') && !result.technicalSkills.length)  result.technicalSkills = its;
    else if (sl.includes('language')  && !result.languages.length)        result.languages = parseLangs(its);
  }
}

function parseSummary(paras, result) {
  for (const p of paras) {
    const sty = getPStyle(p).toLowerCase();
    const txt = getText(p).trim();
    if (!txt) continue;
    if (sty.includes('jobdate')) { result.overallDates = txt; }
    else if (sty === '' || sty.includes('normal')) {
      if (txt.length > 80 && !result.bio) result.bio = txt;
      else if (txt.toLowerCase().startsWith('at ')) result.currentCompany = txt.slice(3).trim();
      else result.currentRole = result.currentRole || txt;
    }
  }
  if (result.overallDates || result.currentRole) {
    result.careerTimeline = [{
      dates: result.overallDates || '', role: result.currentRole || '', company: result.currentCompany || '',
    }];
  }
}
function parseCertifications(paras, result) {
  result.certifications = paras.map(p => {
    const t = getText(p).trim();
    if (!t) return null;
    const m = t.match(/^(\d{4})\s*[:\u2013\-]\s*(.+)$/);
    return m ? { year: m[1], name: m[2].trim() } : { year: '', name: t };
  }).filter(Boolean);
}
function parseEducation(paras, result) {
  result.education = paras.map(p => {
    const t = getText(p).trim();
    if (!t) return null;
    const lines = t.split('\n');
    const m = lines[0].match(/^(.{4,15})\s*[:\u2013\-]\s*(.+)$/);
    return m ? { years: m[1].trim(), degree: m[2].trim(), institution: (lines[1]||'').trim() }
             : { years: '', degree: t, institution: '' };
  }).filter(Boolean);
}
function parseBioAndTimeline(paras, result) {
  // Matches: "2014 – Present: Role..." or "2008-2013: Role at Company"
  const dateRe = /^(\d{4}\s*[\u2013\-]\s*(?:\d{4}|[Tt]oday|[Pp]resent|[Nn]ow))\s*[:]\s*(.+)/;
  for (const p of paras) {
    const sty = getPStyle(p).toLowerCase();
    if (sty && sty !== 'normal') continue;
    const txt = getText(p).trim();
    if (!txt) continue;

    const dm = txt.match(dateRe);
    if (dm) {
      const dates = dm[1].trim().replace(/\s+/g, ' ');
      const rest  = dm[2].trim();
      let role = rest, company = '';
      // Handle "at" possibly merged without space (e.g. "Leadat Agilos")
      const atMatch = rest.match(/^(.*?)\s*\bat\s+(.+)$/i)
                   || rest.match(/^(.*\w)at\s+(.+)$/);  // merged "Leadat Agilos"
      if (atMatch) {
        role = atMatch[1].trim();
        company = atMatch[2].trim();
      } else {
        const dashSep = rest.includes(' \u2013 ') ? ' \u2013 ' : rest.includes(' - ') ? ' - ' : null;
        if (dashSep) {
          const parts = rest.split(dashSep);
          company = parts[parts.length - 1].trim();
          role = parts.slice(0, -1).join(dashSep).trim();
        }
      }
      if (!result.careerTimeline.find(e => e.dates === dates))
        result.careerTimeline.push({ dates, role, company });
      continue;
    }

    // Long Normal paragraph → bio
    if (txt.length > 100 && !result.bio) result.bio = txt;
  }
}

function parseExperiences(paras, result) {
  result.experiences = result.experiences || [];
  let cur = null;
  for (const p of paras) {
    const sty = getPStyle(p).toLowerCase();
    const txt = getText(p).trim();
    if (sty.includes('jobdate')) {
      if (cur) result.experiences.push(cur);
      cur = { dates: txt, title: '', company: '', description: [], tools: '', category: 'select_advisory' };
    } else if (sty.includes('jobdetail')) {
      if (!cur) cur = { dates:'', title:'', company:'', description:[], tools:'', category:'select_advisory' };
      const sep = txt.includes(' \u2013 ') ? ' \u2013 ' : txt.includes(' - ') ? ' - ' : null;
      if (sep) { const [r,...rest]=txt.split(sep); cur.title=r.trim(); cur.company=rest.join(sep).trim(); }
      else if (/ for /i.test(txt)) { const i=txt.toLowerCase().indexOf(' for '); cur.title=txt.slice(0,i).trim(); cur.company=txt.slice(i+5).trim(); }
      else cur.title = txt;
    } else if ((sty.includes('list')||sty.includes('paragraphe')||sty.includes('normal')) && txt) {
      if (!cur) continue;
      if (/^tools\s*:/i.test(txt)) cur.tools = txt.replace(/^tools\s*:\s*/i,'').trim();
      else cur.description.push(txt);
    }
  }
  if (cur) result.experiences.push(cur);
}

/* ── Public API ───────────────────────────────────────────────────────── */
async function parseCV(file) {
  const ab  = await file.arrayBuffer();
  const zip = new PizZip(ab);
  const xml = zip.file('word/document.xml').asText();

  const xmlDoc = new DOMParser().parseFromString(xml, 'text/xml');
  const bodyEl = allNS(xmlDoc, W, 'body')[0];

  const result = {
    firstName:'', lastName:'', birthDate:'', titles:[],
    bio:'', overallDates:'', currentRole:'', currentCompany:'',
    careerTimeline:[], knowHow:'',
    personalSkills:[], areasOfExpertise:[], technicalSkills:[],
    languages:[], education:[], certifications:[], experiences:[],
  };

  const boxes = findAllTxbxContents(xmlDoc.documentElement);
  parseHeader(boxes, result);
  parseSidebar(boxes, result);
  parseBody(bodyEl, result);
  parseBodySkills(bodyEl, result);

  return result;
}

global.parseCV = parseCV;

})(window);
