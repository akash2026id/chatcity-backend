// ══════════════════════════════════════════════════════════════
//  ChatCity Backend — FCM V1 Push Notifications + Gmail SMTP
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

// ── FCM Service Account ──
const FCM_PROJECT_ID   = 'chatcity-63c68';
const FCM_CLIENT_EMAIL = 'firebase-adminsdk-fbsvc@chatcity-63c68.iam.gserviceaccount.com';
const FCM_PRIVATE_KEY  = (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n');

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ══════════════════════════════════════════════
// FCM V1 — Get OAuth2 Access Token
// ══════════════════════════════════════════════
async function getFCMAccessToken() {
  const now   = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   FCM_CLIENT_EMAIL,
    sub:   FCM_CLIENT_EMAIL,
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };

  // Create JWT
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(payload)}`;

  // Sign with private key using Web Crypto
  const keyData = FCM_PRIVATE_KEY
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Buffer.from(keyData, 'base64');
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    Buffer.from(unsigned)
  );
  const jwt = `${unsigned}.${Buffer.from(signature).toString('base64url')}`;

  // Exchange JWT for access token
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const d = await r.json();
  if(!d.access_token) throw new Error('FCM token failed: ' + JSON.stringify(d));
  return d.access_token;
}

// ══════════════════════════════════════════════
// POST /api/send-push
// ══════════════════════════════════════════════
app.post('/api/send-push', async (req, res) => {
  const { token, title, body, url } = req.body;
  if(!token) return res.status(400).json({ error: 'Missing token' });

  try {
    const accessToken = await getFCMAccessToken();
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

    const r = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: title || 'ChatCity 💬',
            body:  body  || 'You have a new message'
          },
          webpush: {
            notification: {
              icon:    'https://cdn-icons-png.flaticon.com/512/3048/3048122.png',
              badge:   'https://cdn-icons-png.flaticon.com/512/3048/3048122.png',
              vibrate: [200, 100, 200],
              click_action: url || 'https://akash2026id.github.io/ChatCity/home.html'
            },
            fcm_options: {
              link: url || 'https://akash2026id.github.io/ChatCity/home.html'
            }
          },
          android: {
            priority: 'high',
            notification: {
              icon:  'notification_icon',
              color: '#7c6eff',
              sound: 'default'
            }
          }
        }
      })
    });

    const d = await r.json();
    if(r.ok) {
      console.log(`[FCM] ✅ Push sent → ${token.slice(0,20)}...`);
      res.json({ success: true, messageId: d.name });
    } else {
      console.error('[FCM] ❌', d.error);
      res.status(r.status).json({ error: d.error });
    }
  } catch(e) {
    console.error('[FCM] Exception:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════
// POST /api/send-email
// ══════════════════════════════════════════════
app.post('/api/send-email', async (req, res) => {
  const { to, toName, subject, html } = req.body;
  if(!to||!subject||!html) return res.status(400).json({ error:'Missing fields' });
  try {
    await transporter.sendMail({
      from: `"ChatCity" <${process.env.GMAIL_USER}>`,
      to:   `"${toName||''}" <${to}>`,
      subject, html
    });
    console.log(`[Email] ✅ → ${to}`);
    res.json({ success: true });
  } catch(e) {
    console.error('[Email] ❌', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══ GET /api/validate-email ══
app.get('/api/validate-email', (req, res) => {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((req.query.email||'').trim());
  res.json({ valid });
});

// ══ GET /api/health ══
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ChatCity Backend ✅',
    gmail: process.env.GMAIL_USER ? '✅' : '❌ not set',
    fcm:   FCM_PRIVATE_KEY        ? '✅' : '❌ not set',
    ts: new Date().toISOString()
  });
});

// ══ GET /api/test-email ══
app.get('/api/test-email', async (req, res) => {
  const to = req.query.to;
  if(!to) return res.json({ error: 'Add ?to=your@email.com' });
  try {
    await transporter.sendMail({
      from: `"ChatCity" <${process.env.GMAIL_USER}>`,
      to, subject: '✅ ChatCity Test',
      html: '<h2 style="color:#7c6eff">ChatCity Email Working! 🎉</h2>'
    });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`\n🚀 ChatCity Backend on port ${PORT}`);
  console.log(`   Gmail: ${process.env.GMAIL_USER||'❌ not set'}`);
  console.log(`   FCM:   ${FCM_PRIVATE_KEY ? '✅ configured' : '❌ not set'}\n`);
});
