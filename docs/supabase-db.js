/**
 * Supabase DB layer for CV Generator.
 *
 * ── Required table — run once in Supabase SQL editor ─────────────────────
 *
 *   CREATE TABLE cv_profiles (
 *     id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     first_name          text        NOT NULL,
 *     last_name           text        NOT NULL,
 *     birth_date          text,
 *
 *     -- Identity / header
 *     titles              text[],          -- up to 3 job titles under the name
 *
 *     -- Bio & summary
 *     bio                 text,
 *     career_timeline     jsonb,           -- [{dates, role, company}, …]
 *
 *     -- Know-how & skills
 *     know_how            text,
 *     personal_skills     text[],
 *     areas_of_expertise  text[],
 *
 *     -- Technical skills
 *     technical_skills    text[],
 *
 *     -- Education & training
 *     education           jsonb,           -- [{years, degree, institution}, …]
 *
 *     -- Certifications
 *     certifications      jsonb,           -- [{year, name}, …]
 *
 *     -- Languages
 *     languages           jsonb,           -- [{language, proficiency}, …]
 *
 *     -- Professional experiences
 *     experiences         jsonb,           -- [{dates, title, company, description[], tools, category}, …]
 *
 *     updated_at          timestamptz DEFAULT now(),
 *     UNIQUE (first_name, last_name)
 *   );
 *
 * ── Config (window.SA_CONFIG) ─────────────────────────────────────────────
 *   supabaseUrl     — https://xxxx.supabase.co
 *   supabaseAnonKey — eyJ…
 */
;(function (global) {
  let _client = null;

  function getClient() {
    if (_client) return _client;
    const cfg = window.SA_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    _client = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    return _client;
  }

  /** Returns true if Supabase is configured in SA_CONFIG */
  function isConfigured() {
    const cfg = window.SA_CONFIG || {};
    return !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  }

  /** Map flat JS state.data → DB row columns */
  function toRow(d) {
    return {
      first_name:         d.firstName           || '',
      last_name:          d.lastName            || '',
      birth_date:         d.birthDate           || null,
      titles:             d.titles              || [],
      bio:                d.bio                 || null,
      career_timeline:    d.careerTimeline      || [],
      know_how:           d.knowHow             || null,
      personal_skills:    d.personalSkills      || [],
      areas_of_expertise: d.areasOfExpertise    || [],
      technical_skills:   d.technicalSkills     || [],
      education:          d.education           || [],
      certifications:     d.certifications      || [],
      languages:          d.languages           || [],
      experiences:        d.experiences         || [],
      updated_at:         new Date().toISOString(),
    };
  }

  /** Map DB row → flat JS state.data */
  function fromRow(row) {
    return {
      firstName:         row.first_name          || '',
      lastName:          row.last_name           || '',
      birthDate:         row.birth_date          || '',
      titles:            row.titles              || ['', '', ''],
      bio:               row.bio                 || '',
      careerTimeline:    row.career_timeline     || [],
      knowHow:           row.know_how            || '',
      personalSkills:    row.personal_skills     || [],
      areasOfExpertise:  row.areas_of_expertise  || [],
      technicalSkills:   row.technical_skills    || [],
      education:         row.education           || [],
      certifications:    row.certifications      || [],
      languages:         row.languages           || [],
      experiences:       row.experiences         || [],
    };
  }

  /** List all profiles (first_name, last_name) sorted by last name */
  async function listProfiles() {
    const sb = getClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from('cv_profiles')
      .select('first_name, last_name')
      .order('last_name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /** Load full CV data for a given person — returns a state.data-shaped object */
  async function loadProfile(firstName, lastName) {
    const sb = getClient();
    if (!sb) return null;
    const { data, error } = await sb
      .from('cv_profiles')
      .select('*')
      .eq('first_name', firstName)
      .eq('last_name', lastName)
      .single();
    if (error) throw error;
    return data ? fromRow(data) : null;
  }

  /**
   * Insert or update a profile.
   * Key = (first_name, last_name). Returns true on success, false if not configured.
   */
  async function upsertProfile(cvData) {
    const sb = getClient();
    if (!sb) return false;
    if (!cvData.firstName || !cvData.lastName) return false;
    const { error } = await sb
      .from('cv_profiles')
      .upsert(toRow(cvData), { onConflict: 'first_name,last_name' });
    if (error) throw error;
    return true;
  }

  global.cvDB = { isConfigured, listProfiles, loadProfile, upsertProfile };
})(window);
