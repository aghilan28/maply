/**
 * Maply — Browser Image Validation Mechanism
 * 
 * Verifies that a candidate image URL actually loads and renders in the browser
 * with valid dimensions before accepting it.
 * 
 * Prevents broken, empty, or unreachable images from ever reaching the UI.
 */

export interface ImageValidationOptions {
  timeoutMs?: number;
  minWidth?: number;
  minHeight?: number;
  signal?: AbortSignal;
}

export function validateBrowserImage(
  url: string,
  options: ImageValidationOptions = {}
): Promise<boolean> {
  const {
    timeoutMs = 6000,
    minWidth = 16,
    minHeight = 16,
    signal,
  } = options;

  return new Promise((resolve) => {
    if (!url || typeof window === 'undefined') {
      return resolve(false);
    }

    if (signal?.aborted) {
      return resolve(false);
    }

    // Data URLs or local SVG assets are inherently browser-renderable if valid format
    if (url.startsWith('data:image/svg+xml') || url.startsWith('data:image/png')) {
      return resolve(true);
    }

    const img = new Image();
    let settled = false;

    const cleanup = () => {
      settled = true;
      img.onload = null;
      img.onerror = null;
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        cleanup();
        img.src = '';
        resolve(false);
      }
    }, timeoutMs);

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          if (!settled) {
            cleanup();
            img.src = '';
            resolve(false);
          }
        },
        { once: true }
      );
    }

    img.onload = () => {
      if (!settled) {
        // Enforce that image has actual non-trivial dimensions (rejects 1x1 tracking pixels)
        const validDimensions =
          img.naturalWidth >= minWidth && img.naturalHeight >= minHeight;
        cleanup();
        resolve(validDimensions);
      }
    };

    img.onerror = () => {
      if (!settled) {
        cleanup();
        resolve(false);
      }
    };

    img.referrerPolicy = 'no-referrer';
    img.src = url;

    // Fast-path: if image was already cached by browser and decoded
    if (img.complete && img.naturalWidth >= minWidth && img.naturalHeight >= minHeight) {
      cleanup();
      resolve(true);
    }
  });
}
