'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { initializeHandTracking, detectHands, closeHandTracking } from '@/lib/handTracking';
import { analyzeHand, combineGestures, GestureState } from '@/lib/gestureRecognition';
import { PortalView } from '@/components/Portal';

const DEFAULT_GESTURE_STATE: GestureState = {
  isPinching: false,
  pinchAmount: 0,
  isOpen: false,
  handRotation: 0,
  handPosition: { x: 0.5, y: 0.5 },
  isActive: false,
};

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [gestureState, setGestureState] = useState<GestureState>(DEFAULT_GESTURE_STATE);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize hand tracking and camera
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        setIsLoading(true);
        // Initialize MediaPipe hand tracking
        await initializeHandTracking();

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (videoRef.current && mounted) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current && mounted) {
              videoRef.current.play();
              setIsLoading(false);
              setIsInitialized(true);
            }
          };
        }
      } catch (err) {
        let message = 'Failed to initialize hand tracking';
        if (err instanceof Error) {
          message = err.message;
          if (err.name === 'NotAllowedError') {
            message = 'Camera access was denied. Please allow camera access to use hand gesture control.';
          } else if (err.name === 'NotFoundError') {
            message = 'No camera device found. Please connect a camera and try again.';
          }
        }
        console.error(message);
        if (mounted) {
          setError(message);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      closeHandTracking();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Main detection loop
  useEffect(() => {
    if (!isInitialized || !videoRef.current) return;

    let isDetecting = false;

    const detectFrame = async () => {
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !isDetecting) {
        isDetecting = true;
        try {
          const result = await detectHands(video);
          
          if (result && result.hands.length > 0) {
            const gestures = result.hands.map((hand, index) =>
              analyzeHand(hand, result.gestures[index]?.categoryName || '')
            );
            
            const combined = combineGestures(gestures);
            setGestureState(combined);
          } else {
            setGestureState(DEFAULT_GESTURE_STATE);
          }
        } catch (error) {
          console.error('[v0] Detection error:', error);
        } finally {
          isDetecting = false;
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };

    animationFrameRef.current = requestAnimationFrame(detectFrame);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized]);

  return (
    <main className="w-full h-screen bg-black flex flex-col overflow-hidden">
      {/* Portal Canvas */}
      <div className="flex-1 relative">
        <PortalView gestureState={gestureState} />
        
        {/* Info Overlay */}
        <div className="absolute top-0 left-0 p-4 text-white font-mono text-xs md:text-sm">
          <div className="space-y-1 bg-black/70 p-3 rounded border border-yellow-500/30">
            <div className="text-yellow-400 font-bold text-sm mb-2">Hand Tracking Data</div>
            <div>Position: {gestureState.handPosition.x.toFixed(2)}, {gestureState.handPosition.y.toFixed(2)}</div>
            <div>Pinch: {(gestureState.pinchAmount * 100).toFixed(0)}% {'▮'.repeat(Math.floor(gestureState.pinchAmount * 10))}</div>
            <div>Rotation: {gestureState.handRotation.toFixed(0)}°</div>
            <div>Status: {gestureState.isActive ? '✓ Active' : '○ Idle'}</div>
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-0 right-0 p-4 text-white font-mono text-xs md:text-sm text-right">
          <div className="space-y-2 bg-black/70 p-4 rounded border border-yellow-500/30 max-w-xs">
            <div className="text-yellow-400 font-bold text-sm mb-3">Gesture Controls</div>
            <div className="text-left space-y-2">
              <div>🤏 <span className="text-yellow-300">Pinch</span> - Grow/shrink portal</div>
              <div>✋ <span className="text-yellow-300">Move hand</span> - Move portal</div>
              <div>🔄 <span className="text-yellow-300">Rotate hand</span> - Spin rings</div>
              <div>👐 <span className="text-yellow-300">Open palm</span> - Activate</div>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="text-white text-center">
              <div className="inline-block">
                <div className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mb-4"></div>
              </div>
              <p className="text-yellow-400 font-mono">Initializing hand tracking...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="text-white text-center p-8 bg-gradient-to-br from-red-900/70 to-red-950/70 rounded-lg border border-red-500/50 max-w-md">
              <h2 className="text-2xl font-bold mb-4 text-red-300">Camera Access Required</h2>
              <p className="mb-6 leading-relaxed">{error}</p>
              <div className="space-y-3 text-sm">
                <p className="text-gray-300">Make sure to:</p>
                <ul className="text-left space-y-1 text-gray-300 ml-4">
                  <li>✓ Grant camera permissions</li>
                  <li>✓ Check camera privacy settings</li>
                  <li>✓ Ensure your camera is working</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Camera Feed Preview */}
      <video
        ref={videoRef}
        className="absolute bottom-4 left-4 w-40 h-32 border-2 border-yellow-500/50 rounded-lg hidden md:block shadow-lg object-cover"
        width={1280}
        height={720}
        muted
        playsInline
      />
    </main>
  );
}
