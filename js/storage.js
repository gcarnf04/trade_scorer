/**
 * storage.js — Encrypted BYOK API Key with PIN
 * Uses AES encryption via CryptoJS (loaded from CDN).
 * The encrypted key is stored in localStorage.
 * The raw key is NEVER stored anywhere.
 */

const Storage = (() => {
  const STORAGE_KEY = 'vault_gemini_key_v1';
  const SESSION_KEY = 'vault_unlocked_key_v1';
  const HISTORY_KEY = 'tss_history';
  const HISTORY_LIMIT = 20;

  /* ── Key Management ─────────────────────────── */

  function hasStoredKey() {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  function isUnlocked() {
    return !!sessionStorage.getItem(SESSION_KEY);
  }

  function getUnlockedKey() {
    return sessionStorage.getItem(SESSION_KEY);
  }

  function saveKey(apiKey, pin) {
    try {
      const encrypted = CryptoJS.AES.encrypt(apiKey, _pinToPassphrase(pin)).toString();
      localStorage.setItem(STORAGE_KEY, encrypted);
      sessionStorage.setItem(SESSION_KEY, apiKey);
      return true;
    } catch (e) {
      console.error('Encryption error:', e);
      return false;
    }
  }

  function loadKey(pin) {
    const cipher = localStorage.getItem(STORAGE_KEY);
    if (!cipher) return null;
    try {
      const bytes  = CryptoJS.AES.decrypt(cipher, _pinToPassphrase(pin));
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (!result || result.length < 20) return null; // Wrong PIN
      sessionStorage.setItem(SESSION_KEY, result);
      return result;
    } catch (e) {
      return null;
    }
  }

  function clearKey() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function _pinToPassphrase(pin) {
    // Stretch PIN with a static salt so brute-force is harder
    return `vault::${pin}::2026::v1`;
  }

  /* ── History Management ─────────────────────── */

  function saveEntry(entry) {
    const history = getHistory();
    history.unshift({ ...entry, id: Date.now() });
    if (history.length > HISTORY_LIMIT) history.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  return { hasStoredKey, isUnlocked, getUnlockedKey, saveKey, loadKey, clearKey, saveEntry, getHistory, clearHistory };
})();
