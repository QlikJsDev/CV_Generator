const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const { generateCV } = require('./lib/generator');
const { parseCV }    = require('./lib/parser');

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ── parse an uploaded Beyond Data .docx ─────────────────────────────── */
app.post('/api/parse', upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const data = await parseCV(req.file.buffer);
    res.json(data);
  } catch (err) {
    console.error('parse error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── generate a Select Advisory .docx ────────────────────────────────── */
app.post('/api/generate', async (req, res) => {
  try {
    const data     = req.body;
    const lastName = (data.lastName || 'CV').replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, '');
    const firstName = (data.firstName || '').replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, '');
    const date     = new Date().toISOString().slice(0, 7).replace('-', '');
    const filename = `${lastName}_${firstName}_SelectAdvisory_${date}.docx`;

    const buffer = await generateCV(data);
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── SPA fallback ─────────────────────────────────────────────────────── */
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`CV Generator running on http://localhost:${PORT}`)
);
