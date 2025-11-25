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
import CharacterEditModal from './modals/CharacterEditModal';
import useAnnotatorStore from '../store/useAnnotatorStore';

export default function MainAnnotator() {
  const [canvasHeight, setCanvasHeight] = useState(80); // Percentage of available height
  const [previewWidth, setPreviewWidth] = useState(null); // Width in pixels based on aspect ratio
  const [isDragging, setIsDragging] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const containerRef = useRef(null);
  const previewContainerRef = useRef(null);

  // Get current tool info for tooltip
  const currentTool = useAnnotatorStore((state) => state.currentTool);
  const isBrushBoxMode = useAnnotatorStore((state) => state.isBrushBoxMode);
  const isSelectingAutoSolveRegion = useAnnotatorStore((state) => state.isSelectingAutoSolveRegion);
  const isRotationMode = useAnnotatorStore((state) => state.isRotationMode);
  const isBaselineMode = useAnnotatorStore((state) => state.isBaselineMode);
  const isAngledBaselineMode = useAnnotatorStore((state) => state.isAngledBaselineMode);
  const isZoomMode = useAnnotatorStore((state) => state.isZoomMode);

  // Tool tooltip info
  const getToolTooltip = () => {
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

    // Constrain between 20% and 80%
    const constrainedPercentage = Math.min(Math.max(percentage, 20), 80);
    setCanvasHeight(constrainedPercentage);
  };

  const handleMouseUp = () => {
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
          minHeight: '150px',
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
          top: '50%',
          right: '12px',
          transform: 'translateY(-50%)',
          width: '220px',
          maxHeight: 'calc(100% - 24px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflow: 'auto',
          zIndex: 20
        }}>
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
    </div>
  );
}
