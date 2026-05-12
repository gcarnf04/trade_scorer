/**
 * gemini-api.js — Gemini API integration (gemini-2.5-flash-lite)
 * Direct browser fetch to Google Generative Language API.
 * Supports CORS from the browser — no server needed.
 */

const GeminiAPI = (() => {
  const MODEL = 'gemini-2.5-flash-lite';
  const BASE   = 'https://generativelanguage.googleapis.com/v1beta/models';

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
    if (rrRatio !== null && rrRatio !== undefined) {
      userContent += `\n\nCalculated Risk:Reward Ratio: 1:${rrRatio.toFixed(2)}`;
      if (rrRatio < 2) {
        userContent += ' [WARNING: Below minimum acceptable 1:2 threshold]';
      }
    }

    const url = `${BASE}/${MODEL}:generateContent?key=${apiKey}`;

    const body = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${response.status}`;
      throw new Error(categorizeError(response.status, msg));
    }

    const data = await response.json();
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!raw) throw new Error('Respuesta vacía de Gemini. Comprueba tu API Key.');

    try {
      return JSON.parse(raw);
    } catch {
      // Try to extract JSON from the text if Gemini added prose
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('La respuesta de Gemini no tiene formato JSON válido.');
    }
  }

  function categorizeError(status, msg) {
    if (status === 400) return 'Clave de API inválida o solicitud incorrecta. Verifica tu Gemini API Key.';
    if (status === 403) return 'Acceso denegado. Verifica que tu API Key de Gemini tiene permisos.';
    if (status === 429) return 'Límite de peticiones alcanzado. Espera un momento e inténtalo de nuevo.';
    if (status === 500) return 'Error del servidor de Google. Inténtalo en unos segundos.';
    if (msg.toLowerCase().includes('quota')) return 'Cuota de la API agotada. Revisa tu cuenta en aistudio.google.com.';
    return `Error de API: ${msg}`;
  }

  return { evaluate };
})();
