// ===================================================================
// EVIDENCE OVERLAY (BRIDAL) — 種目・部位の「なぜ効くか(機序)＋正直な効果＋出典」
// 既存 db-*.js は非破壊。plain-text.js と同型のオーバーレイ層。
// 根拠: _knowledge/10〜12（出典付き）。
// 🔴 部位痩せ(スポットリダクション)表現は排除し、引き締め/姿勢/むくみで語る。
// ===================================================================

// ---- 出典マスタ ----
export const CITATIONS = {
  pilates_posture: {
    short: 'ピラティスと姿勢改善の系統的レビュー (2024)',
    url: 'https://www.archives-rrct.org/article/S2590-1095(24)00035-1/fulltext',
  },
  acsm: {
    short: 'ACSM 運動ガイドライン (2026)',
    url: 'https://acsm.org/resistance-training-guidelines-update-2026/',
  },
  spot_reduction: {
    short: '部位痩せは起きない：メタ分析 (2021) / シドニー大 (2023)',
    url: 'https://www.sydney.edu.au/news-opinion/news/2023/11/07/spot-reduction--why-targeting-weight-loss-to-a-specific-area-is-.html',
  },
  muscle_pump: {
    short: '筋ポンプと静脈還流・むくみ軽減 (J Physiol 2005)',
    url: 'https://physoc.onlinelibrary.wiley.com/doi/abs/10.1113/jphysiol.2004.076422',
  },
};

// ---- 7部位の「正直な効果」（部位痩せNG → 引き締め/姿勢/むくみ）----
export const PART_EFFECT = {
  decollete: { title: 'デコルテ・鎖骨', honest: '胸を開いた姿勢をつくり、デコルテまわりをすっきり見せます。', cites: ['pilates_posture'] },
  arm:       { title: '二の腕',        honest: '二の腕の筋肉を働かせて引き締め、腕元をすっきり見せます。',   cites: ['acsm'] },
  back:      { title: '背中・肩甲骨',  honest: '肩甲骨まわりを引き締め、猫背をケアして後ろ姿を美しく整えます。', cites: ['pilates_posture'] },
  waist:     { title: 'くびれ',        honest: '脇腹（側腹）を使い、くびれの印象を高めます。',             cites: ['acsm'] },
  belly:     { title: '下腹',          honest: '体幹を引き締め、姿勢を整えてお腹まわりをすっきり見せます。', cites: ['pilates_posture', 'acsm'] },
  hip:       { title: 'ヒップ・美脚',  honest: 'お尻と脚の筋肉を使い、ヒップと脚のラインを整えます。',     cites: ['acsm'] },
  posture:   { title: '美姿勢・立ち姿', honest: '全身の姿勢を整え、立ち姿・歩く姿を美しく見せます。',       cites: ['pilates_posture'] },
};

// 共通の但し書き（景表法・薬機法）
export const SPOT_NOTE = '特定の部位だけの脂肪を落とすことはできません。姿勢を整え引き締めて“美しく見せる”ためのプログラムです（変化には個人差があります）。';

// ---- 技法/カテゴリ → 機序（なぜ効くか）----
const TECH_MECHANISM = {
  strength:    '筋肉を働かせて引き締め、ボディラインの輪郭を整えます。',
  core:        '体幹の深い筋肉を働かせ、姿勢を安定させてお腹まわりを引き締めます。',
  isometric:   '姿勢を保ちながら筋肉に効かせ、引き締めます。',
  integration: '複数の筋肉を連動させ、全身のラインを整えます。',
  balance:     '体幹と軸を鍛え、立ち姿を安定させます。',
  stretch:     '筋肉をやさしく伸ばし、関節の動きと姿勢を整えやすくします。',
  mobility:    '関節の動きをなめらかにし、姿勢を整えやすくします。',
  release:     'こわばりをゆるめ、動きと血流をサポートします。',
  breath:      '呼吸で体幹を安定させ、リラックスを促します。',
  pranayama:   '呼吸を深め、自律神経を整えてリラックスを促します。',
  meditation:  '呼吸と意識を整え、心身をリラックスさせます。',
};

// むくみ系判定（足首・ふくらはぎの律動運動）
const EDEMA_HINT = /(calf|ankle|heel|foot|toe|カーフ|足首|ふくらはぎ|かかと|つま先)/i;

// ---- 種目の根拠（機序＋出典キー）を返す ----
export function evidenceFor(ex) {
  const cites = new Set();
  let mechanism;

  if (EDEMA_HINT.test(ex.id || '') || EDEMA_HINT.test(ex.name || '')) {
    mechanism = '足首・ふくらはぎのポンプ作用で巡りをサポートし、一時的なむくみをケアします。';
    cites.add('muscle_pump');
  } else {
    mechanism = TECH_MECHANISM[ex.technique] || TECH_MECHANISM[ex.category] || '姿勢とボディラインを整える助けになります。';
    const gentle = ['stretch', 'mobility', 'release', 'breath', 'pranayama', 'meditation'];
    if (gentle.includes(ex.technique) || gentle.includes(ex.category)) {
      cites.add('pilates_posture');
    } else {
      cites.add('acsm');
    }
  }
  return { mechanism, cites: Array.from(cites) };
}

// ---- 出典の表示用HTML（リンク）----
export function citationLinks(citeKeys) {
  return (citeKeys || [])
    .map(k => CITATIONS[k])
    .filter(Boolean)
    .map(c => `<a class="cite-link" href="${c.url}" target="_blank" rel="noopener">${c.short}</a>`)
    .join('　/　');
}
