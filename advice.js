// ===================================================================
// ADVICE — 専門的な見立て文（カウンセリング文）を生成
// 姿勢診断 × 理想（ドレス・雰囲気）× 部位 → その人だけの見立てをローカル生成。
// 外部AI・APIは使わない（テンプレート＋条件分岐）。
// ===================================================================
import { BRIDAL_PARTS } from './bridal-parts.js';

// 着たいドレス（映える部位＝主役が決まる）
export const DRESS_TYPES = {
  mermaid: { id: 'mermaid', name: 'マーメイド', star: 'くびれからヒップにかけての曲線美', focus: ['waist', 'hip'] },
  princess: { id: 'princess', name: 'プリンセス', star: 'デコルテと上半身の華やかさ', focus: ['decollete', 'arm', 'back'] },
  slender: { id: 'slender', name: 'スレンダー', star: 'まっすぐ伸びた縦のライン', focus: ['posture', 'waist'] },
  aline: { id: 'aline', name: 'Aライン', star: 'バランスの取れた全身のシルエット', focus: ['posture', 'belly'] },
  undecided: { id: 'undecided', name: 'まだ決めていない', star: 'あなたらしいスタイル', focus: [] },
};
export const DRESS_ORDER = ['mermaid', 'princess', 'slender', 'aline', 'undecided'];

// なりたい雰囲気（理想のトーン）
export const MOOD_TYPES = {
  delicate: { id: 'delicate', name: '華奢で可憐に', tone: '華奢で可憐な' },
  glamorous: { id: 'glamorous', name: 'メリハリ・グラマラス', tone: 'メリハリのある' },
  sharp: { id: 'sharp', name: '凛とシャープに', tone: '凛とした' },
  natural: { id: 'natural', name: 'ナチュラルな健康美', tone: '自然体で健康的な' },
};
export const MOOD_ORDER = ['delicate', 'glamorous', 'sharp', 'natural'];

// 姿勢キー → 花嫁向けの専門的な「影響」コメント
const POSTURE_IMPACT = {
  thoracicKyphosis: '背中が丸まってデコルテが閉じ、二の腕が実際より大きく見えやすい',
  roundedShoulders: '肩が前に入り、後ろ姿と鎖骨のラインが崩れて見えやすい',
  forwardHead: '首が前に出て、首まわりが詰まった印象になりやすい',
  anteriorPelvicTilt: '腰が反ってお腹が前に押し出され、くびれが分かりにくい',
  swayBack: '重心が後ろに落ちて、お腹がぽっこり前に出て見えやすい',
  posteriorPelvicTilt: '骨盤が後ろに倒れ、ヒップが平坦に見えやすい',
  lateralAsymmetry: '左右のバランスが崩れ、写真で身体が歪んで見えやすい',
  kneeValgus: '脚のラインがねじれ、まっすぐ美しく見えにくい',
};
const POSTURE_LABELS = {
  thoracicKyphosis: '猫背', roundedShoulders: '巻き肩', forwardHead: 'ストレートネック',
  anteriorPelvicTilt: '反り腰', posteriorPelvicTilt: '骨盤後傾', swayBack: 'スウェイバック',
  lateralAsymmetry: '左右差', kneeValgus: '脚のねじれ',
};

// 見立て文（4パート）を生成
export function buildAdvice({ problemKeys = [], selectedParts = [], dress, mood, weddingDays } = {}) {
  const postures = problemKeys.filter(k => POSTURE_LABELS[k]);
  const postureNames = postures.map(k => POSTURE_LABELS[k]);
  const impact = postures.length ? POSTURE_IMPACT[postures[0]] : null;
  const partNames = selectedParts.map(p => BRIDAL_PARTS[p] && BRIDAL_PARTS[p].name).filter(Boolean);
  const d = DRESS_TYPES[dress];
  const m = MOOD_TYPES[mood];
  const partsTxt = partNames.length ? partNames.join('・') : '全身';

  // ① 現状（診断の見立て）
  const current = postureNames.length
    ? `診断の結果、あなたは【${postureNames.join('・')}】の傾向が見られます。${impact ? `この姿勢は、${impact}状態です。` : ''}`
    : `診断では、大きな姿勢の崩れは見られませんでした。土台が整っているぶん、狙った部位を効率よく磨けるのが強みです。`;

  // ② 理想（ドレス・雰囲気）
  let ideal = '';
  if (d && d.id !== 'undecided') ideal += `目指す${d.name}ドレスは、${d.star}が主役。`;
  ideal += m
    ? `${m.tone}花嫁姿を叶えるには、まず土台の姿勢を整えながら${partsTxt}を磨くのが近道です。`
    : `${partsTxt}を中心に、あなたの理想の姿へ近づけていきます。`;

  // ③ 30日の設計（なぜこの順番か）
  const design = `そこでこの30日は、Phase1（〜10日）で${postureNames.length ? `${postureNames[0]}をリリースして` : '身体をほぐして'}動ける土台を作り、Phase2（〜20日）で${partsTxt}を本格的に引き締め、Phase3（〜30日）で全身を統合して本番の立ち姿へ仕上げます。`;

  // ④ 未来
  const daysTxt = (weddingDays != null && weddingDays >= 0) ? `${weddingDays}日後の当日` : '30日後';
  const future = d && d.id !== 'undecided'
    ? `${daysTxt}、${d.name}ドレスを心から美しく着こなすあなたが待っています。`
    : `${daysTxt}、自信を持って一番きれいな姿で当日を迎えましょう。`;

  return { current, ideal, design, future, postureNames, partNames };
}
