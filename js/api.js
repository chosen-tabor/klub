import { CONFIG } from './config.js';

export const API = {
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

  async updateAttendance(dateKey, attendeesList, infoText, pin) {
    if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.includes("VASE_SCRIPT_ID")) {
      return { success: true, demo: true };
    }

    try {
      const response = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          pin: pin,
          date: dateKey,
          attendees: attendeesList,
          info: infoText || ''
        })
      });
      const res = await response.json();
      return res;
    } catch (err) {
      console.error('API Error post:', err);
      return { status: 'error', message: 'Chyba připojení' };
    }
  }
};