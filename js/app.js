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
    if (els.themeIcon) els.themeIcon.textContent = '☀️';
    if (els.themeLabel) els.themeLabel.textContent = 'Světlý';
  } else {
    document.body.classList.remove('dark-theme');
    if (els.themeIcon) els.themeIcon.textContent = '🌙';
    if (els.themeLabel) els.themeLabel.textContent = 'Tmavý';
  }
}

if (els.themeToggleBtn) {
  els.themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    if (isDark) {
      localStorage.setItem('chosen_theme', 'dark');
      if (els.themeIcon) els.themeIcon.textContent = '☀️';
      if (els.themeLabel) els.themeLabel.textContent = 'Světlý';
    } else {
      localStorage.setItem('chosen_theme', 'light');
      if (els.themeIcon) els.themeIcon.textContent = '🌙';
      if (els.themeLabel) els.themeLabel.textContent = 'Tmavý';
    }
  });
}

initTheme();

Store.initAuth();
updateAuthVisibility();

// Bleskový start z mezipaměti
if (Store.state.isLoggedIn) {
  render();
  syncData();
}

if (els.loginForm) {
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
}

if (els.logoutBtn) {
  els.logoutBtn.addEventListener('click', () => {
    Store.logout();
    updateAuthVisibility();
  });
}

if (els.refreshBtn) {
  els.refreshBtn.addEventListener('click', () => syncData(true));
}

function updateAuthVisibility() {
  if (Store.state.isLoggedIn) {
    els.loginScreen.classList.add('hidden');
    els.appScreen.classList.remove('hidden');
    const roleBadge = Store.state.role === 'admin' ? ' (Admin)' : '';
    if (els.loggedUserLabel) els.loggedUserLabel.textContent = `${Store.state.userName}${roleBadge}`;
  } else {
    els.appScreen.classList.add('hidden');
    els.loginScreen.classList.remove('hidden');
    if (els.loginName) els.loginName.value = '';
    if (els.loginPin) els.loginPin.value = '';
    if (els.loginError) els.loginError.classList.add('hidden');
  }
}

async function syncData(manual = false) {
  if (!Store.state.isLoggedIn) return;

  if (manual && els.statusText) {
    els.statusText.textContent = 'Ověřuji změny v tabulce...';
  }

  const res = await API.fetchAttendance();

  if (res.demo) {
    if (els.statusText) els.statusText.textContent = 'Režim ukázky (vložte SCRIPT_URL).';
  } else if (res.success) {
    Store.loadSheetData(res.data);
    if (els.statusText) els.statusText.textContent = 'Aktuální data načtena.';
    render();
  } else {
    if (manual && els.statusText) els.statusText.textContent = 'Chyba synchronizace dat.';
  }
}

// Zápis nebo odhlášení kliknutím na štítek se jménem
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

  Store.state.sessionsData[key] = { ...currentData, attendees };
  Store.saveCurrentToCache();
  if (els.statusText) els.statusText.textContent = 'Ukládám do tabulky...';
  render();

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
    if (els.statusText) els.statusText.textContent = 'Vše uloženo v tabulce.';
  } else {
    alert('Chyba při zápisu: ' + (res.message || 'Chyba spojení'));
    if (idx > -1) {
      attendees.splice(idx, 0, name);
    } else {
      attendees.pop();
    }
    Store.state.sessionsData[key] = { ...currentData, attendees };
    Store.saveCurrentToCache();
    render();
  }
}

async function handleSaveNote(session, newInfoText) {
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const oldInfo = currentData.info;

  Store.state.sessionsData[key] = { ...currentData, info: newInfoText };
  Store.saveCurrentToCache();
  activeEditing[`${key}_note`] = false;
  if (els.statusText) els.statusText.textContent = 'Ukládám organizační info...';
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
    if (els.statusText) els.statusText.textContent = 'Organizační info uloženo.';
  } else {
    alert('Chyba při ukládání: ' + (res.message || 'Nesprávný PIN'));
    Store.state.sessionsData[key] = { ...currentData, info: oldInfo };
    Store.saveCurrentToCache();
    render();
  }
}

async function handleSaveQuestions(session, newQuestionsText) {
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const oldQuestions = currentData.questions;

  Store.state.sessionsData[key] = { ...currentData, questions: newQuestionsText };
  Store.saveCurrentToCache();
  activeEditing[`${key}_quest`] = false;
  if (els.statusText) els.statusText.textContent = 'Ukládám otázky...';
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
    if (els.statusText) els.statusText.textContent = 'Otázky uloženy v tabulce.';
  } else {
    alert('Chyba při ukládání: ' + (res.message || 'Nesprávný PIN'));
    Store.state.sessionsData[key] = { ...currentData, questions: oldQuestions };
    Store.saveCurrentToCache();
    render();
  }
}

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
  if (els.statusText) els.statusText.textContent = 'Ukládám do tabulky...';
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
    if (els.statusText) els.statusText.textContent = 'Texty uloženy v tabulce pro všechny.';
  } else {
    alert('Chyba při ukládání: ' + (res.message || 'Nedostatečná oprávnění'));
    render();
  }
}

function render() {
  if (!Store.state.isLoggedIn || !els.list) return;

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
      <!-- 1. HLAVIČKA KARTY (DATUM & ČAS) -->
      <div class="card-header-row">
        <div class="badge-and-date">
          <span class="season-tag">${session.season}</span>
          <span class="date-text">${session.label}</span>
        </div>
        <span class="time-tag">18:00</span>
      </div>

      <!-- 2. PŘIHLAŠENÍ ORGANIZÁTOŘI + KLIKACÍ MOJE JMÉNO -->
      <div class="attendees-container">
        <div class="attendees-title">Organizační tým (${attendees.length}):</div>
        <div class="tags-wrap">
          ${attendees.length > 0 
            ? attendees.map(a => {
                if (a === currentName) {
                  return `
                    <button type="button" class="person-tag my-tag" title="Kliknutím zrušíš svou účast">
                      <span class="my-tag-dot"></span>
                      <span>${a}</span>
                      <span class="my-tag-remove">✕</span>
                    </button>
                  `;
                } else {
                  return `<span class="person-tag">${a}</span>`;
                }
              }).join('') 
            : `<span class="no-attendees">Zatím nikdo nezapsán</span>`
          }

          ${!isPresent ? `
            <button type="button" class="btn-add-me-tag" title="Zapsat se do týmu na tento večer">
              + Zapsat se
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 3. ORGANIZAČNÍ INFO -->
      <div class="organizer-section" style="margin-top: 0.15rem;">
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

      <!-- DĚLÍCÍ ČÁRA PŘED OBSAHEM DÍLU -->
      <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 0.2rem 0;">

      <!-- 4. NÁZEV DÍLU & ADMIN EDITACE -->
      <div class="title-with-admin">
        <h3 class="episode-title-heading">${session.episodeNumber}: ${effectiveTitle}</h3>
        ${isAdmin && !isEditingPlot ? `
          <button class="btn-admin-edit" data-key="${key}_plot">✎ Upravit texty dílu</button>
        ` : ''}
      </div>

      <!-- 5. DĚJ DÍLU (NEBO ADMIN EDITOR) -->
      ${!isEditingPlot ? `
        <p class="summary-text">${effectiveSummary}</p>

        <!-- 6. POSTAVY -->
        <p class="characters-text">
          <strong>Hlavní postavy:</strong> ${session.characters}
        </p>

        <!-- 7. HLAVNÍ MOTIV K DISKUZI (PRO HOSTY) -->
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

      <!-- 8. VLASTNÍ OTÁZKY A POSTŘEHY K DISKUZI -->
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
    `;

    // Obsluha zápisu nebo zrušení účasti kliknutím na štítek
    const addMeBtn = card.querySelector('.btn-add-me-tag');
    if (addMeBtn) {
      addMeBtn.addEventListener('click', () => handleToggleAttendance(session));
    }
    const myTagBtn = card.querySelector('.my-tag');
    if (myTagBtn) {
      myTagBtn.addEventListener('click', () => handleToggleAttendance(session));
    }

    // Admin editace
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

    // Otázky k diskuzi
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

    // Organizační info
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