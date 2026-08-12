// ===================================================================
// POSTURE SCORE (BRIDAL) — 姿勢スコアの算出と Before/After 比較
// analyzer.js の calcScore/gradeFromScore ロジックを bridal 用に移植（非破壊）。
// 写真診断: problems[].severity から / セルフチェックのみ: チェック数から。
// ===================================================================

const SEV_PENALTY = { low: 4, mid: 9, high: 16 };

// 写真診断の problems（severity付き）→ スコア（0-100, 下限35）
export function scoreFromProblems(problems = []) {
  let score = 100;
  problems.forEach(p => { if (p.key !== 'general') score -= (SEV_PENALTY[p.severity] || 9); });
  return Math.max(35, Math.min(100, score));
}

// セルフチェックのみ（severity不明）→ 1項目 = mid 相当(-9)
export function scoreFromChecks(checkKeys = []) {
  const score = 100 - (checkKeys.length * 9);
  return Math.max(35, Math.min(100, score));
}

// グレード（花嫁向け・前向きな文言）
export function gradeFromScore(s) {
  if (s >= 92) return { grade: 'EXCELLENT', desc: 'とても美しい姿勢です。この状態をキープ。' };
  if (s >= 82) return { grade: 'GOOD', desc: '良い姿勢。あと少しで理想的です。' };
  if (s >= 70) return { grade: 'FAIR', desc: '伸びしろ十分。30日で変化が期待できます。' };
  if (s >= 58) return { grade: 'CARE', desc: '気になる点あり。集中ケアで変わります。' };
  return { grade: 'CHECK', desc: 'じっくりケアしていきましょう。' };
}

// state から現在のスコアを算出（写真診断のproblems優先 → セルフチェック）
export function computeScore({ diagnosedProblems, checkKeys } = {}) {
  if (diagnosedProblems && diagnosedProblems.length) {
    return scoreFromProblems(diagnosedProblems);
  }
  return scoreFromChecks(checkKeys || []);
}

// Before/After の差分（改善ポイント）
export function improvementText(before, after) {
  const d = after - before;
  if (d > 0) return { diff: d, label: `+${d}点 改善`, tone: 'up' };
  if (d < 0) return { diff: d, label: `${d}点`, tone: 'down' };
  return { diff: 0, label: '±0（キープ）', tone: 'flat' };
}
