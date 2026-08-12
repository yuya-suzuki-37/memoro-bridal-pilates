// ===================================================================
// BRIDAL PARTS — ボディメイク部位軸（フォトウェディング特化）
// 既存の解剖学的 bodyPart を「ドレスで映える部位」7分類にマッピングする。
// 花嫁が選ぶ「気になる部位」× 姿勢診断の「弱点」でハイブリッド処方する。
// 既存 db-pilates.js / db-personal.js は編集せず、ここで対応づけのみ行う。
// ===================================================================

// ---- 7部位の定義（order = ドレス露出の優先度）----
export const BRIDAL_PARTS = {
  decollete: { id:'decollete', name:'デコルテ・鎖骨', order:1, dress:'胸元の開いたドレスを美しく',   posture:['thoracicKyphosis','forwardHead','roundedShoulders'] },
  arm:       { id:'arm',       name:'二の腕',         order:2, dress:'ノースリーブ・ビスチェの腕元',  posture:['roundedShoulders'] },
  back:      { id:'back',      name:'背中・肩甲骨',   order:3, dress:'ローバックドレス・後ろ姿',      posture:['thoracicKyphosis','roundedShoulders'] },
  waist:     { id:'waist',     name:'くびれ',         order:4, dress:'ウエストのシルエット',          posture:['lateralAsymmetry','anteriorPelvicTilt'] },
  belly:     { id:'belly',     name:'下腹',           order:5, dress:'お腹まわりのすっきり感',        posture:['anteriorPelvicTilt','swayBack'] },
  hip:       { id:'hip',       name:'ヒップ・美脚',   order:6, dress:'マーメイドライン・スリット',    posture:['posteriorPelvicTilt','swayBack','kneeValgus'] },
  posture:   { id:'posture',   name:'美姿勢・立ち姿', order:7, dress:'バージンロード・写真映え',      posture:['forwardHead','thoracicKyphosis','swayBack','lateralAsymmetry'] },
};

export const BRIDAL_PART_ORDER = ['decollete','arm','back','waist','belly','hip','posture'];

// ---- bodyPart → 部位 の基本ルール ----
const BODYPART_RULE = {
  arm:       ['arm'],
  chest:     ['decollete','arm'],   // プッシュアップ系は大胸筋（デコルテ）＋三頭筋（二の腕）
  shoulder:  ['back','decollete'],  // 肩甲骨まわり＝巻き肩改善で背中・デコルテに効く
  back:      ['back'],
  hip:       ['hip'],
  leg:       ['hip'],               // スクワット・ランジは美脚＝ヒップ・美脚に集約
  hamstring: ['hip'],
  spine:     ['posture'],
  whole:     ['posture'],
  fullbody:  ['posture','belly'],
  breath:    ['posture'],
  // core は種目名で waist / belly を判別（下記）
};

// core を「くびれ（回旋・側屈）」と「下腹（前面・脚動作）」に振り分ける
const WAIST_HINT = /(twist|oblique|criss|side_bend|sidebend|saw|mermaid|russian|bicycle|side_plank|sideplank|pallof|corkscrew|standing_side)/i;

// ---- 個別オーバーライド（ルールで拾いきれない種目のみ）----
const OVERRIDE = {
  pl_swan_arms:                 ['back','decollete'],
  pl_standing_chest_expansion:  ['decollete','back'],
  pl_standing_arm_circles:      ['decollete','arm'],
  pl_pushup_plank:              ['arm','decollete'],
  pt_pike_pushup:               ['arm','back'],
  pt_plank_press:               ['arm','back'],
  pt_y_t_w:                     ['back','decollete'],
  pt_scapular_pushup:           ['back','decollete'],
  pt_arm_circle:                ['arm','decollete'],
  pt_superman:                  ['back','hip'],
  pt_back_extension:            ['back','hip'],
  pt_wall_walk:                 ['arm','back'],
  pt_dive_bomber:               ['arm','back'],
};

// ---- 種目 → 効く部位（配列）----
export function getBridalParts(ex) {
  if (OVERRIDE[ex.id]) return OVERRIDE[ex.id];
  const bp = ex.bodyPart;
  // core / spine の回旋・側屈系は「くびれ」に集約（腹斜筋・体側）
  if ((bp === 'core' || bp === 'spine') && WAIST_HINT.test(ex.id)) return ['waist'];
  if (bp === 'core') return ['belly'];
  return BODYPART_RULE[bp] || ['posture'];
}

// ---- 部位でフィルタ ----
export function filterByBridalPart(exList, partId) {
  return exList.filter(ex => getBridalParts(ex).includes(partId));
}

// ---- 部位 × 姿勢弱点 のハイブリッド・スコア ----
// 花嫁が選んだ部位に効き、かつ姿勢診断の弱点にも当たる種目を高く評価する。
export function hybridScore(ex, selectedParts = [], problemKeys = []) {
  const parts = getBridalParts(ex);
  let score = 0;
  // 選択部位に効く: +3
  selectedParts.forEach(p => { if (parts.includes(p)) score += 3; });
  // その部位が対象とする姿勢弱点に当たる: +2
  selectedParts.forEach(p => {
    const wanted = (BRIDAL_PARTS[p] && BRIDAL_PARTS[p].posture) || [];
    (ex.targetProblems || []).forEach(tp => { if (wanted.includes(tp)) score += 1; });
  });
  // 診断で出た弱点に直接当たる: +2
  (ex.targetProblems || []).forEach(tp => { if (problemKeys.includes(tp)) score += 2; });
  return score;
}
