import { Check, X } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function FloatingActionButtons() {
  const isBrushBoxMode = useAnnotatorStore((state) => state.isBrushBoxMode);
  const isSelectingAutoSolveRegion = useAnnotatorStore((state) => state.isSelectingAutoSolveRegion);
  const brushStrokes = useAnnotatorStore((state) => state.brushStrokes);
  const autoSolveRegions = useAnnotatorStore((state) => state.autoSolveRegions);
  const confirmBrushBox = useAnnotatorStore((state) => state.confirmBrushBox);
  const cancelBrushBox = useAnnotatorStore((state) => state.cancelBrushBox);
  const cancelAutoSolve = useAnnotatorStore((state) => state.cancelAutoSolve);

  // Only show if in brush mode with strokes OR auto-solve mode with regions
  const showBrushActions = isBrushBoxMode && brushStrokes.length > 0;
  const showAutoSolveActions = isSelectingAutoSolveRegion && autoSolveRegions.length > 0;

  if (!showBrushActions && !showAutoSolveActions) {
    return null;
  }

  const handleConfirm = () => {
    if (isBrushBoxMode) {
      // Confirm brush box - convert strokes to bounding box
      confirmBrushBox();
    } else if (isSelectingAutoSolveRegion) {
      // Confirm auto-solve regions - run Tesseract
      if (autoSolveRegions.length === 0) {
        alert('Please draw at least one region first');
        return;
      }
      alert('Run auto-solve with Tesseract - to be implemented');
      cancelAutoSolve();
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
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
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
            title="Confirm"
            style={{
              padding: '8px',
              fontSize: '11px',
              flex: 1,
              width: '32px',
              margin: 0,
              background: '#4CAF50',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              cursor: 'pointer',
              color: 'white'
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
