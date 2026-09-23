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

// BLESKOVÝ START: Pokud uživatel je přihlášen, vykreslíme ihned mezipaměť bez čekání
if (Store.state.isLoggedIn) {
  render();
  syncData(); // Synchronizace na pozadí
}

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
    Store.setAuth(name, pin, check.role || 'team');
    els.loginBtn.disabled = false;
    els.loginBtn.textContent = 'Vstoupit do aplikace';
    updateAuthVisibility();
    render();
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

els.refreshBtn.addEventListener('click', () => syncData(true));

function updateAuthVisibility() {
  if (Store.state.isLoggedIn) {
    els.loginScreen.classList.add('hidden');
    els.appScreen.classList.remove('hidden');
    const roleBadge = Store.state.role === 'admin' ? ' (Admin)' : '';
    els.loggedUserLabel.textContent = `${Store.state.userName}${roleBadge}`;
  } else {
    els.appScreen.classList.add('hidden');
    els.loginScreen.classList.remove('hidden');
    els.loginName.value = '';
    els.loginPin.value = '';
    els.loginError.classList.add('hidden');
  }
}

async function syncData(manual = false) {
  if (!Store.state.isLoggedIn) return;

  if (manual) {
    els.statusText.textContent = 'Ověřuji změny v tabulce...';
  }

  const res = await API.fetchAttendance();

  if (res.demo) {
    els.statusText.textContent = 'Režim ukázky (vložte SCRIPT_URL).';
  } else if (res.success) {
    Store.loadSheetData(res.data);
    els.statusText.textContent = 'Aktuální data načtena.';
    render();
  } else {
    els.statusText.textContent = manual ? 'Chyba synchronizace dat.' : '';
  }
}

// OPTIMISTICKÝ ZÁPIS ÚČASTI (Okamžitá reakce 0 ms)
async function handleToggleAttendance(session) {
  const name = Store.state.userName;
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;

  const currentData = Store.state.sessionsData[key] || {};
  let attendees = [...(currentData.attendees || [])];

  const idx = attendees.indexOf(name);
  if (idx > -1) {
    attendees.splice(idx, 1);
  } else {
    attendees.push(name);
  }

  // 1. Změna se ihned projeví na obrazovce
  Store.state.sessionsData[key] = { ...currentData, attendees };
  Store.saveCurrentToCache();
  els.statusText.textContent = 'Změna uložena v telefonu, propisuji do tabulky...';
  render();

  // 2. Odeslání do Google Tabulky na pozadí
  const res = await API.updateAttendance({
    date: session.dateStr,
    pin: pin,
    title: currentData.title,
    attendees: attendees,
    info: currentData.info,
    questions: currentData.questions,
    summary: currentData.summary,
    idea: currentData.idea
  });

  if (res.status === 'ok' || res.demo) {
    els.statusText.textContent = 'Vše uloženo v tabulce.';
  } else {
    // Pokud zápis selhal, vrátíme původní stav
    alert('Chyba při zápisu do tabulky: ' + (res.message || 'Chyba spojení'));
    if (idx > -1) {
      attendees.splice(idx, 0, name);
    } else {
      attendees.pop();
    }
    Store.state.sessionsData[key] = { ...currentData, attendees };
    Store.saveCurrentToCache();
    els.statusText.textContent = 'Zápis selhal.';
    render();
  }
}

// ULOŽENÍ POZNÁMKY (Okamžitá reakce)
async function handleSaveNote(session, newInfoText) {
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const oldInfo = currentData.info;

  // Okamžitá změna v UI
  Store.state.sessionsData[key] = { ...currentData, info: newInfoText };
  Store.saveCurrentToCache();
  activeEditing[`${key}_note`] = false;
  els.statusText.textContent = 'Ukládám do tabulky...';
  render();

  const res = await API.updateAttendance({
    date: session.dateStr,
    pin: pin,
    title: currentData.title,
    attendees: currentData.attendees,
    info: newInfoText,
    questions: currentData.questions,
    summary: currentData.summary,
    idea: currentData.idea
  });

  if (res.status === 'ok' || res.demo) {
    els.statusText.textContent = 'Organizační info uloženo v tabulce.';
  } else {
    alert('Chyba při ukládání: ' + (res.message || 'Nesprávný PIN'));
    Store.state.sessionsData[key] = { ...currentData, info: oldInfo };
    Store.saveCurrentToCache();
    render();
  }
}

// ULOŽENÍ OTÁZEK K DISKUZI (Okamžitá reakce)
async function handleSaveQuestions(session, newQuestionsText) {
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const oldQuestions = currentData.questions;

  // Okamžitá změna v UI
  Store.state.sessionsData[key] = { ...currentData, questions: newQuestionsText };
  Store.saveCurrentToCache();
  activeEditing[`${key}_quest`] = false;
  els.statusText.textContent = 'Ukládám do tabulky...';
  render();

  const res = await API.updateAttendance({
    date: session.dateStr,
    pin: pin,
    title: currentData.title,
    attendees: currentData.attendees,
    info: currentData.info,
    questions: newQuestionsText,
    summary: currentData.summary,
    idea: currentData.idea
  });

  if (res.status === 'ok' || res.demo) {
    els.statusText.textContent = 'Otázky uloženy v tabulce.';
  } else {
    alert('Chyba při ukládání: ' + (res.message || 'Nesprávný PIN'));
    Store.state.sessionsData[key] = { ...currentData, questions: oldQuestions };
    Store.saveCurrentToCache();
    render();
  }
}

// ULOŽENÍ DĚJE A MYŠLENKY (ADMIN)
async function handleSaveAdminPlot(session, newTitle, newSummary, newIdea) {
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};

  Store.state.sessionsData[key] = {
    ...currentData,
    title: newTitle,
    summary: newSummary,
    idea: newIdea
  };
  Store.saveCurrentToCache();
  activeEditing[`${key}_plot`] = false;
  els.statusText.textContent = 'Ukládám do tabulky...';
  render();

  const res = await API.updateAttendance({
    date: session.dateStr,
    pin: pin,
    title: newTitle,
    attendees: currentData.attendees,
    info: currentData.info,
    questions: currentData.questions,
    summary: newSummary,
    idea: newIdea
  });

  if (res.status === 'ok' || res.demo) {
    els.statusText.textContent = 'Texty uloženy v tabulce pro všechny.';
  } else {
    alert('Chyba při ukládání: ' + (res.message || 'Nedostatečná oprávnění'));
    render();
  }
}

// VYKRESLENÍ KARET
function render() {
  if (!Store.state.isLoggedIn) return;

  els.list.innerHTML = '';
  const currentName = Store.state.userName;
  const isAdmin = Store.state.role === 'admin';

  CONFIG.SESSIONS.forEach((session) => {
    const key = `${session.day}-${session.month}`;
    const data = Store.state.sessionsData[key] || {};
    const attendees = data.attendees || [];
    const isPresent = currentName && attendees.includes(currentName);

    const effectiveTitle = (data.title && data.title.trim()) ? data.title : session.title;
    const effectiveSummary = (data.summary && data.summary.trim()) ? data.summary : session.summary;
    const effectiveIdea = (data.idea && data.idea.trim()) ? data.idea : session.idea;

    const isEditingNote = !!activeEditing[`${key}_note`];
    const isEditingQuest = !!activeEditing[`${key}_quest`];
    const isEditingPlot = !!activeEditing[`${key}_plot`];

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

      <div class="title-with-admin">
        <h3 class="episode-title-heading">${session.episodeNumber}: ${effectiveTitle}</h3>
        ${isAdmin && !isEditingPlot ? `
          <button class="btn-admin-edit" data-key="${key}_plot">✎ Upravit texty dílu</button>
        ` : ''}
      </div>

      ${!isEditingPlot ? `
        <p class="summary-text">${effectiveSummary}</p>

        <p class="characters-text">
          <strong>Hlavní postavy:</strong> ${session.characters}
        </p>

        <div class="discussion-idea">
          <strong>Hlavní motiv k diskuzi:</strong>
          ${effectiveIdea}
        </div>
      ` : `
        <div class="admin-editor-box">
          <label class="editor-label">Název dílu:</label>
          <input type="text" class="editor-textarea admin-title-input" value="${effectiveTitle}">

          <label class="editor-label" style="margin-top: 0.6rem;">Děj dílu (podle Wikipedie):</label>
          <textarea class="editor-textarea admin-summary-input" rows="5">${effectiveSummary}</textarea>

          <label class="editor-label" style="margin-top: 0.6rem;">Hlavní motiv k diskuzi (pro hosty):</label>
          <textarea class="editor-textarea admin-idea-input" rows="3">${effectiveIdea}</textarea>

          <div class="editor-actions" style="margin-top: 0.6rem;">
            <button class="btn-save-action btn-save-plot">Uložit pro všechny</button>
            <button class="btn-cancel-action btn-cancel-plot">Zrušit</button>
          </div>
        </div>
      `}

      <div class="custom-questions-section">
        ${data.questions ? `
          <div class="questions-block">
            <div class="questions-header">
              <span>💬 Otázky a postřehy k diskuzi:</span>
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
            <label class="editor-label">Otázky k diskuzi:</label>
            <textarea class="editor-textarea" rows="3" placeholder="Otázky pro moderátora do sálu...">${data.questions || ''}</textarea>
            <div class="editor-actions">
              <button class="btn-save-action btn-save-quest">Uložit do tabulky</button>
              <button class="btn-cancel-action btn-cancel-quest">Zrušit</button>
            </div>
          </div>
        ` : ''}
      </div>

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
            <textarea class="editor-textarea" rows="2" placeholder="Technika, čaj, klíče...">${data.info || ''}</textarea>
            <div class="editor-actions">
              <button class="btn-save-action btn-save-note">Uložit do tabulky</button>
              <button class="btn-cancel-action btn-cancel-note">Zrušit</button>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="attendees-container">
        <div class="attendees-title">Organizační tým (${attendees.length}):</div>
        <div class="tags-wrap">
          ${attendees.length > 0 
            ? attendees.map(a => `<span class="person-tag">${a}</span>`).join('') 
            : `<span class="no-attendees">Zatím nikdo nezapsán</span>`
          }
        </div>
      </div>

      <button class="btn-toggle-attendance ${isPresent ? 'is-attending' : ''}">
        ${isPresent ? '✓ Odhlásit mou účast' : '+ Budu přítomen'}
      </button>
    `;

    card.querySelector('.btn-toggle-attendance').addEventListener('click', () => handleToggleAttendance(session));

    const editPlotBtn = card.querySelector('.btn-admin-edit');
    if (editPlotBtn) {
      editPlotBtn.addEventListener('click', () => {
        activeEditing[`${key}_plot`] = true;
        render();
      });
    }
    const savePlotBtn = card.querySelector('.btn-save-plot');
    if (savePlotBtn) {
      const titleInput = card.querySelector('.admin-title-input');
      const sumArea = card.querySelector('.admin-summary-input');
      const ideaArea = card.querySelector('.admin-idea-input');
      savePlotBtn.addEventListener('click', () => {
        handleSaveAdminPlot(session, titleInput.value, sumArea.value, ideaArea.value);
      });
    }
    const cancelPlotBtn = card.querySelector('.btn-cancel-plot');
    if (cancelPlotBtn) {
      cancelPlotBtn.addEventListener('click', () => {
        activeEditing[`${key}_plot`] = false;
        render();
      });
    }

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