'use client';

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandData {
  landmarks: HandLandmark[];
  handedness: string;
  confidence: number;
}

export interface DetectionResult {
  hands: HandData[];
  gestures: Array<{ categoryName: string; categoryIndex: number; score: number }>;
  timestamp: number;
}

// Simple hand tracking using canvas-based motion detection
let canvasContext: CanvasRenderingContext2D | null = null;
let prevFrameData: Uint8ClampedArray | null = null;
let motionPoints: Array<{ x: number; y: number }> = [];

export async function initializeHandTracking(): Promise<void> {
  // Initialize canvas for motion detection
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  canvasContext = canvas.getContext('2d');
  console.log('[v0] Hand tracking initialized');
}

export async function detectHands(video: HTMLVideoElement | HTMLCanvasElement): Promise<DetectionResult | null> {
  if (!canvasContext) {
    return null;
  }

  try {
    const width = video instanceof HTMLVideoElement ? video.videoWidth : video.width;
    const height = video instanceof HTMLVideoElement ? video.videoHeight : video.height;

    // Draw video to canvas for analysis
    canvasContext.canvas.width = width;
    canvasContext.canvas.height = height;
    canvasContext.drawImage(video, 0, 0, width, height);

    const imageData = canvasContext.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Detect skin-colored regions (simple hand detection)
    const handRegions: Array<{ x: number; y: number; count: number }> = [];
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Simple skin detection based on color ranges
      const isSkin = r > 95 && g > 40 && b > 20 &&
                     r > g && r > b &&
                     Math.abs(r - g) > 15;
      
      if (isSkin) {
        const pixelIndex = i / 4;
        const x = (pixelIndex % width) / width;
        const y = Math.floor(pixelIndex / width) / height;
        
        handRegions.push({ x, y, count: 1 });
      }
    }

    // Cluster skin regions into hands
    const hands: HandData[] = [];
    const clusters = clusterPoints(handRegions, 0.15);

    clusters.forEach((cluster, index) => {
      if (cluster.length > 100) {
        const centroid = calculateCentroid(cluster);
        const landmarks = generateHandLandmarks(centroid, cluster);
        
        hands.push({
          landmarks,
          handedness: index === 0 ? 'Right' : 'Left',
          confidence: Math.min(1, cluster.length / 500),
        });
      }
    });

    return {
      hands,
      gestures: [],
      timestamp: performance.now(),
    };
  } catch (error) {
    console.error('[v0] Hand detection error:', error);
    return null;
  }
}

function clusterPoints(points: Array<{ x: number; y: number; count: number }>, threshold: number): Array<Array<{ x: number; y: number }>> {
  const clusters: Array<Array<{ x: number; y: number }>> = [];
  const used = new Set<number>();

  points.forEach((point, i) => {
    if (used.has(i)) return;

    const cluster: Array<{ x: number; y: number }> = [{ x: point.x, y: point.y }];
    used.add(i);

    points.forEach((other, j) => {
      if (used.has(j)) return;
      const dist = Math.sqrt((point.x - other.x) ** 2 + (point.y - other.y) ** 2);
      if (dist < threshold) {
        cluster.push({ x: other.x, y: other.y });
        used.add(j);
      }
    });

    if (cluster.length > 10) {
      clusters.push(cluster);
    }
  });

  return clusters;
}

function calculateCentroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

function generateHandLandmarks(centroid: { x: number; y: number }, cluster: Array<{ x: number; y: number }>): HandLandmark[] {
  // Generate 21 landmarks for MediaPipe Hand format
  const landmarks: HandLandmark[] = [];
  
  // Wrist at center
  landmarks.push({ x: centroid.x, y: centroid.y, z: 0 });
  
  // Generate other landmarks in a pattern
  for (let i = 1; i < 21; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const radius = 0.05 + (i % 5) * 0.02;
    landmarks.push({
      x: centroid.x + Math.cos(angle) * radius,
      y: centroid.y + Math.sin(angle) * radius,
      z: 0,
    });
  }
  
  return landmarks;
}

export function closeHandTracking(): void {
  canvasContext = null;
  prevFrameData = null;
}
