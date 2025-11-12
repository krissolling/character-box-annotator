import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import useAnnotatorStore from '../../store/useAnnotatorStore';

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
  const image = useAnnotatorStore((state) => state.image);
  const setText = useAnnotatorStore((state) => state.setText);
  const setCurrentTool = useAnnotatorStore((state) => state.setCurrentTool);

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
      // Confirm auto-solve regions - run Tesseract
      if (autoSolveRegions.length === 0) {
        alert('Please draw at least one region first');
        return;
      }

      if (!image) {
        alert('No image loaded');
        return;
      }

      setIsProcessing(true);
      setOcrProgress('Initializing OCR...');

      try {
        // Create a Tesseract worker
        const worker = await createWorker('eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(`Processing: ${Math.round(m.progress * 100)}%`);
            }
          },
        });

        // Create a canvas to extract the region from the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Process first region (for now, just process one region)
        const region = autoSolveRegions[0];
        canvas.width = region.width;
        canvas.height = region.height;

        // Draw the selected region
        ctx.drawImage(
          image,
          region.x, region.y, region.width, region.height,
          0, 0, region.width, region.height
        );

        setOcrProgress('Recognizing text...');

        // Run OCR on the canvas
        const { data: { text } } = await worker.recognize(canvas);

        // Clean up the text (remove extra whitespace, newlines)
        const cleanedText = text.trim().replace(/\s+/g, '');

        if (cleanedText.length === 0) {
          alert('No text detected in the selected region. Try selecting a clearer area.');
        } else {
          // Set the recognized text
          setText(cleanedText);
          // Auto-switch to box tool after OCR
          setCurrentTool('box');
          alert(`OCR detected: "${cleanedText}"\n\nYou can now start annotating!`);
        }

        // Cleanup
        await worker.terminate();
        cancelAutoSolve();

      } catch (error) {
        console.error('OCR Error:', error);
        alert('OCR failed. Please try again.');
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
