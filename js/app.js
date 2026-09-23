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

async function syncData() {
  if (els.statusText) els.statusText.textContent = 'Synchronizuji s tabulkou...';

  try {
    const res = await API.fetchAttendance();
    if (res.success && Array.isArray(res.data)) {
      Store.loadSheetData(res.data);
      if (els.statusText) els.statusText.textContent = 'Vše aktuální';
      render(); // KLÍČOVÉ: Překreslí DOM novými daty z tabulky!
    } else {
      if (els.statusText) els.statusText.textContent = 'Režim offline (z mezipaměti)';
    }
  } catch (err) {
    console.error('Chyba při synchronizaci:', err);
    if (els.statusText) els.statusText.textContent = 'Chyba připojení';
  }
}

// Účast organizátora – odesílá POUZE změněný seznam účastníků
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
    attendees: attendees
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

// Obecná synchronizace – posílá POUZE to pole, které se skutečně změnilo
async function updateSessionOnBackend(session, updatedFields, successMsg) {
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};

  Store.state.sessionsData[key] = { ...currentData, ...updatedFields };
  Store.saveCurrentToCache();
  if (els.statusText) els.statusText.textContent = 'Ukládám...';
  render();

  const payload = {
    date: session.dateStr,
    pin: pin,
    ...updatedFields
  };

  const res = await API.updateAttendance(payload);
  if (res.status === 'ok' || res.demo) {
    if (els.statusText) els.statusText.textContent = successMsg;
  } else {
    alert('Chyba při ukládání: ' + (res.message || 'Chyba spojení'));
    Store.state.sessionsData[key] = currentData;
    Store.saveCurrentToCache();
    render();
  }
}

// 1. ÚKOLY
function handleAddTask(session, taskText, personText) {
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const currentInfo = (currentData.info || '').trim();

  let line = '';
  if (taskText && personText) {
    line = `${taskText} — ${personText}`;
  } else if (taskText) {
    line = taskText;
  } else if (personText) {
    line = personText;
  }

  if (!line) return;

  const newInfo = currentInfo ? `${currentInfo}\n${line}` : line;
  activeEditing[`${key}_addTask`] = false;
  updateSessionOnBackend(session, { info: newInfo }, 'Úkol přidán.');
}

function handleToggleAssignTask(session, index) {
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const lines = (currentData.info || '').split('\n').map(l => l.trim()).filter(Boolean);
  const myName = Store.state.userName;

  if (!lines[index] || !myName) return;

  let currentLine = lines[index];
  let [taskPart, assigneesPart] = currentLine.includes('—')
    ? currentLine.split('—').map(s => s.trim())
    : [currentLine, ''];

  let assignees = assigneesPart ? assigneesPart.split(',').map(s => s.trim()).filter(Boolean) : [];

  const myIdx = assignees.indexOf(myName);
  if (myIdx > -1) {
    assignees.splice(myIdx, 1);
  } else {
    assignees.push(myName);
  }

  lines[index] = assignees.length > 0 ? `${taskPart} — ${assignees.join(', ')}` : taskPart;
  updateSessionOnBackend(session, { info: lines.join('\n') }, 'Přiřazení upraveno.');
}

function handleDeleteTask(session, indexToDelete) {
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const lines = (currentData.info || '').split('\n').map(l => l.trim()).filter(Boolean);
  lines.splice(indexToDelete, 1);
  updateSessionOnBackend(session, { info: lines.join('\n') }, 'Úkol smazán.');
}

// 2. OTÁZKY
function handleAddQuestion(session, questionText) {
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const current = (currentData.questions || '').trim();
  if (!questionText) return;

  const updated = current ? `${current}\n${questionText}` : questionText;
  activeEditing[`${key}_addQuest`] = false;
  updateSessionOnBackend(session, { questions: updated }, 'Otázka uložena.');
}

function handleDeleteQuestion(session, indexToDelete) {
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const lines = (currentData.questions || '').split('\n').map(l => l.trim()).filter(Boolean);
  lines.splice(indexToDelete, 1);
  updateSessionOnBackend(session, { questions: lines.join('\n') }, 'Otázka smazána.');
}

// 3. NÁPADY
function handleAddIdea(session, ideaText) {
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const current = (currentData.ideas || '').trim();
  if (!ideaText) return;

  const updated = current ? `${current}\n${ideaText}` : ideaText;
  activeEditing[`${key}_addIdea`] = false;
  updateSessionOnBackend(session, { ideas: updated }, 'Nápad uložen.');
}

function handleDeleteIdea(session, indexToDelete) {
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const lines = (currentData.ideas || '').split('\n').map(l => l.trim()).filter(Boolean);
  lines.splice(indexToDelete, 1);
  updateSessionOnBackend(session, { ideas: lines.join('\n') }, 'Nápad smazán.');
}

// 4. MODLITBY
function handleAddPrayer(session, prayerText) {
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const current = (currentData.prayers || '').trim();
  if (!prayerText) return;

  const updated = current ? `${current}\n${prayerText}` : prayerText;
  activeEditing[`${key}_addPrayer`] = false;
  updateSessionOnBackend(session, { prayers: updated }, 'Modlitba uložena.');
}

function handleDeletePrayer(session, indexToDelete) {
  const key = `${session.day}-${session.month}`;
  const currentData = Store.state.sessionsData[key] || {};
  const lines = (currentData.prayers || '').split('\n').map(l => l.trim()).filter(Boolean);
  lines.splice(indexToDelete, 1);
  updateSessionOnBackend(session, { prayers: lines.join('\n') }, 'Modlitba smazána.');
}

// 5. ADMIN EDITACE TEXTŮ
async function handleSaveAdminPlot(session, newTitle, newSummary, newIdea) {
  activeEditing[`${session.day}-${session.month}_plot`] = false;
  updateSessionOnBackend(session, {
    title: newTitle,
    summary: newSummary,
    idea: newIdea
  }, 'Texty dílu uloženy pro všechny.');
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

    const isAddingTask = !!activeEditing[`${key}_addTask`];
    const isAddingQuest = !!activeEditing[`${key}_addQuest`];
    const isAddingIdea = !!activeEditing[`${key}_addIdea`];
    const isAddingPrayer = !!activeEditing[`${key}_addPrayer`];
    const isEditingPlot = !!activeEditing[`${key}_plot`];

    const taskItems = (data.info || '').split('\n').map(item => item.trim()).filter(Boolean);
    const questionItems = (data.questions || '').split('\n').map(item => item.trim()).filter(Boolean);
    const ideaItems = (data.ideas || '').split('\n').map(item => item.trim()).filter(Boolean);
    const prayerItems = (data.prayers || '').split('\n').map(item => item.trim()).filter(Boolean);

    const card = document.createElement('article');
    card.className = 'session-card';

    card.innerHTML = `
      <!-- 1. HLAVIČKA: SÉRIE VLEVO, DATUM UPROSTŘED, ČAS VPRAVO -->
      <header class="card-top-bar">
        <div class="top-bar-left">
          <span class="season-badge">${session.season}</span>
        </div>
        <div class="top-bar-center">
          <h2 class="day-heading-center">${session.label}</h2>
        </div>
        <div class="top-bar-right">
          <div class="time-badge-inline">
            <span class="time-dot"></span>
            <span>18:00</span>
          </div>
        </div>
      </header>

      <!-- 2. BAREVNĚ VÝRAZNÝ NÁZEV DÍLU HNED POD DATEM -->
      <div class="title-with-admin">
        <h3 class="episode-title-heading">${session.episodeNumber}: ${effectiveTitle}</h3>
        ${isAdmin && !isEditingPlot ? `
          <button class="btn-admin-edit" data-key="${key}_plot">✎ Upravit texty dílu</button>
        ` : ''}
      </div>

      <!-- ADMIN FORMULÁŘ -->
      ${isEditingPlot ? `
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
      ` : ''}

      <!-- 3. ORGANIZAČNÍ TÝM + VÝRAZNÁ PILULKA ZAPSANÉHO -->
      <div class="attendees-container">
        <div class="attendees-title">Organizační tým (${attendees.length}):</div>
        <div class="tags-wrap">
          ${attendees.length > 0 
            ? attendees.map(a => {
                if (a === currentName) {
                  return `
                    <button type="button" class="person-tag my-tag-prominent" title="Kliknutím zrušíš svou účast">
                      <span class="my-tag-dot"></span>
                      <span class="my-tag-name">${a}</span>
                      <span class="my-tag-remove">✕</span>
                    </button>
                  `;
                } else {
                  return `<span class="person-tag other-tag">${a}</span>`;
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

      <!-- 4. ORGANIZAČNÍ ÚKOLY V BODECH -->
      <div class="organizer-section">
        <div class="organizer-info-header">
          <span>📌 Organizační úkoly a příprava:</span>
          ${!isAddingTask ? `
            <button class="btn-task-add-link" data-key="${key}_addTask">+ Přidat úkol</button>
          ` : ''}
        </div>

        <div class="tasks-list">
          ${taskItems.length > 0 ? taskItems.map((task, idx) => {
            const hasAssignment = task.includes('—');
            const [taskDesc, assignedPeople] = hasAssignment ? task.split('—').map(s => s.trim()) : [task, ''];
            const isAssigned = assignedPeople.includes(currentName);

            return `
              <div class="task-item-row">
                <span class="task-bullet">•</span>
                <div class="task-content-wrap">
                  <span class="task-name">${taskDesc}</span>${assignedPeople ? `<span class="task-people">(${assignedPeople})</span>` : ''}
                  
                  // Původní:
                  // <button class="btn-claim-task" ...>Mám na starost</button>

                  // Nové elegantní:
                  <div class="task-actions">
                    <button class="btn-claim-task" data-day="${session.day}" data-month="${session.month}" data-index="${idx}" title="Přidat se k úkolu">
                     + Já
                    </button>
                    <button class="btn-delete-item" data-type="task" data-day="${session.day}" data-month="${session.month}" data-index="${idx}" title="Smazat úkol">✕</button>
                  </div>
                </div>
                <button type="button" class="btn-task-delete" data-idx="${idx}" title="Odstranit úkol">✕</button>
              </div>
            `;
          }).join('') : `
            <div class="no-tasks-hint">Zatím žádné úkoly (klikněte na + Přidat úkol).</div>
          `}
        </div>

        ${isAddingTask ? `
          <div class="task-inline-editor">
            <div class="task-input-row">
              <input type="text" class="task-input task-desc-input" placeholder="Název úkolu (např. Židle, čaj, technika)...">
            </div>
            <div class="task-input-row">
              <input type="text" class="task-input task-person-input" placeholder="Kdo to zařídí (volitelné)...">
              <button type="button" class="btn-assign-me" title="Doplnit moje jméno">Moje jméno</button>
            </div>
            <div class="editor-actions">
              <button class="btn-save-action btn-save-task">Přidat úkol</button>
              <button class="btn-cancel-action btn-cancel-task">Zrušit</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- DĚLÍCÍ ČÁRA PŘED OBSAHEM DÍLU -->
      <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 0.1rem 0;">

      <!-- 5. DĚJ (S POPISEM DĚJ) -->
      ${!isEditingPlot ? `
        <div class="plot-section">
          <span class="section-label-sub">DĚJ</span>
          <p class="summary-text">${effectiveSummary}</p>
        </div>

        <!-- 6. POSTAVY -->
        <p class="characters-text">
          <strong>Hlavní postavy:</strong> ${session.characters}
        </p>

        <!-- 7. HLAVNÍ MOTIV K DISKUZI (PRO HOSTY) -->
        <div class="discussion-idea">
          <strong>Hlavní motiv k diskuzi:</strong>
          ${effectiveIdea}
        </div>
      ` : ''}

      <!-- 8. OTÁZKY A POSTŘEHY K DISKUZI V BODECH -->
      <div class="custom-questions-section">
        <div class="questions-header">
          <span>💬 Otázky a postřehy k diskuzi:</span>
          ${!isAddingQuest ? `
            <button class="btn-quest-add-link" data-key="${key}_addQuest">+ Přidat otázku</button>
          ` : ''}
        </div>

        <div class="questions-list">
          ${questionItems.length > 0 ? questionItems.map((q, idx) => `
            <div class="question-item-row">
              <span class="quest-bullet">•</span>
              <span class="quest-text">${q}</span>
              <button type="button" class="btn-quest-delete" data-idx="${idx}" title="Smazat otázku">✕</button>
            </div>
          `).join('') : `
            <div class="no-quest-hint">Zatím nebyly přidány žádné otázky.</div>
          `}
        </div>

        ${isAddingQuest ? `
          <div class="inline-editor" style="margin-top: 0.4rem;">
            <label class="editor-label">Nová otázka nebo postřeh do diskuze:</label>
            <input type="text" class="task-input new-question-input" placeholder="Např. Co vás nejvíc zasáhlo na reakci Petra?">
            <div class="editor-actions">
              <button class="btn-save-action btn-save-quest">Uložit bod</button>
              <button class="btn-cancel-action btn-cancel-quest">Zrušit</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- 9. SPOLEČNÁ SEKCE: NÁPADY A MODLITBY -->
      <div class="feedback-main-wrapper">
        <div class="feedback-main-title">Nápady a modlitby</div>

        <!-- PODSEKCE A: NÁPADY -->
        <div class="sub-feedback-box ideas-box">
          <div class="sub-feedback-header ideas-header">
            <span>💡 Nápady k večeru:</span>
            ${!isAddingIdea ? `
              <button class="btn-sub-add-link ideas-link" data-key="${key}_addIdea">+ Přidat nápad</button>
            ` : ''}
          </div>

          <div class="sub-feedback-list">
            ${ideaItems.length > 0 ? ideaItems.map((it, idx) => `
              <div class="sub-feedback-row">
                <span class="idea-bullet">•</span>
                <span class="sub-feedback-text">${it}</span>
                <button type="button" class="btn-sub-delete" data-type="idea" data-idx="${idx}" title="Smazat nápad">✕</button>
              </div>
            `).join('') : `
              <div class="sub-feedback-hint">Žádné zapsané nápady.</div>
            `}
          </div>

          ${isAddingIdea ? `
            <div class="inline-editor" style="margin-top: 0.35rem;">
              <input type="text" class="task-input new-idea-input" placeholder="Napište nápad k programu nebo občerstvení...">
              <div class="editor-actions">
                <button class="btn-save-action btn-save-idea">Uložit nápad</button>
                <button class="btn-cancel-action btn-cancel-idea">Zrušit</button>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- PODSEKCE B: MODLITBY -->
        <div class="sub-feedback-box prayers-box">
          <div class="sub-feedback-header prayers-header">
            <span>🙏 Modlitby a přímluvy:</span>
            ${!isAddingPrayer ? `
              <button class="btn-sub-add-link prayers-link" data-key="${key}_addPrayer">+ Přidat modlitbu</button>
            ` : ''}
          </div>

          <div class="sub-feedback-list">
            ${prayerItems.length > 0 ? prayerItems.map((pr, idx) => `
              <div class="sub-feedback-row">
                <span class="prayer-bullet">•</span>
                <span class="sub-feedback-text">${pr}</span>
                <button type="button" class="btn-sub-delete" data-type="prayer" data-idx="${idx}" title="Smazat modlitbu">✕</button>
              </div>
            `).join('') : `
              <div class="sub-feedback-hint">Žádné modlitební náměty.</div>
            `}
          </div>

          ${isAddingPrayer ? `
            <div class="inline-editor" style="margin-top: 0.35rem;">
              <input type="text" class="task-input new-prayer-input" placeholder="Modlitební potřeba, přímluva za hosty...">
              <div class="editor-actions">
                <button class="btn-save-action btn-save-prayer">Uložit modlitbu</button>
                <button class="btn-cancel-action btn-cancel-prayer">Zrušit</button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Posluchače událostí:
    // 1. Účast
    const addMeBtn = card.querySelector('.btn-add-me-tag');
    if (addMeBtn) addMeBtn.addEventListener('click', () => handleToggleAttendance(session));
    const myTagBtn = card.querySelector('.my-tag-prominent');
    if (myTagBtn) myTagBtn.addEventListener('click', () => handleToggleAttendance(session));

    // 2. Admin editace
    const editPlotBtn = card.querySelector('.btn-admin-edit');
    if (editPlotBtn) editPlotBtn.addEventListener('click', () => { activeEditing[`${key}_plot`] = true; render(); });
    const savePlotBtn = card.querySelector('.btn-save-plot');
    if (savePlotBtn) {
      savePlotBtn.addEventListener('click', () => {
        const titleInput = card.querySelector('.admin-title-input');
        const sumArea = card.querySelector('.admin-summary-input');
        const ideaArea = card.querySelector('.admin-idea-input');
        handleSaveAdminPlot(session, titleInput.value, sumArea.value, ideaArea.value);
      });
    }
    const cancelPlotBtn = card.querySelector('.btn-cancel-plot');
    if (cancelPlotBtn) cancelPlotBtn.addEventListener('click', () => { activeEditing[`${key}_plot`] = false; render(); });

    // 3. Úkoly
    const addTaskBtn = card.querySelector('.btn-task-add-link');
    if (addTaskBtn) addTaskBtn.addEventListener('click', () => { activeEditing[`${key}_addTask`] = true; render(); });
    const saveTaskBtn = card.querySelector('.btn-save-task');
    if (saveTaskBtn) {
      saveTaskBtn.addEventListener('click', () => {
        const descInput = card.querySelector('.task-desc-input');
        const personInput = card.querySelector('.task-person-input');
        handleAddTask(session, descInput.value.trim(), personInput.value.trim());
      });
    }
    const cancelTaskBtn = card.querySelector('.btn-cancel-task');
    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', () => { activeEditing[`${key}_addTask`] = false; render(); });
    const assignMeBtn = card.querySelector('.btn-assign-me');
    if (assignMeBtn) {
      assignMeBtn.addEventListener('click', () => {
        const personInput = card.querySelector('.task-person-input');
        if (personInput) personInput.value = currentName;
      });
    }
    card.querySelectorAll('.btn-assign-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => handleToggleAssignTask(session, parseInt(e.currentTarget.dataset.idx, 10)));
    });
    card.querySelectorAll('.btn-task-delete').forEach(btn => {
      btn.addEventListener('click', (e) => handleDeleteTask(session, parseInt(e.currentTarget.dataset.idx, 10)));
    });

    // 4. Otázky
    const addQuestBtn = card.querySelector('.btn-quest-add-link');
    if (addQuestBtn) addQuestBtn.addEventListener('click', () => { activeEditing[`${key}_addQuest`] = true; render(); });
    const saveQuestBtn = card.querySelector('.btn-save-quest');
    if (saveQuestBtn) {
      saveQuestBtn.addEventListener('click', () => {
        const questInput = card.querySelector('.new-question-input');
        handleAddQuestion(session, questInput.value.trim());
      });
    }
    const cancelQuestBtn = card.querySelector('.btn-cancel-quest');
    if (cancelQuestBtn) cancelQuestBtn.addEventListener('click', () => { activeEditing[`${key}_addQuest`] = false; render(); });
    card.querySelectorAll('.btn-quest-delete').forEach(btn => {
      btn.addEventListener('click', (e) => handleDeleteQuestion(session, parseInt(e.currentTarget.dataset.idx, 10)));
    });

    // 5. Nápady
    const addIdeaBtn = card.querySelector('.btn-sub-add-link.ideas-link');
    if (addIdeaBtn) addIdeaBtn.addEventListener('click', () => { activeEditing[`${key}_addIdea`] = true; render(); });
    const saveIdeaBtn = card.querySelector('.btn-save-idea');
    if (saveIdeaBtn) {
      saveIdeaBtn.addEventListener('click', () => {
        const input = card.querySelector('.new-idea-input');
        handleAddIdea(session, input.value.trim());
      });
    }
    const cancelIdeaBtn = card.querySelector('.btn-cancel-idea');
    if (cancelIdeaBtn) cancelIdeaBtn.addEventListener('click', () => { activeEditing[`${key}_addIdea`] = false; render(); });

    // 6. Modlitby
    const addPrayerBtn = card.querySelector('.btn-sub-add-link.prayers-link');
    if (addPrayerBtn) addPrayerBtn.addEventListener('click', () => { activeEditing[`${key}_addPrayer`] = true; render(); });
    const savePrayerBtn = card.querySelector('.btn-save-prayer');
    if (savePrayerBtn) {
      savePrayerBtn.addEventListener('click', () => {
        const input = card.querySelector('.new-prayer-input');
        handleAddPrayer(session, input.value.trim());
      });
    }
    const cancelPrayerBtn = card.querySelector('.btn-cancel-prayer');
    if (cancelPrayerBtn) cancelPrayerBtn.addEventListener('click', () => { activeEditing[`${key}_addPrayer`] = false; render(); });

    // Mazání v nápadech a modlitbách
    card.querySelectorAll('.btn-sub-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        const type = e.currentTarget.dataset.type;
        if (type === 'idea') handleDeleteIdea(session, idx);
        if (type === 'prayer') handleDeletePrayer(session, idx);
      });
    });

    els.list.appendChild(card);
  });
}

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.update();
  }).catch(console.error);
}