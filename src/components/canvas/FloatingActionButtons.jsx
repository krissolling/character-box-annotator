import { useState } from 'react';
import { Check, X } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import { processAutoSolveRegions } from '../../utils/autoSolve';

export default function FloatingActionButtons() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');

  const isBrushBoxMode = useAnnotatorStore((state) => state.isBrushBoxMode);
  const isSelectingAutoSolveRegion = useAnnotatorStore((state) => state.isSelectingAutoSolveRegion);
  const brushStrokes = useAnnotatorStore((state) => state.brushStrokes);
  const autoSolveRegions = useAnnotatorStore((state) => state.autoSolveRegions);
  const confirmBrushBox = useAnnotatorStore((state) => state.confirmBrushBox);
  const cancelBrushBox = useAnnotatorStore((state) => state.cancelBrushBox);
  const cancelAutoSolve = useAnnotatorStore((state) => state.cancelAutoSolve);
  const clearAutoSolveRegions = useAnnotatorStore((state) => state.clearAutoSolveRegions);
  const image = useAnnotatorStore((state) => state.image);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);
  const text = useAnnotatorStore((state) => state.text);
  const addBox = useAnnotatorStore((state) => state.addBox);
  const setCurrentCharIndex = useAnnotatorStore((state) => state.setCurrentCharIndex);

  // Only show if in brush mode with strokes OR auto-solve mode with regions
  const showBrushActions = isBrushBoxMode && brushStrokes.length > 0;
  const showAutoSolveActions = isSelectingAutoSolveRegion && autoSolveRegions.length > 0;

  if (!showBrushActions && !showAutoSolveActions) {
    return null;
  }

  const handleConfirm = async () => {
    if (isBrushBoxMode) {
      // Confirm brush box - convert strokes to bounding box
      confirmBrushBox();
    } else if (isSelectingAutoSolveRegion) {
      // Confirm auto-solve regions - run OCR and create boxes
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

        // Add all new boxes to the store
        addedBoxes.forEach((box) => addBox(box));

        // Find next unannotated character
        const findNextUnannotatedChar = () => {
          for (let i = 0; i < uniqueChars.length; i++) {
            const char = uniqueChars[i];
            const hasBox = boxes.some((b) => b.char === char) || addedBoxes.some((b) => b.char === char);
            if (!hasBox) return i;
          }
          return 0;
        };

        setCurrentCharIndex(findNextUnannotatedChar());

        // Clear regions and exit auto-solve mode
        clearAutoSolveRegions();

        // Log results to console
        const totalChars = uniqueChars.length;
        const remaining = totalChars - (addedBoxes.length + skippedCount);
        console.log(`✅ Auto-Solve Complete: Added ${addedBoxes.length}, Skipped ${skippedCount}, Remaining ${remaining}`);
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

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', flexDirection: 'column', gap: '6px' }}>
      {/* Progress indicator */}
      {isProcessing && ocrProgress && (
        <div style={{
          background: 'rgba(33, 150, 243, 0.95)',
          padding: '8px 12px',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          color: 'white',
          fontSize: '12px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          pointerEvents: 'auto'
        }}>
          {ocrProgress}
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '6px',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          pointerEvents: 'auto'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '6px', height: '100%' }}>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            title="Confirm"
            style={{
              padding: '8px',
              fontSize: '11px',
              flex: 1,
              width: '32px',
              margin: 0,
              background: isProcessing ? '#ccc' : '#4CAF50',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              color: 'white',
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            <Check style={{ width: '16px', height: '16px' }} />
          </button>
          <button
            onClick={handleCancel}
            title="Cancel"
            style={{
              padding: '8px',
              fontSize: '11px',
              flex: 1,
              width: '32px',
              margin: 0,
              border: '1px solid #ddd',
              background: '#f5f5f5',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
