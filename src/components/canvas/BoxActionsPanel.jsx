import { useState, useEffect, useRef } from 'react';
import { Wand2, Trash2, Edit3 } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import { analyzeBoxForIntruders, generateMaskStrokes } from '../../utils/sanitizeBox';

export default function BoxActionsPanel() {
  const [isProcessing, setIsProcessing] = useState(false);
  const lastLoggedRef = useRef(null);

  const selectedBox = useAnnotatorStore((state) => state.selectedBox);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const image = useAnnotatorStore((state) => state.image);
  const imageFilters = useAnnotatorStore((state) => state.imageFilters);
  const sanitizeBoxAction = useAnnotatorStore((state) => state.sanitizeBox);
  const deleteBox = useAnnotatorStore((state) => state.deleteBox);
  const openCharacterEdit = useAnnotatorStore((state) => state.openCharacterEdit);

  // Only show when a box is selected
  if (selectedBox === null || !boxes[selectedBox]) {
    return null;
  }

  const box = boxes[selectedBox];

  // Debug: Log selected box info (only when it changes)
  const logKey = `${selectedBox}-${box.x}-${box.y}`;
  if (lastLoggedRef.current !== logKey) {
    lastLoggedRef.current = logKey;
    console.log('📦 BoxActionsPanel:', {
      selectedBox,
      boxChar: box.char,
      boxIndex: selectedBox,
      totalBoxes: boxes.length,
      boxPosition: `(${Math.round(box.x)}, ${Math.round(box.y)})`
    });
  }

  const handleSanitize = async () => {
    if (!image || isProcessing) return;

    setIsProcessing(true);

    try {
      // Run sanitize analysis
      const analysis = analyzeBoxForIntruders(image, box, {
        invert: imageFilters.invert,
        threshold: 128,
        valleyThreshold: 0.15,
        edgeSearchPercent: 35,
        minValleyWidth: 2,
      });

      // Debug: Log the analysis results
      const { columnDensity, maxDensity, valleyThresholdAbsolute, contentThreshold, leftIntruderEnd, rightIntruderStart } = analysis.debugData;
      console.log('🔍 Sanitize Analysis:', {
        boxSize: `${box.width}x${box.height}`,
        invert: imageFilters.invert,
        maxDensity,
        contentThreshold,
        valleyThreshold: valleyThresholdAbsolute,
        leftIntruderEnd,
        rightIntruderStart,
        leftMaskEnd: analysis.leftMaskEnd,
        rightMaskStart: analysis.rightMaskStart,
        firstFewDensities: columnDensity.slice(0, 10).map(d => Math.round(d)),
        lastFewDensities: columnDensity.slice(-10).map(d => Math.round(d)),
      });

      // Generate erase strokes for intruding areas
      const eraseStrokes = generateMaskStrokes(box, analysis);

      if (eraseStrokes.length > 0) {
        // Add erase strokes to editedCharData
        sanitizeBoxAction(selectedBox, eraseStrokes);
        console.log('✨ Sanitize applied:', {
          leftMaskEnd: analysis.leftMaskEnd,
          rightMaskStart: analysis.rightMaskStart,
          newStrokesCount: eraseStrokes.length
        });
      } else {
        console.log('ℹ️ No intruders detected - box is clean');
      }
    } catch (error) {
      console.error('❌ Sanitize error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = () => {
    if (confirm(`Delete box for "${box.char}"?`)) {
      deleteBox(selectedBox);
    }
  };

  const handleEdit = () => {
    openCharacterEdit(selectedBox);
  };

  return (
    <div className="te-panel" style={{ padding: '8px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px'
      }}>
        <span className="te-small-caps" style={{ fontSize: '10px' }}>
          Selected: <strong>"{box.char}"</strong>
        </span>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={handleSanitize}
          disabled={isProcessing}
          className="te-btn te-btn-secondary"
          style={{
            flex: 1,
            height: '28px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            opacity: isProcessing ? 0.6 : 1,
            cursor: isProcessing ? 'wait' : 'pointer'
          }}
          title="Auto-mask partial letters at edges"
        >
          <Wand2 style={{ width: '12px', height: '12px' }} />
          {isProcessing ? '...' : 'Sanitize'}
        </button>

        <button
          onClick={handleEdit}
          className="te-btn te-btn-secondary te-btn-icon"
          style={{ height: '28px', width: '28px' }}
          title="Edit character mask"
        >
          <Edit3 style={{ width: '12px', height: '12px' }} />
        </button>

        <button
          onClick={handleDelete}
          className="te-btn te-btn-danger te-btn-icon"
          style={{ height: '28px', width: '28px' }}
          title="Delete box"
        >
          <Trash2 style={{ width: '12px', height: '12px' }} />
        </button>
      </div>
    </div>
  );
}
