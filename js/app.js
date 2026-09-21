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

// Stav otevřených editorů: { "30-9_note": true, "30-9_quest": true }
const activeEditing = {};

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

  const currentData = Store.state.sessionsData[key] || { attendees: [], info: '', questions: '' };
  let attendees = [...currentData.attendees];

  const idx = attendees.indexOf(name);
  if (idx > -1) {
    attendees.splice(idx, 1);
  } else {
    attendees.push(name);
  }

  els.statusText.textContent = 'Ukládám do tabulky...';
  render(true);

  const res = await API.updateAttendance(session.dateStr, attendees, currentData.info, currentData.questions, pin);

  if (res.status === 'ok' || res.demo) {
    Store.state.sessionsData[key] = { ...currentData, attendees };
    els.statusText.textContent = 'Změny byly uloženy.';
  } else {
    alert('Chyba: ' + (res.message || 'Nesprávný PIN'));
    els.statusText.textContent = 'Zápis selhal.';
  }

  render();
}

async function handleSaveNote(session, newInfoText) {
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || { attendees: [], info: '', questions: '' };

  els.statusText.textContent = 'Ukládám organizační info...';
  render(true);

  const res = await API.updateAttendance(session.dateStr, currentData.attendees, newInfoText, currentData.questions, pin);

  if (res.status === 'ok' || res.demo) {
    Store.state.sessionsData[key] = { ...currentData, info: newInfoText };
    activeEditing[`${key}_note`] = false;
    els.statusText.textContent = 'Organizační info uloženo.';
  } else {
    alert('Chyba při ukládání: ' + (res.message || 'Nesprávný PIN'));
    els.statusText.textContent = 'Uložení selhalo.';
  }

  render();
}

async function handleSaveQuestions(session, newQuestionsText) {
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || { attendees: [], info: '', questions: '' };

  els.statusText.textContent = 'Ukládám otázky a myšlenky...';
  render(true);

  const res = await API.updateAttendance(session.dateStr, currentData.attendees, currentData.info, newQuestionsText, pin);

  if (res.status === 'ok' || res.demo) {
    Store.state.sessionsData[key] = { ...currentData, questions: newQuestionsText };
    activeEditing[`${key}_quest`] = false;
    els.statusText.textContent = 'Otázky a myšlenky uloženy.';
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
    const data = Store.state.sessionsData[key] || { attendees: [], info: '', questions: '' };
    const attendees = data.attendees;
    const isPresent = currentName && attendees.includes(currentName);
    
    const isEditingNote = !!activeEditing[`${key}_note`];
    const isEditingQuest = !!activeEditing[`${key}_quest`];

    const card = document.createElement('article');
    card.className = 'session-card';

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

      <!-- VÝCHOZÍ MYŠLENKA Z DĚJE -->
      <div class="discussion-idea">
        <strong>Hlavní motiv k diskuzi:</strong>
        ${session.idea}
      </div>

      <!-- VLASTNÍ MYŠLENKY A OTÁZKY OD TÝMU -->
      <div class="custom-questions-section">
        ${data.questions ? `
          <div class="questions-block">
            <div class="questions-header">
              <span>💬 Vaše otázky a postřehy k diskuzi:</span>
              <button class="btn-edit-link" data-key="${key}_quest">Upravit</button>
            </div>
            <div class="questions-content">${data.questions.replace(/\n/g, '<br>')}</div>
          </div>
        ` : `
          ${!isEditingQuest ? `
            <button class="btn-action-outline btn-quest" data-key="${key}_quest">
              + Přidat otázky a postřehy k diskuzi
            </button>
          ` : ''}
        `}

        ${isEditingQuest ? `
          <div class="inline-editor">
            <label class="editor-label">Otázky a postřehy k diskuzi pro tento večer:</label>
            <textarea class="editor-textarea" rows="3" placeholder="Např. Co vás v dílu nejvíc překvapilo? Jak vnímáte Petrovu reakci na lodi?">${data.questions || ''}</textarea>
            <div class="editor-actions">
              <button class="btn-save-action btn-save-quest" ${isSaving ? 'disabled' : ''}>Uložit do tabulky</button>
              <button class="btn-cancel-action btn-cancel-quest">Zrušit</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- ORGANIZAČNÍ INFO -->
      <div class="organizer-section">
        ${data.info ? `
          <div class="organizer-info-block">
            <div class="organizer-info-header">
              <span>📌 Organizační info:</span>
              <button class="btn-edit-link" data-key="${key}_note">Upravit</button>
            </div>
            <div class="organizer-info-content">${data.info}</div>
          </div>
        ` : `
          ${!isEditingNote ? `
            <button class="btn-action-outline btn-note" data-key="${key}_note">
              + Přidat organizační info k večeru
            </button>
          ` : ''}
        `}

        ${isEditingNote ? `
          <div class="inline-editor">
            <label class="editor-label">Organizační poznámka:</label>
            <textarea class="editor-textarea" rows="2" placeholder="Kdo přinese občerstvení, technika, moderování...">${data.info || ''}</textarea>
            <div class="editor-actions">
              <button class="btn-save-action btn-save-note" ${isSaving ? 'disabled' : ''}>Uložit do tabulky</button>
              <button class="btn-cancel-action btn-cancel-note">Zrušit</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- ÚČASTNÍCI -->
      <div class="attendees-container">
        <div class="attendees-title">Organizační tým (${attendees.length}):</div>
        <div class="tags-wrap">
          ${attendees.length > 0 
            ? attendees.map(a => `<span class="person-tag">${a}</span>`).join('') 
            : `<span class="no-attendees">Zatím nikdo nezapsán</span>`
          }
        </div>
      </div>

      <!-- TLAČÍTKO ÚČASTI -->
      <button class="btn-toggle-attendance ${isPresent ? 'is-attending' : ''}" ${isSaving ? 'disabled' : ''}>
        ${isPresent ? '✓ Odhlásit mou účast' : '+ Budu přítomen'}
      </button>
    `;

    card.querySelector('.btn-toggle-attendance').addEventListener('click', () => handleToggleAttendance(session));

    // Otevření editoru otázek
    const addQuestBtn = card.querySelector('.btn-quest');
    if (addQuestBtn) {
      addQuestBtn.addEventListener('click', () => {
        activeEditing[`${key}_quest`] = true;
        render();
      });
    }
    const editQuestBtn = card.querySelector('.btn-edit-link[data-key$="_quest"]');
    if (editQuestBtn) {
      editQuestBtn.addEventListener('click', () => {
        activeEditing[`${key}_quest`] = true;
        render();
      });
    }

    // Uložení / zrušení otázek
    const saveQuestBtn = card.querySelector('.btn-save-quest');
    if (saveQuestBtn) {
      const textarea = card.querySelector('.custom-questions-section .editor-textarea');
      saveQuestBtn.addEventListener('click', () => handleSaveQuestions(session, textarea.value));
    }
    const cancelQuestBtn = card.querySelector('.btn-cancel-quest');
    if (cancelQuestBtn) {
      cancelQuestBtn.addEventListener('click', () => {
        activeEditing[`${key}_quest`] = false;
        render();
      });
    }

    // Otevření editoru organizačního infa
    const addNoteBtn = card.querySelector('.btn-note');
    if (addNoteBtn) {
      addNoteBtn.addEventListener('click', () => {
        activeEditing[`${key}_note`] = true;
        render();
      });
    }
    const editNoteBtn = card.querySelector('.btn-edit-link[data-key$="_note"]');
    if (editNoteBtn) {
      editNoteBtn.addEventListener('click', () => {
        activeEditing[`${key}_note`] = true;
        render();
      });
    }

    // Uložení / zrušení organizačního infa
    const saveNoteBtn = card.querySelector('.btn-save-note');
    if (saveNoteBtn) {
      const textarea = card.querySelector('.organizer-section .editor-textarea');
      saveNoteBtn.addEventListener('click', () => handleSaveNote(session, textarea.value));
    }
    const cancelNoteBtn = card.querySelector('.btn-cancel-note');
    if (cancelNoteBtn) {
      cancelNoteBtn.addEventListener('click', () => {
        activeEditing[`${key}_note`] = false;
        render();
      });
    }

    els.list.appendChild(card);
  });
}

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.update();
  }).catch(console.error);
}

if (Store.state.isLoggedIn) {
  syncData();
}