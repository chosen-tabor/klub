import { CONFIG } from './config.js';

export const API = {
  // 1. Ověření PINu přes GET požadavek (?action=auth&pin=...)
  async verifyCredentials(pin) {
    if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.includes("VASE_SCRIPT_ID")) {
      return { success: true, role: pin === '1378' ? 'admin' : 'team', demo: true };
    }

    try {
      const url = `${CONFIG.SCRIPT_URL}?action=auth&pin=${encodeURIComponent(pin)}`;
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      });
      const res = await response.json();
      return { 
        success: res.success === true, 
        role: res.role || 'team', 
        message: res.message || 'Nesprávný PIN.' 
      };
    } catch (err) {
      console.error('API Error verify:', err);
      return { success: false, message: 'Chyba připojení k serveru' };
    }
  },

  // 2. Načtení všech dat ze sloupců Google Tabulky
  async fetchAttendance() {
    if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.includes("VASE_SCRIPT_ID")) {
      return { success: false, demo: true };
    }

    try {
      const response = await fetch(CONFIG.SCRIPT_URL, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      });
      const res = await response.json();
      return { success: res.status === 'ok', data: res.data || [] };
    } catch (err) {
      console.error('API Error fetch:', err);
      return { success: false, error: err };
    }
  },

  // 3. Uložení změn (účast, úkoly, otázky, nápady, modlitby, texty dílu)
  async updateAttendance(payload) {
    if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.includes("VASE_SCRIPT_ID")) {
      return { status: 'ok', demo: true };
    }

    try {
      const response = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (err) {
      console.error('API Error post:', err);
      return { status: 'error', message: 'Chyba připojení' };
    }
  }
};