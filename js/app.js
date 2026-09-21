import { CONFIG } from './config.js';
import { Store } from './store.js';
import { API } from './api.js';

const els = {
  loginScreen: document.getElementById('loginScreen'),
  appScreen: document.getElementById('appScreen'),
  loginForm: document.getElementById('loginForm'),
  loginName: document.getElementById('loginName'),
  loginPin: document.getElementById('loginPin'),
  loginBtn: document.getElementById('loginBtn'),
  loginError: document.getElementById('loginError'),
  loggedUserLabel: document.getElementById('loggedUserLabel'),
  logoutBtn: document.getElementById('logoutBtn'),
  statusText: document.getElementById('statusText'),
  refreshBtn: document.getElementById('refreshBtn'),
  list: document.getElementById('sessionsList'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),
  themeLabel: document.getElementById('themeLabel')
};

const activeEditing = {};

// ==========================================
// SPRÁVA TÉMAT (SVĚTLÉ PRIMÁRNÍ, TMAVÉ VOLITELNÉ)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('chosen_theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    els.themeIcon.textContent = '☀️';
    els.themeLabel.textContent = 'Světlý režim';
  } else {
    document.body.classList.remove('dark-theme');
    els.themeIcon.textContent = '🌙';
    els.themeLabel.textContent = 'Tmavý režim';
  }
}

els.themeToggleBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-theme');
  if (isDark) {
    localStorage.setItem('chosen_theme', 'dark');
    els.themeIcon.textContent = '☀️';
    els.themeLabel.textContent = 'Světlý režim';
  } else {
    localStorage.setItem('chosen_theme', 'light');
    els.themeIcon.textContent = '🌙';
    els.themeLabel.textContent = 'Tmavý režim';
  }
});

initTheme();

// ==========================================
// AUTENTIZACE
// ==========================================
Store.initAuth();
updateAuthVisibility();

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = els.loginName.value.trim();
  const pin = els.loginPin.value.trim();

  if (!name || !pin) return;

  els.loginError.classList.add('hidden');
  els.loginBtn.disabled = true;
  els.loginBtn.textContent = 'Ověřuji PIN...';

  const check = await API.verifyCredentials(pin);

  if (check.success) {
    Store.setAuth(name, pin);
    els.loginBtn.disabled = false;
    els.loginBtn.textContent = 'Vstoupit do aplikace';
    updateAuthVisibility();
    syncData();
  } else {
    els.loginBtn.disabled = false;
    els.loginBtn.textContent = 'Vstoupit do aplikace';
    els.loginError.textContent = check.message || 'Nesprávný PIN.';
    els.loginError.classList.remove('hidden');
  }
});

els.logoutBtn.addEventListener('click', () => {
  Store.logout();
  updateAuthVisibility();
});

els.refreshBtn.addEventListener('click', syncData);

function updateAuthVisibility() {
  if (Store.state.isLoggedIn) {
    els.loginScreen.classList.add('hidden');
    els.appScreen.classList.remove('hidden');
    els.loggedUserLabel.textContent = Store.state.userName;
  } else {
    els.appScreen.classList.add('hidden');
    els.loginScreen.classList.remove('hidden');
    els.loginName.value = '';
    els.loginPin.value = '';
    els.loginError.classList.add('hidden');
  }
}

// ==========================================
// DATA & VYKRESLOVÁNÍ
// ==========================================
async function syncData() {
  if (!Store.state.isLoggedIn) return;

  els.statusText.textContent = 'Synchronizuji s tabulkou...';
  const res = await API.fetchAttendance();

  if (res.demo) {
    els.statusText.textContent = 'Režim ukázky (vložte SCRIPT_URL).';
  } else if (res.success) {
    Store.loadSheetData(res.data);
    els.statusText.textContent = 'Aktuální data načtena.';
  } else {
    els.statusText.textContent = 'Chyba synchronizace dat.';
  }
  render();
}

async function handleToggleAttendance(session) {
  const name = Store.state.userName;
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;

  const currentData = Store.state.sessionsData[key] || { attendees: [], info: '' };
  let attendees = [...currentData.attendees];

  const idx = attendees.indexOf(name);
  if (idx > -1) {
    attendees.splice(idx, 1);
  } else {
    attendees.push(name);
  }

  els.statusText.textContent = 'Ukládám do tabulky...';
  render(true);

  const res = await API.updateAttendance(session.dateStr, attendees, currentData.info, pin);

  if (res.status === 'ok' || res.demo) {
    Store.state.sessionsData[key] = { ...currentData, attendees };
    els.statusText.textContent = 'Změny byly uloženy.';
  } else {
    alert('Chyba: ' + (res.message || 'Nesprávný PIN'));
    els.statusText.textContent = 'Zápis selhal.';
  }

  render();
}

async function handleSaveInfo(session, newInfoText) {
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || { attendees: [], info: '' };

  els.statusText.textContent = 'Ukládám poznámku...';
  render(true);

  const res = await API.updateAttendance(session.dateStr, currentData.attendees, newInfoText, pin);

  if (res.status === 'ok' || res.demo) {
    Store.state.sessionsData[key] = { ...currentData, info: newInfoText };
    activeEditing[key] = false;
    els.statusText.textContent = 'Poznámka uložena.';
  } else {
    alert('Chyba při ukládání: ' + (res.message || 'Nesprávný PIN'));
    els.statusText.textContent = 'Uložení selhalo.';
  }

  render();
}

function render(isSaving = false) {
  if (!Store.state.isLoggedIn) return;

  els.list.innerHTML = '';
  const currentName = Store.state.userName;

  CONFIG.SESSIONS.forEach((session) => {
    const key = `${session.day}-${session.month}`;
    const data = Store.state.sessionsData[key] || { attendees: [], info: '' };
    const attendees = data.attendees;
    const isPresent = currentName && attendees.includes(currentName);
    const isEditingThis = !!activeEditing[key];

    const card = document.createElement('article');
    card.className = 'session-card';

    // PLOCHÁ STRUKTURA (ŽÁDNÁ KARTA V KARTĚ - PLNA ŠÍŘKA PRO TEXT)
    card.innerHTML = `
      <div class="card-header-row">
        <div class="badge-and-date">
          <span class="season-tag">${session.season}</span>
          <span class="date-text">${session.label}</span>
        </div>
        <span class="time-tag">18:00</span>
      </div>

      <h3 class="episode-title-heading">${session.episodeNumber}: ${session.title}</h3>
      
      <p class="summary-text">${session.summary}</p>

      <p class="characters-text">
        <strong>Hlavní postavy:</strong> ${session.characters}
      </p>

      <div class="discussion-idea">
        <strong>Hlavní myšlenka k diskuzi:</strong>
        ${session.idea}
      </div>

      <!-- ORGANIZAČNÍ INFO / POZNÁMKA -->
      <div class="organizer-section">
        ${data.info ? `
          <div class="organizer-info-block">
            <div class="organizer-info-header">
              <span>📌 Organizační info:</span>
              <button class="btn-edit-note" data-key="${key}">Upravit</button>
            </div>
            <div class="organizer-info-content">${data.info}</div>
          </div>
        ` : `
          ${!isEditingThis ? `
            <button class="btn-add-note" data-key="${key}">+ Přidat organizační info k večeru</button>
          ` : ''}
        `}

        ${isEditingThis ? `
          <div class="note-editor">
            <textarea class="note-textarea" rows="3" placeholder="Poznámka k technice, čaji, moderování...">${data.info || ''}</textarea>
            <div class="note-actions">
              <button class="btn-save-note" ${isSaving ? 'disabled' : ''}>Uložit do tabulky</button>
              <button class="btn-cancel-note">Zrušit</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- ÚČASTNÍCI ORGANIZAČNÍHO TÝMU -->
      <div class="attendees-container">
        <div class="attendees-title">Organizační tým (${attendees.length}):</div>
        <div class="tags-wrap">
          ${attendees.length > 0 
            ? attendees.map(a => `<span class="person-tag">${a}</span>`).join('') 
            : `<span class="no-attendees">Zatím nikdo nezapsán</span>`
          }
        </div>
      </div>

      <!-- VELKÉ TLAČÍTKO AKCE PŘES CELOU ŠÍŘKU -->
      <button class="btn-toggle-attendance ${isPresent ? 'is-attending' : ''}" ${isSaving ? 'disabled' : ''}>
        ${isPresent ? '✓ Odhlásit mou účast' : '+ Budu přítomen'}
      </button>
    `;

    card.querySelector('.btn-toggle-attendance').addEventListener('click', () => handleToggleAttendance(session));

    const addBtn = card.querySelector('.btn-add-note');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        activeEditing[key] = true;
        render();
      });
    }

    const editBtn = card.querySelector('.btn-edit-note');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        activeEditing[key] = true;
        render();
      });
    }

    const saveBtn = card.querySelector('.btn-save-note');
    if (saveBtn) {
      const textarea = card.querySelector('.note-textarea');
      saveBtn.addEventListener('click', () => handleSaveInfo(session, textarea.value));
    }

    const cancelBtn = card.querySelector('.btn-cancel-note');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        activeEditing[key] = false;
        render();
      });
    }

    els.list.appendChild(card);
  });
}

// Service worker reload
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.update();
  }).catch(console.error);
}

if (Store.state.isLoggedIn) {
  syncData();
}