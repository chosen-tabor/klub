export const Store = {
  state: {
    userName: localStorage.getItem('chosen_user_name') || '',
    pin: localStorage.getItem('chosen_pin') || '',
    role: localStorage.getItem('chosen_role') || 'team',
    isLoggedIn: false,
    sessionsData: {}
  },

  // Inicializace relace a okamžité načtení offline mezipaměti
  initAuth() {
    this.state.userName = localStorage.getItem('chosen_user_name') || '';
    this.state.pin = localStorage.getItem('chosen_pin') || '';
    this.state.role = localStorage.getItem('chosen_role') || 'team';
    this.state.isLoggedIn = localStorage.getItem('chosen_logged_in') === 'true';

    const cached = localStorage.getItem('chosen_cached_sessions');
    if (cached) {
      try {
        this.state.sessionsData = JSON.parse(cached);
      } catch (err) {
        console.error('Chyba při čtení cache:', err);
      }
    }
  },

  // Uložení přihlášení
  setAuth(name, pin, role = 'team') {
    this.state.userName = name.trim();
    this.state.pin = pin.trim();
    this.state.role = role;
    this.state.isLoggedIn = true;
    localStorage.setItem('chosen_user_name', this.state.userName);
    localStorage.setItem('chosen_pin', this.state.pin);
    localStorage.setItem('chosen_role', this.state.role);
    localStorage.setItem('chosen_logged_in', 'true');
  },

  // Odhlášení a vyčištění lokálního stavu
  logout() {
    this.state.userName = '';
    this.state.pin = '';
    this.state.role = 'team';
    this.state.isLoggedIn = false;
    this.state.sessionsData = {};
    localStorage.removeItem('chosen_user_name');
    localStorage.removeItem('chosen_pin');
    localStorage.removeItem('chosen_role');
    localStorage.removeItem('chosen_logged_in');
    localStorage.removeItem('chosen_cached_sessions');
  },

  // Převede "30.9.", "30. 9.", "7.10." i "2026-09-30" na jednotný klíč "den-měsíc" (např. "30-9", "7-10")
  normalizeKey(rawDate) {
    if (!rawDate) return null;
    const str = String(rawDate).trim();

    // Párování pro tečkový zápis: 30.9. nebo 30. 9. nebo 7.10.
    const czMatch = str.match(/(\d{1,2})\s*\.\s*(\d{1,2})/);
    if (czMatch) {
      const day = parseInt(czMatch[1], 10);
      const month = parseInt(czMatch[2], 10);
      return `${day}-${month}`;
    }

    // ISO formát pro případ data typu 2026-09-30
    const isoMatch = str.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const month = parseInt(isoMatch[1], 10);
      const day = parseInt(isoMatch[2], 10);
      return `${day}-${month}`;
    }

    return str;
  },

  // Načtení řádků z Google Tabulky a jejich sloučení do stavu
  loadSheetData(rows) {
    if (!Array.isArray(rows)) return;

    rows.forEach(row => {
      const key = this.normalizeKey(row.date);
      if (!key) return;

      const existing = this.state.sessionsData[key] || {};

      this.state.sessionsData[key] = {
        ...existing,
        // Texty z tabulky mají přednost
        title: (row.title && row.title.trim()) ? row.title : existing.title,
        attendees: Array.isArray(row.attendees) ? row.attendees : existing.attendees || [],
        info: row.info !== undefined ? row.info : existing.info || '',
        questions: row.questions !== undefined ? row.questions : existing.questions || '',
        summary: (row.summary && row.summary.trim()) ? row.summary : existing.summary,
        idea: (row.idea && row.idea.trim()) ? row.idea : existing.idea,
        ideas: row.ideas !== undefined ? row.ideas : existing.ideas || '',
        prayers: row.prayers !== undefined ? row.prayers : existing.prayers || ''
      };
    });

    this.saveCurrentToCache();
  },

  // Uložení stavu do mezipaměti zařízení
  saveCurrentToCache() {
    localStorage.setItem('chosen_cached_sessions', JSON.stringify(this.state.sessionsData));
  }
};