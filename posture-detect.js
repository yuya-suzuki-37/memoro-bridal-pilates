// ===================================================================
// POSTURE DETECT — 写真からの姿勢スクリーニング（pilates-tool 用ラッパー）
// posture-tool の analyzer.js（診断ロジック）＋ MediaPipe を薄く包む。
// 写真アップ → 33ランドマーク → analyzeSide/Front → detectProblems → 問題キー
// ※これは医学的診断ではなくスクリーニング（analyzer.js の前提を継承）。
// ===================================================================
import { analyzeSide, analyzeFront, detectProblems } from './analyzer.js';

const MP_VERSION = '0.10.9';
let _landmarker = null;

export async function loadLandmarker(onStatus) {
  if (_landmarker) return _landmarker;
  if (onStatus) onStatus('姿勢推定モデルを読み込み中…（初回のみ時間がかかります）');
  const vision = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`);
  const fileset = await vision.FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
  );
  _landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
      delegate: 'GPU',
    },
    runningMode: 'IMAGE',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  return _landmarker;
}

async function detectPose(image, onStatus) {
  const lm = await loadLandmarker(onStatus);
  const result = lm.detect(image);
  if (!result.landmarks || !result.landmarks.length) return null;
  return result.landmarks[0]; // 33 landmarks
}

// 写真（側面必須・正面任意）→ 姿勢の問題キー配列
export async function diagnoseFromPhotos(sideImg, frontImg, onStatus) {
  if (onStatus) onStatus('側面写真の特徴点を検出中…');
  const lmsSide = await detectPose(sideImg, onStatus);
  if (!lmsSide) {
    throw new Error('側面写真から人物を検出できませんでした。全身（頭〜足）が横向きで写った写真をお試しください。');
  }
  const resultSide = analyzeSide(lmsSide);

  let resultFront = null;
  if (frontImg) {
    if (onStatus) onStatus('正面写真を解析中…');
    const lmsFront = await detectPose(frontImg, onStatus);
    if (lmsFront) resultFront = analyzeFront(lmsFront);
  }

  const problems = detectProblems(resultSide, resultFront);
  const problemKeys = problems.map(p => p.key).filter(k => k && k !== 'general');
  return { problemKeys, problems, resultSide, resultFront };
}
