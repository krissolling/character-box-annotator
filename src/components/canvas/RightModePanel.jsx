import { useState } from 'react';
import { RefreshCcw, Check, X } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import { processAutoSolveRegions } from '../../utils/autoSolve';
import SplineSlider from '../ui/SplineSlider';

export default function RightModePanel() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');

  const currentTool = useAnnotatorStore((state) => state.currentTool);
  const isBrushBoxMode = useAnnotatorStore((state) => state.isBrushBoxMode);
  const isSelectingAutoSolveRegion = useAnnotatorStore((state) => state.isSelectingAutoSolveRegion);
  const isRotationMode = useAnnotatorStore((state) => state.isRotationMode);
  const isBaselineMode = useAnnotatorStore((state) => state.isBaselineMode);
  const isAngledBaselineMode = useAnnotatorStore((state) => state.isAngledBaselineMode);
  const brushBoxSize = useAnnotatorStore((state) => state.brushBoxSize);
  const setBrushBoxSize = useAnnotatorStore((state) => state.setBrushBoxSize);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const angledBaselines = useAnnotatorStore((state) => state.angledBaselines);
  const text = useAnnotatorStore((state) => state.text);
  const currentCharIndex = useAnnotatorStore((state) => state.currentCharIndex);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const brushStrokes = useAnnotatorStore((state) => state.brushStrokes);
  const autoSolveRegions = useAnnotatorStore((state) => state.autoSolveRegions);
  const confirmBrushBox = useAnnotatorStore((state) => state.confirmBrushBox);
  const cancelBrushBox = useAnnotatorStore((state) => state.cancelBrushBox);
  const cancelAutoSolve = useAnnotatorStore((state) => state.cancelAutoSolve);
  const clearAutoSolveRegions = useAnnotatorStore((state) => state.clearAutoSolveRegions);
  const image = useAnnotatorStore((state) => state.image);
  const addBox = useAnnotatorStore((state) => state.addBox);
  const setCurrentCharIndex = useAnnotatorStore((state) => state.setCurrentCharIndex);

  // Determine if we need to show action buttons
  const showBrushActions = isBrushBoxMode && brushStrokes.length > 0;
  const showAutoSolveActions = isSelectingAutoSolveRegion && autoSolveRegions.length > 0;
  const hasActionButtons = showBrushActions || showAutoSolveActions;

  // Determine if we have any active mode that needs the panel
  const hasActiveMode = isBrushBoxMode || isSelectingAutoSolveRegion ||
    isRotationMode || isBaselineMode || isAngledBaselineMode;

  // Don't render if no active mode (box mode doesn't need panel)
  if (!hasActiveMode) {
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
        const { addedBoxes, skippedCount } = await processAutoSolveRegions(
          image,
          autoSolveRegions,
          boxes,
          uniqueChars,
          text,
          imageRotation
        );

        addedBoxes.forEach((box) => addBox(box));

        const findNextUnannotatedChar = () => {
          for (let i = 0; i < uniqueChars.length; i++) {
            const char = uniqueChars[i];
            const hasBox = boxes.some((b) => b.char === char) || addedBoxes.some((b) => b.char === char);
            if (!hasBox) return i;
          }
          return 0;
        };

        setCurrentCharIndex(findNextUnannotatedChar());
        clearAutoSolveRegions();

        console.log(`✅ Auto-Solve Complete: Added ${addedBoxes.length}, Skipped ${skippedCount}`);
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
      cancelBrushBox();
    } else if (isSelectingAutoSolveRegion) {
      cancelAutoSolve();
    }
  };

  // Get mode-specific content
  const getModeContent = () => {
    // Brush mode
    if (isBrushBoxMode) {
      if (!text) {
        return (
          <button
            onClick={() => {
              const newText = prompt('Enter the string to annotate:');
              if (newText && newText.trim()) {
                useAnnotatorStore.getState().setText(newText.trim());
              }
            }}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '11px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Write String
          </button>
        );
      }

      if (currentCharIndex === -1) {
        return (
          <span style={{ fontSize: '10px', color: '#FF9800', fontWeight: 500 }}>
            All done
          </span>
        );
      }

      // Just show brush size slider - character shown in CharacterPicker
      return (
        <SplineSlider
          value={brushBoxSize}
          onChange={setBrushBoxSize}
          min={10}
          max={400}
          showInput={true}
          inputWidth="40px"
        />
      );
    }

    // Auto-solve mode
    if (isSelectingAutoSolveRegion) {
      return (
        <span className="te-control-label">
          Draw regions around groups of letters
        </span>
      );
    }

    // Rotation mode - just show hint, rotation info is in ToolPalette
    if (isRotationMode) {
      return (
        <span className="te-control-label">
          Draw along horizontal
        </span>
      );
    }

    // Baseline mode
    if (isBaselineMode) {
      return (
        <span className="te-control-label">
          Click to add baseline
        </span>
      );
    }

    // Angled baseline mode
    if (isAngledBaselineMode) {
      const latestAngle = angledBaselines.length > 0
        ? angledBaselines[angledBaselines.length - 1].angle
        : 0;

      return (
        <>
          <span className="te-control-label">
            {angledBaselines.length === 0 ? 'Draw to set angle' : 'Place at angle'}
          </span>
          {angledBaselines.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: '#f0f0f0',
                  padding: '4px 6px',
                  borderRadius: '3px',
                  border: '1px solid #ddd'
                }}
              >
                {latestAngle.toFixed(1)}°
              </span>
              <button
                onClick={() => useAnnotatorStore.getState().resetAngledBaseline()}
                style={{
                  padding: '4px',
                  fontSize: '10px',
                  border: '1px solid #ddd',
                  background: '#f5f5f5',
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
                title="Reset angle"
              >
                <RefreshCcw style={{ width: '12px', height: '12px' }} />
              </button>
            </div>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <div className="te-panel" style={{
      position: 'absolute',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      zIndex: 11,
      minWidth: '120px',
      maxWidth: '160px'
    }}>
      {/* Mode-specific content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {getModeContent()}
      </div>

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

      {/* Action buttons */}
      {hasActionButtons && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginTop: '4px',
          borderTop: '1px solid var(--te-gray-mid)',
          paddingTop: '8px'
        }}>
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
      )}
    </div>
  );
}
