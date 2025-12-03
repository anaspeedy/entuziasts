/* ========== Firebase Realtime (config inserted) ========== */
const firebaseConfig = {
  apiKey: "AIzaSyBRs2UN27aXvTGg7bV2wYDHCGH4u7mcqNg",
  authDomain: "apps-48f48.firebaseapp.com",
  databaseURL: "https://apps-48f48-default-rtdb.firebaseio.com",
  projectId: "apps-48f48",
  storageBucket: "apps-48f48.firebasestorage.app",
  messagingSenderId: "935045970314",
  appId: "1:935045970314:web:a5909826f8d58b14017073"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* refs */
const ideasRef = db.ref('ideas');
const scheduleRef = db.ref('schedule');
const statsRef = db.ref('stats');

/* UI references */
const tabs = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.section');
const ideaForm = document.getElementById('ideaForm');
const ideasList = document.getElementById('ideasList');
const scheduleForm = document.getElementById('scheduleForm');
const scheduleBody = document.getElementById('scheduleBody');
const statForm = document.getElementById('statForm');
const todayList = document.getElementById('todayList');

/* helpers */
const statusLabelRU = { pending:'Отложено', inprogress:'В процессе', published:'Опубликовано' };
const nextStatus = s => s==='pending' ? 'inprogress' : s==='inprogress' ? 'published' : 'pending';
const safeKey = s => s.replace(/[.#$\[\]/]/g,'_');
function escapeHtml(text){ if(text===undefined||text===null) return ''; return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* tabs */
tabs.forEach(btn=>{
  btn.addEventListener('click', ()=> {
    sections.forEach(s=>s.classList.remove('active'));
    const id = btn.dataset.section;
    document.getElementById(id).classList.add('active');
  });
});

/* ---------- IDEAS ---------- */
function renderIdeas(data){
  ideasList.innerHTML = '';
  if(!data) return;
  Object.keys(data).forEach(id=>{
    const item = data[id];
    const card = document.createElement('div');
    card.className = `card status-${item.status || 'pending'}`;
    card.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <p><strong>Тема:</strong> ${escapeHtml(item.theme)}</p>
      <p><strong>Формат:</strong> ${escapeHtml(item.format)}</p>
      <p>${escapeHtml(item.desc || '')}</p>
      <p><strong>Статус:</strong> ${statusLabelRU[item.status || 'pending']}</p>
      <div style="margin-top:8px">
        <button class="btn-inline change-status" data-id="${id}">Сменить статус</button>
        <button class="btn-inline delete-idea" data-id="${id}">Удалить</button>
      </div>
    `;
    ideasList.appendChild(card);
  });
}

/* add idea */
ideaForm.addEventListener('submit', e=>{
  e.preventDefault();
  const newIdea = {
    title: document.getElementById('ideaTitle').value.trim(),
    theme: document.getElementById('ideaTheme').value,
    format: document.getElementById('ideaFormat').value,
    desc: document.getElementById('ideaDesc').value.trim(),
    status: document.getElementById('ideaStatus').value || 'pending'
  };
  if(!newIdea.title){ alert('Введите название идеи'); return; }
  ideasRef.push(newIdea);
  ideaForm.reset();
});

/* listen ideas */
ideasRef.on('value', snap=>{
  renderIdeas(snap.exists() ? snap.val() : null);

  const arr = [];
  if(snap.exists()) Object.keys(snap.val()).forEach(k => arr.push(snap.val()[k]));
  renderTopicStats(arr);
  renderToday(); // update today view when ideas change
});

/* delegate idea actions */
ideasList.addEventListener('click', e=>{
  const id = e.target.dataset.id;
  if(!id) return;
  if(e.target.classList.contains('delete-idea')){
    ideasRef.child(id).remove();
    return;
  }
  if(e.target.classList.contains('change-status')){
    ideasRef.child(id).once('value').then(s=>{
      const cur = s.val().status || 'pending';
      const nxt = nextStatus(cur);
      ideasRef.child(id).update({status: nxt});
    });
  }
});

/* ---------- SCHEDULE ---------- */
scheduleForm.addEventListener('submit', e=>{
  e.preventDefault();
  const item = {
    date: document.getElementById('scheduleDate').value,
    time: document.getElementById('scheduleTime').value || '',
    title: document.getElementById('scheduleTitle').value.trim(),
    theme: document.getElementById('scheduleTheme').value,
    format: document.getElementById('scheduleFormat').value,
    done: false
  };
  if(!item.date || !item.title){ alert('Заполните дату и название'); return; }
  scheduleRef.push(item);
  scheduleForm.reset();
});
sheduleBody.addEventListener('input', e=>{
  const id = e.target.dataset.id;
  const field =e.target.dataset.field;
  if(!id||!field) return;
  sheduleRef.child(id).update({ [field]: e.target.value});
});
const sheduleRef = db.ref('shedule');
sheduleRef.on('value', snap =>{
  renderShedule(snap.exists()? snap.val(): null;
  renderTimeStatsFromShedule();
});

function renderSchedule(data) {
  scheduleBody.innerHTML = '';
  if (!data) return;

  Object.keys(data).forEach(id => {
    const it = data[id];
    const tr = document.createElement('tr');

    tr.classList.toggle("row-done", it.done === true);

    tr.innerHTML = `
      <td>${escapeHtml(it.date)}</td>
      <td>${escapeHtml(it.time || "-")}</td>
      <td>${escapeHtml(it.theme)}</td>
      <td>${escapeHtml(it.format)}</td>
      <td>${escapeHtml(it.title)}</td>

      <td>
        <input type="checkbox" class="schedule-done" data-id="${id}" ${it.done ? "checked" : ""}>
      </td>

      <td>
        <button class="btn-inline delete-schedule" data-id="${id}">Удалить</button>
      </td>
    `;

    scheduleBody.appendChild(tr);

    // checkbox handler
    const checkbox = tr.querySelector(".schedule-done");
    checkbox.addEventListener("change", () => {
      scheduleRef.child(id).update({ done: checkbox.checked });
      tr.classList.toggle("row-done", checkbox.checked);
    });

    // delete button handled by delegated listener below
  });
}

scheduleRef.on('value', snap=>{
  renderSchedule(snap.exists() ? snap.val() : null);
  renderTimeStatsFromSchedule();
});

/* edits & delete */
scheduleBody.addEventListener('input', e=>{
  const id = e.target.dataset.id;
  const field = e.target.dataset.field;
  if(!id || !field) return;
  scheduleRef.child(id).update({ [field]: e.target.value });
});
scheduleBody.addEventListener('click', e=>{
  if(e.target.classList.contains('delete-schedule')){
    const id = e.target.dataset.id;
    scheduleRef.child(id).remove();
  }
});

/* ---------- STATS ---------- */
statForm.addEventListener('submit', e=>{
  e.preventDefault();
  const weekRaw = document.getElementById('statWeek').value.trim();
  const title = document.getElementById('statTitle').value.trim() || '—';
  const platform = document.getElementById('statPlatform').value;
  const likes = parseInt(document.getElementById('statLikes').value) || 0;
  const comments = parseInt(document.getElementById('statComments').value) || 0;
  const views = parseInt(document.getElementById('statViews').value) || 0;
  if(!weekRaw){ alert('Введите неделю'); return; }
  const weekKey = safeKey(weekRaw);
  statsRef.child(weekKey).push({ title, platform, likes, comments, views })
    .then(()=> statForm.reset());
});

/* render flat stats (debug/list) */
function renderStats(data){
  // optional, not used in UI, but safe
}

/* stats listener */
statsRef.on('value', snap=>{
  // flatten and render score table
  const flat = [];
  if(snap.exists()){
    Object.keys(snap.val()).forEach(weekKey=>{
      const weekNode = snap.val()[weekKey];
      Object.keys(weekNode).forEach(k => flat.push(weekNode[k]));
    });
  }
  renderScoreStats(flat);
});

/* ---------- STATISTICS: topic / time / score ---------- */

/* topics from ideas */
function renderTopicStats(ideas){
  const counts = {};
  ideas.forEach(i => counts[i.theme] = (counts[i.theme]||0) + 1);
  let html = '<tr><th>Тема</th><th>Постов</th></tr>';
  Object.entries(counts).forEach(([t,c]) => html += `<tr><td>${escapeHtml(t)}</td><td>${c}</td></tr>`);
  document.getElementById('topicStats').innerHTML = html;
}

/* time stats from schedule */
function renderTimeStatsFromSchedule(){
  scheduleRef.once('value').then(snap=>{
    const buckets = {"06:00–12:00":0,"12:00–18:00":0,"18:00–00:00":0,"00:00–06:00":0};
    if(!snap.exists()){
      document.getElementById('timeStats').innerHTML = '<tr><th>Слот</th><th>Публикаций</th></tr>';
      return;
    }
    snap.forEach(c=>{
      const it = c.val();
      if(!it.time) return;
      const h = parseInt(it.time.split(':')[0]);
      if(h>=6 && h<12) buckets["06:00–12:00"]++;
      else if(h>=12 && h<18) buckets["12:00–18:00"]++;
      else if(h>=18 && h<24) buckets["18:00–00:00"]++;
      else buckets["00:00–06:00"]++;
    });
    let html = '<tr><th>Временной слот</th><th>Публикаций</th></tr>';
    Object.entries(buckets).forEach(([slot,cnt]) => html += `<tr><td>${slot}</td><td>${cnt}</td></tr>`);
    document.getElementById('timeStats').innerHTML = html;
  });
}

/* score */
function calculateScore(likes, comments, views){
  if(!views || views < 1) return 0;

  // Engagement Rate
  const er = (likes + comments * 2) / views; 
  // комментарии считаются в 2 раза ценнее лайка

  // Преобразование ER → шкала 0–10
  // 0.05 (5%) = средний контент = 5/10
  // 0.10 (10%) = очень хороший = 8/10
  // 0.20 (20%) = вирусный = 10/10
  let score = er * 50; 
  // 0.20 * 50 = 10

  if(score > 10) score = 10;
  return Math.round(score * 10) / 10; // округление до 0.1
}

  // ideas in process
  ideasRef.once('value').then(snap=>{
    if(snap.exists()){
      snap.forEach(c=>{
        const it = c.val();
        if(it.status === 'inprogress'){
          const div = document.createElement('div');
          div.className = `card status-${it.status}`;
          div.innerHTML = `<h3>${escapeHtml(it.title)}</h3><p>${escapeHtml(it.theme)} · ${escapeHtml(it.format)}</p>`;
          todayList.appendChild(div);
        }
      });
    }
  });



/* initial load */
window.addEventListener('load', ()=> {
  sections.forEach(s=>s.classList.remove('active'));
  document.getElementById('ideas').classList.add('active');
});
