import { HandData } from './handTracking';

export interface GestureState {
  isPinching: boolean;
  pinchAmount: number; // 0-1, where 1 is maximum pinch
  isOpen: boolean;
  handRotation: number; // degrees
  handPosition: { x: number; y: number };
  isActive: boolean;
}

const PINCH_THRESHOLD = 0.05;
const OPEN_THRESHOLD = 0.1;

function calculateDistance(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number }
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateHandRotation(landmarks: any[]): number {
  if (landmarks.length < 10) return 0;
  
  // Calculate rotation based on wrist to middle finger
  const wrist = landmarks[0];
  const middleFingerTip = landmarks[12];
  
  const dx = middleFingerTip.x - wrist.x;
  const dy = middleFingerTip.y - wrist.y;
  
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

function getHandCentroid(landmarks: any[]): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;
  
  for (const landmark of landmarks) {
    sumX += landmark.x;
    sumY += landmark.y;
  }
  
  return {
    x: sumX / landmarks.length,
    y: sumY / landmarks.length,
  };
}

export function analyzeHand(hand: HandData, gestureName: string = ''): GestureState {
  const landmarks = hand.landmarks;
  
  if (landmarks.length < 21) {
    return {
      isPinching: false,
      pinchAmount: 0,
      isOpen: true,
      handRotation: 0,
      handPosition: { x: 0.5, y: 0.5 },
      isActive: false,
    };
  }

  // Pinch detection: thumb (4) to index (8)
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const pinchDistance = calculateDistance(thumbTip, indexTip);
  const isPinching = pinchDistance < PINCH_THRESHOLD;
  const pinchAmount = Math.max(0, 1 - (pinchDistance / PINCH_THRESHOLD));

  // Open hand detection: average distances between fingers
  const fingerTips = [8, 12, 16, 20]; // index, middle, ring, pinky
  const palmBase = landmarks[9]; // base of middle finger
  
  let averageDistance = 0;
  for (const tipIndex of fingerTips) {
    averageDistance += calculateDistance(palmBase, landmarks[tipIndex]);
  }
  averageDistance /= fingerTips.length;
  const isOpen = averageDistance > OPEN_THRESHOLD;

  // Hand rotation
  const handRotation = calculateHandRotation(landmarks);

  // Hand position (normalized to 0-1)
  const centroid = getHandCentroid(landmarks);
  const handPosition = {
    x: Math.max(0, Math.min(1, centroid.x)),
    y: Math.max(0, Math.min(1, centroid.y)),
  };

  // Gesture detection from recognized gesture name
  const isActive = gestureName === 'Open_Palm' || isOpen;

  return {
    isPinching,
    pinchAmount,
    isOpen,
    handRotation,
    handPosition,
    isActive,
  };
}

export function combineGestures(
  gestures: GestureState[]
): GestureState {
  if (gestures.length === 0) {
    return {
      isPinching: false,
      pinchAmount: 0,
      isOpen: false,
      handRotation: 0,
      handPosition: { x: 0.5, y: 0.5 },
      isActive: false,
    };
  }

  if (gestures.length === 1) {
    return gestures[0];
  }

  // For two hands: combine pinch amounts, take average rotation and position
  return {
    isPinching: gestures.some(g => g.isPinching),
    pinchAmount: Math.max(...gestures.map(g => g.pinchAmount)),
    isOpen: gestures.some(g => g.isOpen),
    handRotation: (gestures[0].handRotation + (gestures[1]?.handRotation || 0)) / (gestures.length as any),
    handPosition: {
      x: gestures.reduce((sum, g) => sum + g.handPosition.x, 0) / gestures.length,
      y: gestures.reduce((sum, g) => sum + g.handPosition.y, 0) / gestures.length,
    },
    isActive: gestures.some(g => g.isActive),
  };
}
