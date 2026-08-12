// ===================================================================
// 30-DAY PROGRAM GENERATOR (BRIDAL) — 花嫁ボディメイク版
// Phase 1 (Day 1-10):  解放 (Release) — 呼吸・フォーム習得・低強度
// Phase 2 (Day 11-20): 活性化 (Activation) — 弱点部位の強化
// Phase 3 (Day 21-30): 統合・仕上げ (Integration) — 本番へ向けて
// Day 7, 14, 21, 28 はアクティブレスト
// 第2引数 selectedParts: ['arm','back',...] 花嫁が選んだ気になる部位
// ===================================================================
import {
  ALL_EXERCISES,
  buildPrescriptionPool,
  buildAnchors,
} from './prescription-matrix.js';

// ----- 内部: 使用回数＋目標強度を見て最少使用ピック -----
// targetIntensity: フェーズ別の目標強度（漸進性）。近い強度を優先する。
function pickLeastUsed(exList, usage, count, anchors, excludeIds, targetIntensity = null) {
  const score = (ex) => {
    let s = usage[ex.id] || 0;
    if (anchors.has(ex.id)) s *= 0.5;
    // 目標強度から離れるほどペナルティ（使用回数バランスを崩さない程度に軽め）
    if (targetIntensity != null) s += Math.abs((ex.intensity || 2) - targetIntensity) * 0.6;
    return s;
  };

  const primary = exList
    .filter(ex => !excludeIds.includes(ex.id))
    .sort((a, b) => {
      const sa = score(a), sb = score(b);
      if (sa !== sb) return sa - sb;
      const aa = anchors.has(a.id) ? 0 : 1;
      const ab = anchors.has(b.id) ? 0 : 1;
      return aa - ab;
    });

  const picked = primary.slice(0, count);

  if (picked.length < count) {
    const fallback = exList
      .filter(ex => !picked.includes(ex))
      .sort((a, b) => score(a) - score(b));
    while (picked.length < count && fallback.length) {
      picked.push(fallback.shift());
    }
  }
  return picked;
}

// フェーズ別の目標強度（漸進性）
function targetIntensityFor(phase, kind) {
  if (kind === 'selfcare') return phase === 1 ? 1.2 : phase === 2 ? 1.5 : 1.6;
  // training: Phase1 軽め → Phase3 しっかり
  return phase === 1 ? 1.6 : phase === 2 ? 2.1 : 2.6;
}

// ===== 今日のメニュー: セルフケア2 + トレーニング2 =====
function pickTodayMenu(problemKeys = [], selectedParts = []) {
  const pool = buildPrescriptionPool(problemKeys, selectedParts);
  const selfcare = pool.selfcare.slice(0, 2);
  const training = pool.training.slice(0, 2);
  return { selfcare, training };
}

// ===== 30日プログラム生成 =====
function build30DayProgram(problemKeys = [], selectedParts = []) {
  const pool = buildPrescriptionPool(problemKeys, selectedParts);
  const anchors = buildAnchors(problemKeys, selectedParts);
  const sList = pool.selfcare;
  const tList = pool.training;

  const sUsage = Object.fromEntries(sList.map(ex => [ex.id, 0]));
  const tUsage = Object.fromEntries(tList.map(ex => [ex.id, 0]));

  const days = [];

  for (let day = 1; day <= 30; day++) {
    const phase = day <= 10 ? 1 : day <= 20 ? 2 : 3;
    const isRest = (day % 7 === 0);
    const dayInPhase = day <= 10 ? day : day <= 20 ? day - 10 : day - 20;

    const prev = days[days.length - 1];
    const prevIds = prev
      ? [...(prev.selfcare || []), ...(prev.training || [])].map(e => e.id)
      : [];

    let selfcare, training;
    if (isRest) {
      // アクティブレスト: 軽いセルフケアのみ
      selfcare = pickLeastUsed(sList, sUsage, 2, anchors, prevIds, 1.0);
      training = [];
    } else {
      selfcare = pickLeastUsed(sList, sUsage, 2, anchors, prevIds, targetIntensityFor(phase, 'selfcare'));
      const sameDayIds = selfcare.map(e => e.id);
      training = pickLeastUsed(tList, tUsage, 2, anchors, [...prevIds, ...sameDayIds], targetIntensityFor(phase, 'training'));
    }

    selfcare.forEach(ex => { sUsage[ex.id] = (sUsage[ex.id] || 0) + 1; });
    training.forEach(ex => { tUsage[ex.id] = (tUsage[ex.id] || 0) + 1; });

    const theme = themeFor(phase, dayInPhase, isRest);

    days.push({ day, phase, isRest, theme, selfcare, training });
  }

  return days;
}

function themeFor(phase, dayInPhase, isRest) {
  if (isRest) return 'アクティブレスト・呼吸を整える';

  const themes = {
    1: [
      '導入・身体を知る',
      'リリースの導入',
      '胸郭の解放',
      '股関節の解放',
      '首と肩のリセット',
      '骨盤の感覚を取り戻す',
      '太もも・骨盤リリース',
      '脊柱モビリティ',
      '深層筋への意識',
      'Phase 1総仕上げ',
    ],
    2: [
      '臀筋の覚醒',
      '体幹深層の活性化',
      '肩甲骨スタビライザー',
      '骨盤底〜横隔膜',
      '中臀筋の活性化',
      '後面連鎖の起動',
      '側腹の引き締め',
      '片脚バランスの導入',
      '抗回旋トレーニング',
      'Phase 2総仕上げ',
    ],
    3: [
      '機能的動作の統合',
      'ボディラインの引き締め',
      '左右差の最終調整',
      '呼吸と姿勢の統合',
      'くびれ・ヒップの仕上げ',
      'デコルテ・背中の仕上げ',
      '後ろ姿の総仕上げ',
      '全身の統合',
      '美姿勢の完成',
      '本番へ・最高の姿で',
    ],
  };
  return themes[phase][dayInPhase - 1];
}

export { pickTodayMenu, build30DayProgram, ALL_EXERCISES };
