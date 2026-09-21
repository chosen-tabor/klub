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
  list: document.getElementById('sessionsList')
};

const activeEditing = {};

// Inicializace stavu přihlášení
Store.initAuth();
updateAuthVisibility();

// Zpracování formuláře přihlášení
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

// Odhlášení
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

async function syncData() {
  if (!Store.state.isLoggedIn) return;

  els.statusText.textContent = 'Synchronizuji s tabulkou...';
  const res = await API.fetchAttendance();

  if (res.demo) {
    els.statusText.textContent = 'Režim ukázky (vložte SCRIPT_URL).';
  } else if (res.success) {
    Store.loadSheetData(res.data);
    els.statusText.textContent = 'Aktualizováno právě teď.';
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

  els.statusText.textContent = 'Ukládám informaci...';
  render(true);

  const res = await API.updateAttendance(session.dateStr, currentData.attendees, newInfoText, pin);

  if (res.status === 'ok' || res.demo) {
    Store.state.sessionsData[key] = { ...currentData, info: newInfoText };
    activeEditing[key] = false;
    els.statusText.textContent = 'Informace byla uložena.';
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

    card.innerHTML = `
      <div class="card-top">
        <span class="date-title">${session.label}</span>
        <span class="time-badge">18:00</span>
      </div>

      <div class="episode-detail">
        <h3>${session.ep}</h3>
        <p>${session.desc}</p>
      </div>

      <!-- Informace k večeru -->
      <div class="info-container">
        ${data.info ? `
          <div class="info-section">
            <div class="info-header">
              <span class="info-label">📌 Informace k večeru:</span>
              <button class="btn-edit-info" data-key="${key}">Upravit</button>
            </div>
            <div class="info-text">${data.info}</div>
          </div>
        ` : `
          ${!isEditingThis ? `
            <button class="btn-add-info" data-key="${key}">+ Přidat informaci k večeru</button>
          ` : ''}
        `}

        ${isEditingThis ? `
          <div class="info-editor">
            <textarea class="info-textarea" rows="3" placeholder="Organizační poznámky...">${data.info || ''}</textarea>
            <div class="editor-actions">
              <button class="btn-save-info" ${isSaving ? 'disabled' : ''}>Uložit do tabulky</button>
              <button class="btn-cancel-info">Zrušit</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Účastníci -->
      <div class="attendees-wrap">
        <div class="attendees-label">Organizační tým (${attendees.length}):</div>
        <div class="tags-box">
          ${attendees.length > 0 
            ? attendees.map(a => `<span class="attendee-tag">${a}</span>`).join('') 
            : `<span class="no-one">Zatím nikdo nezapsán</span>`
          }
        </div>
      </div>

      <button class="btn-toggle ${isPresent ? 'active' : ''}" ${isSaving ? 'disabled' : ''}>
        ${isPresent ? '✓ Odhlásit mou účast' : '+ Budu přítomen'}
      </button>
    `;

    card.querySelector('.btn-toggle').addEventListener('click', () => handleToggleAttendance(session));

    const addBtn = card.querySelector('.btn-add-info');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        activeEditing[key] = true;
        render();
      });
    }

    const editBtn = card.querySelector('.btn-edit-info');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        activeEditing[key] = true;
        render();
      });
    }

    const saveBtn = card.querySelector('.btn-save-info');
    if (saveBtn) {
      const textarea = card.querySelector('.info-textarea');
      saveBtn.addEventListener('click', () => handleSaveInfo(session, textarea.value));
    }

    const cancelBtn = card.querySelector('.btn-cancel-info');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        activeEditing[key] = false;
        render();
      });
    }

    els.list.appendChild(card);
  });
}

// Service worker
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

// Pokud už byl uživatel přihlášený v mezipaměti, rovnou stáhneme data
if (Store.state.isLoggedIn) {
  syncData();
}