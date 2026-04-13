// ══════════════════════════════════════════════════════════════
//  ChatCity — Backend Server (Gmail SMTP)
//  Deploy FREE on: render.com
// ══════════════════════════════════════════════════════════════

import express    from 'express';
import cors       from 'cors';
import nodemailer from 'nodemailer';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Gmail SMTP ──
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// ── Verify connection on startup ──
transporter.verify((error) => {
  if (error) console.error('❌ Gmail SMTP Error:', error);
  else console.log('✅ Gmail SMTP Ready!');
});

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ══ POST /api/send-email ══
app.post('/api/send-email', async (req, res) => {
  const { to, toName, subject, html } = req.body;
  console.log(`[Email] Request → to: ${to}, subject: ${subject}`);

  if (!to || !subject || !html) {
    console.warn('[Email] Missing fields');
    return res.status(400).json({ error: 'Missing: to, subject, html' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.warn('[Email] Invalid email:', to);
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const info = await transporter.sendMail({
      from:    `"ChatCity" <${process.env.GMAIL_USER}>`,
      to:      `"${toName || ''}" <${to}>`,
      subject: subject,
      html:    html
    });
    console.log(`[Email] ✅ Sent! MessageId: ${info.messageId} → ${to}`);
    res.json({ success: true, messageId: info.messageId });
  } catch(e) {
    console.error('[Email] ❌ Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══ GET /api/validate-email ══
app.get('/api/validate-email', (req, res) => {
  const email = (req.query.email || '').trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  res.json({ valid });
});

// ══ GET /api/health ══
app.get('/api/health', async (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'ChatCity Backend',
    gmail: process.env.GMAIL_USER || 'not set',
    time: new Date().toISOString()
  });
});

// ══ GET /api/test-email ══ (for testing)
app.get('/api/test-email', async (req, res) => {
  const to = req.query.to;
  if (!to) return res.json({ error: 'Add ?to=your@email.com' });
  
  try {
    await transporter.sendMail({
      from:    `"ChatCity" <${process.env.GMAIL_USER}>`,
      to:      to,
      subject: '✅ ChatCity Email Test',
      html:    '<h2>Email is working! 🎉</h2><p>ChatCity backend is connected successfully.</p>'
    });
    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 ChatCity Backend running on port ${PORT}`);
  console.log(`   Gmail: ${process.env.GMAIL_USER}`);
});
