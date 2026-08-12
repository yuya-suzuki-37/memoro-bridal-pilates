// ===================================================================
// PRESCRIPTION MATRIX (BRIDAL) — 花嫁ボディメイク版
// 母集団: ピラティス(マット) ＋ 自重パーソナル
// (姿勢問題キー × 選択部位) でハイブリッド処方する。
// 40〜70代シニア向けフィルタは撤廃し、20〜30代花嫁の中〜高強度に対応。
// ===================================================================

import { DB_PILATES } from './db-pilates.js';
import { DB_PERSONAL } from './db-personal.js';
import { getBridalParts, hybridScore } from './bridal-parts.js';

// 花嫁向け母集団（yoga / seitai / senior は不使用）
const ALL_EXERCISES_LIST = [...DB_PILATES, ...DB_PERSONAL];
const ALL_EXERCISES = Object.fromEntries(ALL_EXERCISES_LIST.map(ex => [ex.id, ex]));

// ===== セルフケア / トレーニング分類 =====
// selfcare = ストレッチ・リリース・モビリティ・呼吸（緩める・整える）
// training = 筋力・コア・バランス・統合（引き締める・鍛える）
const SELFCARE_TECHNIQUES = new Set(['stretch', 'release', 'mobility', 'breath', 'pranayama', 'meditation']);
const TRAINING_TECHNIQUES = new Set(['strength', 'core', 'balance', 'isometric', 'integration']);

function isSelfcare(ex) {
  if (ex.category === 'selfcare') return true;
  if (ex.category === 'breath' || ex.category === 'meditation') return true;
  if (ex.category === 'mobility' && ex.intensity <= 1) return true;
  if (SELFCARE_TECHNIQUES.has(ex.technique)) return true;
  return false;
}

function isTraining(ex) {
  if (ex.category === 'strength' || ex.category === 'training') return true;
  if (ex.category === 'core' && ex.intensity >= 2) return true;
  if (ex.category === 'balance') return true;
  if (ex.category === 'integration') return true;
  if (TRAINING_TECHNIQUES.has(ex.technique) && ex.intensity >= 2) return true;
  return false;
}

// ===== 花嫁向け安全フィルタ（自宅・マット中心 / 中〜高強度OK）=====
// 除外: ジャンプ・高衝撃（マンション/写真前提）、懸垂バー等の非家庭器具、極端な高難度アクロバット
const BRIDAL_EXCLUDE_TECH = new Set(['plyometric']);
const BRIDAL_EXCLUDE_IDS = new Set([
  // ジャンプ・高衝撃
  'pt_jump_squat', 'pt_burpee_easy', 'pt_jumping_jack', 'pt_high_knees',
  'pt_butt_kicks', 'pt_skater_jump', 'pt_squat_thrust', 'pt_mountain_climber',
  // 懸垂バーなど一般家庭にない器具
  'pt_dead_hang', 'pt_scapular_pullup', 'pt_hanging_knee_raise', 'pt_inverted_row',
  // 極端な高難度アクロバット（30日ボディメイクに不要）
  'pt_pseudo_planche', 'pt_dragon_flag_prep', 'pt_l_sit_progression',
  'pt_pistol_progression', 'pt_shrimp_squat', 'pt_skater_squat', 'pt_reverse_nordic',
]);
// 自宅にある器具のみ許容
const BRIDAL_OK_EQUIP = new Set(['なし', 'マット', 'マットなし', '', '壁', '椅子', 'ソファ', 'クッション', '台', '階段', '机']);
function bridalEquipmentOk(eq) {
  if (!eq) return true;
  // 「ソファ/椅子」「机/壁」など複合は、いずれかが家庭で可能ならOK
  return eq.split('/').map(s => s.trim()).some(p => BRIDAL_OK_EQUIP.has(p));
}
function isBridalSafe(ex) {
  if (BRIDAL_EXCLUDE_IDS.has(ex.id)) return false;
  if (BRIDAL_EXCLUDE_TECH.has(ex.technique)) return false;
  if (!bridalEquipmentOk(ex.equipment)) return false;
  return true; // intensity 制限なし（花嫁は中〜高強度OK）
}

// ===== 問題キーごとのプール =====
function buildPoolForProblem(problemKey) {
  const matches = ALL_EXERCISES_LIST.filter(ex =>
    ex.targetProblems && ex.targetProblems.includes(problemKey)
  );
  const filtered = matches.filter(isBridalSafe);
  return {
    selfcare: filtered.filter(isSelfcare),
    training: filtered.filter(isTraining),
  };
}

// ===== 処方プール構築（姿勢キー × 選択部位）=====
function buildPrescriptionPool(problemKeys = [], selectedParts = []) {
  const selfSet = new Map();
  const trainSet = new Map();

  // 1) 姿勢の弱点キーから母集団を作る
  problemKeys.forEach(k => {
    const p = buildPoolForProblem(k);
    p.selfcare.forEach(ex => { if (!selfSet.has(ex.id)) selfSet.set(ex.id, ex); });
    p.training.forEach(ex => { if (!trainSet.has(ex.id)) trainSet.set(ex.id, ex); });
  });

  // 2) 選択部位に効く種目を追加（姿勢キーに紐付かない種目も拾う）
  if (selectedParts.length) {
    ALL_EXERCISES_LIST.filter(isBridalSafe).forEach(ex => {
      const parts = getBridalParts(ex);
      if (!selectedParts.some(p => parts.includes(p))) return;
      if (isSelfcare(ex) && !selfSet.has(ex.id)) selfSet.set(ex.id, ex);
      if (isTraining(ex) && !trainSet.has(ex.id)) trainSet.set(ex.id, ex);
    });
  }

  // 3) general で補完
  if (selfSet.size < 4 || trainSet.size < 4) {
    const g = buildPoolForProblem('general');
    g.selfcare.forEach(ex => { if (!selfSet.has(ex.id)) selfSet.set(ex.id, ex); });
    g.training.forEach(ex => { if (!trainSet.has(ex.id)) trainSet.set(ex.id, ex); });
  }

  // 4) それでも足りなければ母集団全体から補完
  if (selfSet.size < 4) {
    ALL_EXERCISES_LIST.filter(ex => isSelfcare(ex) && isBridalSafe(ex))
      .forEach(ex => { if (!selfSet.has(ex.id)) selfSet.set(ex.id, ex); });
  }
  if (trainSet.size < 4) {
    ALL_EXERCISES_LIST.filter(ex => isTraining(ex) && isBridalSafe(ex))
      .forEach(ex => { if (!trainSet.has(ex.id)) trainSet.set(ex.id, ex); });
  }

  let selfcare = Array.from(selfSet.values());
  let training = Array.from(trainSet.values());

  // 5) ハイブリッドスコア降順（部位×姿勢に効く種目を優先）
  if (selectedParts.length || problemKeys.length) {
    const byScore = (a, b) => hybridScore(b, selectedParts, problemKeys) - hybridScore(a, selectedParts, problemKeys);
    selfcare = selfcare.sort(byScore);
    training = training.sort(byScore);
  }

  return { selfcare, training };
}

// アンカー: 処方上位のセルフケア・トレーニング各2種（優先配分される）
function buildAnchors(problemKeys = [], selectedParts = []) {
  const anchors = new Set();
  const pool = buildPrescriptionPool(problemKeys, selectedParts);
  [pool.selfcare[0], pool.selfcare[1], pool.training[0], pool.training[1]]
    .forEach(ex => { if (ex) anchors.add(ex.id); });
  return anchors;
}

// プール統計（UI表示用）
function getPoolStats(problemKeys = [], selectedParts = []) {
  const pool = buildPrescriptionPool(problemKeys, selectedParts);
  return {
    total: pool.selfcare.length + pool.training.length,
    selfcare: pool.selfcare.length,
    training: pool.training.length,
  };
}

export {
  ALL_EXERCISES,
  ALL_EXERCISES_LIST,
  buildPrescriptionPool,
  buildAnchors,
  buildPoolForProblem,
  getPoolStats,
  isSelfcare,
  isTraining,
  isBridalSafe,
};
