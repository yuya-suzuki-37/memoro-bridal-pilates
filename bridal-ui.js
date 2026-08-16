// ===================================================================
// BRIDAL PILATES — フロントエンド（入口 / 見立て / 今日 / 30日カレンダー）
// 姿勢（写真診断 or セルフチェック）× 理想（ドレス・雰囲気）× 部位 から、
// 専門的な見立て文（カウンセリング）と "あなた専用" の30日を生成する。
// ===================================================================
import { build30DayProgram } from './program.js';
import { ALL_EXERCISES } from './prescription-matrix.js';
import { BRIDAL_PARTS, BRIDAL_PART_ORDER } from './bridal-parts.js';
import { diagnoseFromPhotos } from './posture-detect.js';
import { DRESS_TYPES, DRESS_ORDER, MOOD_TYPES, MOOD_ORDER, buildAdvice } from './advice.js';
import { plainify } from './plain-text.js';
import { evidenceFor, citationLinks, PART_EFFECT, SPOT_NOTE } from './evidence.js';
import { computeScore, gradeFromScore, improvementText } from './score.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const STORE_KEY = 'bridalPilates.v1';

const POSTURE_CHECKS = [
  { key: 'thoracicKyphosis', label: '背中が丸まりがち（猫背）' },
  { key: 'roundedShoulders', label: '肩が前に入っている（巻き肩）' },
  { key: 'forwardHead', label: 'あごが前に出る・ストレートネック' },
  { key: 'anteriorPelvicTilt', label: '腰が反りやすい（反り腰）' },
  { key: 'swayBack', label: '立つとお腹が前に出て猫背になる' },
  { key: 'lateralAsymmetry', label: '左右で肩や腰の高さが違う' },
  { key: 'kneeValgus', label: '脚のライン（X脚・O脚）が気になる' },
];

const PROBLEM_LABELS = {
  thoracicKyphosis: '猫背', roundedShoulders: '巻き肩', forwardHead: 'ストレートネック',
  anteriorPelvicTilt: '反り腰', posteriorPelvicTilt: '骨盤後傾', swayBack: 'スウェイバック',
  lateralAsymmetry: '左右差', kneeValgus: '脚のねじれ', ankleStiffness: '足首の硬さ',
};

const state = {
  weddingDate: null,
  selectedParts: [],
  dress: null,
  mood: null,
  postureChecks: [],
  diagnosedKeys: [],
  diagnosedProblems: [],
  photoSide: null,
  photoFront: null,
  problemKeys: [],
  advice: null,
  startDate: null,
  done: {},
  program: [],
  phase: 1,
  // 結果の可視化（Before / After）
  beforeScore: null,
  beforeGrade: null,
  beforeDate: null,
  beforePhoto: null,
  afterScore: null,
  afterGrade: null,
  afterDate: null,
  afterPhoto: null,
  // 整える習慣（日ごと）
  habits: {},
};

// ---------- 永続化 ----------
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify({
    weddingDate: state.weddingDate,
    selectedParts: state.selectedParts,
    dress: state.dress,
    mood: state.mood,
    postureChecks: state.postureChecks,
    diagnosedProblems: state.diagnosedProblems,
    problemKeys: state.problemKeys,
    startDate: state.startDate,
    done: state.done,
    beforeScore: state.beforeScore,
    beforeGrade: state.beforeGrade,
    beforeDate: state.beforeDate,
    beforePhoto: state.beforePhoto,
    afterScore: state.afterScore,
    afterGrade: state.afterGrade,
    afterDate: state.afterDate,
    afterPhoto: state.afterPhoto,
    habits: state.habits,
  }));
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!d || !d.startDate || !(d.selectedParts || []).length) return false;
    Object.assign(state, d);
    state.postureChecks = d.postureChecks || [];
    state.program = build30DayProgram(state.problemKeys, state.selectedParts);
    return true;
  } catch (e) { return false; }
}

// ---------- 日付 ----------
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
function dayDiff(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
function currentDay() {
  if (!state.startDate) return 1;
  return Math.min(30, Math.max(1, dayDiff(state.startDate, todayISO()) + 1));
}

// ---------- 画面遷移 ----------
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
}
function showView(name) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
}

// ---------- 入口: 部位チップ ----------
function renderParts() {
  $('#parts-grid').innerHTML = BRIDAL_PART_ORDER.map(id => {
    const p = BRIDAL_PARTS[id];
    const on = state.selectedParts.includes(id);
    return `<button type="button" class="part-chip ${on ? 'active' : ''}" data-part="${id}">
      <span class="part-name">${p.name}</span>
      <span class="part-dress">${p.dress}</span>
    </button>`;
  }).join('');
  $$('#parts-grid .part-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.part;
      const i = state.selectedParts.indexOf(id);
      if (i >= 0) state.selectedParts.splice(i, 1);
      else state.selectedParts.push(id);
      chip.classList.toggle('active');
      updateStartBtn();
    });
  });
}

// ---------- 入口: 理想（ドレス・雰囲気）----------
function renderDress() {
  $('#dress-grid').innerHTML = DRESS_ORDER.map(id => {
    const on = state.dress === id;
    return `<button type="button" class="mini-chip ${on ? 'active' : ''}" data-dress="${id}">${DRESS_TYPES[id].name}</button>`;
  }).join('');
  $$('#dress-grid .mini-chip').forEach(el => el.addEventListener('click', () => {
    state.dress = state.dress === el.dataset.dress ? null : el.dataset.dress;
    renderDress();
  }));
}
function renderMood() {
  $('#mood-grid').innerHTML = MOOD_ORDER.map(id => {
    const on = state.mood === id;
    return `<button type="button" class="mini-chip ${on ? 'active' : ''}" data-mood="${id}">${MOOD_TYPES[id].name}</button>`;
  }).join('');
  $$('#mood-grid .mini-chip').forEach(el => el.addEventListener('click', () => {
    state.mood = state.mood === el.dataset.mood ? null : el.dataset.mood;
    renderMood();
  }));
}

// ---------- 入口: 姿勢セルフチェック ----------
function renderPostureCheck() {
  $('#posture-check').innerHTML = POSTURE_CHECKS.map(c => {
    const on = state.postureChecks.includes(c.key);
    return `<button type="button" class="check-item ${on ? 'active' : ''}" data-key="${c.key}">
      <span class="check-box">${on ? '✓' : ''}</span><span class="check-label">${c.label}</span>
    </button>`;
  }).join('');
  $$('#posture-check .check-item').forEach(el => {
    el.addEventListener('click', () => {
      const k = el.dataset.key;
      const i = state.postureChecks.indexOf(k);
      if (i >= 0) state.postureChecks.splice(i, 1);
      else state.postureChecks.push(k);
      el.classList.toggle('active');
      el.querySelector('.check-box').textContent = state.postureChecks.includes(k) ? '✓' : '';
    });
  });
}

// ---------- 入口: 写真姿勢診断 ----------
function setupPhotoInputs() {
  bindPhoto('photo-side', 'ph-side', 'photoSide', '側面写真');
  bindPhoto('photo-front', 'ph-front', 'photoFront', '正面写真');
  // スロットのどこをタップしてもファイル選択を起動（label非依存・Safari/Chrome両対応）
  $$('[data-photo-trigger]').forEach(slot => {
    slot.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return; // input自身のクリックは無視（無限ループ防止）
      const input = document.getElementById(slot.dataset.photoTrigger);
      if (input) input.click();
    });
  });
  const btn = $('#btn-diagnose');
  if (btn) btn.addEventListener('click', runDiagnosis);
}
function bindPhoto(inputId, phId, stateKey, labelJa) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const ph = document.getElementById(phId);
    const btn = $('#btn-diagnose');
    // 選択直後に「読み込み中」を表示（無反応をなくす）
    if (ph) { ph.classList.remove('has-photo'); ph.innerHTML = `⏳ ${labelJa} 読み込み中…`; }
    // 画像デコード：HEIC/HEIF（iPhone写真）はlibheifで、それ以外はcreateImageBitmapで
    let decoded = null;
    const isHeic = /\.(heic|heif)$/i.test(f.name) || /image\/(heic|heif)/i.test(f.type);
    if (isHeic) {
      if (ph) ph.innerHTML = `⏳ ${labelJa} 変換中…（iPhone形式・数秒）`;
      try {
        decoded = await heicToBitmap(f);
      } catch (e0) {
        if (ph) ph.innerHTML = `⚠ HEIC読み込み失敗：${(e0 && e0.message) || e0}`;
        state[stateKey] = null; if (btn) btn.disabled = true; return;
      }
    } else {
      try {
        decoded = await createImageBitmap(f);
      } catch (e1) {
        try { decoded = await loadImageEl(f); } catch (e2) { decoded = null; }
      }
    }
    if (decoded) {
      state[stateKey] = decoded;
      if (ph) { ph.classList.add('has-photo'); ph.innerHTML = `✓ ${labelJa} 選択済み`; }
    } else {
      state[stateKey] = null;
      if (ph) { ph.classList.remove('has-photo'); ph.innerHTML = `⚠ 読み込めない形式（JPEG/PNGでお試しください）`; }
    }
    if (btn) btn.disabled = !state.photoSide;
  });
}
// File → HTMLImageElement（createImageBitmap失敗時のフォールバック）
function loadImageEl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('decode failed')); };
    img.src = URL.createObjectURL(file);
  });
}
// HEIC/HEIF（iPhone写真）→ ImageBitmap（libheif-jsでデコード・新iPhone形式に対応）
let _libheifMod = null;
async function getLibheif() {
  if (_libheifMod) return _libheifMod;
  if (typeof libheif === 'undefined') throw new Error('libheif未読込（⌘⇧Rでリロードを）');
  _libheifMod = (typeof libheif === 'function') ? await libheif() : libheif;
  return _libheifMod;
}
async function heicToBitmap(file) {
  const lib = await getLibheif();
  const buf = new Uint8Array(await file.arrayBuffer());
  const decoder = new lib.HeifDecoder();
  const data = decoder.decode(buf);
  if (!data || !data.length) throw new Error('画像を検出できません');
  const image = data[0];
  const w = image.get_width(), h = image.get_height();
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(w, h);
  await new Promise((resolve, reject) => {
    image.display(imageData, (displayData) => {
      if (!displayData) { reject(new Error('デコードに失敗しました')); return; }
      ctx.putImageData(displayData, 0, 0);
      resolve();
    });
  });
  return await createImageBitmap(canvas);
}
// Before/After写真: canvasで縮小しJPEG dataURL化（端末内のみ保存・容量削減）
function fileToDataURL(file, maxW = 720) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('画像の読み込みに失敗しました')); };
    img.src = URL.createObjectURL(file);
  });
}
async function runDiagnosis() {
  const status = $('#diagnose-status');
  const btn = $('#btn-diagnose');
  if (!state.photoSide) return;
  btn.disabled = true;
  status.className = 'diagnose-status';
  try {
    const res = await diagnoseFromPhotos(state.photoSide, state.photoFront, msg => { status.textContent = msg; });
    state.diagnosedKeys = res.problemKeys;
    state.diagnosedProblems = res.problems || [];
    res.problemKeys.forEach(k => { if (!state.postureChecks.includes(k)) state.postureChecks.push(k); });
    renderPostureCheck();
    const names = res.problemKeys.map(k => PROBLEM_LABELS[k] || k).filter(Boolean);
    status.innerHTML = names.length
      ? `<span class="diag-ok">✓ 診断完了：<strong>${names.join('・')}</strong> の傾向を検出。下のチェックに反映しました。</span>`
      : `<span class="diag-ok">✓ 診断完了：大きな姿勢の崩れは見られませんでした。気になる部位を選んで進めましょう。</span>`;
  } catch (e) {
    status.innerHTML = `<span class="diag-err">${e.message || '解析に失敗しました。別の写真をお試しください。'}</span>`;
  } finally {
    btn.disabled = !state.photoSide;
  }
}

function updateCountdown() {
  const el = $('#countdown');
  if (!state.weddingDate) { el.textContent = ''; return; }
  const d = dayDiff(todayISO(), state.weddingDate);
  if (d > 0) el.innerHTML = `本番まで <strong>あと ${d}日</strong>`;
  else if (d === 0) el.innerHTML = `<strong>本番当日</strong>です`;
  else el.textContent = '設定日を過ぎています';
}
function updateStartBtn() {
  $('#btn-start').disabled = !(state.weddingDate && state.selectedParts.length);
}

function partsToProblems(parts) {
  const set = new Set();
  parts.forEach(p => (BRIDAL_PARTS[p].posture || []).forEach(k => set.add(k)));
  return Array.from(set);
}

// ---------- 見立て（カウンセリング）----------
async function start() {
  state.problemKeys = state.diagnosedKeys.length ? [...new Set([...state.diagnosedKeys, ...state.postureChecks])]
    : state.postureChecks.length ? [...state.postureChecks]
      : partsToProblems(state.selectedParts);
  state.startDate = todayISO();
  state.done = {};
  // Before スコアを記録（写真診断のproblems優先 → セルフチェック）
  if (state.beforeScore == null) {
    state.beforeScore = computeScore({ diagnosedProblems: state.diagnosedProblems, checkKeys: state.postureChecks });
    state.beforeGrade = gradeFromScore(state.beforeScore).grade;
    state.beforeDate = todayISO();
  }
  state.program = build30DayProgram(state.problemKeys, state.selectedParts);
  const wd = state.weddingDate ? dayDiff(todayISO(), state.weddingDate) : null;
  state.advice = buildAdvice({
    problemKeys: state.problemKeys,
    selectedParts: state.selectedParts,
    dress: state.dress,
    mood: state.mood,
    weddingDays: wd,
  });
  save();
  await runAnalyzing();
  renderAdvice();
  showScreen('advice');
}

// 解析中の演出（進捗リング＋項目チェック）— 診断→見立ての"間"を作り込む（kogaoと統一）
function runAnalyzing() {
  return new Promise(resolve => {
    const items = ['姿勢のクセ', '気になる部位', '理想のシルエット', '30日の組み立て', 'メニューの最適化'];
    const ov = document.createElement('div');
    ov.className = 'analyzing-ov';
    ov.innerHTML = `
      <div class="az-card">
        <div class="az-ring">
          <svg viewBox="0 0 80 80"><circle class="az-track" cx="40" cy="40" r="34"/><circle class="az-prog" cx="40" cy="40" r="34"/></svg>
          <span class="az-pct">0%</span>
        </div>
        <p class="az-title">あなたの姿勢を解析しています</p>
        <ul class="az-list">${items.map((t) => `<li><span class="az-check"></span>${t}</li>`).join('')}</ul>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('in'));
    const lis = ov.querySelectorAll('.az-list li');
    lis.forEach((li, i) => setTimeout(() => li.classList.add('done'), 380 + i * 330));
    const pctEl = ov.querySelector('.az-pct'), progEl = ov.querySelector('.az-prog');
    let p = 0;
    const tick = setInterval(() => {
      p = Math.min(100, p + 2); pctEl.textContent = p + '%';
      progEl.style.strokeDashoffset = String(214 * (1 - p / 100));
      if (p >= 100) clearInterval(tick);
    }, 34);
    setTimeout(() => { ov.classList.add('out'); setTimeout(() => { ov.remove(); resolve(); }, 400); }, 2200);
  });
}
function renderAdvice() {
  const a = state.advice;
  if (!a) return;
  $('#adv-current').textContent = a.current;
  $('#adv-ideal').textContent = a.ideal;
  $('#adv-design').textContent = a.design;
  $('#adv-future').textContent = a.future;
  const tags = [...(a.postureNames || []), ...(a.partNames || [])];
  $('#advice-tags').innerHTML = tags.map(t => `<span class="dx-chip">${t}</span>`).join('');
}
function enterApp() {
  showScreen('app');
  showView('today');
  renderPersonalSummary();
  renderToday();
  renderCalendar();
  renderChange();
}

// ---------- パーソナル要約（app内・簡易）----------
function renderPersonalSummary() {
  const el = $('#personal-summary');
  if (!el) return;
  const postureNames = state.problemKeys.map(k => PROBLEM_LABELS[k]).filter(Boolean);
  const partNames = state.selectedParts.map(p => BRIDAL_PARTS[p] && BRIDAL_PARTS[p].name).filter(Boolean);
  const wd = state.weddingDate ? dayDiff(todayISO(), state.weddingDate) : null;
  const partEffects = state.selectedParts.map(p => PART_EFFECT[p] && PART_EFFECT[p].honest).filter(Boolean);
  el.innerHTML = `
    <div class="ps-days">${(wd != null && wd >= 0) ? `本番まで <strong>あと ${wd}日</strong>` : 'あなた専用の30日プログラム'}</div>
    <div class="ps-type">姿勢のクセ：<strong>${postureNames.length ? postureNames.join('・') : 'セルフチェック未入力'}</strong></div>
    <div class="ps-plan"><strong>${partNames.length ? partNames.join('・') : '全身'}</strong>を重点に整える“あなた専用”メニューです。</div>
    ${partEffects.length ? `<div class="ps-effects">${partEffects.map(e => `<div class="ps-effect">✓ ${e}</div>`).join('')}</div>` : ''}
    <div class="ps-note">${SPOT_NOTE}</div>
  `;
}

// ---------- 種目カード ----------
function catLabel(ex) {
  return ['selfcare', 'mobility', 'breath', 'meditation'].includes(ex.category) ? 'セルフケア' : 'トレーニング';
}
function catClass(ex) {
  return ['selfcare', 'mobility', 'breath', 'meditation'].includes(ex.category) ? 'selfcare' : 'training';
}
function exerciseBadges(ex) {
  const mine = new Set(state.problemKeys);
  const hit = (ex.targetProblems || []).filter(k => mine.has(k));
  if (!hit.length) return '';
  return `<div class="ex-badges">${hit.slice(0, 2).map(k => `<span class="ex-badge">${PROBLEM_LABELS[k] || k}に効く</span>`).join('')}</div>`;
}
// 頻出種目は実写フォーム写真を使用（棒人間SVGより"やり方が伝わる"。他種目はSVGのまま＝ハイブリッド）
const PHOTO_EXERCISES = new Set(['pl_chest_opener','pl_pelvic_clock','pl_mermaid','pl_thread_needle','pl_swan_arms','pl_wall_angel','pl_standing_arm_circles','pl_rolldown','pl_spine_twist_supine','pl_imprint','pl_seated_forward','pl_ankle_circle','pl_neck_release','pl_calf_stretch','pl_standing_roll_down','pl_standing_side_bend','pl_chin_tuck','pl_spine_stretch','pl_seal','pl_standing_rollup']);
function exVisual(ex, cls) {
  if (PHOTO_EXERCISES.has(ex.id)) {
    return `<img class="${cls}" src="images/exercises/${ex.id}.png" alt="${ex.name}" loading="lazy">`;
  }
  return ex.illustration || '';
}
function exerciseCard(ex) {
  return `<div class="ex-card" data-ex="${ex.id}">
    <div class="ex-illust">${exVisual(ex, 'ex-photo')}</div>
    <div class="ex-info">
      <span class="ex-cat ${catClass(ex)}">${catLabel(ex)}</span>
      <h4 class="ex-name">${ex.name}</h4>
      <div class="ex-meta"><span>⏱ ${ex.duration || ''}</span></div>
      <p class="ex-purpose">${plainify(ex.purpose) || ''}</p>
      ${exerciseBadges(ex)}
    </div>
  </div>`;
}
function bindCards(root) {
  root.querySelectorAll('.ex-card').forEach(c => {
    c.addEventListener('click', () => openExercise(ALL_EXERCISES[c.dataset.ex]));
  });
}

// ---------- 今日 ----------
const PHASE_JA = ['', '解放', '活性化', '仕上げ'];
function renderToday() {
  const day = currentDay();
  const d = state.program[day - 1];
  if (!d) return;
  $('#today-daynum').textContent = `DAY ${String(day).padStart(2, '0')}`;
  const wd = state.weddingDate ? dayDiff(todayISO(), state.weddingDate) : null;
  $('#today-countdown').textContent = (wd != null && wd >= 0) ? `本番まであと ${wd}日` : '';
  $('#today-phase').textContent = `Phase ${d.phase} ／ ${PHASE_JA[d.phase]}`;
  $('#today-theme').textContent = d.isRest ? 'アクティブレスト・呼吸を整える' : d.theme;
  const list = [...(d.selfcare || []), ...(d.training || [])];
  $('#today-grid').innerHTML = list.map(exerciseCard).join('');
  bindCards($('#today-grid'));
  const done = !!state.done[day];
  const btn = $('#btn-complete');
  btn.textContent = done ? '✓ 完了しました（タップで取消）' : '今日のレッスンを完了';
  btn.classList.toggle('done', done);
  renderHabits();
}

// ---------- 整える習慣（栄養・睡眠）----------
const HABITS = [
  { key: 'water', icon: '💧', label: '水を1.5Lこまめに飲む', hint: 'めぐり・むくみ対策に' },
  { key: 'protein', icon: '🍗', label: '朝か昼にタンパク質をとる', hint: '筋肉と肌の材料に' },
  { key: 'salt', icon: '🧂', label: '塩分は控えめにする', hint: '翌朝のむくみ対策に' },
  { key: 'dinner', icon: '🌙', label: '就寝3時間前までに夕食', hint: '睡眠の質・むくみに' },
  { key: 'sleep', icon: '😴', label: '7時間ねむる', hint: '回復と肌の調子に' },
];
function renderHabits() {
  const el = $('#today-habits');
  if (!el) return;
  const day = currentDay();
  const rec = (state.habits && state.habits[day]) || {};
  const n = HABITS.filter(h => rec[h.key]).length;
  el.innerHTML = `
    <div class="hb-head"><h3 class="hb-title">今日の整える習慣</h3><span class="hb-count">${n}/${HABITS.length}</span></div>
    <p class="hb-lead">運動に“生活”を少し足すと、変化が出やすくなります。</p>
    <div class="hb-list">
      ${HABITS.map(h => `<button type="button" class="hb-item ${rec[h.key] ? 'on' : ''}" data-habit="${h.key}">
        <span class="hb-check">${rec[h.key] ? '✓' : ''}</span>
        <span class="hb-ico">${h.icon}</span>
        <span class="hb-body"><span class="hb-label">${h.label}</span><span class="hb-hint">${h.hint}</span></span>
      </button>`).join('')}
    </div>
    <button type="button" id="btn-guide" class="hb-guide">📖 花嫁の食事・むくみケア ガイド</button>`;
  $$('#today-habits .hb-item').forEach(b => b.addEventListener('click', () => {
    const d = currentDay();
    if (!state.habits) state.habits = {};
    if (!state.habits[d]) state.habits[d] = {};
    const k = b.dataset.habit;
    state.habits[d][k] = !state.habits[d][k];
    save();
    renderHabits();
  }));
  const gb = $('#btn-guide');
  if (gb) gb.addEventListener('click', openGuide);
}

// ---------- 食事・むくみケア ガイド（B-2 / B-3）----------
const GUIDE_HTML = `
  <button class="modal-close" data-close>✕</button>
  <h3 class="modal-title">花嫁の食事・むくみケア</h3>
  <p class="guide-intro">運動と一緒に“食べ方”を整えると、ドレス姿のコンディションづくりに役立ちます。むずかしく考えず、できる範囲でOKです。</p>
  <div class="guide-sec">
    <h4>🍽 3つの基本</h4>
    <ul class="guide-list">
      <li><b>タンパク質</b>を毎食：肉・魚・卵・大豆・乳から手のひら1枚分。筋肉と肌の材料になります。</li>
      <li><b>水分</b>は1日1.5Lめやす：一度にではなくこまめに。めぐり・むくみ対策の基本です。</li>
      <li><b>塩分・糖分</b>はとりすぎ注意：味つけは薄めを意識。加工食品・外食は塩分が多めです。</li>
    </ul>
  </div>
  <div class="guide-sec">
    <h4>💧 むくみ対策</h4>
    <ul class="guide-list">
      <li>塩分を控えめに（だし・酸味・香りで薄味でも満足に）</li>
      <li>カリウムをとる：野菜・果物・海藻・いも類・豆類</li>
      <li>水分は減らさずしっかり（減らすと逆にためこみやすくなります）</li>
      <li>夜おそい食事・お酒は控えめに</li>
    </ul>
  </div>
  <div class="guide-sec">
    <h4>✨ 肌の調子に</h4>
    <ul class="guide-list">
      <li>タンパク質＋ビタミン（緑黄色野菜・果物）をそろえる</li>
      <li>睡眠をしっかり（7時間めやす）</li>
      <li>脂っこいもの・甘いもののとりすぎに注意</li>
    </ul>
  </div>
  <div class="guide-sec">
    <h4>👰 前日＆当日</h4>
    <div class="guide-day">
      <p><b>前日</b>：塩分控えめ・消化に良いものを中心に。水分はいつも通り。お酒はほどほどにして、早めに休みましょう。</p>
      <p><b>当日</b>：朝は軽め＆薄味に。水分はほどほど。直前の食べすぎ・炭酸のとりすぎに注意すると、お腹まわりが気になりにくくなります。</p>
    </div>
  </div>
  <p class="guide-note">※これは健康・美容の一般的な情報提供であり、医療・栄養指導ではありません。合う方法は体質・体調により異なり、効果には個人差があります。妊娠中・授乳中・持病のある方、通院中・食事制限のある方は、医師・管理栄養士にご相談ください。</p>
  <p class="guide-src">参考：厚生労働省 e-ヘルスネット（水分・減塩・カリウム）／「日本人の食事摂取基準」</p>
`;
function openGuide() { openModal(GUIDE_HTML); }

// ---------- カレンダー ----------
function renderCalendar() {
  const days = state.program.filter(d => d.phase === state.phase);
  const cd = currentDay();
  $('#calendar-grid').innerHTML = days.map(d => {
    const done = !!state.done[d.day];
    const isToday = d.day === cd;
    return `<div class="day-card ${d.isRest ? 'rest' : ''} ${done ? 'done' : ''} ${isToday ? 'today' : ''}" data-day="${d.day}">
      <div class="day-num">${String(d.day).padStart(2, '0')}</div>
      <div class="day-theme">${d.isRest ? 'アクティブレスト' : d.theme}</div>
      ${done ? '<span class="day-check">✓</span>' : (d.isRest ? '<span class="day-tag">休</span>' : '')}
    </div>`;
  }).join('');
  $$('#calendar-grid .day-card').forEach(c => {
    c.addEventListener('click', () => openDay(state.program[+c.dataset.day - 1]));
  });
  const doneN = Object.keys(state.done).filter(k => state.done[k]).length;
  $('#progress-count').textContent = `${doneN} / 30 日`;
  $('#progress-fill').style.width = `${Math.round(doneN / 30 * 100)}%`;
  $('#progress-streak').textContent = `🔥 ${streak()}日継続`;
  $$('.phase-tab').forEach(t => t.classList.toggle('active', +t.dataset.phase === state.phase));
}
function streak() {
  let best = 0, cur = 0;
  for (let d = 1; d <= 30; d++) {
    if (state.done[d]) { cur++; best = Math.max(best, cur); } else { cur = 0; }
  }
  return best;
}

// ---------- 変化の記録（Before / After）----------
function renderChange() {
  const el = $('#view-change');
  if (!el) return;
  const doneN = Object.keys(state.done).filter(k => state.done[k]).length;
  const habitDays = state.habits ? Object.keys(state.habits).filter(dy => HABITS.some(h => state.habits[dy] && state.habits[dy][h.key])).length : 0;
  const bScore = state.beforeScore;
  const aScore = state.afterScore;
  const bGrade = state.beforeGrade || (bScore != null ? gradeFromScore(bScore).grade : '');

  let scoreHtml;
  if (bScore != null && aScore != null) {
    const imp = improvementText(bScore, aScore);
    const aGrade = state.afterGrade || gradeFromScore(aScore).grade;
    scoreHtml = `
      <div class="chg-scores">
        <div class="chg-score"><span class="chg-when">Before</span><span class="chg-num">${bScore}</span><span class="chg-grade">${bGrade}</span></div>
        <div class="chg-arrow">→</div>
        <div class="chg-score after"><span class="chg-when">After</span><span class="chg-num">${aScore}</span><span class="chg-grade">${aGrade}</span></div>
      </div>
      <div class="chg-imp ${imp.tone}">${imp.tone === 'up' ? '✨ ' : ''}${imp.label}</div>
      <div class="chg-bar"><span class="chg-bar-fill" style="width:${aScore}%"></span><span class="chg-bar-mark" style="left:${bScore}%"></span></div>
      <p class="chg-legend">バーは現在のスコア／縦線が開始時（${state.beforeDate || ''}）</p>`;
  } else if (bScore != null) {
    scoreHtml = `
      <div class="chg-scores single">
        <div class="chg-score"><span class="chg-when">開始時 Before</span><span class="chg-num">${bScore}</span><span class="chg-grade">${bGrade}</span></div>
      </div>
      <div class="chg-bar"><span class="chg-bar-fill" style="width:${bScore}%"></span></div>
      <p class="chg-hint">30日続けて「再測定」すると、あなたの変化が数字で見えます。</p>`;
  } else {
    scoreHtml = `<p class="chg-hint">入口で姿勢を診断すると、開始時のスコアが記録されます。</p>`;
  }

  const photoSlot = (key, cap, addLabel) => {
    const url = state[key];
    return `<figure>
      <figcaption>${cap}</figcaption>
      <label class="chg-photo-slot">
        <input type="file" accept="image/*" hidden data-photo="${key}">
        ${url
          ? `<img src="${url}" alt="${cap}"><span class="chg-photo-edit">変更</span>`
          : `<span class="chg-photo-add"><span class="chg-photo-plus">＋</span>${addLabel}</span>`}
      </label>
      ${url ? `<button type="button" class="chg-photo-del" data-photo-del="${key}">削除</button>` : ''}
    </figure>`;
  };
  const photoHtml = `
    <div class="card chg-card">
      <h3 class="chg-h">Before / After 写真</h3>
      <div class="chg-photos">
        ${photoSlot('beforePhoto', 'Before（開始時）', '開始時の写真')}
        ${photoSlot('afterPhoto', 'After（今）', '今の写真')}
      </div>
      <p class="chg-privacy">🔒 写真はこの端末の中だけに保存され、外部には送信されません。</p>
    </div>`;

  el.innerHTML = `
    <div class="card chg-card">
      <h3 class="chg-h">姿勢スコアの変化</h3>
      ${scoreHtml}
    </div>
    <div class="card chg-card">
      <h3 class="chg-h">30日の達成</h3>
      <div class="chg-stats">
        <div class="chg-stat"><span class="chg-stat-n">${doneN}</span><span class="chg-stat-l">/ 30日 完了</span></div>
        <div class="chg-stat"><span class="chg-stat-n">${streak()}</span><span class="chg-stat-l">日 継続</span></div>
        <div class="chg-stat"><span class="chg-stat-n">${Math.round(doneN / 30 * 100)}<small>%</small></span><span class="chg-stat-l">達成率</span></div>
      </div>
      <p class="chg-habit">🌿 整える習慣を <b>${habitDays}日</b> 実践しています</p>
    </div>
    ${photoHtml}
    <button id="btn-remeasure" class="btn btn-primary btn-block">今の姿勢を再測定する</button>
    <p class="chg-note">開始時と同じ条件（同じ服・場所・時間帯）で測ると、変化がわかりやすくなります。</p>
  `;
  const rm = $('#btn-remeasure');
  if (rm) rm.addEventListener('click', openRemeasure);
  // 写真の登録（縮小→dataURL→端末内保存）
  $$('#view-change input[data-photo]').forEach(inp => inp.addEventListener('change', async () => {
    const f = inp.files[0];
    if (!f) return;
    try {
      state[inp.dataset.photo] = await fileToDataURL(f, 720);
      save();
      renderChange();
    } catch (err) {
      alert(err.message || '写真の登録に失敗しました');
    }
  }));
  // 写真の削除
  $$('#view-change [data-photo-del]').forEach(btn => btn.addEventListener('click', () => {
    state[btn.dataset.photoDel] = null;
    save();
    renderChange();
  }));
}

// セルフチェックで再測定（写真診断者も簡易に更新できる）
function openRemeasure() {
  const items = POSTURE_CHECKS.map(c => {
    const on = state.postureChecks.includes(c.key);
    return `<button type="button" class="check-item ${on ? 'active' : ''}" data-key="${c.key}"><span class="check-box">${on ? '✓' : ''}</span><span class="check-label">${c.label}</span></button>`;
  }).join('');
  openModal(`
    <button class="modal-close" data-close>✕</button>
    <h3 class="modal-title">今の姿勢を再チェック</h3>
    <p class="muted">いま当てはまるものを選んでください。改善したものはチェックを外しましょう。</p>
    <div class="posture-check" id="remeasure-check">${items}</div>
    <button id="btn-remeasure-save" class="btn btn-primary btn-block">この内容で記録する</button>
  `);
  const tmp = [...state.postureChecks];
  $$('#remeasure-check .check-item').forEach(elm => elm.addEventListener('click', () => {
    const k = elm.dataset.key; const i = tmp.indexOf(k);
    if (i >= 0) tmp.splice(i, 1); else tmp.push(k);
    elm.classList.toggle('active');
    elm.querySelector('.check-box').textContent = tmp.includes(k) ? '✓' : '';
  }));
  $('#btn-remeasure-save').addEventListener('click', () => {
    state.afterScore = computeScore({ checkKeys: tmp });
    state.afterGrade = gradeFromScore(state.afterScore).grade;
    state.afterDate = todayISO();
    save();
    closeModal();
    renderChange();
    showView('change');
  });
}

// ---------- モーダル ----------
function openModal(html) {
  $('#modal-content').innerHTML = html;
  $('#modal').hidden = false;
}
function closeModal() { $('#modal').hidden = true; }

function openExercise(ex) {
  if (!ex) return;
  const how = (ex.how || []).map(h => `<li>${plainify(h)}</li>`).join('');
  const cues = ex.cues
    ? `<div class="cue-row"><span class="cue do">◎ ${plainify(ex.cues.do) || ''}</span><span class="cue dont">✕ ${plainify(ex.cues.dont) || ''}</span></div>`
    : '';
  const ev = evidenceFor(ex);
  openModal(`
    <button class="modal-close" data-close>✕</button>
    <div class="modal-illust">${exVisual(ex, 'modal-photo')}</div>
    <span class="ex-cat ${catClass(ex)}">${catLabel(ex)}</span>
    <h3 class="modal-title">${ex.name}</h3>
    ${exerciseBadges(ex)}
    <div class="modal-meta"><span>⏱ ${ex.duration || ''}</span><span>🛠 ${ex.equipment || ''}</span></div>
    <p class="modal-purpose">${plainify(ex.purpose) || ''}</p>
    ${how ? `<h4 class="modal-h">やり方</h4><ol class="modal-how">${how}</ol>` : ''}
    ${cues}
    ${ex.why ? `<p class="modal-why">💡 ${plainify(ex.why)}</p>` : ''}
    <div class="modal-evidence">
      <div class="ev-mechanism"><span class="ev-label">なぜ効くの？</span>${ev.mechanism}</div>
      <div class="ev-cite"><span class="ev-label">根拠</span>${citationLinks(ev.cites)}</div>
    </div>
  `);
}
function openDay(d) {
  if (!d) return;
  const list = [...(d.selfcare || []), ...(d.training || [])];
  const cards = list.map(exerciseCard).join('') || '<p class="muted">アクティブレスト日。呼吸と軽いストレッチで整えましょう。</p>';
  openModal(`
    <button class="modal-close" data-close>✕</button>
    <div class="day-modal-head">
      <span class="today-daynum">DAY ${String(d.day).padStart(2, '0')}</span>
      <span class="today-phase">Phase ${d.phase} ／ ${PHASE_JA[d.phase]}</span>
    </div>
    <h3 class="modal-title">${d.isRest ? 'アクティブレスト・呼吸を整える' : d.theme}</h3>
    <div class="ex-grid">${cards}</div>
  `);
  bindCards($('#modal-content'));
}

// ---------- 初期化 ----------
// 無料姿勢診断（posture-tool）からの ?dx= 受け取り（診断キーを引き継ぐ）
const VALID_PROBLEM_KEYS = ['thoracicKyphosis','roundedShoulders','forwardHead','anteriorPelvicTilt','posteriorPelvicTilt','swayBack','lateralAsymmetry','kneeValgus','ankleStiffness'];
function applyDxParam(params) {
  const dx = params.get('dx');
  if (!dx) return;
  const keys = dx.split(',').map(s => s.trim()).filter(k => VALID_PROBLEM_KEYS.includes(k));
  if (!keys.length) return;
  state.diagnosedKeys = keys;
  keys.forEach(k => { if (!state.postureChecks.includes(k)) state.postureChecks.push(k); });
  state.fromDx = true;
  // dxをURLから消す（リロード時の重複適用を防ぐ）
  const url = new URL(location.href);
  url.searchParams.delete('dx');
  history.replaceState(null, '', url.pathname + (url.search || ''));
}
function showDxBanner() {
  const card = document.querySelector('.setup-card');
  if (!card || document.querySelector('.dx-banner')) return;
  const names = (state.diagnosedKeys || []).map(k => PROBLEM_LABELS[k] || k).join('・');
  const banner = document.createElement('div');
  banner.className = 'dx-banner';
  banner.innerHTML = `<span class="dx-banner-title">✓ 無料姿勢診断の結果を引き継ぎました</span><span class="dx-banner-body"><strong>${names}</strong> の傾向を検出。下の姿勢チェックに反映済みです（必要なら修正できます）。あとは挙式日・部位・理想を選ぶだけ。</span>`;
  card.insertBefore(banner, card.firstChild);
}
function init() {
  // ?reset で保存データを消して入口（トップ）から開く（開発・やり直し用）
  const params = new URLSearchParams(location.search);
  if (params.has('reset')) {
    localStorage.removeItem(STORE_KEY);
    history.replaceState(null, '', location.pathname);
  }
  applyDxParam(params);
  renderParts();
  renderDress();
  renderMood();
  renderPostureCheck();
  setupPhotoInputs();
  $('#wedding-date').addEventListener('change', e => {
    state.weddingDate = e.target.value || null;
    updateCountdown();
    updateStartBtn();
  });
  $('#btn-start').addEventListener('click', start);
  $('#btn-begin').addEventListener('click', enterApp);
  $('#btn-back-setup').addEventListener('click', () => showScreen('setup'));
  $$('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
  $$('.phase-tab').forEach(t => t.addEventListener('click', () => { state.phase = +t.dataset.phase; renderCalendar(); }));
  $('#btn-complete').addEventListener('click', () => {
    const day = currentDay();
    state.done[day] = !state.done[day];
    save();
    renderToday();
    renderCalendar();
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('設定をリセットして最初からやり直しますか？')) return;
    localStorage.removeItem(STORE_KEY);
    location.reload();
  });
  $('#modal').addEventListener('click', e => { if (e.target.hasAttribute('data-close')) closeModal(); });

  if (load()) {
    $('#wedding-date').value = state.weddingDate || '';
    enterApp();
  } else {
    showScreen('setup');
    if (state.fromDx) showDxBanner();
  }
}
init();
