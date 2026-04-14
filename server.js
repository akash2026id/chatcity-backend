// ══════════════════════════════════════════════════════════════
//  ChatCity Backend — Gmail SMTP + FCM Push Notifications
//  Deploy FREE: render.com
// ══════════════════════════════════════════════════════════════

import express    from 'express';
import cors       from 'cors';
import nodemailer from 'nodemailer';
import fetch      from 'node-fetch';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Gmail SMTP ──
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
});

transporter.verify(err => {
  if(err) console.error('❌ Gmail SMTP:', err.message);
  else    console.log('✅ Gmail SMTP Ready');
});

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ══ GET /api/health ══
app.get('/api/health', (req, res) => {
  res.json({ status:'ok', service:'ChatCity Backend ✅', ts: new Date().toISOString() });
});

// ══ GET /api/validate-email ══
app.get('/api/validate-email', (req, res) => {
  const email = (req.query.email||'').trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  res.json({ valid });
});

// ══ POST /api/send-email ══
app.post('/api/send-email', async (req, res) => {
  const { to, toName, subject, html } = req.body;
  if(!to||!subject||!html) return res.status(400).json({ error:'Missing fields' });
  try {
    await transporter.sendMail({
      from: `"ChatCity" <${process.env.GMAIL_USER}>`,
      to: `"${toName||''}" <${to}>`,
      subject, html
    });
    console.log(`[Email] ✅ → ${to}`);
    res.json({ success:true });
  } catch(e) {
    console.error('[Email] ❌', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══ POST /api/send-push — FCM HTTP v1 ══
app.post('/api/send-push', async (req, res) => {
  const { token, title, body, url } = req.body;
  if(!token) return res.status(400).json({ error:'Missing token' });

  try {
    // Get FCM access token using service account
    const projectId = 'chatcity-63c68';
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // Use Firebase legacy API with server key (simpler for free tier)
    const serverKey = process.env.FCM_SERVER_KEY;
    if(!serverKey) {
      console.warn('[FCM] No server key set');
      return res.json({ success:false, reason:'No FCM key' });
    }

    const r = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${serverKey}`
      },
      body: JSON.stringify({
        to: token,
        notification: { title: title||'ChatCity', body: body||'New message' },
        data: { url: url||'home.html' },
        android:  { priority: 'high' },
        webpush:  { notification: { icon:'https://cdn-icons-png.flaticon.com/512/3048/3048122.png', badge:'https://cdn-icons-png.flaticon.com/512/3048/3048122.png', vibrate:[200,100,200] } }
      })
    });
    const d = await r.json();
    console.log(`[FCM] Push sent:`, d.success ? '✅' : '❌', d.results?.[0]);
    res.json({ success: d.success > 0 });
  } catch(e) {
    console.error('[FCM]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══ GET /api/test-push ══
app.get('/api/test-email', async (req, res) => {
  const to = req.query.to;
  if(!to) return res.json({ error:'Add ?to=your@email.com' });
  try {
    await transporter.sendMail({
      from: `"ChatCity" <${process.env.GMAIL_USER}>`,
      to, subject: '✅ ChatCity Email Test',
      html: '<h2 style="color:#7c6eff">ChatCity Email Working! 🎉</h2>'
    });
    res.json({ success:true, message:`Test email sent to ${to}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`\n🚀 ChatCity Backend on port ${PORT}`);
  console.log(`   Gmail: ${process.env.GMAIL_USER||'not set'}`);
  console.log(`   FCM: ${process.env.FCM_SERVER_KEY?'✅ configured':'❌ not set'}\n`);
});
