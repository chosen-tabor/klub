import { CONFIG } from './config.js';

export const API = {
  /**
   * Ověření PINu vůči Google Apps Scriptu.
   * V souboru api.js žádný PIN není uveden; ověření provádí výhradně backend.
   */
  async verifyCredentials(pin) {
    if (!pin) {
      return { success: false, message: 'Zadejte prosím PIN.' };
    }

    try {
      const url = `${CONFIG.SCRIPT_URL}?action=auth&pin=${encodeURIComponent(pin.trim())}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP chyba ${response.status}`);
      }

      const result = await response.json();
      return result; // Očekává { success: true, role: 'team' | 'admin' } nebo { success: false, message: '...' }
    } catch (err) {
      console.error('Chyba při ověřování PINu:', err);
      return { 
        success: false, 
        message: 'Nelze ověřit PIN. Zkontrolujte připojení k internetu.' 
      };
    }
  },

  /**
   * Načtení aktuálních dat všech setkání z Google Tabulky.
   */
  async fetchAttendance() {
    try {
      const response = await fetch(CONFIG.SCRIPT_URL);
      if (!response.ok) {
        throw new Error(`HTTP chyba ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error('Chyba při načítání dat ze serveru:', err);
      return { status: 'error', message: err.toString() };
    }
  },

  /**
   * Odeslání aktualizace (účast, úkoly, otázky, nápady, modlitby) do Google Tabulky.
   */
  async updateAttendance(payload) {
    try {
      const response = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP chyba ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Chyba při ukládání dat na server:', err);
      return { status: 'error', message: err.toString() };
    }
  }
};