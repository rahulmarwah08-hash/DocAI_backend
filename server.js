// backend/server.js
// ─────────────────────────────────────────────────
// Doc AI — Backend Proxy Server
// Keeps your OpenAI API key safe on the server side.
// Deploy this to Railway, Render, or any Node host.
// ─────────────────────────────────────────────────

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CONFIG ───
// Set this in your hosting dashboard as an environment variable:
//   OPENAI_API_KEY=sk-proj-xxxxxxxxx
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const MAX_TOKENS = 400;

if (!OPENAI_API_KEY) {
  console.error('⚠️  OPENAI_API_KEY environment variable is required!');
  console.error('   Set it in your hosting dashboard (Railway/Render).');
  process.exit(1);
}

// ─── MIDDLEWARE ───
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow image uploads

// Rate limiting: 60 requests per minute per IP (prevents abuse)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please slow down.' },
});
app.use('/api/', limiter);

// ─── HEALTH CHECK ───
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Doc AI Backend', version: '1.0.0' });
});

// ─── CHAT ENDPOINT ───
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system, isPremium } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Free user guard — prevent detailed analysis
    const freeGuard = isPremium
      ? ''
      : `\n\nIMPORTANT: This user is on the FREE plan. You CAN describe images generally (e.g. 'that looks like a salad'). But do NOT provide detailed nutritional analysis (no calorie counts, macros, diet plans from photos) and do NOT analyze medical reports, lab results, prescriptions, or X-rays in detail. Instead, briefly acknowledge what you see and mention 'For detailed analysis, check out Doc AI Pro!' Keep it friendly.`;

    const systemMessage = (system || 'You are Doc AI, a friendly health companion.') + freeGuard;

    // Build OpenAI request
    const openaiMessages = [
      { role: 'system', content: systemMessage },
      ...messages,
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: MAX_TOKENS,
        messages: openaiMessages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('OpenAI error:', data.error);
      return res.status(500).json({ error: data.error.message || 'AI service error' });
    }

    const aiText = data.choices?.[0]?.message?.content || 'Sorry, no response.';
    res.json({ content: aiText });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── RECEIPT VALIDATION (for Google Play purchases) ───
// This verifies that a Pro subscription purchase is real
app.post('/api/verify-purchase', async (req, res) => {
  try {
    const { purchaseToken, productId, platform } = req.body;

    // TODO: For production, integrate with:
    // - Google Play: Use google-auth-library + androidpublisher API
    // - Apple: Use App Store Server API
    //
    // For now, we trust the client (acceptable for MVP/launch).
    // Add server-side verification before scaling.

    console.log(`Purchase verification: ${platform} — ${productId}`);
    res.json({ valid: true, productId });

  } catch (err) {
    console.error('Purchase verification error:', err);
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🩺 Doc AI backend running on port ${PORT}`);
});
