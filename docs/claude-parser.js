/**
 * CV parser powered by Claude API.
 * Extracts structured text (with paragraph-style markers) from a .docx file
 * and asks Claude to return a structured JSON object.
 * Requires PizZip to be loaded (CDN).
 */
;(function (global) {

/* ── Structured text extraction ───────────────────────────────────────── */
/**
 * Extracts paragraph text from the docx XML and prefixes each line with a
 * style tag so Claude can understand the document structure even without
 * seeing the original formatting.
 *
 * Known Select Advisory / Beyond Data paragraph styles:
 *   JobDates    → [PERIOD]   e.g. "2016 – Today"
 *   JobDetails  → [MISSION]  e.g. "Qlik Sense Dev • BMW BeLux"  (role • client)
 *   Whitetext   → [DETAIL]   description bullets or "Tools: …"
 *   Heading1    → [SECTION]
 *   Heading2    → [SUBSECTION]
 *   ListParagraph → [ITEM]
 *   Normal      → (plain line)
 *
 * Sidebar / floating text-box content is excluded (txbxContent stripped).
 */
function extractStructuredText(zip) {
  const raw = zip.file('word/document.xml').asText();

  // Remove sidebar/floating text-box content so it doesn't pollute body text
  const xml = raw.replace(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/g, '');

  const lines = [];

  // Iterate over every paragraph in document order
  // Note: we use a simple regex; nested <w:p> inside VML are already removed above
  const paraRe  = /<w:p[ >][\s\S]*?<\/w:p>/g;
  const styleRe = /<w:pStyle w:val="([^"]+)"/;
  const textRe  = () => /<w:t[^>]*>([^<]*)<\/w:t>/g;

  let m;
  while ((m = paraRe.exec(xml)) !== null) {
    const p = m[0];

    // Collect all text runs
    let text = '';
    let tm;
    const tr = textRe();
    while ((tm = tr.exec(p)) !== null) text += tm[1];
    text = text
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#\d+;/g, '')
      .trim();
    if (!text) continue;

    // Determine style
    const sm = p.match(styleRe);
    const style = sm ? sm[1].toLowerCase() : 'normal';

    if      (style.includes('heading1'))   lines.push(`\n[SECTION] ${text}`);
    else if (style.includes('heading2'))   lines.push(`[SUBSECTION] ${text}`);
    else if (style.includes('jobdate'))    lines.push(`[PERIOD] ${text}`);
    else if (style.includes('jobdetail'))  lines.push(`[MISSION] ${text}`);
    else if (style.includes('whitetext'))  lines.push(`[DETAIL] ${text}`);
    else if (style.includes('list'))       lines.push(`[ITEM] ${text}`);
    else                                   lines.push(text);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ── Prompt ────────────────────────────────────────────────────────────── */
const SYSTEM = `\
You are a CV data extraction specialist for Select Advisory, a Belgian BI consulting firm.
You receive CV text that may contain structural markers:
  [SECTION]    → main heading (e.g. "Professional experience")
  [SUBSECTION] → sub-heading
  [PERIOD]     → date range for an experience (e.g. "2016 – Today")
  [MISSION]    → role and client, often formatted as "Role Title • Client Name"
                 → split these: everything before " • " or " – " is the role/title,
                   everything after is the client/company name.
  [DETAIL]     → a description bullet point OR a tools line starting with "Tools:"
  [ITEM]       → a list item (skill, education entry, certification, etc.)

Extract ALL information and return a single valid JSON object.
If a field is absent, return an empty string or empty array.`;

const USER_PREFIX = `\
Extract ALL information from this CV and return a JSON object with EXACTLY these fields:

{
  "firstName": "string",
  "lastName": "string",
  "birthDate": "string — e.g. 'January 1, 1980', or ''",
  "titles": ["up to 3 job-title strings shown under the name"],
  "bio": "string — introductory / professional-summary paragraph",
  "careerTimeline": [
    { "dates": "e.g. '2019 – today'", "role": "job title", "company": "employer" }
  ],
  "knowHow": "string — brief domain-expertise description, or ''",
  "personalSkills": ["soft-skill strings"],
  "areasOfExpertise": ["industry / domain strings"],
  "technicalSkills": ["tool or technology strings"],
  "languages": [{ "language": "name", "proficiency": 5 }],
  "education": [
    { "years": "e.g. '2004-2008'", "degree": "degree name", "institution": "school" }
  ],
  "certifications": [{ "year": "2024", "name": "certification name" }],
  "experiences": [
    {
      "dates":       "from [PERIOD] line",
      "title":       "role part — before ' • ' or ' – ' in [MISSION] line",
      "company":     "client/company part — after ' • ' or ' – ' in [MISSION] line",
      "description": ["each [DETAIL] line that is NOT a tools line"],
      "tools":       "content of [DETAIL] line that starts with 'Tools:' (strip the prefix)",
      "category":    "select_advisory or pre_advisory"
    }
  ]
}

Rules:
- [MISSION] lines often use ' • ' or ' – ' to separate role from client; split accordingly.
- [DETAIL] lines that start with 'Tools:' go into "tools"; all others are "description" bullets.
- "category" = "pre_advisory" for experience BEFORE joining Select Advisory / Agilos / Beyond Data.
- Language proficiency: 5=native/fluent, 4=advanced, 3=intermediate, 2=elementary, 1=basic.
- Experiences in reverse chronological order (most recent first).
- careerTimeline = high-level career summary (not detailed missions).
- Return ONLY the JSON object — no markdown fences, no explanation.

CV TEXT:
`;

/* ── Public API ────────────────────────────────────────────────────────── */
async function parseWithClaude(file, apiKey) {
  const ab  = await file.arrayBuffer();
  const zip = new PizZip(ab);
  const cvText = extractStructuredText(zip);

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
      messages: [{ role: 'user', content: USER_PREFIX + cvText }],
    }),
  });

  if (!resp.ok) {
    let msg = `Claude API error ${resp.status}`;
    try { const e = await resp.json(); msg = e.error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  const data = await resp.json();
  let text = (data.content[0]?.text || '').trim();

  // Strip markdown code fences if Claude added them anyway
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) text = fenced[1].trim();

  const parsed = JSON.parse(text);

  // ── Normalise ─────────────────────────────────────────────────────────
  if (!Array.isArray(parsed.titles)) parsed.titles = parsed.titles ? [String(parsed.titles)] : [];
  while (parsed.titles.length < 3) parsed.titles.push('');

  parsed.languages = (parsed.languages || []).map(l => ({
    language: l.language || '',
    proficiency: Math.max(1, Math.min(5, parseInt(l.proficiency) || 5)),
  }));

  parsed.experiences = (parsed.experiences || []).map(e => ({
    dates:       e.dates       || '',
    title:       e.title       || '',
    company:     e.company     || '',
    description: Array.isArray(e.description) ? e.description : [],
    tools:       e.tools       || '',
    category:    e.category === 'pre_advisory' ? 'pre_advisory' : 'select_advisory',
  }));

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
