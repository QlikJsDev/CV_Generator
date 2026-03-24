'use strict';
/**
 * Parses a Beyond Data Group .docx and returns structured data
 * compatible with the form schema used by the generator.
 *
 * Layout of Beyond Data template (from analysis):
 *  - Floating header text box  → name (first para) + titles (subsequent)
 *  - Floating sidebar text box → Personal skills / Areas of expertise /
 *                                Technical skills / Languages sections
 *  - Body paragraphs (styles):
 *      Titre1       = Heading 1   (section markers)
 *      JobDates     = date ranges
 *      JobDetails   = role title
 *      Paragraphedeliste = List Paragraph (bullets, certifications, education…)
 *      Normal       = bio, current role/company
 */
const PizZip       = require('pizzip');
const { DOMParser } = require('@xmldom/xmldom');

const W   = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const WP  = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const WPS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape';

/* ── DOM helpers ──────────────────────────────────────────────────────── */
function wAttr(el, name) {
  return el.getAttributeNS(W, name) || el.getAttribute(`w:${name}`) || '';
}
function childrenNS(el, ns, local) {
  const out = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.namespaceURI === ns && n.localName === local) out.push(n);
  }
  return out;
}
function allNS(el, ns, local) {
  const list = el.getElementsByTagNameNS(ns, local);
  return Array.from({ length: list.length }, (_, i) => list[i]);
}
function getText(el) {
  // Exclude w:t elements that are inside wp:anchor or wp:inline (drawings)
  const texts = [];
  const tNodes = allNS(el, W, 't');
  for (let i = 0; i < tNodes.length; i++) {
    let node = tNodes[i].parentNode;
    let skip = false;
    while (node && node !== el) {
      const ln = node.localName;
      if (ln === 'anchor' || ln === 'inline') { skip = true; break; }
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
function hasAnchor(paraEl) {
  // Only filter paragraphs that anchor floating TEXT BOXES (not decorative bullet icons)
  const anchors = allNS(paraEl, WP, 'anchor');
  for (let i = 0; i < anchors.length; i++) {
    if (allNS(anchors[i], WPS, 'txbx').length > 0) return true;
  }
  return false;
}

/* ── Find ALL txbxContent elements at any nesting depth ──────────────── */
function findTextBoxes(root) {
  const result = [];
  function walk(n) {
    if (!n) return;
    if (n.localName === 'txbxContent') result.push(n);
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
  }
  walk(root.documentElement || root);
  return result;
}

/* ── Parse header text box (name + titles) ────────────────────────────── */
function parseHeader(boxes, result) {
  for (const box of boxes) {
    const paras = allNS(box, W, 'p');
    if (!paras.length) continue;

    // Strategy 1: first para has runs with a large font size (name) vs smaller (title)
    // separated by a <w:br> line break (JFD format).
    const firstPara = paras[0];
    const runs  = allNS(firstPara, W, 'r');
    const brs   = allNS(firstPara, W, 'br');

    if (runs.length >= 2 && brs.length >= 1) {
      // Find the run with the largest font — that is the name
      let nameParts = [], titleParts = [];
      let pastBreak = false;
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

    // Strategy 2: ALL-CAPS last name (MGE format): "Maxime GERARD"
    const first = getText(paras[0]).trim();
    const words = first.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord === lastWord.toUpperCase() && lastWord.length >= 2 && /[A-Z]/.test(lastWord)) {
      result.lastName  = lastWord[0] + lastWord.slice(1).toLowerCase();
      result.firstName = words.slice(0, -1).join(' ');
      result.titles    = paras.slice(1).map(p => getText(p).trim()).filter(Boolean);
      return;
    }

    // Strategy 3: fallback — take the whole first para as name, rest as titles
    if (first.length > 3 && first.length < 60) {
      const parts = first.split(/\s+/);
      result.firstName = parts.slice(0, -1).join(' ');
      result.lastName  = parts[parts.length - 1] || '';
      result.titles    = paras.slice(1).map(p => getText(p).trim()).filter(Boolean);
      return;
    }
  }
}

/* ── Parse sidebar from ALL text boxes (handles groups + simple shapes) ── */
function parseSidebar(boxes, result) {
  const SECTION_HEADERS = new Set([
    'personal skills', 'areas of expertise', 'technical skills', 'languages',
    'personal skill', 'area of expertise', 'technical expertise',
  ]);

  for (const box of boxes) {
    const paras = allNS(box, W, 'p');
    if (!paras.length) continue;

    const items = paras.map(p => getText(p).trim()).filter(Boolean);
    if (!items.length) continue;

    const joined = items.join(' ').toLowerCase();

    // Skip pure section headers
    if (items.length === 1 && SECTION_HEADERS.has(items[0].toLowerCase())) continue;

    // Skip the header box (contains name + titles — identified by long text in first para)
    if (paras.length <= 2 && items[0].length > 20 &&
        (items[0].includes('–') || items[0].split(' ').length >= 2 &&
         !/^(personal|area|technical|language)/i.test(items[0])) &&
        result.firstName && items[0].includes(result.firstName)) continue;

    // Classify content by keywords
    const isLang = /\b(english|french|dutch|german|spanish|italian|portuguese|mandarin|arabic)\b/i.test(joined);
    const isTech = /\b(office|excel|sql|qlik|java|python|azure|power bi|sap|sharepoint|jira|confluence|snowflake)\b/i.test(joined);
    const isArea = /\b(finance|healthcare|automotive|industry|retail|public|logistics|telecom)\b/i.test(joined);
    const isPersonal = !isLang && !isTech && !isArea && items.length >= 2 && items[0].length < 40;

    if      (isLang && !result.languages.length)        result.languages        = parseLanguages(items);
    else if (isTech && !result.technicalSkills.length)  result.technicalSkills  = items;
    else if (isArea && !result.areasOfExpertise.length) result.areasOfExpertise = items;
    else if (isPersonal && !result.personalSkills.length) result.personalSkills = items;
  }

  // MGE-style: single text box with section headers as paragraphs + bullets
  for (const box of boxes) {
    const paras = allNS(box, W, 'p');
    if (paras.length < 5) continue;
    const fullText = getText(box);
    if (!fullText.includes('Personal skills') && !fullText.includes('Languages')) continue;

    const sections = {};
    let currentSection = null;
    for (const p of paras) {
      const styleVal = getPStyle(p).toLowerCase();
      const t        = getText(p).trim();
      if (!t) continue;
      const isBullet = styleVal.includes('paragraphe') || styleVal.includes('list');
      if (isBullet && currentSection !== null) {
        sections[currentSection].push(t);
      } else if (!isBullet) {
        currentSection = t;
        sections[currentSection] = [];
      }
    }
    for (const [sTitle, sitems] of Object.entries(sections)) {
      const sl = sTitle.toLowerCase();
      const joined = sitems.join(', ');
      if (sl.includes('personal skill') && !result.personalSkills.length)
        result.personalSkills = joined.split(',').map(s => s.trim()).filter(Boolean);
      else if (sl.includes('expertise') && !result.areasOfExpertise.length)
        result.areasOfExpertise = joined.split(',').map(s => s.trim()).filter(Boolean);
      else if (sl.includes('technical') && !result.technicalSkills.length)
        result.technicalSkills = sitems;
      else if (sl.includes('language') && !result.languages.length)
        result.languages = parseLanguages(sitems);
    }
  }
}

/* ── Parse skills/languages from body paragraphs (JFD-style templates) ── */
function parseBodySkills(bodyEl, result) {
  const paras = childrenNS(bodyEl, W, 'p').filter(p => !hasAnchor(p));
  const sections = {};
  let current = null;

  for (const para of paras) {
    const style = getPStyle(para).toLowerCase();
    const text  = getText(para).trim();
    const isH1  = style.includes('heading1') || style.includes('titre1') || style === 'titre 1';
    // Some templates use Normal paragraphs as section labels in the sidebar area
    const isLabel = style === '' || style === 'normal';
    const isBullet = style.includes('list') || style.includes('paragraphe');

    if (isH1 || (isLabel && text && text.length < 40 && !isBullet &&
        /^(Personal skills|Areas of expertise|Technical|Languages|Certifi|Education|Professional)/i.test(text))) {
      current = text;
      sections[current] = [];
    } else if (current !== null && isBullet && text) {
      sections[current].push(text);
    }
  }

  for (const [section, items] of Object.entries(sections)) {
    const sl = section.toLowerCase();
    if (sl.includes('personal skill') && !result.personalSkills.length) {
      result.personalSkills = items;
    } else if (sl.includes('expertise') && !result.areasOfExpertise.length) {
      result.areasOfExpertise = items;
    } else if (sl.includes('technical') && !result.technicalSkills.length) {
      result.technicalSkills = items;
    } else if (sl.includes('language') && !result.languages.length) {
      result.languages = parseLanguages(items);
    }
  }
}

function parseLanguages(items) {
  const out = [];
  for (const item of items) {
    if (item.includes(':')) {
      const [lang, prof] = item.split(':', 2);
      out.push({ language: lang.trim(), proficiency: profToStars(prof.trim()) });
    } else if (item.includes(',')) {
      for (const l of item.split(',')) {
        const t = l.trim();
        if (t) out.push({ language: t, proficiency: 5 });
      }
    } else if (item.trim()) {
      out.push({ language: item.trim(), proficiency: 5 });
    }
  }
  return out;
}

function profToStars(text) {
  const tl = text.toLowerCase();
  if (tl.includes('native') || tl.includes('mother'))  return 5;
  if (tl.includes('fluent') || tl.includes('proficient')) return 4;
  if (tl.includes('advanced'))   return 4;
  if (tl.includes('upper'))      return 4;
  if (tl.includes('intermediate')) return 3;
  if (tl.includes('elementary')) return 2;
  if (tl.includes('basic') || tl.includes('beginner')) return 1;
  return 4; // default
}

/* ── Parse body paragraphs ────────────────────────────────────────────── */
function parseBody(bodyEl, result) {
  const paras = childrenNS(bodyEl, W, 'p').filter(p => !hasAnchor(p));
  const tables = childrenNS(bodyEl, W, 'tbl');

  // Group paragraphs by section (Heading 1)
  const sections = {};
  let currentH = null;
  for (const para of paras) {
    const style = getPStyle(para).toLowerCase();
    const text  = getText(para).trim();
    const isH1  = style.includes('heading1') || style.includes('titre1') ||
                  style === 'titre 1';
    if (isH1) {
      currentH = text;
      sections[currentH] = [];
    } else if (currentH !== null) {
      sections[currentH].push(para);
    }
  }

  for (const [heading, entries] of Object.entries(sections)) {
    const hl = heading.toLowerCase();
    if (hl.includes('summary') || hl.includes('sommaire'))       parseSummary(entries, result);
    else if (hl.includes('certif') || hl.includes('training'))   parseCertifications(entries, result);
    else if (hl.includes('education') && !hl.includes('certif')) parseEducation(entries, result);
    else if (hl.includes('experience') || hl.includes('expérience')) parseExperiences(entries, result);
  }
}

function parseSummary(paras, result) {
  for (const p of paras) {
    const style = getPStyle(p).toLowerCase();
    const text  = getText(p).trim();
    if (!text) continue;
    if (style.includes('jobdate') || style === 'jobdates') {
      result.overallDates = text;
    } else if (style === '' || style.includes('normal')) {
      if (text.length > 80 && !result.bio)    result.bio = text;
      else if (text.toLowerCase().startsWith('at ')) result.currentCompany = text.slice(3).trim();
      else if (!result.bio && text.length > 20) result.bio = text;
      else result.currentRole = text;
    }
  }

  if (result.overallDates || result.currentRole) {
    result.careerTimeline = [{
      dates:   result.overallDates || '',
      role:    result.currentRole  || '',
      company: result.currentCompany || '',
    }];
  }
}

function parseCertifications(paras, result) {
  const certs = [];
  for (const p of paras) {
    const text = getText(p).trim();
    if (!text) continue;
    const m = text.match(/^(\d{4})\s*[:\–\-]\s*(.+)$/);
    if (m) certs.push({ year: m[1], name: m[2].trim() });
    else   certs.push({ year: '', name: text });
  }
  result.certifications = certs;
}

function parseEducation(paras, result) {
  const edu = [];
  for (const p of paras) {
    const text = getText(p).trim();
    if (!text) continue;
    const lines = text.split('\n');
    const m = lines[0].match(/^(.{4,15})\s*[:\–\-]\s*(.+)$/);
    if (m) {
      edu.push({ years: m[1].trim(), degree: m[2].trim(), institution: (lines[1] || '').trim() });
    } else {
      edu.push({ years: '', degree: text, institution: '' });
    }
  }
  result.education = edu;
}

function parseExperiences(paras, result) {
  result.experiences = result.experiences || [];
  let current = null;

  for (const p of paras) {
    const style = getPStyle(p).toLowerCase();
    const text  = getText(p).trim();

    if (style.includes('jobdate') || style === 'jobdates') {
      if (current) result.experiences.push(current);
      current = { dates: text, title: '', company: '', description: [], tools: '', category: 'select_advisory' };
    } else if (style.includes('jobdetail') || style === 'jobdetails') {
      if (!current) current = { dates: '', title: '', company: '', description: [], tools: '', category: 'select_advisory' };
      if (text.includes(' \u2013 ') || text.includes(' - ')) {
        const sep = text.includes(' \u2013 ') ? ' \u2013 ' : ' - ';
        const [role, ...rest] = text.split(sep);
        current.title   = role.trim();
        current.company = rest.join(sep).trim();
      } else if (/ for /i.test(text)) {
        const idx = text.toLowerCase().indexOf(' for ');
        current.title   = text.slice(0, idx).trim();
        current.company = text.slice(idx + 5).trim();
      } else {
        current.title = text;
      }
    } else if (style.includes('paragraphe') || style.includes('list') || style.includes('normal')) {
      if (!current) continue;
      if (/^tools\s*:/i.test(text) || /^outils\s*:/i.test(text)) {
        current.tools = text.replace(/^(?:tools|outils)\s*:\s*/i, '').trim();
      } else if (text) {
        current.description.push(text);
      }
    }
  }
  if (current) result.experiences.push(current);
}

/* ── Public entry point ───────────────────────────────────────────────── */
async function parseCV(buffer) {
  const zip    = new PizZip(buffer);
  const docXml = zip.file('word/document.xml').asText();

  const domParser = new DOMParser({ errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} } });
  const xmlDoc    = domParser.parseFromString(docXml, 'text/xml');
  const bodyEl    = allNS(xmlDoc, W, 'body')[0];

  const result = {
    firstName: '', lastName: '', birthDate: '', titles: [],
    bio: '', overallDates: '', currentRole: '', currentCompany: '',
    careerTimeline: [], knowHow: '',
    personalSkills: [], areasOfExpertise: [], technicalSkills: [],
    languages: [], education: [], certifications: [], experiences: [],
  };

  const boxes = findTextBoxes(xmlDoc);
  parseHeader(boxes, result);
  parseSidebar(boxes, result);
  parseBody(bodyEl, result);
  parseBodySkills(bodyEl, result); // fallback for templates with skills in body

  return result;
}

module.exports = { parseCV };
