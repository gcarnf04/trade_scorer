/**
 * gemini-api.js — Gemini API integration (gemini-2.5-flash-lite)
 * Direct browser fetch to Google Generative Language API.
 * Supports CORS from the browser — no server needed.
 */

const GeminiAPI = (() => {
  const MODEL = 'gemini-2.5-flash-lite';
  const BASE   = 'https://generativelanguage.googleapis.com/v1beta/models';

  function getSystemPrompt(lang) {
    const isEs = lang === 'es';
    const langRule = isEs
      ? 'RESPOND ENTIRELY IN SPANISH (en Español). Your verdict, uncomfortable questions, and summary_line must be written entirely in Spanish.'
      : 'RESPOND ENTIRELY IN ENGLISH. Your verdict, uncomfortable questions, and summary_line must be written entirely in English.';

    return `You are a ruthless Risk Manager at a top-tier hedge fund. Your job is to evaluate a trader's setup before they execute it. You detect emotional biases (FOMO, revenge trading, overconfidence, anchoring) and assess technical soundness.

You MUST respond ONLY with a valid JSON object. No markdown, no prose outside JSON.

JSON structure:
{
  "score": <integer 0-100>,
  "grade": "<string: ABORTED|HIGH RISK|MODERATE RISK|ACCEPTABLE|CLEAN SETUP>",
  "verdict": "<2-3 sentence blunt assessment, max 80 words, in the specified language>",
  "dimensions": {
    "risk_management": <integer 0-100>,
    "emotional_control": <integer 0-100>,
    "technical_confluence": <integer 0-100>,
    "context_awareness": <integer 0-100>
  },
  "questions": [
    "<uncomfortable question 1, in specified language>",
    "<uncomfortable question 2, in specified language>",
    "<uncomfortable question 3, in specified language>"
  ],
  "biases_detected": ["<bias1>", "<bias2>"],
  "summary_line": "<max 10 words summarizing the setup for history log, in specified language>"
}

Scoring criteria:
- 0-35: Emotional trade, stop immediately
- 36-59: High risk, serious flaws
- 60-74: Moderate, proceed with caution
- 75-89: Acceptable setup with caveats
- 90-100: Clean, disciplined setup

Risk:Reward below 1:2 MUST lower risk_management by at least 20 points.
FOMO language ("don't want to miss", "no quiero quedarme fuera", "está subiendo") MUST lower emotional_control below 50.
Revenge trading language ("recuperar", "recover", "get back") MUST lower emotional_control below 30.
${langRule}`;
  }  async function evaluate(traderText, rrRatio, apiKey) {
    let userContent = `TRADE SETUP TO EVALUATE:\n\n"${traderText}"`;
    if (rrRatio !== null && rrRatio !== undefined) {
      userContent += `\n\nCalculated Risk:Reward Ratio: 1:${rrRatio.toFixed(2)}`;
      if (rrRatio < 2) {
        userContent += ' [WARNING: Below minimum acceptable 1:2 threshold]';
      }
    }

    const currentLang = typeof Lang !== 'undefined' ? Lang.get() : 'en';

    const body = {
      system_instruction: {
        parts: [{ text: getSystemPrompt(currentLang) }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4,
        maxOutputTokens: 800,
      },
    };

    const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3-flash', 'gemini-3.1-flash-lite'];
    let lastError = null;

    for (const modelName of models) {
      try {
        const url = `${BASE}/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const msg = err?.error?.message || `HTTP ${response.status}`;
          lastError = new Error(categorizeError(response.status, msg));
          if (response.status === 429) {
            console.warn(`[Quota Exhausted] ${modelName} returned 429. Falling back...`);
            continue;
          }
          throw lastError;
        }

        const data = await response.json();
        const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!raw) throw new Error('Empty response from Gemini. Check your API Key.');

        try {
          return JSON.parse(raw);
        } catch {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) return JSON.parse(match[0]);
          throw new Error('Gemini response is not valid JSON.');
        }

      } catch (err) {
        lastError = err;
        if (err.status === 429 || (err.message && err.message.includes('429')) || (err.message && err.message.toLowerCase().includes('quota'))) {
          continue; // Try next model
        }
        throw err;
      }
    }
    throw lastError || new Error("All fallback models exhausted due to rate limit/quota.");
  }
  function categorizeError(status, msg) {
    if (status === 400) return 'Invalid API Key or bad request. Verify your Gemini API Key.';
    if (status === 403) return 'Access denied. Verify that your Gemini API Key has permissions.';
    if (status === 429) return 'Rate limit reached. Wait a moment and try again.';
    if (status === 500) return 'Google server error. Try again in a few seconds.';
    if (msg.toLowerCase().includes('quota')) return 'API quota exceeded. Check your account at aistudio.google.com.';
    return `API Error: ${msg}`;
  }

  return { evaluate };
})();
