// backend/news-analysis.js
// Fully fixed & robust Groq analysis router with history endpoints
require('dotenv').config();

let fetch = global.fetch;
try { if (!fetch) fetch = require('node-fetch'); } catch (e) {}

const express = require('express');
const router = express.Router();
const { db } = require('./database'); // expects database.js to export { db, ... }
const jwt = require('jsonwebtoken');

const GROQ_KEY = process.env.GROQ_KEY || process.env.GROQ_API_KEY || process.env.AI_API_KEY || '';
const GROQ_URL = process.env.GROQ_URL || process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const JWT_SECRET = process.env.JWT_SECRET || 'coredex_secret_key_2024_enhanced';

console.log('✅ news-analysis router loaded. GROQ model=', GROQ_MODEL);

// ---------------------- helpers ----------------------
function parseUser(req) {
  try {
    const auth = req.headers.authorization || req.query.token;
    if (!auth) return null;
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    const payload = jwt.verify(token, JWT_SECRET);
    return payload; // payload shape depends on your auth implementation
  } catch (e) {
    return null;
  }
}

/**
 * Normalize model output into { verdict, score, confidence, summary, reasons }
 */
function parseModelOutput(text) {
  if (!text) {
    return {
      verdict: 'uncertain',
      score: 50,
      confidence: 'Medium',
      summary: '',
      reasons: []
    };
  }

  const raw = String(text).trim();

  // 1) Try to find JSON blob
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const candidate = jsonMatch[0];
    try {
      const parsed = JSON.parse(candidate);

      const verdict = (parsed.verdict || parsed.result || 'uncertain').toString();
      let score = 50;
      if (typeof parsed.score === 'number') score = Math.round(parsed.score);
      else if (typeof parsed.confidence === 'string') {
        const num = parsed.confidence.match(/([0-9]{1,3})/);
        if (num) score = Math.round(Number(num[1]));
      }

      const confidence = parsed.confidence || (score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low');
      const summary = parsed.summary || parsed.explanation || parsed.message || '';
      const reasons = Array.isArray(parsed.reasons) ? parsed.reasons : (parsed.reasons ? [parsed.reasons] : []);

      return { verdict: verdict.toLowerCase(), score: Math.max(0, Math.min(100, score)), confidence, summary, reasons };
    } catch (e) {
      // fall through to heuristics
      console.warn('parseModelOutput: JSON parse failed, falling back to heuristics');
    }
  }

  // 2) Try simple "key: value" extraction
  const joined = raw.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean).join(' | ');

  const verdictMatch = joined.match(/verdict\s*[:=]\s*("?)([a-zA-Z0-9 _-]+)\1/i);
  const confidenceNumMatch = joined.match(/confidence\s*[:=]\s*("?)([0-9]{1,3})\s*%?\1/i);
  const confidenceWordMatch = joined.match(/confidence\s*[:=]\s*("?)(high|medium|low)\1/i);
  const explanationMatch = joined.match(/(?:explanation|summary|analysis)\s*[:=]\s*(.+)$/i);

  let verdict = verdictMatch ? verdictMatch[2].trim().toLowerCase() : null;
  let score = null;
  let confidence = null;
  let summary = null;

  if (confidenceNumMatch) {
    score = Number(confidenceNumMatch[2]);
    confidence = `${score}%`;
  } else if (confidenceWordMatch) {
    confidence = confidenceWordMatch[2];
  }

  if (explanationMatch) summary = explanationMatch[1].trim();

  // If we got some useful fields, return normalized
  if (verdict || score !== null || confidence || summary) {
    verdict = verdict || 'uncertain';
    score = score ?? (confidence && typeof confidence === 'string' && confidence.match(/(\d+)/) ? Number(confidence.match(/(\d+)/)[1]) : 50);
    confidence = confidence || (score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low');
    summary = summary || raw;

    // try to extract reasons
    const reasonSection = raw.match(/(?:reasons|evidence|because|why)[:\-\s]*([\s\S]*)/i);
    let reasons = [];
    if (reasonSection) {
      reasons = reasonSection[1].split(/[\r\n;•\-–]+/).map(p => p.trim()).filter(Boolean).slice(0, 10);
    }

    return { verdict, score: Math.max(0, Math.min(100, Number(Math.round(score)))), confidence, summary, reasons };
  }

  // 3) Final fallback - return whole text as summary
  return {
    verdict: 'uncertain',
    score: 50,
    confidence: 'Medium',
    summary: raw,
    reasons: []
  };
}

/**
 * Save analysis into analysis_history - only for authenticated users
 * Fields used: user_id, content, analysis_data (JSON text), credibility_score, result
 */
function saveAnalysisToDb(userId, content, analysisObj) {
  // Only save if user is authenticated
  if (!userId) {
    console.log('⚠️ Skipping analysis save - user not authenticated');
    return;
  }

  try {
    const analysisDataStr = JSON.stringify(analysisObj);
    const credibility_score = Number(analysisObj.score ?? 0) || 0;
    const result = (analysisObj.verdict || analysisObj.result || 'uncertain').toString();

    db.run(
      `INSERT INTO analysis_history (user_id, content, analysis_data, credibility_score, result)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, content, analysisDataStr, credibility_score, result],
      function (err) {
        if (err) {
          console.error('❌ DB save error:', err.message);
        } else {
          console.log('✅ analysis saved id=', this.lastID, 'for user=', userId);
        }
      }
    );
  } catch (e) {
    console.error('❌ saveAnalysisToDb error:', e);
  }
}

/**
 * Call Groq API robustly and return { ok, text, raw }.
 */
async function callGroq(content) {
  if (!GROQ_KEY || !GROQ_URL) {
    console.warn('callGroq: missing GROQ config');
    return { ok: false, error: 'Missing GROQ config' };
  }

  const payload = {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: 'You are a meticulous fact-checker. Prefer returning a JSON object with fields: verdict, score, confidence, summary, reasons (array). If returning non-JSON, produce a concise analysis paragraph.' },
      { role: 'user', content }
    ],
    temperature: 0.12,
    max_tokens: 900
  };

  try {
    console.log('======================');
    console.log('CALLING GROQ:', GROQ_URL, 'model=', GROQ_MODEL);
    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = null; }

    console.log('RAW GROQ RESPONSE:', parsed ?? text);

    if (!resp.ok) {
      return { ok: false, status: resp.status, body: parsed ?? text };
    }

    // try common shapes
    if (parsed) {
      if (parsed.choices && Array.isArray(parsed.choices) && parsed.choices[0]) {
        const modelMsg = parsed.choices[0].message?.content ?? parsed.choices[0].text ?? '';
        return { ok: true, text: modelMsg, raw: parsed };
      }
      if (parsed.outputs && Array.isArray(parsed.outputs) && parsed.outputs[0]) {
        const o = parsed.outputs[0];
        const s = typeof o === 'string' ? o : (o.content ?? JSON.stringify(o));
        return { ok: true, text: s, raw: parsed };
      }
      // fallback stringify
      return { ok: true, text: JSON.stringify(parsed), raw: parsed };
    }

    // plain text response
    return { ok: true, text, raw: text };
  } catch (err) {
    console.error('ERROR calling GROQ:', err);
    return { ok: false, error: err.message || String(err) };
  }
}

// ---------------------- ROUTES ----------------------

// POST /api/news/analyze
router.post('/analyze', async (req, res) => {
  try {
    console.log('✅ /api/news/analyze HIT');

    const content = (req.body && req.body.content) ? String(req.body.content).trim() : '';
    if (!content) return res.status(400).json({ success: false, error: 'Content required' });

    const user = parseUser(req);
    const userId = user ? (user.userId || user.id || null) : null;

    const groqResp = await callGroq(content);

    if (!groqResp.ok) {
      console.warn('⚠️ GROQ failed:', groqResp);
      const fallback = {
        verdict: 'uncertain',
        score: 55,
        confidence: 'Medium',
        summary: 'Fallback analysis used because the AI API failed or returned an error.',
        reasons: []
      };
      saveAnalysisToDb(userId, content, fallback);
      return res.json({ success: true, source: 'fallback', analysis: fallback });
    }

    // groqResp.text is the model message (string)
    const modelText = groqResp.text ?? '';

    // Normalize
    const analysis = parseModelOutput(modelText);

    // Attach raw model object for debug
    analysis._raw_model = groqResp.raw ?? modelText;

    // Save
    saveAnalysisToDb(userId, content, analysis);

    // Return normalized object
    return res.json({ success: true, source: 'groq', analysis });
  } catch (err) {
    console.error('Unexpected /analyze error:', err);
    const fallback = { verdict: 'uncertain', score: 50, confidence: 'Medium', summary: 'Server error fallback', reasons: [] };
    try { saveAnalysisToDb(null, req.body?.content || '', fallback); } catch (e) {}
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/news/history  - returns recent history (if user present, returns user-specific; otherwise returns global)
router.get('/history', (req, res) => {
  try {
    const user = parseUser(req);
    const limit = parseInt(req.query.limit) || (user ? 500 : 200); // Support limit query parameter
    const safeLimit = Math.min(Math.max(limit, 1), 1000); // Clamp between 1 and 1000

    if (user && (user.userId || user.id)) {
      const uid = user.userId || user.id;
      db.all('SELECT id, user_id, content, analysis_data, credibility_score, result, created_at FROM analysis_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [uid, safeLimit], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: 'DB error' });
        return res.json({ success: true, history: rows });
      });
    } else {
      // public/global: last entries with limit
      db.all('SELECT id, user_id, content, analysis_data, credibility_score, result, created_at FROM analysis_history ORDER BY created_at DESC LIMIT ?', [safeLimit], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: 'DB error' });
        return res.json({ success: true, history: rows });
      });
    }
  } catch (e) {
    console.error('/history error', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/news/history/:id
router.get('/history/:id', (req, res) => {
  try {
    const id = Number(req.params.id) || 0;
    db.get('SELECT id, user_id, content, analysis_data, credibility_score, result, created_at FROM analysis_history WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ success: false, error: 'DB error' });
      if (!row) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, item: row });
    });
  } catch (e) {
    console.error('/history/:id error', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/news/history/:id  (requires authentication)
router.delete('/history/:id', (req, res) => {
  try {
    const user = parseUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });

    const uid = user.userId || user.id;
    const id = Number(req.params.id) || 0;

    db.run('DELETE FROM analysis_history WHERE id = ? AND (user_id = ? OR ? IS NULL)', [id, uid, uid], function (err) {
      if (err) return res.status(500).json({ success: false, error: 'DB error' });
      if (this.changes === 0) return res.status(404).json({ success: false, error: 'Not found or not permitted' });
      return res.json({ success: true });
    });
  } catch (e) {
    console.error('DELETE history error', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * Save chat message to database
 */
function saveChatToDb(userId, sessionId, userMessage, aiResponse) {
  try {
    db.run(
      `INSERT INTO chat_history (user_id, session_id, user_message, ai_response)
       VALUES (?, ?, ?, ?)`,
      [userId, sessionId, userMessage, aiResponse],
      function (err) {
        if (err) {
          console.error('❌ DB chat save error:', err.message);
        } else {
          console.log('✅ chat saved id=', this.lastID, 'session=', sessionId);
        }
      }
    );
  } catch (e) {
    console.error('❌ saveChatToDb error:', e);
  }
}

// POST /api/news/chat
router.post('/chat', async (req, res) => {
  try {
    console.log('✅ /api/news/chat HIT');

    const message = (req.body && req.body.message) ? String(req.body.message).trim() : '';
    if (!message) return res.status(400).json({ success: false, error: 'Message required' });

    const user = parseUser(req);
    const userId = user ? (user.userId || user.id || null) : null;

    // Create a chat prompt for the AI
    const chatPrompt = `You are COREDEX AI, an expert in news analysis and fact-checking. Respond helpfully to this user query about news, fake news detection, or related topics: "${message}"

Please provide a concise, informative response. If the query is about analyzing specific news content, suggest using the analysis tool. Keep responses under 300 words.`;

    const groqResp = await callGroq(chatPrompt);

    if (!groqResp.ok) {
      console.warn('⚠️ GROQ chat failed:', groqResp);
      return res.json({
        success: false,
        error: 'Chat service temporarily unavailable',
        response: 'Sorry, I\'m having trouble connecting right now. Please try again later.'
      });
    }

    const chatResponse = groqResp.text ?? 'I apologize, but I couldn\'t generate a response.';

    // Save chat to database
    const sessionId = req.body.session_id || null;
    saveChatToDb(userId, sessionId, message, chatResponse);

    return res.json({
      success: true,
      response: chatResponse,
      source: 'groq'
    });

  } catch (err) {
    console.error('Unexpected /chat error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      response: 'Sorry, there was an error processing your message.'
    });
  }
});

// GET /api/news/chat/history
router.get('/chat/history', (req, res) => {
  try {
    const user = parseUser(req);
    if (user && (user.userId || user.id)) {
      const uid = user.userId || user.id;
      // Group by session_id and get latest message per session
      db.all(`
        SELECT session_id, user_message, ai_response, created_at,
               ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) as rn
        FROM chat_history
        WHERE user_id = ?
        ORDER BY created_at DESC
      `, [uid], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: 'DB error' });

        // Group messages by session
        const sessions = {};
        rows.forEach(row => {
          if (!sessions[row.session_id]) {
            sessions[row.session_id] = {
              session_id: row.session_id,
              messages: [],
              created_at: row.created_at
            };
          }
          sessions[row.session_id].messages.push({
            sender: 'user',
            message: row.user_message,
            timestamp: row.created_at
          });
          sessions[row.session_id].messages.push({
            sender: 'bot',
            message: row.ai_response,
            timestamp: row.created_at
          });
        });

        const history = Object.values(sessions).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return res.json({ success: true, history });
      });
    } else {
      // public/global: last 50 entries (simplified)
      db.all('SELECT id, user_message, ai_response, created_at FROM chat_history ORDER BY created_at DESC LIMIT 50', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: 'DB error' });
        return res.json({ success: true, history: rows });
      });
    }
  } catch (e) {
    console.error('/chat/history error', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/news/chat/history/:sessionId
router.get('/chat/history/:sessionId', (req, res) => {
  try {
    const user = parseUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });

    const uid = user.userId || user.id;
    const sessionId = req.params.sessionId;

    db.all('SELECT user_message, ai_response, created_at FROM chat_history WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC', [uid, sessionId], (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: 'DB error' });

      // Format messages
      const messages = [];
      rows.forEach(row => {
        messages.push({
          sender: 'user',
          message: row.user_message,
          timestamp: row.created_at
        });
        messages.push({
          sender: 'bot',
          message: row.ai_response,
          timestamp: row.created_at
        });
      });

      return res.json({ success: true, messages });
    });
  } catch (e) {
    console.error('/chat/history/:sessionId error', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/news/chat/history/:sessionId (delete specific session)
router.delete('/chat/history/:sessionId', (req, res) => {
  try {
    const user = parseUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });

    const uid = user.userId || user.id;
    const sessionId = req.params.sessionId;

    db.run('DELETE FROM chat_history WHERE user_id = ? AND session_id = ?', [uid, sessionId], function (err) {
      if (err) return res.status(500).json({ success: false, error: 'DB error' });
      return res.json({ success: true, deleted: this.changes });
    });
  } catch (e) {
    console.error('DELETE chat/history/:sessionId error', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/news/chat/history (clear all user's chat history)
router.delete('/chat/history', (req, res) => {
  try {
    const user = parseUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });

    const uid = user.userId || user.id;
    db.run('DELETE FROM chat_history WHERE user_id = ?', [uid], function (err) {
      if (err) return res.status(500).json({ success: false, error: 'DB error' });
      return res.json({ success: true, deleted: this.changes });
    });
  } catch (e) {
    console.error('DELETE chat/history error', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
