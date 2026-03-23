/* ── Constants ───────────────────────────────────────────────────────────── */
const STEPS = [
  '1. Personal Info',
  '2. Summary',
  '3. Skills',
  '4. Languages',
  '5. Education',
  '6. Experience',
  '7. Generate',
];
const PROFICIENCY_LEVELS = ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'];

/* ── State ───────────────────────────────────────────────────────────────── */
let currentStep = 1;
let inputMode   = null;      // 'manual' | 'upload'
let uploadedFile = null;
const tags = { personalSkills: [], areasOfExpertise: [] };

/* ── Init ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildStepNav();
  setupTagInput('personalSkillsInput', 'personalSkills', 'personalSkillsTags');
  setupTagInput('areasInput',           'areasOfExpertise', 'areasTags');
});

/* ── Mode selection ──────────────────────────────────────────────────────── */
function selectMode(mode) {
  inputMode = mode;
  document.getElementById('modeManual').classList.toggle('selected', mode === 'manual');
  document.getElementById('modeUpload').classList.toggle('selected', mode === 'upload');

  document.getElementById('uploadPanel').style.display  = mode === 'upload' ? '' : 'none';
  document.getElementById('formArea').style.display     = mode === 'manual' ? '' : 'none';

  if (mode === 'manual') {
    showStep(1);
    // Seed with one empty row per dynamic list
    if (!document.querySelector('#languagesList .dynamic-item'))     addLanguage();
    if (!document.querySelector('#techSkillsList .dynamic-item'))    addTechSkill();
    if (!document.querySelector('#educationList .dynamic-item'))     addEducation();
    if (!document.querySelector('#certificationsList .dynamic-item'))addCertification();
    if (!document.querySelector('#experiencesList .dynamic-item'))   addExperience();
    if (!document.querySelector('#careerTimeline .dynamic-item'))    addCareerEntry();
  }
}

/* ── File upload ─────────────────────────────────────────────────────────── */
function handleFileSelect(input) {
  if (input.files && input.files[0]) setFile(input.files[0]);
}
function handleDrop(event) {
  event.preventDefault();
  document.getElementById('dropZone').classList.remove('drag-over');
  const file = event.dataTransfer.files[0];
  if (file) setFile(file);
}
function setFile(file) {
  uploadedFile = file;
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileInfo').style.display = '';
  document.getElementById('btnParse').disabled = false;
  document.getElementById('parseError').style.display = 'none';
}
function clearFile() {
  uploadedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('fileInfo').style.display = 'none';
  document.getElementById('btnParse').disabled = true;
}

async function parseCV() {
  if (!uploadedFile) return;
  const spinner  = document.getElementById('parseSpinner');
  const errBox   = document.getElementById('parseError');
  const btnParse = document.getElementById('btnParse');

  spinner.style.display = '';
  btnParse.disabled     = true;
  errBox.style.display  = 'none';

  try {
    const fd = new FormData();
    fd.append('file', uploadedFile);
    const resp = await fetch('/parse', { method: 'POST', body: fd });
    const json = await resp.json();

    if (!resp.ok) throw new Error(json.error || 'Parse error');

    // Show form and fill it
    document.getElementById('formArea').style.display = '';
    fillForm(json);
    showStep(1);
    document.getElementById('parsedAlert').style.removeProperty('display');
    // Scroll to form
    document.getElementById('formArea').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    errBox.textContent   = 'Error: ' + err.message;
    errBox.style.display = '';
  } finally {
    spinner.style.display = 'none';
    btnParse.disabled     = false;
  }
}

/* ── Fill form from parsed data ──────────────────────────────────────────── */
function fillForm(data) {
  setVal('firstName', data.firstName || '');
  setVal('lastName',  data.lastName  || '');
  setVal('birthDate', data.birthDate || '');
  setVal('title1', (data.titles || [])[0] || '');
  setVal('title2', (data.titles || [])[1] || '');
  setVal('bio',    data.bio    || '');
  setVal('overallDates',   data.overallDates   || '');
  setVal('currentRole',    data.currentRole    || '');
  setVal('currentCompany', data.currentCompany || '');

  // Tags
  refillTags('personalSkills',   data.personalSkills   || [], 'personalSkillsTags');
  refillTags('areasOfExpertise', data.areasOfExpertise || [], 'areasTags');

  // Technical skills
  clearList('techSkillsList');
  for (const s of (data.technicalSkills || [])) addTechSkill(s);
  if (!document.querySelector('#techSkillsList .dynamic-item')) addTechSkill();

  // Languages
  clearList('languagesList');
  for (const l of (data.languages || [])) addLanguage(l);
  if (!document.querySelector('#languagesList .dynamic-item')) addLanguage();

  // Education
  clearList('educationList');
  for (const e of (data.education || [])) addEducation(e);
  if (!document.querySelector('#educationList .dynamic-item')) addEducation();

  // Certifications
  clearList('certificationsList');
  for (const c of (data.certifications || [])) addCertification(c);
  if (!document.querySelector('#certificationsList .dynamic-item')) addCertification();

  // Career timeline
  clearList('careerTimeline');
  for (const e of (data.careerTimeline || [])) addCareerEntry(e);
  if (!document.querySelector('#careerTimeline .dynamic-item')) addCareerEntry();

  // Experiences
  clearList('experiencesList');
  for (const e of (data.experiences || [])) addExperience(e);
  if (!document.querySelector('#experiencesList .dynamic-item')) addExperience();
}

function refillTags(storeKey, items, containerId) {
  tags[storeKey] = [];
  document.getElementById(containerId).innerHTML = '';
  const container = document.getElementById(containerId);
  for (const item of items) addTag(item, storeKey, container);
}

function clearList(id) {
  document.getElementById(id).innerHTML = '';
}

/* ── Step navigation ─────────────────────────────────────────────────────── */
function buildStepNav() {
  const nav = document.getElementById('stepNav');
  nav.innerHTML = STEPS.map((s, i) =>
    `<button class="step-pill" data-step="${i + 1}" onclick="goToStep(${i + 1})">${s}</button>`
  ).join('');
}
function updateNav() {
  document.querySelectorAll('.step-pill').forEach(pill => {
    const n = parseInt(pill.dataset.step);
    pill.classList.toggle('active', n === currentStep);
    pill.classList.toggle('done',   n < currentStep);
  });
  document.getElementById('btnPrev').style.display = currentStep > 1 ? '' : 'none';
  const btnNext = document.getElementById('btnNext');
  btnNext.style.display = currentStep === STEPS.length ? 'none' : '';
}
function showStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.querySelector(`.step-panel[data-step="${n}"]`);
  if (panel) panel.classList.add('active');
  currentStep = n;
  updateNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function nextStep() { if (currentStep < STEPS.length) showStep(currentStep + 1); }
function prevStep() { if (currentStep > 1) showStep(currentStep - 1); }
function goToStep(n) { if (n <= currentStep + 1) showStep(n); }

/* ── Tag input ───────────────────────────────────────────────────────────── */
function setupTagInput(inputId, storeKey, containerId) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = input.value.replace(/,/g, '').trim();
      if (v) addTag(v, storeKey, container);
      input.value = '';
    }
  });
  input.addEventListener('blur', () => {
    const v = input.value.replace(/,/g, '').trim();
    if (v) { addTag(v, storeKey, container); input.value = ''; }
  });
  document.getElementById(inputId.replace('Input', 'Wrapper'))
    ?.addEventListener('click', () => input.focus());
}
function addTag(text, storeKey, container) {
  if (tags[storeKey].includes(text)) return;
  tags[storeKey].push(text);
  const chip = document.createElement('span');
  chip.className = 'tag-chip';
  chip.innerHTML = `${esc(text)}<span class="remove-tag" onclick="removeTag('${esc(text)}','${storeKey}',this.parentElement)">×</span>`;
  container.appendChild(chip);
}
function removeTag(text, storeKey, chip) {
  tags[storeKey] = tags[storeKey].filter(t => t !== text);
  chip.remove();
}

/* ── Technical skills ────────────────────────────────────────────────────── */
function addTechSkill(value = '') {
  const list = document.getElementById('techSkillsList');
  const div = document.createElement('div');
  div.className = 'dynamic-item py-2';
  div.innerHTML = `
    <div class="d-flex gap-2 align-items-center">
      <input type="text" class="form-control tech-skill-input" value="${esc(value)}"
             placeholder="e.g. Qlik Sense / QlikView / NPrinting">
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.dynamic-item').remove()">
        <i class="bi bi-trash"></i>
      </button>
    </div>`;
  list.appendChild(div);
}

/* ── Languages ───────────────────────────────────────────────────────────── */
function addLanguage(lang = {}) {
  const list = document.getElementById('languagesList');
  const div = document.createElement('div');
  div.className = 'dynamic-item';
  const opts = PROFICIENCY_LEVELS.map(l =>
    `<option value="${l}" ${lang.proficiency === l ? 'selected' : ''}>${l}</option>`
  ).join('');
  div.innerHTML = `
    <button type="button" class="remove-btn" onclick="this.closest('.dynamic-item').remove()">
      <i class="bi bi-x-circle"></i>
    </button>
    <div class="row g-2">
      <div class="col-md-5">
        <label class="form-label small mb-1">Language</label>
        <input type="text" class="form-control lang-name" value="${esc(lang.language || '')}" placeholder="English">
      </div>
      <div class="col-md-7">
        <label class="form-label small mb-1">Proficiency</label>
        <select class="form-select lang-proficiency">${opts}</select>
      </div>
    </div>`;
  list.appendChild(div);
}

/* ── Education ───────────────────────────────────────────────────────────── */
function addEducation(edu = {}) {
  const list = document.getElementById('educationList');
  const div = document.createElement('div');
  div.className = 'dynamic-item';
  div.innerHTML = `
    <button type="button" class="remove-btn" onclick="this.closest('.dynamic-item').remove()">
      <i class="bi bi-x-circle"></i>
    </button>
    <div class="row g-2">
      <div class="col-md-3">
        <label class="form-label small mb-1">Years</label>
        <input type="text" class="form-control edu-years" value="${esc(edu.years || '')}" placeholder="2004-2005">
      </div>
      <div class="col-md-9">
        <label class="form-label small mb-1">Degree / Programme</label>
        <input type="text" class="form-control edu-degree" value="${esc(edu.degree || '')}" placeholder="MSc Data Science">
      </div>
      <div class="col-12">
        <label class="form-label small mb-1">Institution</label>
        <input type="text" class="form-control edu-institution" value="${esc(edu.institution || '')}" placeholder="UCLouvain">
      </div>
    </div>`;
  list.appendChild(div);
}

/* ── Certifications ──────────────────────────────────────────────────────── */
function addCertification(cert = {}) {
  const list = document.getElementById('certificationsList');
  const div = document.createElement('div');
  div.className = 'dynamic-item py-2';
  div.innerHTML = `
    <div class="d-flex gap-2 align-items-center">
      <input type="text" class="form-control cert-year" style="max-width:90px"
             value="${esc(cert.year || '')}" placeholder="2025">
      <input type="text" class="form-control cert-name"
             value="${esc(cert.name || '')}" placeholder="Qlik Sense Data Architect">
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.dynamic-item').remove()">
        <i class="bi bi-trash"></i>
      </button>
    </div>`;
  list.appendChild(div);
}

/* ── Career timeline ─────────────────────────────────────────────────────── */
function addCareerEntry(entry = {}) {
  const list = document.getElementById('careerTimeline');
  const div = document.createElement('div');
  div.className = 'dynamic-item';
  div.innerHTML = `
    <button type="button" class="remove-btn" onclick="this.closest('.dynamic-item').remove()">
      <i class="bi bi-x-circle"></i>
    </button>
    <div class="row g-2">
      <div class="col-md-3">
        <label class="form-label small mb-1">Dates</label>
        <input type="text" class="form-control career-dates" value="${esc(entry.dates || '')}" placeholder="2014 – Present">
      </div>
      <div class="col-md-5">
        <label class="form-label small mb-1">Role</label>
        <input type="text" class="form-control career-role" value="${esc(entry.role || '')}" placeholder="Project Manager">
      </div>
      <div class="col-md-4">
        <label class="form-label small mb-1">Company</label>
        <input type="text" class="form-control career-company" value="${esc(entry.company || '')}" placeholder="Agilos">
      </div>
    </div>`;
  list.appendChild(div);
}

/* ── Experiences ─────────────────────────────────────────────────────────── */
let expCount = 0;
function addExperience(exp = {}) {
  const id   = expCount++;
  const list = document.getElementById('experiencesList');
  const div  = document.createElement('div');
  div.className = 'dynamic-item';

  const descRows = (exp.description && exp.description.length)
    ? exp.description.map(d => descRowHtml(d)).join('')
    : descRowHtml('');

  div.innerHTML = `
    <button type="button" class="remove-btn" onclick="this.closest('.dynamic-item').remove()">
      <i class="bi bi-x-circle"></i>
    </button>
    <div class="row g-2">
      <div class="col-md-3">
        <label class="form-label small mb-1">Dates</label>
        <input type="text" class="form-control exp-dates" value="${esc(exp.dates || '')}" placeholder="Jan 2023 – Current">
      </div>
      <div class="col-md-5">
        <label class="form-label small mb-1">Role / Title</label>
        <input type="text" class="form-control exp-title" value="${esc(exp.title || '')}" placeholder="BI Consultant">
      </div>
      <div class="col-md-4">
        <label class="form-label small mb-1">Company / Client</label>
        <input type="text" class="form-control exp-company" value="${esc(exp.company || '')}" placeholder="Client name">
      </div>
      <div class="col-12">
        <label class="form-label small mb-1">Category</label>
        <select class="form-select exp-category">
          <option value="select_advisory" ${(exp.category||'') !== 'pre_advisory' ? 'selected':''}>
            With Select Advisory / Beyond Data
          </option>
          <option value="pre_advisory" ${exp.category === 'pre_advisory' ? 'selected':''}>
            Before Select Advisory / Beyond Data
          </option>
        </select>
      </div>
      <div class="col-12">
        <label class="form-label small mb-1">Description</label>
        <div class="desc-entries" id="descEntries_${id}">${descRows}</div>
        <button type="button" class="btn btn-outline-secondary btn-sm"
                onclick="addDescRow('descEntries_${id}')">
          <i class="bi bi-plus me-1"></i>Add paragraph
        </button>
      </div>
      <div class="col-12">
        <label class="form-label small mb-1">Tools / Technologies</label>
        <input type="text" class="form-control exp-tools" value="${esc(exp.tools || '')}"
               placeholder="Qlik Sense, Python, SQL, Azure…">
      </div>
    </div>`;
  list.appendChild(div);
}

function descRowHtml(text = '') {
  return `<div class="desc-row">
    <textarea class="form-control exp-desc" rows="2"
              placeholder="Describe responsibilities and achievements…">${esc(text)}</textarea>
    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeDescRow(this)">
      <i class="bi bi-trash"></i>
    </button>
  </div>`;
}
function addDescRow(containerId) {
  document.getElementById(containerId).insertAdjacentHTML('beforeend', descRowHtml());
}
function removeDescRow(btn) {
  const row = btn.closest('.desc-row');
  if (row.parentElement.querySelectorAll('.desc-row').length > 1) row.remove();
}

/* ── Collect data ────────────────────────────────────────────────────────── */
function collectData() {
  const get = id => (document.getElementById(id)?.value || '').trim();

  const techSkills    = [...document.querySelectorAll('.tech-skill-input')].map(i => i.value.trim()).filter(Boolean);
  const languages     = [...document.querySelectorAll('#languagesList .dynamic-item')].map(el => ({
    language:    el.querySelector('.lang-name')?.value.trim() || '',
    proficiency: el.querySelector('.lang-proficiency')?.value || 'Fluent',
  })).filter(l => l.language);
  const education     = [...document.querySelectorAll('#educationList .dynamic-item')].map(el => ({
    years:       el.querySelector('.edu-years')?.value.trim() || '',
    degree:      el.querySelector('.edu-degree')?.value.trim() || '',
    institution: el.querySelector('.edu-institution')?.value.trim() || '',
  })).filter(e => e.degree);
  const certifications= [...document.querySelectorAll('#certificationsList .dynamic-item')].map(el => ({
    year: el.querySelector('.cert-year')?.value.trim() || '',
    name: el.querySelector('.cert-name')?.value.trim() || '',
  })).filter(c => c.name);
  const careerTimeline= [...document.querySelectorAll('#careerTimeline .dynamic-item')].map(el => ({
    dates:   el.querySelector('.career-dates')?.value.trim() || '',
    role:    el.querySelector('.career-role')?.value.trim() || '',
    company: el.querySelector('.career-company')?.value.trim() || '',
  })).filter(e => e.role);
  const experiences   = [...document.querySelectorAll('#experiencesList .dynamic-item')].map(el => ({
    dates:       el.querySelector('.exp-dates')?.value.trim() || '',
    title:       el.querySelector('.exp-title')?.value.trim() || '',
    company:     el.querySelector('.exp-company')?.value.trim() || '',
    category:    el.querySelector('.exp-category')?.value || 'select_advisory',
    description: [...el.querySelectorAll('.exp-desc')].map(t => t.value.trim()).filter(Boolean),
    tools:       el.querySelector('.exp-tools')?.value.trim() || '',
  })).filter(e => e.title);

  return {
    template:         'select_advisory',
    firstName:        get('firstName'),
    lastName:         get('lastName'),
    birthDate:        get('birthDate'),
    titles:           [get('title1'), get('title2')].filter(Boolean),
    bio:              get('bio'),
    overallDates:     get('overallDates'),
    currentRole:      get('currentRole'),
    currentCompany:   get('currentCompany'),
    careerTimeline,
    personalSkills:   tags.personalSkills,
    areasOfExpertise: tags.areasOfExpertise,
    technicalSkills:  techSkills,
    languages,
    education,
    certifications,
    experiences,
  };
}

/* ── Generate ────────────────────────────────────────────────────────────── */
async function generateCV() {
  const idle    = document.getElementById('generateIdle');
  const loading = document.getElementById('generateLoading');
  const errBox  = document.getElementById('generateError');
  const success = document.getElementById('generateSuccess');

  idle.style.display    = 'none';
  loading.style.display = '';
  errBox.style.display  = 'none';
  success.style.display = 'none';

  try {
    const resp = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectData()),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || 'Server error');
    }
    const blob = await resp.blob();
    const cd   = resp.headers.get('Content-Disposition') || '';
    const fnM  = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
    const filename = fnM ? decodeURIComponent(fnM[1]) : 'CV.docx';

    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: filename }).click();
    URL.revokeObjectURL(url);

    loading.style.display  = 'none';
    success.style.display  = '';
    success.innerHTML = `<i class="bi bi-check-circle me-2"></i>
      <strong>${esc(filename)}</strong> downloaded successfully!`;
    idle.style.display = '';
  } catch (err) {
    loading.style.display = 'none';
    errBox.style.display  = '';
    errBox.textContent    = 'Error: ' + err.message;
    idle.style.display    = '';
  }
}

/* ── Util ────────────────────────────────────────────────────────────────── */
function setVal(id, v)  { const el = document.getElementById(id); if (el) el.value = v; }
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
