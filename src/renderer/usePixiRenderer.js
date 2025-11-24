import { useRef, useEffect, useState } from 'react';
import { PixiRenderer } from './PixiRenderer';

/**
 * React hook for pixi.js renderer
 * @param {Object} options - Configuration options
 * @returns {Object} Renderer interface
 */
export function usePixiRenderer(options = {}) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // Create renderer
    const renderer = new PixiRenderer(canvas, options);

    // Wait for initialization
    renderer.waitForInit()
      .then(() => {
        rendererRef.current = renderer;

        // Export globally for debugging
        if (typeof window !== 'undefined') {
          window.__PIXI_RENDERER__ = renderer;
          console.log('🔧 Debug: Renderer available at window.__PIXI_RENDERER__');
        }

        setIsReady(true);
      })
      .catch(err => {
        console.error('Failed to initialize renderer:', err);
        setError(err);
      });

    // Cleanup on unmount
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, []);

  // Handle resize
  useEffect(() => {
    if (!canvasRef.current || !rendererRef.current || !isReady) return;

    const canvas = canvasRef.current;
    const parent = canvas.parentElement;

    let resizeTimeout;
    const handleResize = () => {
      if (parent && rendererRef.current) {
        // Debounce resize to avoid flickering
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          const rect = parent.getBoundingClientRect();
          rendererRef.current.resize(rect.width, rect.height);
        }, 100);
      }
    };

    // Initial size (no debounce)
    if (parent && rendererRef.current) {
      const rect = parent.getBoundingClientRect();
      rendererRef.current.resize(rect.width, rect.height);
    }

    // Observe parent size changes
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(parent);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, [isReady]);

  // API methods
  const api = {
    canvasRef,
    isReady,
    error,

    loadImage: async (image) => {
      if (!rendererRef.current) throw new Error('Renderer not initialized');
      await rendererRef.current.loadImage(image);
    },

    setBoxes: (boxes) => {
      if (!rendererRef.current) return;
      rendererRef.current.setBoxes(boxes);
    },

    updateBox: (index, updates) => {
      if (!rendererRef.current) return;
      rendererRef.current.updateBox(index, updates);
    },

    setSelectedBox: (index) => {
      if (!rendererRef.current) return;
      rendererRef.current.setSelectedBox(index);
    },

    setHoveredBox: (index) => {
      if (!rendererRef.current) return;
      rendererRef.current.setHoveredBox(index);
    },

    findBoxAtPoint: (x, y) => {
      if (!rendererRef.current) return null;
      return rendererRef.current.findBoxAtPoint(x, y);
    },

    findAllBoxesAtPoint: (x, y, tolerance) => {
      if (!rendererRef.current) return [];
      return rendererRef.current.findAllBoxesAtPoint(x, y, tolerance);
    },

    setPan: (x, y) => {
      if (!rendererRef.current) return;
      rendererRef.current.setPan(x, y);
    },

    setZoom: (zoom) => {
      if (!rendererRef.current) return;
      rendererRef.current.setZoom(zoom);
    },

    getViewport: () => {
      if (!rendererRef.current) return null;
      return rendererRef.current.getViewport();
    },

    requestRender: () => {
      if (!rendererRef.current) return;
      rendererRef.current.requestRender();
    },

    getRenderer: () => rendererRef.current
  };

  return api;
}
