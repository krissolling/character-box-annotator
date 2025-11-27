import { useState, useRef, useEffect } from 'react';
import PixiCanvasTest from './canvas/PixiCanvasTest';
import CharacterPicker from './sidebar/CharacterPicker';
import FilterControls from './sidebar/FilterControls';
import TypographyControls from './sidebar/TypographyControls';
import WordPreview from './sidebar/WordPreview';
import BaselineControls from './sidebar/BaselineControls';
import EditedCharacters from './sidebar/EditedCharacters';
import OrphanedBoxes from './sidebar/OrphanedBoxes';
import ExportPanel from './sidebar/ExportPanel';
import BoxActionsPanel from './canvas/BoxActionsPanel';
import CharacterEditModal from './modals/CharacterEditModal';
import BaselinePickerModal from './modals/BaselinePickerModal';
import useAnnotatorStore from '../store/useAnnotatorStore';
import { processAutoSolveRegions, processSelectedLineGroups } from '../utils/autoSolve';
import { sanitizeBox } from '../utils/sanitizeBox';
import { useAutoSave } from '../hooks/useAutoSave';

export default function MainAnnotator() {
  // Initialize canvasHeight from localStorage (persisted preview height)
  const [canvasHeight, setCanvasHeight] = useState(() => {
    const saved = localStorage.getItem('annotator-canvas-height');
    return saved ? parseFloat(saved) : 80;
  });
  const [previewWidth, setPreviewWidth] = useState(null); // Width in pixels based on aspect ratio
  const [isDragging, setIsDragging] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const containerRef = useRef(null);
  const previewContainerRef = useRef(null);

  // Auto-OCR state
  const [isRunningAutoOCR, setIsRunningAutoOCR] = useState(false);
  const [showBaselinePicker, setShowBaselinePicker] = useState(false);
  const [detectedLineGroups, setDetectedLineGroups] = useState([]);
  const [ocrResults, setOcrResults] = useState(null); // Store OCR results for user decision
  const [showOcrPrompt, setShowOcrPrompt] = useState(false);

  // Get current tool info for tooltip
  const currentTool = useAnnotatorStore((state) => state.currentTool);
  const isBrushBoxMode = useAnnotatorStore((state) => state.isBrushBoxMode);
  const isSelectingAutoSolveRegion = useAnnotatorStore((state) => state.isSelectingAutoSolveRegion);
  const isRotationMode = useAnnotatorStore((state) => state.isRotationMode);
  const isBaselineMode = useAnnotatorStore((state) => state.isBaselineMode);
  const isAngledBaselineMode = useAnnotatorStore((state) => state.isAngledBaselineMode);
  const isZoomMode = useAnnotatorStore((state) => state.isZoomMode);

  // Auto-OCR store state
  const image = useAnnotatorStore((state) => state.image);
  const text = useAnnotatorStore((state) => state.text);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const baselines = useAnnotatorStore((state) => state.baselines);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const hasRunAutoOCR = useAnnotatorStore((state) => state.hasRunAutoOCR);
  const addBox = useAnnotatorStore((state) => state.addBox);
  const addBaseline = useAnnotatorStore((state) => state.addBaseline);
  const addAngledBaseline = useAnnotatorStore((state) => state.addAngledBaseline);
  const setCurrentCharIndex = useAnnotatorStore((state) => state.setCurrentCharIndex);
  const setZoomLevel = useAnnotatorStore((state) => state.setZoomLevel);
  const setPanOffset = useAnnotatorStore((state) => state.setPanOffset);
  const setBoxEraseMask = useAnnotatorStore((state) => state.setBoxEraseMask);

  // Auto-save hook - saves project to IndexedDB when changes are made
  useAutoSave();

  // Auto-run OCR when component mounts with image and text
  useEffect(() => {
    const runAutoOCR = async () => {
      // ATOMIC check-and-set using Zustand's synchronous getState/setState
      // This prevents the race condition where two effect runs both pass the check
      const state = useAnnotatorStore.getState();

      // Check all skip conditions using the store's current state (not React state which may be stale)
      const shouldSkip = !state.image || !state.text || state.hasRunAutoOCR || state.boxes.length > 0;

      if (shouldSkip) {
        return;
      }

      // Check if Tesseract is available
      if (typeof window === 'undefined' || !window.Tesseract) {
        console.log('⚠️ Tesseract not loaded yet, skipping auto-OCR');
        return;
      }

      // ATOMIC: Set flag immediately before any async work (prevents second run)
      useAnnotatorStore.setState({ hasRunAutoOCR: true });
      setIsRunningAutoOCR(true);

      try {
        // Create a region covering the entire image
        const fullImageRegion = {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height
        };

        // Request line-grouped results for picker UI
        const { lineGroups } = await processAutoSolveRegions(
          image,
          [fullImageRegion],
          [], // No existing boxes
          uniqueChars,
          text,
          imageRotation,
          true // returnLineGrouped = true
        );


        // Store results and show prompt to user
        if (lineGroups && lineGroups.length > 0) {
          console.log('🔍 OCR lineGroups:', lineGroups);

          // Count characters and words from line groups
          let totalChars = 0;
          let totalWords = 0;
          let inStringCount = 0;
          let notInStringCount = 0;

          lineGroups.forEach((group, idx) => {
            console.log(`  Line ${idx}:`, {
              hasSymbols: !!group.symbols,
              symbolCount: group.symbols?.length,
              text: group.text,
              group
            });
            // lineGroups have 'symbols' array, not 'boxes'
            if (group && group.symbols && Array.isArray(group.symbols)) {
              totalChars += group.symbols.length;

              // Count how many are in the target string
              group.symbols.forEach(symbol => {
                if (uniqueChars.includes(symbol.text)) {
                  inStringCount++;
                } else {
                  notInStringCount++;
                }
              });
            }
          });
          // Rough word count: estimate ~5 chars per word
          totalWords = Math.max(1, Math.ceil(totalChars / 5));

          console.log(`📊 OCR Summary: ${totalChars} chars, ~${totalWords} words, ${lineGroups.length} lines`);

          setOcrResults({
            lineGroups,
            charCount: totalChars,
            inStringCount,
            notInStringCount,
            lineCount: lineGroups.length
          });
          setShowOcrPrompt(true);
        } else {
          // No lines detected
          console.log('⚠️ No text lines detected');
        }
      } catch (error) {
        console.error('❌ Auto-OCR error:', error);
      } finally {
        setIsRunningAutoOCR(false);
      }
    };

    runAutoOCR();
  }, [image, text, hasRunAutoOCR, boxes.length, uniqueChars, imageRotation, baselines.length]);

  // Watch for manual OCR trigger
  const triggerFullOCR = useAnnotatorStore((state) => state.triggerFullOCR);
  const resetOCRTrigger = useAnnotatorStore((state) => state.resetOCRTrigger);

  useEffect(() => {
    if (!triggerFullOCR || !image) return;

    // Reset trigger and re-run OCR
    resetOCRTrigger();
    useAnnotatorStore.setState({ hasRunAutoOCR: false });
  }, [triggerFullOCR, image, resetOCRTrigger]);

  // Handle line selection from picker
  const handleLineSelection = (selectedLines) => {
    setShowBaselinePicker(false);
    setDetectedLineGroups([]);

    if (!selectedLines || selectedLines.length === 0) {
      setCurrentCharIndex(0);
      return;
    }

    const { boxes: newBoxes, baselines: newBaselines } = processSelectedLineGroups(
      selectedLines,
      uniqueChars,
      boxes,
      image
    );

    // Add boxes and auto-sanitize OCR boxes
    const currentBoxCount = useAnnotatorStore.getState().boxes.length;
    newBoxes.forEach((box) => addBox(box));

    // Auto-sanitize each new box
    if (image) {
      const updatedBoxes = useAnnotatorStore.getState().boxes;
      for (let i = currentBoxCount; i < updatedBoxes.length; i++) {
        const box = updatedBoxes[i];
        try {
          const result = sanitizeBox(image, box);
          if (result.hasChanges) {
            setBoxEraseMask(i, result.eraseMask);
          }
        } catch (err) {
          console.warn(`⚠️ Failed to sanitize box for '${box.char}':`, err);
        }
      }
    }

    // Add baselines (only if no baselines exist yet)
    if (newBaselines.length > 0 && baselines.length === 0) {
      const addedHorizontalYs = []; // Track added Y values to avoid duplicates
      const addedAngledKeys = []; // Track added angled baselines

      newBaselines.forEach((baseline) => {
        // Calculate if horizontal or angled
        const dx = baseline.x1 - baseline.x0;
        const dy = baseline.y1 - baseline.y0;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        if (Math.abs(angle) < 2) {
          // Horizontal - check for duplicates within 3px tolerance
          const y = Math.round((baseline.y0 + baseline.y1) / 2);
          const isDuplicate = addedHorizontalYs.some(existingY => Math.abs(existingY - y) < 3);

          if (!isDuplicate) {
            addBaseline(y);
            addedHorizontalYs.push(y);
          }
        } else {
          // Angled - check for duplicates by rounding coordinates
          const key = `${Math.round(baseline.x0)},${Math.round(baseline.y0)},${Math.round(baseline.x1)},${Math.round(baseline.y1)}`;

          if (!addedAngledKeys.includes(key)) {
            const start = { x: baseline.x0, y: baseline.y0 };
            const end = { x: baseline.x1, y: baseline.y1 };
            addAngledBaseline(start, end, angle);
            addedAngledKeys.push(key);
          }
        }
      });
    }

    // Zoom to fit the selected line(s) with 50px padding
    if (newBoxes.length > 0 && containerRef.current) {
      // Calculate bounding box of all new boxes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      newBoxes.forEach(box => {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
      });

      // Add 50px padding (in image coordinates)
      const padding = 50;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(image.width, maxX + padding);
      maxY = Math.min(image.height, maxY + padding);

      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;

      // Get container dimensions
      const containerRect = containerRef.current.getBoundingClientRect();
      const viewportWidth = containerRect.width;
      const viewportHeight = containerRect.height;

      // Calculate zoom level to fit content
      const zoomX = viewportWidth / contentWidth;
      const zoomY = viewportHeight / contentHeight;
      const newZoom = Math.min(zoomX, zoomY, 4.0); // Cap at 4x zoom

      // Calculate pan offset to center the content
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const panX = (viewportWidth / 2) - (centerX * newZoom);
      const panY = (viewportHeight / 2) - (centerY * newZoom);

      setZoomLevel(newZoom);
      setPanOffset({ x: panX, y: panY });

      console.log(`🔍 Zoomed to fit selected line: ${newZoom.toFixed(2)}x`);
    }

    // Find first unannotated character
    const findFirstUnannotatedChar = () => {
      for (let i = 0; i < uniqueChars.length; i++) {
        const char = uniqueChars[i];
        const hasBox = boxes.some((b) => b.char === char) || newBoxes.some((b) => b.char === char);
        if (!hasBox) return i;
      }
      return -1;
    };

    setCurrentCharIndex(findFirstUnannotatedChar());

    console.log(`✅ Added ${newBoxes.length} boxes from selected lines`);
  };

  // Handle picker cancel
  const handlePickerCancel = () => {
    setShowBaselinePicker(false);
    setDetectedLineGroups([]);
    setCurrentCharIndex(0);
  };

  // Handle OCR prompt accept
  const handleOcrAccept = () => {
    setShowOcrPrompt(false);
    if (!ocrResults) return;

    // If multiple lines, show line picker
    if (ocrResults.lineGroups.length > 1) {
      setDetectedLineGroups(ocrResults.lineGroups);
      setShowBaselinePicker(true);
    } else {
      // Single line, process directly
      handleLineSelection(ocrResults.lineGroups);
    }
    setOcrResults(null);
  };

  // Handle OCR prompt dismiss
  const handleOcrDismiss = () => {
    setShowOcrPrompt(false);
    setOcrResults(null);
    setCurrentCharIndex(0);
  };

  // Tool tooltip info
  const getToolTooltip = () => {
    if (isRunningAutoOCR) return { label: 'Auto-OCR', shortcut: null, hint: 'Detecting characters...' };
    if (isBrushBoxMode) return { label: 'Brush', shortcut: 'B', hint: 'Paint to create box. Shift+Drag to change brush size' };
    if (isZoomMode) return { label: 'Zoom', shortcut: 'Z', hint: 'Drag to zoom in/out' };
    if (isSelectingAutoSolveRegion) return { label: 'Auto-Solve', shortcut: null, hint: 'Draw regions for OCR' };
    if (isRotationMode) return { label: 'Rotate', shortcut: null, hint: 'Draw along horizontal to rotate the canvas' };
    if (isBaselineMode) return { label: 'Baseline', shortcut: null, hint: 'Click to add baseline' };
    if (isAngledBaselineMode) return { label: 'Angled', shortcut: null, hint: 'Draw to set angle' };

    switch (currentTool) {
      case 'pointer': return { label: 'Pointer', shortcut: 'V', hint: 'Select and move boxes' };
      case 'box': return { label: 'Box', shortcut: 'M', hint: 'Draw bounding boxes' };
      default: return { label: 'Pointer', shortcut: 'V', hint: '' };
    }
  };

  const toolTooltip = getToolTooltip();

  // Update width based on aspect ratio when height changes
  useEffect(() => {
    const updateWidth = () => {
      const previewCanvas = document.getElementById('word-preview-canvas');
      if (!previewCanvas || !containerRef.current) return;

      const naturalWidth = parseFloat(previewCanvas.dataset.naturalWidth);
      const naturalHeight = parseFloat(previewCanvas.dataset.naturalHeight);

      if (!naturalWidth || !naturalHeight) return;

      const aspectRatio = naturalWidth / naturalHeight;
      const containerRect = containerRef.current.getBoundingClientRect();
      const availableHeight = containerRect.height * (100 - canvasHeight) / 100;
      // Account for padding (20px for handle + 12px padding)
      const actualHeight = availableHeight - 32;

      if (actualHeight > 0) {
        const calculatedWidth = actualHeight * aspectRatio;
        setPreviewWidth(calculatedWidth);
      }
    };

    updateWidth();

    // Also update on resize
    window.addEventListener('resize', updateWidth);

    // Set up a MutationObserver to watch for canvas data attribute changes
    const previewCanvas = document.getElementById('word-preview-canvas');
    let observer;
    if (previewCanvas) {
      observer = new MutationObserver(updateWidth);
      observer.observe(previewCanvas, { attributes: true, attributeFilter: ['data-natural-width', 'data-natural-height'] });
    }

    return () => {
      window.removeEventListener('resize', updateWidth);
      if (observer) observer.disconnect();
    };
  }, [canvasHeight]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const container = e.currentTarget.parentElement;
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percentage = (y / rect.height) * 100;

    // Constrain between 5% and 95%
    const constrainedPercentage = Math.min(Math.max(percentage, 5), 95);
    setCanvasHeight(constrainedPercentage);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Save to localStorage when drag ends
      localStorage.setItem('annotator-canvas-height', canvasHeight.toString());
    }
    setIsDragging(false);
  };

  return (
    <div
      ref={containerRef}
      style={{ background: 'var(--te-bg)', height: '100vh', display: 'flex', flexDirection: 'column' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Main content area - full screen canvas with floating elements */}
      <div style={{
        flex: 1,
        padding: '0',
        overflow: 'hidden',
        minHeight: 0,
        position: 'relative'
      }}>
        {/* Full screen Annotation Canvas - WebGL renderer */}
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          <PixiCanvasTest />
        </div>

        {/* Floating Word Preview at bottom */}
        <div
          ref={previewContainerRef}
          style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: previewWidth ? `${previewWidth}px` : 'fit-content',
          maxWidth: 'calc(100% - 24px)',
          height: `${100 - canvasHeight}%`,
          minHeight: '40px',
          maxHeight: '60%',
          overflow: 'hidden',
          background: 'transparent',
          borderRadius: 'var(--radius-sm)',
          zIndex: 15
        }}>
          {/* Draggable handle */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              height: '20px',
              background: 'transparent',
              cursor: 'ns-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              zIndex: 10
            }}
          >
            <div style={{
              width: '48px',
              height: '6px',
              background: isDragging ? 'var(--te-blue)' : 'var(--te-green)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--te-gray-mid)',
              boxShadow: 'var(--shadow-inner)'
            }}></div>
          </div>
          <div style={{ height: '100%', overflow: 'hidden', paddingTop: '20px' }}>
            <WordPreview
              eyedropperActive={eyedropperActive}
              setEyedropperActive={setEyedropperActive}
            />
          </div>
        </div>

        {/* Tool tooltip - top left */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 20,
          background: 'var(--te-gray-panel)',
          border: '1px solid var(--te-gray-mid)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 10px',
          boxShadow: 'var(--shadow-inner)'
        }}>
          <div style={{
            fontSize: '11px',
            color: 'var(--te-black)',
            textAlign: 'left'
          }}>
            <span style={{ fontVariationSettings: "'wght' 500" }}>
              {toolTooltip.label}
              {toolTooltip.shortcut && ` (${toolTooltip.shortcut})`}
            </span>
            {toolTooltip.hint && (
              <span style={{ marginLeft: '8px', fontVariationSettings: "'wght' 350", color: 'var(--te-gray-dark)' }}>
                {toolTooltip.hint}
              </span>
            )}
          </div>
        </div>

        {/* Character picker - top center */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 'calc(100% - 200px)',
          zIndex: 20
        }}>
          <CharacterPicker />
        </div>

        {/* Floating right sidebar */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          width: '220px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 20
        }}>
          <BoxActionsPanel />
          <BaselineControls />
          <EditedCharacters />
          <OrphanedBoxes />
        </div>

        {/* Bottom right - Visual controls + Export */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          width: '220px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 20
        }}>
          <FilterControls
            eyedropperActive={eyedropperActive}
            setEyedropperActive={setEyedropperActive}
          />
          <ExportPanel />
        </div>
      </div>

      {/* Character Edit Modal */}
      <CharacterEditModal />

      {/* Baseline Picker Modal */}
      <BaselinePickerModal
        isOpen={showBaselinePicker}
        lineGroups={detectedLineGroups}
        image={image}
        uniqueChars={uniqueChars}
        onSelect={handleLineSelection}
        onCancel={handlePickerCancel}
      />

      {/* OCR Results Prompt */}
      {showOcrPrompt && ocrResults && (
        <div className="te-panel" style={{
          position: 'absolute',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 11,
          minWidth: '300px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '8px'
          }}>
            <div style={{ fontSize: '12px', fontVariationSettings: "'wght' 600" }}>
              Auto-OCR found:
            </div>
            <div style={{ fontSize: '11px', color: 'var(--te-gray-dark)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>• {ocrResults.charCount} character{ocrResults.charCount !== 1 ? 's' : ''} found, {' '}
                <span style={{
                  background: 'var(--te-green)',
                  color: 'var(--te-black)',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontVariationSettings: "'wght' 600"
                }}>
                  {ocrResults.inStringCount} in string
                </span>
              </div>
              <div>• {ocrResults.lineCount} line{ocrResults.lineCount !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--te-gray-dark)', marginTop: '4px' }}>
              Use these results?
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', padding: '0 8px 8px 8px' }}>
            <button
              onClick={handleOcrDismiss}
              className="te-btn te-btn-secondary"
              style={{ flex: 1, fontSize: '11px', padding: '6px' }}
            >
              Dismiss
            </button>
            <button
              onClick={handleOcrAccept}
              className="te-btn te-btn-primary"
              style={{ flex: 1, fontSize: '11px', padding: '6px' }}
            >
              {ocrResults.lineCount > 1 ? 'Choose Lines' : 'Use Results'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
