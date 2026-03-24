/* ═══════════════════════════════════════════════════════════════════════
   CV Generator — Select Advisory
   Vanilla JS SPA: all sections always visible, sidebar navigation,
   supports manual entry and Beyond Data CV import.
═══════════════════════════════════════════════════════════════════════ */

/* ── State ────────────────────────────────────────────────────────────── */
const state = {
  mode: 'manual',  // 'manual' | 'upload'
  data: {
    firstName: '', lastName: '', birthDate: '',
    titles: ['', '', ''],
    bio: '',
    careerTimeline: [],
    knowHow: '',
    personalSkills: [], areasOfExpertise: [], technicalSkills: [],
    education: [], certifications: [], languages: [], experiences: [],
  },
};

/* ── Section manifest ─────────────────────────────────────────────────── */
const SECTIONS = [
  { id: 'identity',      icon: '👤', label: 'Identity'           },
  { id: 'bio',           icon: '📝', label: 'Bio & Summary'      },
  { id: 'knowhow',       icon: '💡', label: 'Know-how & Skills'  },
  { id: 'technical',     icon: '🔧', label: 'Technical Skills'   },
  { id: 'education',     icon: '🎓', label: 'Education'          },
  { id: 'certifications',icon: '📜', label: 'Certifications'     },
  { id: 'languages',     icon: '🌐', label: 'Languages'          },
  { id: 'experiences',   icon: '💼', label: 'Experiences'        },
];

/* ── HTML escape ──────────────────────────────────────────────────────── */
function h(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                         .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ═══════════════════════════════════════════════════════════════════════
   RENDERERS
═══════════════════════════════════════════════════════════════════════ */
function renderSidebar() {
  document.getElementById('sidebar-nav').innerHTML = SECTIONS.map(s =>
    `<a class="nav-item" data-section="${s.id}" href="#section-${s.id}">
       <span class="nav-icon">${s.icon}</span>${s.label}
     </a>`
  ).join('');
}

function renderAll() {
  const d = state.data;
  document.getElementById('form-root').innerHTML =
    sectionIdentity(d) + sectionBio(d) + sectionKnowhow(d) +
    sectionTechnical(d) + sectionEducation(d) + sectionCertifications(d) +
    sectionLanguages(d) + sectionExperiences(d);
  initTagInputs();
  initIntersectionObserver();
}

/* ── 1. Identity ──────────────────────────────────────────────────────── */
function sectionIdentity(d) {
  return `<section class="form-section" id="section-identity">
    <div class="section-header">
      <span class="section-icon">👤</span>
      <h2 class="section-title">Identity</h2>
    </div>
    <div class="form-grid">
      <div class="field">
        <label>First name</label>
        <input type="text" data-bind="firstName" value="${h(d.firstName)}" placeholder="Jean-François">
      </div>
      <div class="field">
        <label>Last name</label>
        <input type="text" data-bind="lastName" value="${h(d.lastName)}" placeholder="Dierckx">
      </div>
      <div class="field">
        <label>Date of birth</label>
        <input type="text" data-bind="birthDate" value="${h(d.birthDate)}" placeholder="January 1, 1990">
      </div>
    </div>
    <div class="field mb-16">
      <label>Job titles — shown under your name (up to 3)</label>
      <div class="titles-list">
        ${[0,1,2].map(i => `
          <input type="text" data-bind="titles" data-idx="${i}"
                 value="${h((d.titles||[])[i]||'')}" placeholder="Title ${i+1}${i===0?' (e.g. Senior BI Consultant)':''}">
        `).join('')}
      </div>
    </div>
  </section>`;
}

/* ── 2. Bio & Professional Summary ───────────────────────────────────── */
function sectionBio(d) {
  const timeline = d.careerTimeline || [];
  return `<section class="form-section" id="section-bio">
    <div class="section-header">
      <span class="section-icon">📝</span>
      <h2 class="section-title">Bio &amp; Professional Summary</h2>
    </div>
    <div class="field mb-16">
      <label>Bio — introductory paragraph</label>
      <textarea data-bind="bio" rows="5" placeholder="Jean-François is a Senior BI Consultant with 10+ years of experience…">${h(d.bio)}</textarea>
    </div>
    <div class="section-divider">Career timeline</div>
    <p class="field-hint mb-8">Each entry appears in the "Professional summary" section of the CV.</p>
    <div class="list-items" id="timeline-list">
      ${timeline.map((e, i) => timelineItem(e, i)).join('')}
    </div>
    <button class="btn-add-item" data-action="add-timeline">＋ Add entry</button>
  </section>`;
}

function timelineItem(e, i) {
  return `<div class="list-item list-item-grid cols-3" data-item="timeline" data-idx="${i}">
    <button class="btn-remove-item" data-action="remove-timeline" data-idx="${i}">✕ Remove</button>
    <div class="field">
      <label>Period</label>
      <input type="text" data-bind="careerTimeline.dates" data-idx="${i}" value="${h(e.dates)}" placeholder="2019 – today">
    </div>
    <div class="field">
      <label>Role</label>
      <input type="text" data-bind="careerTimeline.role" data-idx="${i}" value="${h(e.role)}" placeholder="BI Consultant">
    </div>
    <div class="field">
      <label>Company / Client</label>
      <input type="text" data-bind="careerTimeline.company" data-idx="${i}" value="${h(e.company)}" placeholder="Select Advisory">
    </div>
  </div>`;
}

/* ── 3. Know-how & Skills ─────────────────────────────────────────────── */
function sectionKnowhow(d) {
  return `<section class="form-section" id="section-knowhow">
    <div class="section-header">
      <span class="section-icon">💡</span>
      <h2 class="section-title">Know-how &amp; Skills</h2>
    </div>
    <div class="field mb-16">
      <label>Know-how summary <span style="font-weight:400;text-transform:none">(optional free text)</span></label>
      <textarea data-bind="knowHow" rows="3" placeholder="Domain expertise description…">${h(d.knowHow)}</textarea>
    </div>
    <div class="form-grid">
      <div class="field">
        <label>Personal skills</label>
        <div class="tag-container" id="tag-personalSkills" data-tag-key="personalSkills"></div>
        <span class="field-hint">Type a skill and press Enter</span>
      </div>
      <div class="field">
        <label>Areas of expertise</label>
        <div class="tag-container" id="tag-areasOfExpertise" data-tag-key="areasOfExpertise"></div>
        <span class="field-hint">Type an area and press Enter</span>
      </div>
    </div>
  </section>`;
}

/* ── 4. Technical Skills ──────────────────────────────────────────────── */
function sectionTechnical(d) {
  return `<section class="form-section" id="section-technical">
    <div class="section-header">
      <span class="section-icon">🔧</span>
      <h2 class="section-title">Technical Expertise</h2>
    </div>
    <div class="field">
      <label>Technical skills</label>
      <div class="tag-container" id="tag-technicalSkills" data-tag-key="technicalSkills"></div>
      <span class="field-hint">Each entry appears as a bullet in the 2-column section of the CV. Press Enter to add.</span>
    </div>
  </section>`;
}

/* ── 5. Education ─────────────────────────────────────────────────────── */
function sectionEducation(d) {
  const edu = d.education || [];
  return `<section class="form-section" id="section-education">
    <div class="section-header">
      <span class="section-icon">🎓</span>
      <h2 class="section-title">Education &amp; Training</h2>
    </div>
    <div class="list-items" id="edu-list">
      ${edu.map((e, i) => eduItem(e, i)).join('')}
    </div>
    <button class="btn-add-item" data-action="add-edu">＋ Add education</button>
  </section>`;
}

function eduItem(e, i) {
  return `<div class="list-item list-item-grid cols-3">
    <button class="btn-remove-item" data-action="remove-edu" data-idx="${i}">✕ Remove</button>
    <div class="field">
      <label>Period</label>
      <input type="text" data-bind="education.years" data-idx="${i}" value="${h(e.years)}" placeholder="2008 – 2012">
    </div>
    <div class="field">
      <label>Degree / Program</label>
      <input type="text" data-bind="education.degree" data-idx="${i}" value="${h(e.degree)}" placeholder="Master in Computer Science">
    </div>
    <div class="field">
      <label>Institution</label>
      <input type="text" data-bind="education.institution" data-idx="${i}" value="${h(e.institution)}" placeholder="UCLouvain">
    </div>
  </div>`;
}

/* ── 6. Certifications ────────────────────────────────────────────────── */
function sectionCertifications(d) {
  const certs = d.certifications || [];
  return `<section class="form-section" id="section-certifications">
    <div class="section-header">
      <span class="section-icon">📜</span>
      <h2 class="section-title">Certifications</h2>
    </div>
    <div class="list-items" id="cert-list">
      ${certs.map((c, i) => certItem(c, i)).join('')}
    </div>
    <button class="btn-add-item" data-action="add-cert">＋ Add certification</button>
  </section>`;
}

function certItem(c, i) {
  return `<div class="list-item list-item-grid cols-2">
    <button class="btn-remove-item" data-action="remove-cert" data-idx="${i}">✕ Remove</button>
    <div class="field">
      <label>Year</label>
      <input type="text" data-bind="certifications.year" data-idx="${i}" value="${h(c.year)}" placeholder="2024">
    </div>
    <div class="field">
      <label>Certification name</label>
      <input type="text" data-bind="certifications.name" data-idx="${i}" value="${h(c.name)}" placeholder="Qlik Sense Data Architect">
    </div>
  </div>`;
}

/* ── 7. Languages ─────────────────────────────────────────────────────── */
function sectionLanguages(d) {
  const langs = d.languages || [];
  return `<section class="form-section" id="section-languages">
    <div class="section-header">
      <span class="section-icon">🌐</span>
      <h2 class="section-title">Languages</h2>
    </div>
    <div id="lang-list">
      ${langs.map((l, i) => langItem(l, i)).join('')}
    </div>
    <button class="btn-add-item" data-action="add-lang">＋ Add language</button>
  </section>`;
}

function langItem(l, i) {
  const prof = Math.max(1, Math.min(5, parseInt(l.proficiency) || 5));
  const LEVELS = ['', 'Basic', 'Elementary', 'Intermediate', 'Advanced', 'Native/Fluent'];
  return `<div class="lang-entry">
    <div style="display:flex;gap:8px;align-items:center">
      <input type="text" data-bind="languages.language" data-idx="${i}"
             value="${h(l.language)}" placeholder="French" style="width:140px">
      <button class="btn-remove-item" style="position:static;margin:0"
              data-action="remove-lang" data-idx="${i}">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <div class="stars" data-lang-idx="${i}">
        ${[1,2,3,4,5].map(n =>
          `<button class="star-btn${n<=prof?' filled':''}" data-star="${n}" data-lang-idx="${i}"
                   title="${LEVELS[n]}">
             ${n<=prof?'★':'☆'}
           </button>`
        ).join('')}
      </div>
      <span class="field-hint" id="lang-level-${i}">${LEVELS[prof]}</span>
    </div>
  </div>`;
}

/* ── 8. Experiences ───────────────────────────────────────────────────── */
function sectionExperiences(d) {
  const exps = d.experiences || [];
  return `<section class="form-section" id="section-experiences">
    <div class="section-header">
      <span class="section-icon">💼</span>
      <h2 class="section-title">Professional Experiences</h2>
    </div>
    <div id="exp-list">
      ${exps.map((e, i) => expCard(e, i)).join('')}
    </div>
    <button class="btn-add-item" data-action="add-exp">＋ Add experience</button>
  </section>`;
}

function expCard(e, i) {
  const label = [e.dates, [e.title, e.company].filter(Boolean).join(' – ')].filter(Boolean).join(' · ') || `Experience ${i+1}`;
  const open  = i === 0 && !e.dates ? ' open' : '';
  return `<div class="exp-card${open}" id="exp-card-${i}">
    <div class="exp-card-header" data-action="toggle-exp" data-idx="${i}">
      <div>
        <div class="exp-card-title">${h(label)}</div>
      </div>
      <div class="exp-card-controls">
        <button class="btn-remove-item" style="position:static"
                data-action="remove-exp" data-idx="${i}">✕ Remove</button>
        <span class="exp-toggle">▶</span>
      </div>
    </div>
    <div class="exp-card-body">
      <div class="exp-grid-4 mb-16">
        <div class="field">
          <label>Period</label>
          <input type="text" data-bind="experiences.dates" data-idx="${i}" value="${h(e.dates)}" placeholder="2022 – 2025">
        </div>
        <div class="field">
          <label>Role / Title</label>
          <input type="text" data-bind="experiences.title" data-idx="${i}" value="${h(e.title)}" placeholder="BI Consultant">
        </div>
        <div class="field">
          <label>Company / Client</label>
          <input type="text" data-bind="experiences.company" data-idx="${i}" value="${h(e.company)}" placeholder="Toyota BeLux">
        </div>
        <div class="field">
          <label>Category</label>
          <select data-bind="experiences.category" data-idx="${i}">
            <option value="select_advisory"${e.category!=='pre_advisory'?' selected':''}>SA / Beyond Data</option>
            <option value="pre_advisory"${e.category==='pre_advisory'?' selected':''}>Pre-Advisory</option>
          </select>
        </div>
      </div>
      <div class="field mb-16">
        <label>Description <span style="font-weight:400;text-transform:none">(one bullet per line)</span></label>
        <textarea data-bind="experiences.description" data-idx="${i}" rows="4"
                  placeholder="Developed a Qlik Sense dashboard for finance reporting…">${h((e.description||[]).join('\n'))}</textarea>
      </div>
      <div class="field">
        <label>Tools</label>
        <input type="text" data-bind="experiences.tools" data-idx="${i}" value="${h(e.tools)}"
               placeholder="Qlik Sense, SQL, Snowflake, JIRA">
      </div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   TAG INPUT
═══════════════════════════════════════════════════════════════════════ */
function initTagInputs() {
  document.querySelectorAll('[data-tag-key]').forEach(container => {
    const key = container.dataset.tagKey;
    renderTagContainer(container, key);
  });
}

function renderTagContainer(container, key) {
  const tags = state.data[key] || [];
  container.innerHTML =
    tags.map((tag, i) =>
      `<span class="tag">${h(tag)}
         <button class="tag-remove" data-tag-key="${key}" data-tag-idx="${i}">×</button>
       </span>`
    ).join('') +
    `<input class="tag-new" data-tag-key="${key}" placeholder="Type and press Enter…">`;
}

/* ═══════════════════════════════════════════════════════════════════════
   INTERSECTION OBSERVER (highlight nav item)
═══════════════════════════════════════════════════════════════════════ */
function initIntersectionObserver() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const id = entry.target.id.replace('section-', '');
      const link = document.querySelector(`.nav-item[data-section="${id}"]`);
      if (link) link.classList.toggle('active', entry.isIntersecting);
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  document.querySelectorAll('.form-section').forEach(s => obs.observe(s));
}

/* ═══════════════════════════════════════════════════════════════════════
   DATA BINDING: read current form values into state.data
═══════════════════════════════════════════════════════════════════════ */
function syncFormToState() {
  // Simple scalars
  document.querySelectorAll('[data-bind]').forEach(el => {
    const bind = el.dataset.bind;
    const idx  = el.dataset.idx !== undefined ? parseInt(el.dataset.idx) : null;
    const val  = el.tagName === 'SELECT' ? el.value : el.value;

    if (bind.includes('.')) {
      // e.g. "careerTimeline.dates", "experiences.description"
      const [arr, field] = bind.split('.');
      if (idx === null) return;
      if (!state.data[arr][idx]) return;
      if (field === 'description') {
        state.data[arr][idx][field] = val.split('\n').filter(l => l.trim());
      } else {
        state.data[arr][idx][field] = val;
      }
    } else if (bind === 'titles') {
      state.data.titles[idx] = val;
    } else {
      state.data[bind] = val;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   EVENT HANDLING
═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('input', e => {
  const el   = e.target;
  const bind = el.dataset.bind;
  if (!bind) return;
  const idx  = el.dataset.idx !== undefined ? parseInt(el.dataset.idx) : null;
  const val  = el.value;

  if (bind.includes('.')) {
    const [arr, field] = bind.split('.');
    if (idx === null || !state.data[arr][idx]) return;
    if (field === 'description') {
      state.data[arr][idx][field] = val.split('\n').filter(l => l.trim());
    } else {
      state.data[arr][idx][field] = val;
    }
    // Update exp card title live
    if (arr === 'experiences') {
      const card = document.querySelector(`#exp-card-${idx} .exp-card-title`);
      if (card) {
        const exp = state.data.experiences[idx];
        card.textContent = [exp.dates, [exp.title, exp.company].filter(Boolean).join(' – ')].filter(Boolean).join(' · ') || `Experience ${idx+1}`;
      }
    }
  } else if (bind === 'titles') {
    state.data.titles[idx] = val;
  } else {
    state.data[bind] = val;
  }

  // Tag input — live add on comma
  if (el.classList.contains('tag-new')) {
    const key = el.dataset.tagKey;
    if (val.endsWith(',')) {
      const newTag = val.slice(0, -1).trim();
      if (newTag) {
        state.data[key] = [...(state.data[key]||[]), newTag];
        const container = el.closest('[data-tag-key]');
        renderTagContainer(container, key);
        container.querySelector('.tag-new').focus();
      }
    }
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.tagName === 'SELECT' && el.dataset.bind) {
    const [arr, field] = el.dataset.bind.split('.');
    const idx = parseInt(el.dataset.idx);
    if (state.data[arr] && state.data[arr][idx]) {
      state.data[arr][idx][field] = el.value;
    }
  }
});

document.addEventListener('keydown', e => {
  if (!e.target.classList.contains('tag-new')) return;
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const val = e.target.value.trim();
  if (!val) return;
  const key = e.target.dataset.tagKey;
  state.data[key] = [...(state.data[key]||[]), val];
  const container = e.target.closest('[data-tag-key]');
  renderTagContainer(container, key);
  container.querySelector('.tag-new').focus();
});

document.addEventListener('click', e => {
  const el     = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const idx    = el.dataset.idx !== undefined ? parseInt(el.dataset.idx) : null;

  // ── Tag remove ──────────────────────────────────────────────────────
  if (action === undefined && e.target.classList.contains('tag-remove')) {
    const key = e.target.dataset.tagKey;
    const i   = parseInt(e.target.dataset.tagIdx);
    state.data[key].splice(i, 1);
    const container = e.target.closest('[data-tag-key]');
    renderTagContainer(container, key);
    return;
  }

  switch (action) {
    // ── Career timeline ──────────────────────────────────────────────
    case 'add-timeline':
      state.data.careerTimeline.push({ dates: '', role: '', company: '' });
      rerenderSection('bio');
      scrollToLastIn('timeline-list');
      break;
    case 'remove-timeline':
      state.data.careerTimeline.splice(idx, 1);
      rerenderSection('bio');
      break;

    // ── Education ────────────────────────────────────────────────────
    case 'add-edu':
      state.data.education.push({ years: '', degree: '', institution: '' });
      rerenderSection('education');
      scrollToLastIn('edu-list');
      break;
    case 'remove-edu':
      state.data.education.splice(idx, 1);
      rerenderSection('education');
      break;

    // ── Certifications ───────────────────────────────────────────────
    case 'add-cert':
      state.data.certifications.push({ year: '', name: '' });
      rerenderSection('certifications');
      scrollToLastIn('cert-list');
      break;
    case 'remove-cert':
      state.data.certifications.splice(idx, 1);
      rerenderSection('certifications');
      break;

    // ── Languages ────────────────────────────────────────────────────
    case 'add-lang':
      state.data.languages.push({ language: '', proficiency: 5 });
      rerenderSection('languages');
      break;
    case 'remove-lang':
      state.data.languages.splice(idx, 1);
      rerenderSection('languages');
      break;

    // ── Experiences ──────────────────────────────────────────────────
    case 'add-exp':
      state.data.experiences.push({
        dates: '', title: '', company: '', description: [], tools: '', category: 'select_advisory'
      });
      rerenderSection('experiences');
      scrollToLastIn('exp-list');
      document.querySelector(`#exp-card-${state.data.experiences.length-1}`)?.classList.add('open');
      break;
    case 'remove-exp':
      syncFormToState();
      state.data.experiences.splice(idx, 1);
      rerenderSection('experiences');
      break;
    case 'toggle-exp': {
      const card = document.getElementById(`exp-card-${idx}`);
      if (card) card.classList.toggle('open');
      break;
    }
  }

  // ── Tag remove (via data-action on button inside tag) ──────────────
  if (e.target.dataset.tagKey) {
    const key = e.target.dataset.tagKey;
    const i   = parseInt(e.target.dataset.tagIdx);
    state.data[key].splice(i, 1);
    const container = e.target.closest('[data-tag-key]');
    renderTagContainer(container, key);
  }
});

// Star rating
document.addEventListener('click', e => {
  const btn = e.target.closest('.star-btn');
  if (!btn) return;
  const li  = parseInt(btn.dataset.langIdx);
  const val = parseInt(btn.dataset.star);
  state.data.languages[li].proficiency = val;
  const starsEl = document.querySelector(`.stars[data-lang-idx="${li}"]`);
  if (starsEl) {
    starsEl.querySelectorAll('.star-btn').forEach(b => {
      const n = parseInt(b.dataset.star);
      b.textContent = n <= val ? '★' : '☆';
      b.classList.toggle('filled', n <= val);
    });
  }
  const LEVELS = ['', 'Basic', 'Elementary', 'Intermediate', 'Advanced', 'Native/Fluent'];
  const levelEl = document.getElementById(`lang-level-${li}`);
  if (levelEl) levelEl.textContent = LEVELS[val] || '';
});

/* ── Partial re-renders ───────────────────────────────────────────────── */
function rerenderSection(id) {
  syncFormToState();
  const d = state.data;
  const renderers = {
    bio:            () => sectionBio(d),
    education:      () => sectionEducation(d),
    certifications: () => sectionCertifications(d),
    languages:      () => sectionLanguages(d),
    experiences:    () => sectionExperiences(d),
  };
  const sectionEl = document.getElementById(`section-${id}`);
  if (!sectionEl || !renderers[id]) return;
  const html = renderers[id]();
  const tmp  = document.createElement('div');
  tmp.innerHTML = html;
  sectionEl.replaceWith(tmp.firstElementChild);
  if (id === 'knowhow' || id === 'technical') initTagInputs();
}

function scrollToLastIn(containerId) {
  requestAnimationFrame(() => {
    const container = document.getElementById(containerId);
    if (container) container.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   MODE TOGGLE
═══════════════════════════════════════════════════════════════════════ */
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    const banner = document.getElementById('upload-banner');
    banner.classList.toggle('hidden', state.mode !== 'upload');
    if (state.mode === 'upload') banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   FILE UPLOAD + PARSE
═══════════════════════════════════════════════════════════════════════ */
const fileInput  = document.getElementById('file-input');
const btnParse   = document.getElementById('btn-parse');
const filenameEl = document.getElementById('upload-filename');
const statusEl   = document.getElementById('upload-status');

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  filenameEl.textContent = `📎 ${file.name}`;
  btnParse.disabled = false;
});

// Drag-and-drop
const uploadCard = document.querySelector('.upload-card');
if (uploadCard) {
  uploadCard.addEventListener('dragover', e => { e.preventDefault(); uploadCard.classList.add('dragover'); });
  uploadCard.addEventListener('dragleave', ()  => uploadCard.classList.remove('dragover'));
  uploadCard.addEventListener('drop', e => {
    e.preventDefault();
    uploadCard.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.docx')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      filenameEl.textContent = `📎 ${file.name}`;
      btnParse.disabled = false;
    }
  });
}

btnParse.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  btnParse.disabled = true;
  btnParse.textContent = 'Parsing…';
  statusEl.className = 'upload-status';
  statusEl.textContent = 'Reading your CV…';

  try {
    const fd = new FormData();
    fd.append('cv', file);
    const res = await fetch('/api/parse', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    const parsed = await res.json();
    Object.assign(state.data, parsed);
    // Ensure arrays
    if (!Array.isArray(state.data.titles)) state.data.titles = state.data.titles ? [state.data.titles] : ['','',''];
    while (state.data.titles.length < 3) state.data.titles.push('');

    renderAll();
    statusEl.className = 'upload-status success';
    statusEl.textContent = '✓ Form filled — review and edit below, then generate.';
    // Switch to manual view
    document.querySelector('.mode-btn[data-mode="manual"]').click();
    toast('CV imported successfully — form filled!', 'success');
  } catch (err) {
    statusEl.className = 'upload-status error';
    statusEl.textContent = '✗ Error: ' + err.message;
    toast('Parse failed: ' + err.message, 'error');
  } finally {
    btnParse.disabled = false;
    btnParse.textContent = 'Parse & fill form';
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   GENERATE
═══════════════════════════════════════════════════════════════════════ */
document.getElementById('btn-generate').addEventListener('click', async () => {
  syncFormToState();
  const btn = document.getElementById('btn-generate');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-generate-icon">⏳</span> Generating…';

  try {
    const res = await fetch('/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(state.data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Generation failed');
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const last = (state.data.lastName  || 'CV').replace(/\s+/g, '');
    const first = (state.data.firstName || '').replace(/\s+/g, '');
    a.href     = url;
    a.download = `${last}_${first}_SelectAdvisory.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('CV generated!', 'success');
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-generate-icon">⬇</span> Generate CV';
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════════════ */
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

/* ═══════════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════════ */
renderSidebar();
renderAll();
