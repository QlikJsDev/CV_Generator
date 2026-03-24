/**
 * CV parser powered by Claude API.
 * Extracts text from a .docx file and asks Claude to return structured JSON.
 * Requires PizZip to be loaded (CDN).
 */
;(function (global) {

/* ── Text extraction from .docx ───────────────────────────────────────── */
function extractTextFromDocx(zip) {
  const xml = zip.file('word/document.xml').asText();
  return xml
    .replace(/<w:br[^/]*(\/)?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#\d+;/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ── Prompt ────────────────────────────────────────────────────────────── */
const SYSTEM = `You are a CV data extraction specialist for Select Advisory, a Belgian BI consulting firm.
Extract information from any CV format (Beyond Data, external CVs, etc.) and return a single valid JSON object.
Be thorough. If a field is absent in the CV, return an empty string or empty array.`;

const USER_PREFIX = `Extract ALL information from this CV and return a JSON object with EXACTLY these fields:

{
  "firstName": "string",
  "lastName": "string",
  "birthDate": "string — formatted date, e.g. 'January 1, 1980', or ''",
  "titles": ["up to 3 job title strings shown under the name"],
  "bio": "string — the introductory / professional-summary paragraph",
  "careerTimeline": [
    { "dates": "e.g. '2019 – today'", "role": "job title", "company": "employer" }
  ],
  "knowHow": "string — brief domain expertise description, or ''",
  "personalSkills": ["soft skill strings"],
  "areasOfExpertise": ["industry / domain strings"],
  "technicalSkills": ["tool or technology strings"],
  "languages": [{ "language": "name", "proficiency": 5 }],
  "education": [
    { "years": "e.g. '2004-2008'", "degree": "degree name", "institution": "school" }
  ],
  "certifications": [{ "year": "2024", "name": "certification name" }],
  "experiences": [
    {
      "dates": "e.g. '2022 – 2025'",
      "title": "role / mission title",
      "company": "company or client name",
      "description": ["bullet point 1", "bullet point 2"],
      "tools": "comma-separated tools used",
      "category": "select_advisory or pre_advisory"
    }
  ]
}

Rules:
- "category" = "pre_advisory" for experience BEFORE joining Select Advisory / Agilos / Beyond Data; otherwise "select_advisory".
- Language proficiency scale: 5 = native/fluent, 4 = advanced, 3 = intermediate, 2 = elementary, 1 = basic.
- List experiences in reverse chronological order (most recent first).
- careerTimeline = high-level career summary entries (not detailed missions).
- Return ONLY the JSON object, no markdown fences, no explanation.

CV TEXT:
`;

/* ── Public API ────────────────────────────────────────────────────────── */
async function parseWithClaude(file, apiKey) {
  const ab  = await file.arrayBuffer();
  const zip = new PizZip(ab);
  const cvText = extractTextFromDocx(zip);

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

  // Strip markdown code fences if Claude added them
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) text = fenced[1].trim();

  const parsed = JSON.parse(text);

  // Normalise
  if (!Array.isArray(parsed.titles)) parsed.titles = parsed.titles ? [String(parsed.titles)] : [];
  while (parsed.titles.length < 3) parsed.titles.push('');

  parsed.languages = (parsed.languages || []).map(l => ({
    language: l.language || '',
    proficiency: Math.max(1, Math.min(5, parseInt(l.proficiency) || 5)),
  }));

  parsed.experiences = (parsed.experiences || []).map(e => ({
    dates: e.dates || '',
    title: e.title || '',
    company: e.company || '',
    description: Array.isArray(e.description) ? e.description : [],
    tools: e.tools || '',
    category: e.category === 'pre_advisory' ? 'pre_advisory' : 'select_advisory',
  }));

  ['personalSkills','areasOfExpertise','technicalSkills','education','certifications','careerTimeline'].forEach(k => {
    if (!Array.isArray(parsed[k])) parsed[k] = [];
  });
  ['bio','knowHow','firstName','lastName','birthDate'].forEach(k => {
    if (typeof parsed[k] !== 'string') parsed[k] = '';
  });

  return parsed;
}

global.parseWithClaude = parseWithClaude;

})(window);
