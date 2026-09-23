export const Store = {
  state: {
    userName: localStorage.getItem('chosen_user_name') || '',
    pin: localStorage.getItem('chosen_pin') || '',
    role: localStorage.getItem('chosen_role') || 'team',
    isLoggedIn: false,
    sessionsData: {}
  },

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

  normalizeKey(rawDate) {
    if (!rawDate) return null;
    const czMatch = String(rawDate).match(/^(\d{1,2})\.\s*(\d{1,2})/);
    if (czMatch) return `${parseInt(czMatch[1], 10)}-${parseInt(czMatch[2], 10)}`;

    const isoMatch = String(rawDate).match(/^\d{4}-(\d{2})-(\d{2})/);
    if (isoMatch) return `${parseInt(isoMatch[2], 10)}-${parseInt(isoMatch[1], 10)}`;

    return String(rawDate).replace(/\s+/g, '');
  },

  loadSheetData(rows) {
    if (!Array.isArray(rows)) return;

    rows.forEach(row => {
      const key = this.normalizeKey(row.date);
      if (!key) return;

      if (!this.state.sessionsData[key]) {
        this.state.sessionsData[key] = {};
      }

      this.state.sessionsData[key] = {
        ...this.state.sessionsData[key],
        title: row.title || this.state.sessionsData[key].title || '',
        attendees: row.attendees || this.state.sessionsData[key].attendees || [],
        info: row.info || '',
        questions: row.questions || '',
        summary: row.summary || this.state.sessionsData[key].summary || '',
        idea: row.idea || this.state.sessionsData[key].idea || '',
        ideas: row.ideas || '',
        prayers: row.prayers || ''
      };
    });

    this.saveCurrentToCache();
  },

  saveCurrentToCache() {
    localStorage.setItem('chosen_cached_sessions', JSON.stringify(this.state.sessionsData));
  }
};