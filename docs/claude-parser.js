/**
 * CV parser powered by Claude API (tool_use / structured output).
 * Uses Claude's tool_use to enforce a strict JSON schema — Claude must
 * fill every field, no empty arrays or missing keys.
 * Requires PizZip to be loaded (CDN).
 */
;(function (global) {

/* ── Structured text extraction ───────────────────────────────────────── */
/**
 * Prefixes each paragraph with a semantic tag so Claude understands
 * the document structure without seeing the original formatting.
 *
 *   [SECTION]    Heading1  — section title
 *   [PERIOD]     JobDates  — date range for one experience
 *   [MISSION]    JobDetails — "Role • Client"  (role before •, client after)
 *   [DETAIL]     Whitetext — description bullet or tools line
 *   [ITEM]       List      — skill / education / certification item
 *   (plain line) Normal    — free text, bio, career summary line
 *
 * Sidebar / text-box content (txbxContent) is stripped first.
 */
function extractStructuredText(zip) {
  const raw = zip.file('word/document.xml').asText();

  // ── Step 1: harvest text from every text box ─────────────────────────
  // The candidate name + titles live in the first floating text box and
  // are NOT in the main body flow — we must grab them before stripping.
  const txbxTexts = [];
  const txbxBlockRe = /<w:txbxContent>([\s\S]*?)<\/w:txbxContent>/g;
  let tbm;
  while ((tbm = txbxBlockRe.exec(raw)) !== null) {
    const inner = tbm[1];
    // Collect paragraphs inside this text box
    const pRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
    let pm;
    const boxLines = [];
    while ((pm = pRe.exec(inner)) !== null) {
      let t = '', tm;
      const tRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      while ((tm = tRe.exec(pm[0])) !== null) t += tm[1];
      t = t.replace(/&amp;/g,'&').replace(/&lt;/g,'<')
           .replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
      if (t) boxLines.push(t);
    }
    if (boxLines.length) txbxTexts.push(boxLines.join('\n'));
  }

  // First text box = name + titles header
  const headerSection = txbxTexts.length
    ? `[CANDIDATE_HEADER]\n${txbxTexts[0]}\n`
    : '';

  // ── Step 2: body paragraphs with text boxes stripped ─────────────────
  const xml = raw.replace(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/g, '');

  const lines  = [];
  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  const styleRe = /<w:pStyle w:val="([^"]+)"/;

  let m;
  while ((m = paraRe.exec(xml)) !== null) {
    const p = m[0];

    let text = '';
    let tm;
    const tRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    while ((tm = tRe.exec(p)) !== null) text += tm[1];
    text = text
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#\d+;/g, '')
      .trim();
    if (!text) continue;

    const sm    = p.match(styleRe);
    const style = sm ? sm[1].toLowerCase() : 'normal';

    if      (style.includes('heading1'))  lines.push(`\n[SECTION] ${text}`);
    else if (style.includes('heading2'))  lines.push(`[SUBSECTION] ${text}`);
    else if (style.includes('jobdate'))   lines.push(`[PERIOD] ${text}`);
    else if (style.includes('jobdetail')) lines.push(`[MISSION] ${text}`);
    else if (style.includes('whitetext')) lines.push(`[DETAIL] ${text}`);
    else if (style.includes('list'))      lines.push(`[ITEM] ${text}`);
    else                                  lines.push(text);
  }

  return (headerSection + lines.join('\n'))
    .replace(/\n{3,}/g, '\n\n').trim();
}

/* ── Tool schema ───────────────────────────────────────────────────────── */
const EXTRACT_TOOL = {
  name: 'extract_cv',
  description: 'Extract all information from a CV into a structured format for Select Advisory.',
  input_schema: {
    type: 'object',
    required: [
      'firstName','lastName','birthDate','titles','bio',
      'careerTimeline','knowHow','personalSkills','areasOfExpertise',
      'technicalSkills','languages','education','certifications','experiences'
    ],
    properties: {
      firstName:       { type: 'string' },
      lastName:        { type: 'string' },
      birthDate:       { type: 'string', description: 'e.g. "January 1, 1980" or empty string' },
      titles:          { type: 'array', items: { type: 'string' }, description: 'Up to 3 job titles shown under the name' },
      bio:             { type: 'string', description: 'Full introductory / professional-summary paragraph' },
      careerTimeline:  {
        type: 'array',
        description: 'High-level career summary entries (not detailed missions)',
        items: {
          type: 'object', required: ['dates','role','company'],
          properties: {
            dates:   { type: 'string' },
            role:    { type: 'string' },
            company: { type: 'string' },
          },
        },
      },
      knowHow:          { type: 'string', description: 'Brief domain expertise description or empty string' },
      personalSkills:   { type: 'array', items: { type: 'string' } },
      areasOfExpertise: { type: 'array', items: { type: 'string' } },
      technicalSkills:  { type: 'array', items: { type: 'string' } },
      languages: {
        type: 'array',
        items: {
          type: 'object', required: ['language','proficiency'],
          properties: {
            language:    { type: 'string' },
            proficiency: { type: 'integer', minimum: 1, maximum: 5,
              description: '5=native/fluent 4=advanced 3=intermediate 2=elementary 1=basic' },
          },
        },
      },
      education: {
        type: 'array',
        items: {
          type: 'object', required: ['years','degree','institution'],
          properties: {
            years:       { type: 'string' },
            degree:      { type: 'string' },
            institution: { type: 'string' },
          },
        },
      },
      certifications: {
        type: 'array',
        items: {
          type: 'object', required: ['year','name'],
          properties: {
            year: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
      experiences: {
        type: 'array',
        description: 'All professional experiences, reverse chronological order',
        items: {
          type: 'object',
          required: ['dates','title','company','description','tools','category'],
          properties: {
            dates:   { type: 'string', description: 'Period of the mission e.g. "2022 – 2025"' },
            title:   { type: 'string', description: 'Role / mission title ONLY — do NOT include the client name here' },
            company: {
              type: 'string',
              description: 'Client or company name ONLY. In [MISSION] lines, the part AFTER " • " or " – " is the client.',
            },
            description: {
              type: 'array', items: { type: 'string' },
              description: '[DETAIL] lines that describe the work done (not the tools). Extract every bullet.',
            },
            tools: {
              type: 'string',
              description: '[DETAIL] line(s) that list software/tools used. Often the last [DETAIL] under a mission.',
            },
            category: {
              type: 'string', enum: ['select_advisory','pre_advisory'],
              description: '"pre_advisory" for experience BEFORE Select Advisory / Agilos / Beyond Data',
            },
          },
        },
      },
    },
  },
};

/* ── System prompt ─────────────────────────────────────────────────────── */
const SYSTEM = `\
You are a CV data extraction specialist for Select Advisory, a Belgian BI consulting firm.
The CV text uses structural markers:
  [CANDIDATE_HEADER] = the very first block — contains the candidate's full name and job titles.
                       First line (or words) = full name → split into firstName / lastName.
                       Remaining lines = titles[] (up to 3).
  [SECTION]  = main heading
  [PERIOD]   = date range for one experience block
  [MISSION]  = role and client, separated by " • " or " – "
               → "title" is the part BEFORE the separator
               → "company" is the part AFTER the separator
  [DETAIL]   = a description bullet OR the tools line (usually the last one under a mission, listing software)
  [ITEM]     = list item (skill, education, certification)

Rules:
- Extract firstName and lastName from [CANDIDATE_HEADER]. The last word of the first line is usually the last name.
- Split [MISSION] on " • " or " – ": left part → title, right part → company. Never put both in title.
- Collect ALL [DETAIL] lines for each experience. Descriptive sentences → description[]. Tool lists → tools.
- A tools line is typically a short comma/slash-separated list of software names, not a full sentence.
- Fill every field. Use empty string or [] only when the information is truly absent from the CV.`;

/* ── Public API ────────────────────────────────────────────────────────── */
async function parseWithClaude(file) {
  const apiKey = (window.SA_CONFIG && window.SA_CONFIG.anthropicApiKey) || '';
  if (!apiKey) throw new Error('API key not configured — check config.js or the GitHub Actions secret.');

  const ab  = await file.arrayBuffer();
  const zip = new PizZip(ab);
  const cvText = extractStructuredText(zip);

  console.log('[CV Parser] Structured text sent to Claude:\n', cvText);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'extract_cv' },
      messages: [{ role: 'user', content: `Extract all CV data from the following text:\n\n${cvText}` }],
    }),
  });

  if (!resp.ok) {
    let msg = `Claude API error ${resp.status}`;
    try { const e = await resp.json(); msg = e.error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  const data = await resp.json();
  console.log('[CV Parser] Raw Claude response:', data);

  // With tool_use, the result is in content[].input of the tool_use block
  const toolBlock = (data.content || []).find(c => c.type === 'tool_use' && c.name === 'extract_cv');
  if (!toolBlock) throw new Error('Claude did not return structured CV data. Check the browser console.');
  const parsed = toolBlock.input;
  console.log('[CV Parser] Parsed data:', parsed);

  // ── Normalise ─────────────────────────────────────────────────────────
  if (!Array.isArray(parsed.titles)) parsed.titles = parsed.titles ? [String(parsed.titles)] : [];
  while (parsed.titles.length < 3) parsed.titles.push('');

  parsed.languages = (parsed.languages || []).map(l => ({
    language:    l.language    || '',
    proficiency: Math.max(1, Math.min(5, parseInt(l.proficiency) || 5)),
  }));

  parsed.experiences = (parsed.experiences || []).map(e => {
    let { dates='', title='', company='', description=[], tools='', category='' } = e;

    // Safety: split title on bullet/dash if company still empty
    if (!company && title) {
      const re = /^(.+?)\s*[•\u2022·\u00B7]\s*(.+)$|^(.+?)\s+\u2013\s+(.+)$/;
      const hit = title.match(re);
      if (hit) {
        title   = (hit[1] || hit[3] || '').trim();
        company = (hit[2] || hit[4] || '').trim();
      }
    }

    // Coerce description to array
    if (typeof description === 'string') {
      description = description.split('\n').map(s => s.trim()).filter(Boolean);
    } else if (!Array.isArray(description)) {
      description = [];
    }

    // Move any "Tools: …" line that ended up in description[] into tools
    description = description.filter(line => {
      if (/^tools\s*:/i.test(line)) {
        if (!tools) tools = line.replace(/^tools\s*:\s*/i, '').trim();
        return false;
      }
      return true;
    });

    return {
      dates,
      title,
      company,
      description,
      tools:    String(tools || ''),
      category: category === 'pre_advisory' ? 'pre_advisory' : 'select_advisory',
    };
  });

  ['personalSkills','areasOfExpertise','technicalSkills',
   'education','certifications','careerTimeline'].forEach(k => {
    if (!Array.isArray(parsed[k])) parsed[k] = [];
  });
  ['bio','knowHow','firstName','lastName','birthDate'].forEach(k => {
    if (typeof parsed[k] !== 'string') parsed[k] = '';
  });

  return parsed;
}

global.parseWithClaude = parseWithClaude;

})(window);
