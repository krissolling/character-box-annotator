import { RefreshCcw } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function ModeControls() {
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

  // Don't show if no tool is selected
  if (!currentTool) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: '32px' }}>
        <span style={{ fontSize: '11px', color: '#666', paddingLeft: '10px' }}>
          Select a tool above to begin annotating
        </span>
      </div>
    );
  }

  // Box mode
  if (currentTool === 'box') {
    if (!text) {
      return (
        <div style={{ width: '100%', padding: '0 10px' }}>
          <button
            onClick={() => {
              // This will be wired up to open string modal
              alert('Open string modal - to be implemented');
            }}
            style={{
              width: '100%',
              margin: 0,
              padding: '8px 16px',
              fontSize: '12px',
              height: '36px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Write a String to Begin
          </button>
        </div>
      );
    }

    // Check if all boxes are drawn
    if (currentCharIndex === -1) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', minHeight: '32px' }}>
          <span style={{ fontSize: '11px', color: '#FF9800', fontWeight: 600, paddingLeft: '10px' }}>
            All characters have been annotated. Delete boxes from the character list to draw new ones.
          </span>
        </div>
      );
    }

    const currentChar = uniqueChars[currentCharIndex];
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: '32px' }}>
        <span style={{ fontSize: '11px', color: '#666', paddingLeft: '10px' }}>
          Draw a box around the character: <strong>{currentChar}</strong>
        </span>
      </div>
    );
  }

  // Brush mode
  if (isBrushBoxMode) {
    if (!text) {
      return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minHeight: '32px' }}>
          <div style={{ paddingLeft: '10px' }}>
            <span style={{ fontSize: '11px', color: '#666' }}>Write a string to begin:</span>
            <button
              onClick={() => alert('Open string modal - to be implemented')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                height: '26px',
                marginLeft: '8px',
                background: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Write String
            </button>
          </div>
        </div>
      );
    }

    // Check if all boxes are drawn
    if (currentCharIndex === -1) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', minHeight: '32px' }}>
          <span style={{ fontSize: '11px', color: '#FF9800', fontWeight: 600, paddingLeft: '10px' }}>
            All characters have been annotated. Delete boxes from the character list to draw new ones.
          </span>
        </div>
      );
    }

    const currentChar = uniqueChars[currentCharIndex];
    return (
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1, paddingLeft: '10px' }}>
        <span style={{ fontSize: '11px', color: '#666' }}>
          Paint a bounding box for: <strong>{currentChar}</strong>
        </span>
        <label style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>Size:</label>
        <input
          type="range"
          min="10"
          max="400"
          value={brushBoxSize}
          onChange={(e) => setBrushBoxSize(parseInt(e.target.value))}
          style={{ width: '80px' }}
        />
        <span
          style={{
            fontSize: '11px',
            color: '#333',
            fontWeight: 600,
            minWidth: '35px',
            background: '#f0f0f0',
            padding: '4px 8px',
            borderRadius: '3px',
            border: '1px solid #ddd'
          }}
        >
          {brushBoxSize}px
        </span>
      </div>
    );
  }

  // Auto-solve mode
  if (isSelectingAutoSolveRegion) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: '32px' }}>
        <span style={{ fontSize: '11px', color: '#666', paddingLeft: '10px' }}>
          Draw box(es) around text regions to analyze. Draw multiple for better coverage.
        </span>
      </div>
    );
  }

  // Rotation mode
  if (isRotationMode) {
    return (
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '32px'
        }}
      >
        <span style={{ fontSize: '11px', color: '#666', paddingLeft: '10px' }}>
          Draw a line along what should be horizontal or vertical
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '11px',
              color: '#333',
              fontWeight: 600,
              minWidth: '35px',
              background: '#f0f0f0',
              padding: '4px 8px',
              borderRadius: '3px',
              border: '1px solid #ddd'
            }}
          >
            {imageRotation.toFixed(1)}°
          </span>
          <button
            onClick={() => useAnnotatorStore.getState().resetRotation()}
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              height: '32px',
              width: 'auto',
              margin: 0,
              border: '1px solid #ddd',
              background: '#f5f5f5',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#e0e0e0'}
            onMouseOut={(e) => e.currentTarget.style.background = '#f5f5f5'}
          >
            <RefreshCcw style={{ width: '14px', height: '14px' }} /> Reset
          </button>
        </div>
      </div>
    );
  }

  // Baseline mode
  if (isBaselineMode) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: '32px' }}>
        <span style={{ fontSize: '11px', color: '#666', paddingLeft: '10px' }}>
          Click and drag to draw a baseline
        </span>
      </div>
    );
  }

  // Angled baseline mode
  if (isAngledBaselineMode) {
    const latestAngle = angledBaselines.length > 0
      ? angledBaselines[angledBaselines.length - 1].angle
      : 0;

    const instructionText = angledBaselines.length === 0
      ? 'Draw line to set angle for angled baselines'
      : 'Click and drag to place baseline at set angle';

    return (
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '32px'
        }}
      >
        <span style={{ fontSize: '11px', color: '#666', paddingLeft: '10px' }}>
          {instructionText}
        </span>
        {angledBaselines.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '11px',
                color: '#333',
                fontWeight: 600,
                minWidth: '35px',
                background: '#f0f0f0',
                padding: '4px 8px',
                borderRadius: '3px',
                border: '1px solid #ddd'
              }}
            >
              {latestAngle.toFixed(1)}°
            </span>
            <button
              onClick={() => useAnnotatorStore.getState().resetAngledBaseline()}
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                height: '32px',
                width: 'auto',
                margin: 0,
                border: '1px solid #ddd',
                background: '#f5f5f5',
                color: '#333',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              <RefreshCcw style={{ width: '14px', height: '14px' }} /> Reset
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
