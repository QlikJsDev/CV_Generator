"""
Parse an existing Beyond Data Group .docx CV.

Structure (from template analysis):
- Header floating shape: Para0 = "FIRSTNAME LASTNAME\\nTitle1" (BR-separated), Para1 = "Title2"
- Sidebar floating shape: section headers + bullet paragraphs
- Body (no Professional Summary heading):
    [Normal]*    → bio text (long paragraphs)
    [Job Dates]  → overallDates
    [Normal]     → currentRole / currentCompany
    [Heading 1]  → section titles (Training & certifications, Education, Professional experiences)
    ...
"""

import re
from docx import Document

W   = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
WP  = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
WPS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'


# ── low-level helpers ─────────────────────────────────────────────────────────

def _all_text(el):
    return ''.join(t.text or '' for t in el.findall(f'.//{{{W}}}t'))


def _para_lines(para):
    """
    Split a paragraph into text lines at every w:br element.
    Returns a list of non-empty stripped strings.
    """
    lines, current = [], []
    for child in para:
        ctag = child.tag.split('}')[-1]
        if ctag == 'r':
            for rc in child:
                rtag = rc.tag.split('}')[-1]
                if rtag == 'br':
                    s = ''.join(current).strip()
                    if s:
                        lines.append(s)
                    current = []
                elif rtag == 't':
                    current.append(rc.text or '')
    s = ''.join(current).strip()
    if s:
        lines.append(s)
    return lines


def _find_shapes(doc):
    result = []
    for anchor in doc.element.body.findall(f'.//{{{WP}}}anchor'):
        txbx = anchor.find(f'.//{{{WPS}}}txbx')
        if txbx is not None:
            tc = txbx.find(f'{{{W}}}txbxContent')
            if tc is not None:
                result.append((anchor, tc))
    return result


def _sname(para):
    try:
        return (para.style.name or '').lower()
    except Exception:
        return ''


def _is_heading1(para):
    sn = _sname(para)
    return 'heading 1' in sn or 'titre' in sn


def _is_job_dates(para):
    sn = _sname(para)
    return 'job dates' in sn or 'jobdates' in sn


def _is_job_details(para):
    sn = _sname(para)
    return 'job details' in sn or 'jobdetails' in sn


def _is_list(para):
    sn = _sname(para)
    return 'list' in sn or 'paragraphe' in sn


def _has_anchor(para):
    return bool(para._element.findall(f'.//{{{WP}}}anchor'))


# ── shape parsers ─────────────────────────────────────────────────────────────

def _parse_header(doc, result):
    """
    Extract name + titles from the header floating text box.
    Para 0: "Firstname LASTNAME\\n(BR)Title1" → split at BR
    Para 1: Title2
    """
    for _anchor, tc in _find_shapes(doc):
        paras = tc.findall(f'{{{W}}}p')
        if not paras:
            continue

        # Collect all text lines (splitting at w:br within each paragraph)
        all_lines = []
        for p in paras:
            all_lines.extend(_para_lines(p))

        if not all_lines:
            continue

        # The header box is identified by an ALL-CAPS word (surname)
        words = all_lines[0].split()
        if not any(w.isupper() and len(w) >= 2 for w in words):
            continue

        # Parse name from first line
        if words[-1].isupper() and len(words[-1]) >= 2:
            result['lastName']  = words[-1].capitalize()
            result['firstName'] = ' '.join(words[:-1])
        else:
            result['firstName'] = words[0]
            result['lastName']  = ' '.join(words[1:]).title()

        result['titles'] = [l for l in all_lines[1:] if l.strip()]
        return


def _parse_sidebar(doc, result):
    """Extract skills + languages from the sidebar floating text box."""
    for _anchor, tc in _find_shapes(doc):
        text = _all_text(tc)
        if 'Personal skills' not in text and 'expertise' not in text.lower():
            continue

        paras = tc.findall(f'{{{W}}}p')
        sections, current = {}, None

        for p in paras:
            pStyle = p.find(f'.//{{{W}}}pStyle')
            sval   = (pStyle.get(f'{{{W}}}val') if pStyle is not None else '') or ''
            t = _all_text(p).strip()
            if not t:
                continue
            is_bullet = 'Paragraphe' in sval or 'List' in sval.lower()
            if is_bullet and current is not None:
                sections[current].append(t)
            elif not is_bullet:
                current = t
                sections.setdefault(current, [])

        for title, items in sections.items():
            tl = title.lower()
            joined = ', '.join(items)
            if 'personal skill' in tl:
                result['personalSkills'] = [s.strip() for s in joined.split(',') if s.strip()]
            elif 'expertise' in tl:
                result['areasOfExpertise'] = [s.strip() for s in joined.split(',') if s.strip()]
            elif 'technical' in tl:
                result['technicalSkills'] = items
            elif 'language' in tl:
                result['languages'] = _parse_languages(items)
        return


def _parse_languages(items):
    langs = []
    for item in items:
        if ':' in item:
            lang, prof = item.split(':', 1)
            langs.append({'language': lang.strip(), 'proficiency': prof.strip()})
        elif ',' in item:
            for lang in item.split(','):
                l = lang.strip()
                if l:
                    langs.append({'language': l, 'proficiency': 'Fluent'})
        elif item.strip():
            langs.append({'language': item.strip(), 'proficiency': 'Fluent'})
    return langs


# ── body parser ───────────────────────────────────────────────────────────────

def _parse_body(doc, result):
    paras = [p for p in doc.paragraphs if not _has_anchor(p)]

    # ── Pre-section content (bio, dates, current role) ──────────────────────
    pre_section = []
    first_heading_idx = None
    for i, p in enumerate(paras):
        if _is_heading1(p):
            first_heading_idx = i
            break
        t = p.text.strip()
        if t:
            pre_section.append(p)

    # Bio = first long Normal paragraph before any heading
    for p in pre_section:
        t = p.text.strip()
        if not t:
            continue
        sn = _sname(p)
        if _is_job_dates(p):
            if not result['overallDates']:
                result['overallDates'] = t
        elif 'normal' in sn or sn == '':
            if len(t) > 80:
                if not result['bio']:
                    result['bio'] = t
            else:
                # Short Normal lines: current role or "At Company"
                if t.lower().startswith('at '):
                    if not result['currentCompany']:
                        result['currentCompany'] = t[3:].strip()
                else:
                    if not result['currentRole']:
                        result['currentRole'] = t

    if first_heading_idx is None:
        return

    # ── Sections (identified by Heading 1) ──────────────────────────────────
    sections, current_h = {}, None
    for p in paras[first_heading_idx:]:
        if _is_heading1(p):
            current_h = p.text.strip()
            sections[current_h] = []
        elif current_h is not None:
            sections[current_h].append(p)

    for heading, entries in sections.items():
        hl = heading.lower()
        if 'certif' in hl or 'training' in hl or 'formation' in hl:
            _parse_certifications(entries, result)
        elif 'education' in hl:
            _parse_education(entries, result)
        elif 'experience' in hl or 'expérience' in hl:
            _parse_experiences(entries, result)


def _parse_certifications(paras, result):
    certs = []
    for p in paras:
        t = p.text.strip()
        if not t:
            continue
        m = re.match(r'^(\d{4})\s*[:\–\-]\s*(.+)$', t)
        if m:
            certs.append({'year': m.group(1), 'name': m.group(2).strip()})
        else:
            certs.append({'year': '', 'name': t})
    result['certifications'] = certs


def _parse_education(paras, result):
    edu = []
    for p in paras:
        t = p.text.strip()
        if not t:
            continue
        lines = t.split('\n')
        first = lines[0]
        m = re.match(r'^(.{4,15})\s*[:\–\-]\s*(.+)$', first)
        if m:
            edu.append({
                'years':       m.group(1).strip(),
                'degree':      m.group(2).strip(),
                'institution': lines[1].strip() if len(lines) > 1 else '',
            })
        else:
            edu.append({'years': '', 'degree': t, 'institution': ''})
    result['education'] = edu


def _parse_experiences(paras, result):
    experiences, current = [], None

    for p in paras:
        sn = _sname(p)
        t  = p.text.strip()

        if _is_job_dates(p):
            if not t:
                continue  # skip empty Job Dates paragraphs
            if current:
                experiences.append(current)
            current = {
                'dates': t, 'title': '', 'company': '',
                'description': [], 'tools': '',
                'category': 'select_advisory',
            }

        elif _is_job_details(p):
            if not t:
                continue
            if current is None:
                current = {
                    'dates': '', 'title': '', 'company': '',
                    'description': [], 'tools': '',
                    'category': 'select_advisory',
                }
            # Split "Role – Company" or "Role for Company"
            if ' – ' in t or ' - ' in t:
                sep = ' – ' if ' – ' in t else ' - '
                parts = t.split(sep, 1)
                current['title']   = parts[0].strip()
                current['company'] = parts[1].strip()
            elif ' for ' in t.lower():
                idx = t.lower().index(' for ')
                current['title']   = t[:idx].strip()
                current['company'] = t[idx + 5:].strip()
            else:
                current['title'] = t

        elif _is_list(p) or ('list' in sn):
            if current is None or not t:
                continue
            if re.match(r'^(?:tools|outils)\s*:', t, re.IGNORECASE):
                current['tools'] = re.sub(r'^(?:tools|outils)\s*:\s*', '', t, flags=re.IGNORECASE).strip()
            else:
                current['description'].append(t)

        elif ('normal' in sn or sn == '') and t and current:
            # Some CVs use Normal for descriptions in experience
            if not _is_heading1(p):
                current['description'].append(t)

    if current:
        experiences.append(current)

    result['experiences'] = experiences


# ── public entry point ────────────────────────────────────────────────────────

def parse_beyond_data_cv(file_obj):
    doc = Document(file_obj)

    result = {
        'template':         'select_advisory',
        'firstName':        '',
        'lastName':         '',
        'birthDate':        '',
        'titles':           [],
        'bio':              '',
        'overallDates':     '',
        'currentRole':      '',
        'currentCompany':   '',
        'careerTimeline':   [],
        'personalSkills':   [],
        'areasOfExpertise': [],
        'technicalSkills':  [],
        'languages':        [],
        'education':        [],
        'certifications':   [],
        'experiences':      [],
    }

    _parse_header(doc, result)
    _parse_sidebar(doc, result)
    _parse_body(doc, result)

    return result
