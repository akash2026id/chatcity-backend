// ══════════════════════════════════════════════════════════════
//  ChatCity — Backend Server
//  Gmail SMTP Email + Email Validation
//  Deploy FREE on: render.com
// ══════════════════════════════════════════════════════════════

import express    from 'express';
import cors       from 'cors';
import nodemailer from 'nodemailer';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Gmail SMTP Transporter ──
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'abuhurira.bsh.rc@gmail.com',
    pass: process.env.GMAIL_PASS || 'owprwowzvfezrrqi'
  }
});

// ── Middleware ──
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// ══════════════════════════════════════════════
// ROUTE 1: Send Email
// POST /api/send-email
// Body: { to, toName, subject, html }
// ══════════════════════════════════════════════
app.post('/api/send-email', async (req, res) => {
  const { to, toName, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing fields: to, subject, html' });
  }

  try {
    await transporter.sendMail({
      from:    `"ChatCity" <abuhurira.bsh.rc@gmail.com>`,
      to:      `"${toName || ''}" <${to}>`,
      subject: subject,
      html:    html
    });

    console.log(`[Email] ✅ Sent to ${to}`);
    res.json({ success: true });
  } catch(e) {
    console.error('[Email] ❌', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════
// ROUTE 2: Validate Email (simple)
// GET /api/validate-email?email=user@example.com
// ══════════════════════════════════════════════
app.get('/api/validate-email', (req, res) => {
  const { email } = req.query;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email||'').trim());
  res.json({ valid });
});

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ChatCity Backend ✅' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 ChatCity Backend running on port ${PORT}`);
  console.log(`   POST /api/send-email`);
  console.log(`   GET  /api/validate-email`);
  console.log(`   GET  /api/health\n`);
});
