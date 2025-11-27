import { useEffect, useRef, useCallback } from 'react';
import useAnnotatorStore from '../store/useAnnotatorStore';
import { saveProject } from '../utils/projectStorage';

const AUTO_SAVE_DELAY = 2000; // 2 seconds debounce

/**
 * Hook to auto-save the current project to IndexedDB
 * Debounces saves to avoid excessive writes
 */
export function useAutoSave() {
  const saveTimeoutRef = useRef(null);
  const lastSaveRef = useRef(null);

  // Subscribe to relevant state changes
  const image = useAnnotatorStore((state) => state.image);
  const imageFile = useAnnotatorStore((state) => state.imageFile);
  const text = useAnnotatorStore((state) => state.text);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const baselines = useAnnotatorStore((state) => state.baselines);
  const angledBaselines = useAnnotatorStore((state) => state.angledBaselines);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const imageFilters = useAnnotatorStore((state) => state.imageFilters);
  const levelsAdjustment = useAnnotatorStore((state) => state.levelsAdjustment);
  const letterSpacing = useAnnotatorStore((state) => state.letterSpacing);
  const charPadding = useAnnotatorStore((state) => state.charPadding);
  const kerningAdjustments = useAnnotatorStore((state) => state.kerningAdjustments);
  const isAnnotating = useAnnotatorStore((state) => state.isAnnotating);
  const currentProjectId = useAnnotatorStore((state) => state.currentProjectId);
  const setCurrentProjectId = useAnnotatorStore((state) => state.setCurrentProjectId);

  const performSave = useCallback(async () => {
    if (!image || !imageFile) {
      return;
    }

    try {
      const projectData = {
        image,
        imageFile,
        text,
        boxes,
        settings: {
          baselines,
          angledBaselines,
          imageRotation,
          imageFilters,
          levelsAdjustment,
          letterSpacing,
          charPadding,
          kerningAdjustments
        }
      };

      const projectId = await saveProject(projectData, currentProjectId);

      // Store the project ID if this is a new project
      if (!currentProjectId) {
        setCurrentProjectId(projectId);
      }

      lastSaveRef.current = Date.now();
      console.log('Auto-saved project:', projectId);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [
    image,
    imageFile,
    text,
    boxes,
    baselines,
    angledBaselines,
    imageRotation,
    imageFilters,
    levelsAdjustment,
    letterSpacing,
    charPadding,
    kerningAdjustments,
    currentProjectId,
    setCurrentProjectId
  ]);

  // Debounced auto-save effect
  useEffect(() => {
    // Only auto-save when annotating and have an image
    if (!isAnnotating || !image || !imageFile) {
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule new save
    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    isAnnotating,
    image,
    imageFile,
    text,
    boxes,
    baselines,
    angledBaselines,
    imageRotation,
    imageFilters,
    levelsAdjustment,
    letterSpacing,
    charPadding,
    kerningAdjustments,
    performSave
  ]);

  // Save immediately when leaving annotating mode
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Don't save on unmount - let the debounce handle it naturally
      }
    };
  }, []);

  // Return a function to force save immediately
  return {
    saveNow: performSave,
    lastSaved: lastSaveRef.current
  };
}
