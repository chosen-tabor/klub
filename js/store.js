export const Store = {
  state: {
    userName: localStorage.getItem('chosen_user_name') || '',
    pin: localStorage.getItem('chosen_pin') || '',
    isLoggedIn: false,
    sessionsData: {}
  },

  initAuth() {
    this.state.isLoggedIn = localStorage.getItem('chosen_logged_in') === 'true';
  },

  setAuth(name, pin) {
    this.state.userName = name.trim();
    this.state.pin = pin.trim();
    this.state.isLoggedIn = true;
    localStorage.setItem('chosen_user_name', this.state.userName);
    localStorage.setItem('chosen_pin', this.state.pin);
    localStorage.setItem('chosen_logged_in', 'true');
  },

  logout() {
    this.state.userName = '';
    this.state.pin = '';
    this.state.isLoggedIn = false;
    this.state.sessionsData = {};
    localStorage.removeItem('chosen_user_name');
    localStorage.removeItem('chosen_pin');
    localStorage.removeItem('chosen_logged_in');
  },

  normalizeKey(rawDate) {
    if (!rawDate) return null;
    const czMatch = String(rawDate).match(/^(\d{1,2})\.\s*(\d{1,2})/);
    if (czMatch) return `${parseInt(czMatch[1], 10)}-${parseInt(czMatch[2], 10)}`;
    
    const isoMatch = String(rawDate).match(/^\d{4}-(\d{2})-(\d{2})/);
    if (isoMatch) return `${parseInt(isoMatch[2], 10)}-${parseInt(isoMatch[1], 10)}`;

    return String(rawDate).replace(/\s+/g, '');
  },

  loadSheetData(rawData) {
    this.state.sessionsData = {};
    for (const [key, val] of Object.entries(rawData)) {
      const normKey = this.normalizeKey(key);
      if (normKey) {
        if (Array.isArray(val)) {
          this.state.sessionsData[normKey] = { attendees: val, info: '', questions: '' };
        } else {
          this.state.sessionsData[normKey] = {
            attendees: val.attendees || [],
            info: val.info || '',
            questions: val.questions || ''
          };
        }
      }
    }
  }
};