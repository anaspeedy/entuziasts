// ---------------- Firebase config (Realtime DB) ----------------
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

// ---------------- UI — tabs ----------------
const tabs = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.section');
tabs.forEach(btn=>{
  btn.addEventListener('click', ()=> {
    sections.forEach(s=>s.classList.remove('active'));
    document.getElementById(btn.dataset.section).classList.add('active');
  });
});

// ---------------- HELPERS ----------------
const statusLabelRU = {
  pending: 'Отложено',
  inprogress: 'В процессе',
  published: 'Опубликовано'
};
const nextStatus = s => s==='pending' ? 'inprogress' : s==='inprogress' ? 'published' : 'pending';
const safeKey = s => s.replace(/[.#$\[\]/]/g,'_'); // для ключа недели

// ---------------- IDEAS ----------------
const ideaForm = document.getElementById('ideaForm');
const ideasList = document.getElementById('ideasList');
const ideasRef = db.ref('ideas');

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
// --- Статистика по темам ---
function renderTopicStats(ideas) {
    let html = "<tr><th>Тема</th><th>Количество постов</th></tr>";
    const counts = {};
    ideas.forEach(idea => {
        if (!counts[idea.theme]) counts[idea.theme] = 0;
        counts[idea.theme]++;
    });
    Object.entries(counts).forEach(([theme, count]) => {
        html += `<tr><td>${theme}</td><td>${count}</td></tr>`;
    });
    document.getElementById("topicStats").innerHTML = html;
}

// --- Статистика по времени публикаций ---
function renderTimeStats(ideas) {
    let html = "<tr><th>Временной слот</th><th>Количество публикаций</th></tr>";
    const buckets = {"06:00–12:00":0,"12:00–18:00":0,"18:00–00:00":0,"00:00–06:00":0};
    ideas.forEach(i => {
        if (!i.time) return;
        const [h] = i.time.split(":").map(Number);
        if (h >=6 && h<12) buckets["06:00–12:00"]++;
        else if (h>=12 && h<18) buckets["12:00–18:00"]++;
        else if (h>=18 && h<24) buckets["18:00–00:00"]++;
        else buckets["00:00–06:00"]++;
    });
    Object.entries(buckets).forEach(([slot, count]) => {
        html += `<tr><td>${slot}</td><td>${count}</td></tr>`;
    });
    document.getElementById("timeStats").innerHTML = html;
}

// --- Автоматическая оценка эффективности ---
function renderScoreStats(stats) {
    let html = "<tr><th>Название поста</th><th>Оценка</th><th>Эффективность</th></tr>";
    stats.forEach(s => {
        if (!s.views || !s.likes) return;
        const ratio = (s.likes / s.views) * 100;
        const score = Math.min(10,(ratio/2).toFixed(1));
        let level="Средний", cls="score-medium";
        if (score>=8){level="Вирусный"; cls="score-high";}
        else if(score<=3){level="Слабый"; cls="score-low";}
        html += `<tr>
            <td>${s.title}</td>
            <td>${score}/10</td>
            <td class="${cls}">${level}</td>
        </tr>`;
    });
    document.getElementById("scoreStats").innerHTML = html;
}

onValue(ideasRef, snapshot=>{
    const ideas=[];
    snapshot.forEach(c=>ideas.push(c.val()));
    renderIdeas(ideas);
    renderTopicStats(ideas);
    renderTimeStats(ideas);
});

// Статистика постов (лайки/просмотры)
onValue(statsRef, snapshot=>{
    const stats=[];
    snapshot.forEach(c=>stats.push(c.val()));
    renderScoreStats(stats);
});

// submit new idea
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

// listen ideas
ideasRef.on('value', snap=>{
  renderIdeas(snap.exists() ? snap.val() : null);
});

// delegate idea buttons
ideasList.addEventListener('click', e=>{
  const id = e.target.dataset.id;
  if(!id) return;
  if(e.target.classList.contains('delete-idea')){
    db.ref('ideas/'+id).remove();
    return;
  }
  if(e.target.classList.contains('change-status')){
    // get current and update to next
    db.ref('ideas/'+id).once('value').then(s=>{
      const cur = s.val().status || 'pending';
      const nxt = nextStatus(cur);
      db.ref('ideas/'+id).update({status: nxt});
    });
  }
});

// ---------------- SCHEDULE ----------------
const scheduleForm = document.getElementById('scheduleForm');
const scheduleBody = document.getElementById('scheduleBody');
const scheduleRef = db.ref('schedule');

scheduleForm.addEventListener('submit', e=>{
  e.preventDefault();
  const item = {
    date: document.getElementById('scheduleDate').value,
    title: document.getElementById('scheduleTitle').value.trim(),
    theme: document.getElementById('scheduleTheme').value,
    format: document.getElementById('scheduleFormat').value
  };
  if(!item.date || !item.title){ alert('Заполните дату и название'); return; }
  scheduleRef.push(item);
  scheduleForm.reset();
});

function renderSchedule(data){
  scheduleBody.innerHTML = '';
  if(!data) return;
  Object.keys(data).forEach(id=>{
    const it = data[id];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input data-id="${id}" data-field="date" value="${escapeHtml(it.date)}"></td>
      <td><input data-id="${id}" data-field="theme" value="${escapeHtml(it.theme)}"></td>
      <td><input data-id="${id}" data-field="format" value="${escapeHtml(it.format)}"></td>
      <td><input data-id="${id}" data-field="title" value="${escapeHtml(it.title)}"></td>
      <td><button class="btn-inline delete-schedule" data-id="${id}">Удалить</button></td>
    `;
    scheduleBody.appendChild(tr);
  });
}

scheduleRef.on('value', snap=>{
  renderSchedule(snap.exists() ? snap.val() : null);
});

// delegate edits & delete in schedule
scheduleBody.addEventListener('input', e=>{
  const id = e.target.dataset.id;
  const field = e.target.dataset.field;
  if(!id || !field) return;
  const value = e.target.value;
  scheduleRef.child(id).update({ [field]: value });
});
scheduleBody.addEventListener('click', e=>{
  if(e.target.classList.contains('delete-schedule')){
    const id = e.target.dataset.id;
    scheduleRef.child(id).remove();
  }
});

// ---------------- STATS ----------------
const statForm = document.getElementById('statForm');
const statsList = document.getElementById('statsList');
const statsRef = db.ref('stats');

statForm.addEventListener('submit', e=>{
  e.preventDefault();
  const weekRaw = document.getElementById('statWeek').value.trim();
  const platform = document.getElementById('statPlatform').value;
  const likes = parseInt(document.getElementById('statLikes').value) || 0;
  const comments = parseInt(document.getElementById('statComments').value) || 0;
  const views = parseInt(document.getElementById('statViews').value) || 0;
  if(!weekRaw){ alert('Введите неделю'); return; }
  const weekKey = safeKey(weekRaw);
  // записываем под stats/<weekKey>/<platform>
  statsRef.child(weekKey).child(platform).set({ likes, comments, views })
    .then(()=> {
      statForm.reset();
    });
});

// render stats: grouped by week
function renderStats(data){
  statsList.innerHTML = '';
  if(!data) return;
  Object.keys(data).forEach(weekKey=>{
    const weekNode = data[weekKey];
    const div = document.createElement('div');
    div.className = 'card';
    // display original week string by reversing safeKey (we stored raw week in first platform? to be safe show key)
    const displayWeek = weekKey.replace(/_/g,' ');
    div.innerHTML = `<h3>Неделя: ${displayWeek}</h3>`;
    ['VK','TikTok','Instagram'].forEach(platform=>{
      if(weekNode[platform]){
        const p = weekNode[platform];
        div.innerHTML += `<p><strong>${platform}:</strong> Лайки ${p.likes}, Комментарии ${p.comments}, Просмотры ${p.views}</p>`;
      }
    });
    statsList.appendChild(div);
  });
}

statsRef.on('value', snap=>{
  renderStats(snap.exists() ? snap.val() : null);
});

// ---------------- UTIL ----------------
function escapeHtml(text){
  if(!text && text!==0) return '';
  return String(text)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039');
}