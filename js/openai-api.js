/**
 * openai-api.js — OpenAI API integration (gpt-4o-mini, JSON mode)
 * Makes direct fetch calls from the browser using BYOK.
 */

const OpenAIAPI = (() => {
  const MODEL = 'gpt-4o-mini';

  const SYSTEM_PROMPT = `You are a ruthless Risk Manager at a top-tier hedge fund. Your job is to evaluate a trader's setup before they execute it. You detect emotional biases (FOMO, revenge trading, overconfidence, anchoring) and assess technical soundness.

You MUST respond ONLY with a valid JSON object. No markdown, no prose outside JSON.

JSON structure:
{
  "score": <integer 0-100>,
  "grade": "<string: ABORTED|HIGH RISK|MODERATE RISK|ACCEPTABLE|CLEAN SETUP>",
  "verdict": "<2-3 sentence blunt assessment, max 80 words, in the language the trader used>",
  "dimensions": {
    "risk_management": <integer 0-100>,
    "emotional_control": <integer 0-100>,
    "technical_confluence": <integer 0-100>,
    "context_awareness": <integer 0-100>
  },
  "questions": [
    "<uncomfortable question 1, in same language as trader>",
    "<uncomfortable question 2, in same language as trader>",
    "<uncomfortable question 3, in same language as trader>"
  ],
  "biases_detected": ["<bias1>", "<bias2>"],
  "summary_line": "<max 10 words summarizing the setup for history log>"
}

Scoring criteria:
- 0-35: Emotional trade, stop immediately
- 36-59: High risk, serious flaws
- 60-74: Moderate, proceed with caution
- 75-89: Acceptable setup with caveats
- 90-100: Clean, disciplined setup

Risk:Reward below 1:2 MUST lower risk_management by at least 20 points.
FOMO language ("don't want to miss", "no quiero quedarme fuera", "está subiendo") MUST lower emotional_control below 50.
Revenge trading language ("recuperar", "recover", "get back") MUST lower emotional_control below 30.`;

  async function evaluate(traderText, rrRatio, apiKey) {
    let userContent = `TRADE SETUP TO EVALUATE:\n\n"${traderText}"`;
    if (rrRatio !== null) {
      userContent += `\n\nCalculated Risk:Reward Ratio: 1:${rrRatio.toFixed(2)}`;
      if (rrRatio < 2) {
        userContent += ' [WARNING: Below minimum acceptable 1:2 threshold]';
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        max_tokens: 700,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${response.status}`;
      throw new Error(categorizeError(response.status, msg));
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response from OpenAI.');

    try {
      return JSON.parse(raw);
    } catch {
      throw new Error('Invalid JSON response from model.');
    }
  }

  function categorizeError(status, msg) {
    if (status === 401) return 'Invalid API key. Verify your OpenAI key starts with sk-.';
    if (status === 429) return 'Rate limit reached. Wait a moment and try again.';
    if (status === 500) return 'OpenAI server error. Try again in a few seconds.';
    if (status === 413) return 'Request too large.';
    if (msg.toLowerCase().includes('insufficient_quota')) return 'Your OpenAI account has no credits. Add billing at platform.openai.com.';
    return `API error: ${msg}`;
  }

  return { evaluate };
})();
