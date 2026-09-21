export const Store = {
  state: {
    userName: localStorage.getItem('chosen_user_name') || '',
    pin: localStorage.getItem('chosen_pin') || '',
    sessionsData: {} // Formát: { "30-9": { attendees: [...], info: "" } }
  },

  setUserName(name) {
    this.state.userName = name.trim();
    localStorage.setItem('chosen_user_name', this.state.userName);
  },

  setPin(pin) {
    this.state.pin = pin.trim();
    localStorage.setItem('chosen_pin', this.state.pin);
  },

  // Normalizuje datum (např. "30.9.", "30. 9.", "2026-09-30") na klíč "30-9"
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
          this.state.sessionsData[normKey] = { attendees: val, info: '' };
        } else {
          this.state.sessionsData[normKey] = {
            attendees: val.attendees || [],
            info: val.info || ''
          };
        }
      }
    }
  }
};