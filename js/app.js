/**
 * app.js — Main orchestrator for Trade Setup Scorer
 */

/* ── Helpers ─────────────────────────────────── */
const $ = id => document.getElementById(id);
const show = el => el && (el.hidden = false);
const hide = el => el && (el.hidden = true);

/* ── State ───────────────────────────────────── */
const State = {
  apiKey: null,          // Raw key in memory (never persisted)
  isDemo: false,
  lastResult: null,
};

/* ── DOM refs ────────────────────────────────── */
const DOM = {
  // Sections
  heroSection:      $('heroSection'),
  setupSection:     $('setupSection'),
  loadingSection:   $('loadingSection'),
  resultsSection:   $('resultsSection'),
  historySection:   $('historySection'),
  historyGrid:      $('historyGrid'),
  historyEmpty:     $('historyEmpty'),

  // Key status bar
  keyStatusBar:     $('keyStatusBar'),
  keyStatusDot:     $('keyStatusDot'),
  keyStatusLabel:   $('keyStatusLabel'),
  btnChangeKey:     $('btnChangeKey'),
  btnClearKey:      $('btnClearKey'),

  // Setup form
  tradeText:        $('tradeText'),
  charCount:        $('charCount'),
  entryPrice:       $('entryPrice'),
  stopLoss:         $('stopLoss'),
  takeProfit:       $('takeProfit'),
  rrBadge:          $('rrBadge'),
  btnEvaluate:      $('btnEvaluate'),
  btnDemo:          $('btnDemo'),

  // Results
  gaugeScore:       $('gaugeScore'),
  gaugeFill:        $('gaugeFill'),
  scoreGrade:       $('scoreGrade'),
  verdictText:      $('verdictText'),
  demoRibbon:       $('demoRibbon'),
  dimRisk:          $('dimRisk'),    dimRiskBar:  $('dimRiskBar'),
  dimEmotion:       $('dimEmotion'), dimEmotionBar: $('dimEmotionBar'),
  dimTech:          $('dimTech'),    dimTechBar:  $('dimTechBar'),
  dimContext:       $('dimContext'), dimContextBar: $('dimContextBar'),
  questionsList:    $('questionsList'),
  btnCopyResult:    $('btnCopyResult'),
  btnNewAnalysis:   $('btnNewAnalysis'),

  // Modals & Ads
  setupModal:       $('setupModal'),
  loginModal:       $('loginModal'),
  interstitialAd:   $('interstitialAd'),
  adCountdown:      $('adCountdown'),
  btnSkipAd:        $('btnSkipAd'),
  modalApiKeyInput: $('modalApiKeyInput'),
  modalPinInputs:   null,
  loginPinInputs:   null,
  modalError:       $('modalError'),
  loginError:       $('loginError'),
  btnSaveKey:       $('btnSaveKey'),
  btnUnlock:        $('btnUnlock'),
  btnOpenSetup:     $('btnOpenSetup'),
};

/* ── Startup ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  DOM.modalPinInputs  = [...document.querySelectorAll('#setupModal .pin-input')];
  DOM.loginPinInputs  = [...document.querySelectorAll('#loginModal .pin-input')];

  initPinInputs(DOM.modalPinInputs);
  initPinInputs(DOM.loginPinInputs);
  bindEvents();
  updateKeyStatus();
  renderHistory();
});

/* ── API Key Status ──────────────────────────── */
function updateKeyStatus() {
  if (Storage.isUnlocked()) {
    State.apiKey = Storage.getUnlockedKey();
    DOM.keyStatusDot.className = 'status-dot active';
    DOM.keyStatusLabel.textContent = 'API Key loaded';
    show(DOM.keyStatusBar);
    DOM.btnEvaluate.disabled = !DOM.tradeText?.value?.trim();
  } else if (Storage.hasStoredKey()) {
    State.apiKey = null;
    DOM.keyStatusDot.className = 'status-dot';
    DOM.keyStatusLabel.textContent = 'Key saved — enter PIN to activate';
    show(DOM.keyStatusBar);
    DOM.btnEvaluate.disabled = true;
    openLoginModal();
  } else {
    State.apiKey = null;
    DOM.keyStatusDot.className = 'status-dot error';
    DOM.keyStatusLabel.textContent = 'No API Key';
    show(DOM.keyStatusBar);
    DOM.btnEvaluate.disabled = true;
  }
}

/* ── Event Bindings ──────────────────────────── */
function bindEvents() {
  // Textarea char count + RR
  DOM.tradeText?.addEventListener('input', () => {
    const len = DOM.tradeText.value.length;
    DOM.charCount.textContent = `${len}/2000`;
    DOM.btnEvaluate.disabled = !len || !State.apiKey;
  });

  // Numeric inputs → RR calc
  [DOM.entryPrice, DOM.stopLoss, DOM.takeProfit].forEach(el =>
    el?.addEventListener('input', recalcRR));

  // Buttons
  DOM.btnEvaluate?.addEventListener('click', runEvaluation);
  DOM.btnDemo?.addEventListener('click', runDemo);
  DOM.btnOpenSetup?.addEventListener('click', () => openSetupModal());
  DOM.btnChangeKey?.addEventListener('click', () => openSetupModal());
  DOM.btnClearKey?.addEventListener('click', clearKey);
  DOM.btnSaveKey?.addEventListener('click', saveKey);
  DOM.btnUnlock?.addEventListener('click', unlockKey);
  DOM.btnCopyResult?.addEventListener('click', copyResult);
  $('btnShareX')?.addEventListener('click', shareX);
  $('btnShareIG')?.addEventListener('click', shareInstagram);
  DOM.btnNewAnalysis?.addEventListener('click', resetToForm);

  // Modal close on backdrop click
  DOM.setupModal?.addEventListener('click', e => { if (e.target === DOM.setupModal) closeSetupModal(); });
  DOM.loginModal?.addEventListener('click', e => { if (e.target === DOM.loginModal) closeLoginModal(); });

  // Show API key toggle
  $('btnToggleApiKey')?.addEventListener('click', () => {
    const inp = DOM.modalApiKeyInput;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Re-check vault unlock explicitly if the user clicked the key status bar (optional)
  DOM.keyStatusBar?.addEventListener('click', () => {
    if (Storage.hasStoredKey() && !Storage.isUnlocked()) openLoginModal();
    else if (!Storage.hasStoredKey()) openSetupModal();
  });

  // History clear
  $('btnClearHistory')?.addEventListener('click', () => {
    if (confirm('Clear entire history?')) {
      Storage.clearHistory();
      renderHistory();
    }
  });
}

/* ── R:R Calculator ──────────────────────────── */
function recalcRR() {
  const entry = parseFloat(DOM.entryPrice?.value);
  const sl    = parseFloat(DOM.stopLoss?.value);
  const tp    = parseFloat(DOM.takeProfit?.value);

  if (!entry || !sl || !tp || isNaN(entry + sl + tp)) {
    DOM.rrBadge.textContent = 'R:R —';
    DOM.rrBadge.className   = 'rr-badge';
    return null;
  }

  const risk   = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk === 0) return null;

  const rr = reward / risk;
  DOM.rrBadge.textContent = `R:R 1:${rr.toFixed(2)}`;
  DOM.rrBadge.className   = `rr-badge ${rr >= 2 ? 'good' : rr >= 1 ? 'warn' : 'bad'}`;
  return rr;
}

/* ── Evaluation Flow ─────────────────────────── */
async function runEvaluation() {
  if (!State.apiKey) { openLoginModal(); return; }
  const text = DOM.tradeText.value.trim();
  if (!text) return;

  State.isDemo = false;
  const rr = recalcRR();

  showLoading('Auditing risk management...');

  try {
    const result = await GeminiAPI.evaluate(text, rr, State.apiKey);
    State.lastResult = { result, text, rr };

    Storage.saveEntry({
      score:   result.score,
      grade:   result.grade,
      trade:   text.substring(0, 80),
      summary: result.summary_line,
    });

    showInterstitial(result, false);
  } catch (err) {
    hideLoading();
    showError(err.message);
  }
}

/* ── Demo Mode ───────────────────────────────── */
function runDemo() {
  State.isDemo = true;
  showLoading('Loading example analysis...');

  setTimeout(() => {
    const demo = {
      score: 42,
      grade: 'HIGH RISK',
      verdict: 'You are going long because you "don\'t want to miss out". That\'s not an analysis, it\'s pure FOMO. There is no defined stop loss, the macro context is bearish, and your risk management is non-existent. The market owes you nothing.',
      dimensions: { risk_management: 18, emotional_control: 25, technical_confluence: 55, context_awareness: 48 },
      questions: [
        'Would you have taken this trade if you closed yesterday in profit, or are you just trying to recover losses?',
        'Where is your stop loss and what exact % of your account are you risking?',
        'Does this setup comply with your written trading rules, or are you improvising?',
      ],
      biases_detected: ['FOMO', 'No Stop Loss'],
      summary_line: 'TSLA long FOMO without stop $245',
    };
    showInterstitial(demo, true);
  }, 1200);
}

/* ── Render Results ──────────────────────────── */
function renderResults(result, isDemo) {
  hideLoading();
  hide(DOM.setupSection);
  hide(DOM.heroSection);
  show(DOM.resultsSection);

  // Demo ribbon
  isDemo ? show(DOM.demoRibbon) : hide(DOM.demoRibbon);

  // Score gauge animation
  animateGauge(result.score);

  // Grade
  const grade = result.grade || gradeFromScore(result.score);
  const cls   = result.score < 50 ? 'red' : result.score < 75 ? 'yellow' : 'green';
  DOM.scoreGrade.textContent = grade;
  DOM.scoreGrade.className   = `score-grade ${cls}`;

  // Verdict
  DOM.verdictText.textContent = result.verdict || '';

  // Dimensions
  const d = result.dimensions || {};
  setDimension(DOM.dimRisk,    DOM.dimRiskBar,    d.risk_management       ?? 50);
  setDimension(DOM.dimEmotion, DOM.dimEmotionBar, d.emotional_control     ?? 50);
  setDimension(DOM.dimTech,    DOM.dimTechBar,    d.technical_confluence  ?? 50);
  setDimension(DOM.dimContext, DOM.dimContextBar, d.context_awareness     ?? 50);

  // Questions
  const questions = result.questions || [];
  DOM.questionsList.innerHTML = questions.map((q, i) =>
    `<li><span class="q-num">${i + 1}</span>${q}</li>`
  ).join('');

  renderHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function gradeFromScore(s) {
  if (s < 36) return 'ABORTED';
  if (s < 50) return 'HIGH RISK';
  if (s < 75) return 'MODERATE RISK';
  if (s < 90) return 'ACCEPTABLE';
  return 'CLEAN SETUP';
}

function setDimension(labelEl, barEl, value) {
  labelEl.textContent = value;
  const cls = value < 50 ? 'red' : value < 75 ? 'yellow' : 'green';
  barEl.className = `bar-fill ${cls}`;
  barEl.style.width = '0';
  requestAnimationFrame(() => setTimeout(() => { barEl.style.width = `${value}%`; }, 50));
}

/* ── Gauge Animation ─────────────────────────── */
function animateGauge(score) {
  const fill   = DOM.gaugeFill;
  const label  = DOM.gaugeScore;
  const radius = 80;
  const circum = Math.PI * radius; // half-circle
  const pct    = score / 100;

  // Gauge stroke color
  const color = score < 50 ? '#ef4444' : score < 75 ? '#f59e0b' : '#22c55e';
  fill.style.stroke = color;
  DOM.scoreGrade.style.color = color;

  let current = 0;
  const step = score / 40;
  const interval = setInterval(() => {
    current = Math.min(current + step, score);
    label.textContent = Math.round(current);
    const offset = circum - (current / 100) * circum;
    fill.style.strokeDashoffset = offset;
    if (current >= score) clearInterval(interval);
  }, 20);
}

/* ── Copy Result ─────────────────────────────── */
function copyResult() {
  const r = State.lastResult?.result;
  if (!r) return;
  const text = [
    `🎯 Trade Setup Scorer — Result`,
    `Score: ${r.score}/100 (${r.grade})`,
    ``,
    `📋 Risk Manager's Verdict:`,
    r.verdict,
    ``,
    `🔴 Uncomfortable Questions:`,
    ...(r.questions || []).map((q, i) => `${i + 1}. ${q}`),
    ``,
    `🔗 Evaluate your next trade: https://gcarnf04.github.io/trade_scorer/`,
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    DOM.btnCopyResult.textContent = '✓ Copied';
    setTimeout(() => { DOM.btnCopyResult.textContent = '📋 Copy Analysis'; }, 2000);
  });
}

/* ── Share on X (Twitter) ────────────────── */
function shareX() {
  const r = State.lastResult?.result;
  if (!r) return;
  const text = [
    `🎯 My setup scored ${r.score}/100 on Trade Setup Scorer.`,
    r.score < 50 ? `The AI caught me doing ${(r.biases_detected||['emotional trading']).join(' and ')} 💀` : `Verdict: "${(r.verdict||'').slice(0,80)}..."`,
    `What's your score? 👇`,
    `https://gcarnf04.github.io/trade_scorer/`,
  ].join('\n');
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,width=580,height=400');
}

/* ── Copy for Instagram ────────────────── */
function shareInstagram() {
  const r = State.lastResult?.result;
  if (!r) return;
  const text = [
    `🎯 TRADE SETUP SCORER`,
    `Score: ${r.score}/100 — ${r.grade}`,
    `▬`.repeat(Math.round(r.score / 10)) + `□`.repeat(10 - Math.round(r.score / 10)),
    ``,
    `🔴 Verdict:`,
    `"${r.verdict || ''}"`,
    ``,
    `❓ ${(r.questions || []).slice(0, 2).join('\n❓ ')}`,
    ``,
    `Evaluate your next trade → gcarnf04.github.io/trade_scorer`,
    `#Trading #RiskManagement #TradingPsychology #FOMO #Forex #Stocks`,
  ].join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('btnShareIG');
    const prev = btn.innerHTML;
    btn.textContent = '✓ Copied! Open Instagram and paste';
    setTimeout(() => { btn.innerHTML = prev; }, 3000);
  });
}

/* ── Reset to Form ───────────────────────────── */
function resetToForm() {
  hide(DOM.resultsSection);
  show(DOM.heroSection);
  show(DOM.setupSection);
  DOM.tradeText.value = '';
  DOM.charCount.textContent = '0/2000';
  DOM.entryPrice.value = '';
  DOM.stopLoss.value = '';
  DOM.takeProfit.value = '';
  DOM.rrBadge.textContent = 'R:R —';
  DOM.rrBadge.className = 'rr-badge';
  DOM.btnEvaluate.disabled = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Loading States ──────────────────────────── */
function showLoading(msg) {
  hide(DOM.setupSection);
  hide(DOM.heroSection);
  hide(DOM.resultsSection);
  show(DOM.loadingSection);
  $('loadingStatus').textContent = msg || 'Analyzing...';
  const sub = $('loadingSub');
  const msgs = [
    'Detecting emotional biases...',
    'Evaluating risk management...',
    'Calculating discipline ratio...',
    'Preparing verdict...',
  ];
  let i = 0;
  sub._interval = setInterval(() => { sub.textContent = msgs[i++ % msgs.length]; }, 1400);
}

function hideLoading() {
  const sub = $('loadingSub');
  if (sub._interval) clearInterval(sub._interval);
  hide(DOM.loadingSection);
}

/* ── Interstitial Ad ─────────────────────────── */
function showInterstitial(result, isDemo) {
  hideLoading();
  hide(DOM.setupSection);
  hide(DOM.heroSection);
  show(DOM.interstitialAd);

  let timeLeft = 5;
  DOM.adCountdown.textContent = `0${timeLeft}`;
  DOM.btnSkipAd.textContent = 'Wait...';
  DOM.btnSkipAd.disabled = true;

  const interval = setInterval(() => {
    timeLeft--;
    DOM.adCountdown.textContent = `0${timeLeft}`;
    if (timeLeft <= 0) {
      clearInterval(interval);
      DOM.btnSkipAd.disabled = false;
      DOM.btnSkipAd.textContent = 'Continue to analysis →';
    }
  }, 1000);

  DOM.btnSkipAd.onclick = () => {
    if (timeLeft > 0) return;
    clearInterval(interval);
    hide(DOM.interstitialAd);
    renderResults(result, isDemo);
  };
}

/* ── Error Toast ─────────────────────────────── */
function showError(msg) {
  const toast = $('errorToast');
  if (!toast) return;
  toast.textContent = `⚠ ${msg}`;
  toast.hidden = false;
  toast.style.animation = 'slideUp .2s ease';
  setTimeout(() => { toast.hidden = true; show(DOM.setupSection); show(DOM.heroSection); }, 5000);
}

/* ── Modal: Setup API Key ────────────────────── */
function openSetupModal() {
  DOM.setupModal.hidden = false;
  DOM.modalApiKeyInput.value = '';
  DOM.modalError.textContent = '';
  DOM.modalPinInputs.forEach(p => p.value = '');
  setTimeout(() => DOM.modalApiKeyInput.focus(), 50);
}

function closeSetupModal() { DOM.setupModal.hidden = true; }

function saveKey() {
  const key = DOM.modalApiKeyInput.value.trim();
  const pin = DOM.modalPinInputs.map(p => p.value).join('');

  if (!key.startsWith('AIza') || key.length < 30) {
    DOM.modalError.textContent = 'Key must start with AIza (Gemini API Key)'; return;
  }
  if (pin.length !== 4) {
    DOM.modalError.textContent = 'Enter a 4-digit PIN'; return;
  }

  if (!Storage.saveKey(key, pin)) {
    DOM.modalError.textContent = 'Error encrypting the key'; return;
  }

  State.apiKey = key;
  closeSetupModal();
  updateKeyStatus();
  DOM.btnEvaluate.disabled = !DOM.tradeText?.value?.trim();
}

/* ── Modal: Login (PIN) ──────────────────────── */
function openLoginModal() {
  DOM.loginModal.hidden = false;
  DOM.loginError.textContent = '';
  DOM.loginPinInputs.forEach(p => p.value = '');
  setTimeout(() => DOM.loginPinInputs[0]?.focus(), 50);
}

function closeLoginModal() { DOM.loginModal.hidden = true; }

function unlockKey() {
  const pin = DOM.loginPinInputs.map(p => p.value).join('');
  if (pin.length !== 4) { DOM.loginError.textContent = 'Incomplete PIN'; return; }

  const key = Storage.loadKey(pin);
  if (!key) { DOM.loginError.textContent = 'Incorrect PIN'; return; }

  State.apiKey = key;
  closeLoginModal();
  updateKeyStatus();
  DOM.btnEvaluate.disabled = !DOM.tradeText?.value?.trim();
}

function clearKey() {
  if (!confirm('Delete saved key? You will need to enter it again.')) return;
  Storage.clearKey();
  State.apiKey = null;
  updateKeyStatus();
}

/* ── PIN Input UX ────────────────────────────── */
function initPinInputs(inputs) {
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
    });
  });
}

/* ── History ─────────────────────────────────── */
function renderHistory() {
  History.render(DOM.historyGrid, DOM.historyEmpty);
}
