import { CONFIG } from './config.js';
import { Store } from './store.js';
import { API } from './api.js';

const els = {
  userName: document.getElementById('userName'),
  userPin: document.getElementById('userPin'),
  statusText: document.getElementById('statusText'),
  refreshBtn: document.getElementById('refreshBtn'),
  list: document.getElementById('sessionsList')
};

// Inicializace polí
els.userName.value = Store.state.userName;
els.userPin.value = Store.state.pin;

els.userName.addEventListener('input', (e) => {
  Store.setUserName(e.target.value);
  render();
});

els.userPin.addEventListener('input', (e) => {
  Store.setPin(e.target.value);
});

els.refreshBtn.addEventListener('click', syncData);

async function syncData() {
  els.statusText.textContent = 'Synchronizuji s tabulkou...';
  const res = await API.fetchAttendance();

  if (res.demo) {
    els.statusText.textContent = 'Režim ukázky (vložte SCRIPT_URL).';
  } else if (res.success) {
    Store.loadSheetData(res.data);
    els.statusText.textContent = 'Aktualizováno právě teď.';
  } else {
    els.statusText.textContent = 'Chyba synchronizace.';
  }
  render();
}

async function handleToggle(session) {
  const name = Store.state.userName;
  const pin = Store.state.pin;
  const key = `${session.day}-${session.month}`;

  if (!name) {
    alert('Zadejte prosím své jméno v horní liště.');
    els.userName.focus();
    return;
  }
  if (!pin) {
    alert('Zadejte prosím PIN pro uložení změn.');
    els.userPin.focus();
    return;
  }

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
    alert('Chyba při zápisu: ' + (res.message || 'Nesprávný PIN'));
    els.statusText.textContent = 'Zápis se nezdařil.';
  }

  render();
}

function render(isSaving = false) {
  els.list.innerHTML = '';
  const currentName = Store.state.userName;

  CONFIG.SESSIONS.forEach((session) => {
    const key = `${session.day}-${session.month}`;
    const data = Store.state.sessionsData[key] || { attendees: [], info: '' };
    const attendees = data.attendees;
    const isPresent = currentName && attendees.includes(currentName);

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

      ${data.info ? `
        <div class="info-section">
          <div class="info-label">Poznámka k večeru:</div>
          <div class="info-text">${data.info}</div>
        </div>
      ` : ''}

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
        ${isPresent ? 'Odhlásit mou účast' : '+ Budu přítomen'}
      </button>
    `;

    card.querySelector('.btn-toggle').addEventListener('click', () => handleToggle(session));
    els.list.appendChild(card);
  });
}

// Registrace Service Workeru
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

// Spuštění
syncData();