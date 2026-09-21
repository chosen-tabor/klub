import { CONFIG } from './config.js';

export const API = {
  async verifyCredentials(pin) {
    if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.includes("VASE_SCRIPT_ID")) {
      return { success: true, role: pin === '9999' ? 'admin' : 'team', demo: true };
    }

    try {
      const response = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'verify', pin: pin })
      });
      const res = await response.json();
      return { success: res.status === 'ok', role: res.role || 'team', message: res.message };
    } catch (err) {
      console.error('API Error verify:', err);
      return { success: false, message: 'Chyba připojení k serveru' };
    }
  },

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
      return { success: res.status === 'ok', data: res.data || {} };
    } catch (err) {
      console.error('API Error fetch:', err);
      return { success: false, error: err };
    }
  },

  async updateAttendance(payload) {
    // payload: { date, pin, attendees, info, questions, summary, idea }
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