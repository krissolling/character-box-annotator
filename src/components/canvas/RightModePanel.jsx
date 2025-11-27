import { useState, useEffect, useRef } from 'react';
import { Check, X, Scissors } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import { processAutoSolveRegions } from '../../utils/autoSolve';

export default function RightModePanel() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const previewCanvasRef = useRef(null);

  const isBrushBoxMode = useAnnotatorStore((state) => state.isBrushBoxMode);
  const isSelectingAutoSolveRegion = useAnnotatorStore((state) => state.isSelectingAutoSolveRegion);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const text = useAnnotatorStore((state) => state.text);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const brushStrokes = useAnnotatorStore((state) => state.brushStrokes);
  const autoSolveRegions = useAnnotatorStore((state) => state.autoSolveRegions);
  const confirmBrushBox = useAnnotatorStore((state) => state.confirmBrushBox);
  const clearBrushStrokes = useAnnotatorStore((state) => state.clearBrushStrokes);
  const cancelAutoSolve = useAnnotatorStore((state) => state.cancelAutoSolve);
  const clearAutoSolveRegions = useAnnotatorStore((state) => state.clearAutoSolveRegions);
  const image = useAnnotatorStore((state) => state.image);
  const addBox = useAnnotatorStore((state) => state.addBox);
  const addBaseline = useAnnotatorStore((state) => state.addBaseline);
  const addAngledBaseline = useAnnotatorStore((state) => state.addAngledBaseline);
  const baselines = useAnnotatorStore((state) => state.baselines);

  // Sanitize state
  const pendingSanitizeBox = useAnnotatorStore((state) => state.pendingSanitizeBox);
  const pendingSanitizeAnalysis = useAnnotatorStore((state) => state.pendingSanitizeAnalysis);
  const confirmSanitize = useAnnotatorStore((state) => state.confirmSanitize);
  const dismissSanitize = useAnnotatorStore((state) => state.dismissSanitize);
  const advanceToNextChar = useAnnotatorStore((state) => state.advanceToNextChar);

  // Draw sanitize preview
  useEffect(() => {
    if (!previewCanvasRef.current || !pendingSanitizeBox || !pendingSanitizeAnalysis || !image) {
      return;
    }

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const box = pendingSanitizeBox;

    // Set canvas size (scaled down for preview)
    const maxSize = 80;
    const scale = Math.min(maxSize / box.width, maxSize / box.height, 1);
    canvas.width = Math.round(box.width * scale);
    canvas.height = Math.round(box.height * scale);

    // Draw the box region from the image
    ctx.drawImage(
      image,
      box.x, box.y, box.width, box.height,
      0, 0, canvas.width, canvas.height
    );

    // Overlay the intruder mask in red
    if (pendingSanitizeAnalysis.intruderMask) {
      const { width, height } = pendingSanitizeAnalysis.debugData;

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext('2d');

      const maskImageData = maskCtx.createImageData(width, height);
      for (let i = 0; i < pendingSanitizeAnalysis.intruderMask.length; i++) {
        const idx = i * 4;
        if (pendingSanitizeAnalysis.intruderMask[i] === 1) {
          maskImageData.data[idx] = 255;     // R
          maskImageData.data[idx + 1] = 50;  // G
          maskImageData.data[idx + 2] = 50;  // B
          maskImageData.data[idx + 3] = 180; // A
        }
      }
      maskCtx.putImageData(maskImageData, 0, 0);

      // Draw scaled mask onto preview
      ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    }
  }, [pendingSanitizeBox, pendingSanitizeAnalysis, image]);

  // Determine what to show
  const showBrushActions = isBrushBoxMode && brushStrokes.length > 0;
  const showAutoSolveActions = isSelectingAutoSolveRegion && autoSolveRegions.length > 0;
  const showSanitizeActions = pendingSanitizeBox && pendingSanitizeAnalysis && pendingSanitizeAnalysis.hasIntruders;

  // Define handler functions before useEffect (to avoid "Cannot access before initialization" error)
  const handleSanitizeConfirm = () => {
    confirmSanitize();
    advanceToNextChar(true);
  };

  const handleSanitizeDismiss = () => {
    dismissSanitize();
    advanceToNextChar(true);
  };

  // Keyboard shortcut for sanitize mode
  useEffect(() => {
    if (!showSanitizeActions) return;

    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        handleSanitizeConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSanitizeActions, handleSanitizeConfirm]);

  const hasActionButtons = showBrushActions || showAutoSolveActions || showSanitizeActions;

  if (!hasActionButtons) {
    return null;
  }

  const handleConfirm = async () => {
    if (isBrushBoxMode) {
      confirmBrushBox();
    } else if (isSelectingAutoSolveRegion) {
      if (autoSolveRegions.length === 0) {
        alert('Please draw at least one region first');
        return;
      }

      if (!image) {
        alert('No image loaded');
        return;
      }

      if (uniqueChars.length === 0) {
        alert('Please enter a string first before using auto-solve');
        return;
      }

      setIsProcessing(true);
      setOcrProgress('Processing OCR...');

      try {
        const { addedBoxes, skippedCount, suggestedBaselines } = await processAutoSolveRegions(
          image,
          autoSolveRegions,
          boxes,
          uniqueChars,
          text,
          imageRotation
        );

        addedBoxes.forEach((box) => addBox(box));

        // Add suggested baselines (only if no baselines exist yet)
        if (suggestedBaselines && suggestedBaselines.length > 0 && baselines.length === 0) {
          console.log(`📏 Adding ${suggestedBaselines.length} suggested baseline(s)`);
          suggestedBaselines.forEach((baseline) => {
            if (baseline.type === 'horizontal') {
              addBaseline(baseline.y);
              console.log(`  ➡️ Added horizontal baseline at Y=${baseline.y.toFixed(1)}`);
            } else if (baseline.type === 'angled') {
              const start = { x: baseline.x0, y: baseline.y0 };
              const end = { x: baseline.x1, y: baseline.y1 };
              addAngledBaseline(start, end, baseline.angle);
              console.log(`  ↗️ Added angled baseline at ${baseline.angle.toFixed(1)}°`);
            }
          });
        }

        clearAutoSolveRegions();

        // Advance to next unannotated character using centralized logic
        advanceToNextChar(true);

        console.log(`✅ Auto-Solve Complete: Added ${addedBoxes.length}, Skipped ${skippedCount}, Baselines: ${suggestedBaselines?.length || 0}`);
      } catch (error) {
        console.error('❌ Auto-solve error:', error);
      } finally {
        setIsProcessing(false);
        setOcrProgress('');
      }
    }
  };

  const handleCancel = () => {
    if (isBrushBoxMode) {
      clearBrushStrokes();
    } else if (isSelectingAutoSolveRegion) {
      cancelAutoSolve();
    }
  };

  const numIntruders = pendingSanitizeAnalysis?.intruderComponents?.length || 0;

  return (
    <div className="te-panel" style={{
      position: 'absolute',
      top: '72px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      zIndex: 11
    }}>
      {/* Sanitize mode UI */}
      {showSanitizeActions && (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {/* Preview canvas */}
            <canvas
              ref={previewCanvasRef}
              style={{
                border: '1px solid var(--te-gray-300)',
                borderRadius: '4px',
                maxWidth: '80px',
                maxHeight: '80px',
              }}
            />

            {/* Info */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Scissors style={{ width: '12px', height: '12px', color: 'var(--te-orange, #f97316)' }} />
                <span style={{ fontSize: '10px', fontVariationSettings: "'wght' 600" }}>
                  {numIntruders} intruder{numIntruders !== 1 ? 's' : ''}
                </span>
              </div>
              <span style={{ fontSize: '9px', color: 'var(--te-gray-dark)' }}>
                Red = will be masked
              </span>
            </div>
          </div>

          {/* Sanitize buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={handleSanitizeDismiss}
                title="Skip sanitize"
                className="te-btn te-btn-secondary te-btn-icon"
                style={{ flex: 1 }}
              >
                <X style={{ width: '14px', height: '14px' }} />
              </button>
              <button
                onClick={handleSanitizeConfirm}
                title="Apply sanitize"
                className="te-btn te-btn-icon"
                style={{
                  flex: 1,
                  background: 'var(--te-green)',
                  borderColor: 'var(--te-green)',
                  color: 'var(--te-black)',
                }}
              >
                <Scissors style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
            <div style={{
              fontSize: '9px',
              color: 'var(--te-gray-dark)',
              textAlign: 'center'
            }}>
              Press Space to accept
            </div>
          </div>
        </>
      )}

      {/* Brush/OCR mode UI */}
      {(showBrushActions || showAutoSolveActions) && !showSanitizeActions && (
        <>
          {/* Processing indicator */}
          {isProcessing && ocrProgress && (
            <div style={{
              background: 'var(--te-blue)',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              color: 'white',
              fontSize: '10px',
              fontVariationSettings: "'wght' 500",
              textAlign: 'center'
            }}>
              {ocrProgress}
            </div>
          )}

          {/* Action buttons (confirm/cancel) */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handleCancel}
              title="Cancel"
              className="te-btn te-btn-secondary te-btn-icon"
              style={{ flex: 1 }}
            >
              <X style={{ width: '14px', height: '14px' }} />
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              title="Confirm"
              className="te-btn te-btn-icon"
              style={{
                flex: 1,
                background: isProcessing ? 'var(--te-gray-mid)' : 'var(--te-green)',
                borderColor: isProcessing ? 'var(--te-gray-mid)' : 'var(--te-green)',
                color: isProcessing ? 'var(--te-gray-dark)' : 'var(--te-black)',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.6 : 1
              }}
            >
              <Check style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
