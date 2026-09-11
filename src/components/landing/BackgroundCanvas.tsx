import React, { useEffect, useRef, useState } from 'react';

const TOTAL_FRAMES = 300;

export const BackgroundCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const images: HTMLImageElement[] = [];
    let loadedCount = 0;
    let lastDrawnFrame = -1;
    let animationFrameId: number;

    // High-DPI Canvas Sizing
    const updateCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth || document.documentElement.clientWidth || 1920;
      const height = window.innerHeight || document.documentElement.clientHeight || 1080;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      lastDrawnFrame = -1;
    };

    window.addEventListener('resize', updateCanvasSize);
    updateCanvasSize();

    // Draw frame maintaining aspect-ratio cover
    const drawCoverImage = (img: HTMLImageElement) => {
      if (!img || !img.complete || img.naturalWidth === 0) return false;

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const canvasRatio = canvasWidth / canvasHeight;

      let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

      if (canvasRatio > imgRatio) {
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imgRatio;
        offsetX = 0;
        offsetY = (canvasHeight - drawHeight) / 2;
      } else {
        drawWidth = canvasHeight * imgRatio;
        drawHeight = canvasHeight;
        offsetX = (canvasWidth - drawWidth) / 2;
        offsetY = 0;
      }

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      return true;
    };

    // Preload all 300 frame images
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const indexStr = String(i).padStart(3, '0');
      img.src = `/frames/ezgif-frame-${indexStr}.jpg`;

      img.onload = () => {
        loadedCount++;
        setLoadProgress(Math.round((loadedCount / TOTAL_FRAMES) * 100));
        if (loadedCount === TOTAL_FRAMES) {
          setIsLoaded(true);
        }
        lastDrawnFrame = -1;
      };

      img.onerror = () => {
        loadedCount++;
        setLoadProgress(Math.round((loadedCount / TOTAL_FRAMES) * 100));
      };

      images.push(img);
    }

    let currentFrame = 0;

    const getTargetFrame = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const maxScroll = Math.max(
        1,
        (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight
      );
      const progress = Math.max(0, Math.min(1, scrollY / maxScroll));
      return progress * (TOTAL_FRAMES - 1);
    };

    // Animation Loop with Linear Interpolation (Lerp)
    const renderLoop = () => {
      const targetFrame = getTargetFrame();
      currentFrame += (targetFrame - currentFrame) * 0.06;

      const frameIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(currentFrame)));

      if (frameIndex !== lastDrawnFrame || lastDrawnFrame === -1) {
        const success = drawCoverImage(images[frameIndex]);
        if (success) {
          lastDrawnFrame = frameIndex;
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* Top Preloader Progress Bar */}
      {!isLoaded && (
        <div
          className="fixed top-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 z-50 transition-all duration-150 ease-out shadow-lg shadow-orange-500/50"
          style={{ width: `${loadProgress}%` }}
        />
      )}

      {/* Fixed Fullscreen Background Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full object-cover pointer-events-none z-0"
      />

      {/* Clear view overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40 pointer-events-none z-0" />
    </>
  );
};
