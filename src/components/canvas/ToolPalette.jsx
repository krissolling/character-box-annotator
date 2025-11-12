import { Square, Edit3, Zap, RotateCw, Minus, Slash, MousePointer2 } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import ModeControls from './ModeControls';
import FloatingActionButtons from './FloatingActionButtons';

export default function ToolPalette() {
  const currentTool = useAnnotatorStore((state) => state.currentTool);
  const setCurrentTool = useAnnotatorStore((state) => state.setCurrentTool);
  const startAutoSolveRegionSelection = useAnnotatorStore((state) => state.startAutoSolveRegionSelection);
  const startBrushBoxMode = useAnnotatorStore((state) => state.startBrushBoxMode);
  const startRotationMode = useAnnotatorStore((state) => state.startRotationMode);
  const startBaselineMode = useAnnotatorStore((state) => state.startBaselineMode);
  const startAngledBaselineMode = useAnnotatorStore((state) => state.startAngledBaselineMode);
  const cancelAutoSolve = useAnnotatorStore((state) => state.cancelAutoSolve);
  const cancelBrushBox = useAnnotatorStore((state) => state.cancelBrushBox);
  const cancelRotation = useAnnotatorStore((state) => state.cancelRotation);
  const cancelBaseline = useAnnotatorStore((state) => state.cancelBaseline);
  const cancelAngledBaseline = useAnnotatorStore((state) => state.cancelAngledBaseline);
  const currentCharIndex = useAnnotatorStore((state) => state.currentCharIndex);
  const setCurrentCharIndex = useAnnotatorStore((state) => state.setCurrentCharIndex);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const text = useAnnotatorStore((state) => state.text);
  const image = useAnnotatorStore((state) => state.image);
  const isBrushBoxMode = useAnnotatorStore((state) => state.isBrushBoxMode);
  const isSelectingAutoSolveRegion = useAnnotatorStore((state) => state.isSelectingAutoSolveRegion);
  const isRotationMode = useAnnotatorStore((state) => state.isRotationMode);
  const isBaselineMode = useAnnotatorStore((state) => state.isBaselineMode);
  const isAngledBaselineMode = useAnnotatorStore((state) => state.isAngledBaselineMode);

  const currentChar = uniqueChars[currentCharIndex];

  // Helper function to find first available unannotated character
  const findFirstAvailableChar = () => {
    for (let i = 0; i < uniqueChars.length; i++) {
      const hasBox = boxes.some(box => box.charIndex === i);
      if (!hasBox) {
        return i;
      }
    }
    return -1; // All characters have boxes
  };

  // Show separator and mode controls when any tool is active
  const showModeControls =
    currentTool !== null ||
    isBrushBoxMode ||
    isSelectingAutoSolveRegion ||
    isRotationMode ||
    isBaselineMode ||
    isAngledBaselineMode;

  const handleToolClick = (tool) => {
    if (tool.value === 'autosolve') {
      if (!text || text.length === 0) {
        alert('Please write a string first before using auto-solve.');
        return;
      }
      if (!image) {
        alert('Please upload an image first.');
        return;
      }
      startAutoSolveRegionSelection();
    } else if (tool.value === 'brush') {
      if (!text || text.length === 0) {
        alert('Please write a string first before using brush mode.');
        return;
      }
      if (!image) {
        alert('Please upload an image first.');
        return;
      }
      // If no character selected, select first available (or -1 if all done)
      if (currentCharIndex === -1 || currentCharIndex >= uniqueChars.length) {
        const firstAvailable = findFirstAvailableChar();
        setCurrentCharIndex(firstAvailable); // Will be -1 if all done
      }
      startBrushBoxMode();
    } else if (tool.value === 'rotate') {
      if (!image) {
        alert('Please upload an image first.');
        return;
      }
      startRotationMode();
    } else if (tool.value === 'baseline') {
      if (!image) {
        alert('Please upload an image first.');
        return;
      }
      startBaselineMode();
    } else if (tool.value === 'angled') {
      if (!image) {
        alert('Please upload an image first.');
        return;
      }
      startAngledBaselineMode();
    } else {
      // For box tool and pointer, explicitly clear all modes
      cancelAutoSolve();
      cancelBrushBox();
      cancelRotation();
      cancelBaseline();
      cancelAngledBaseline();

      // If switching to box mode, select character
      if (tool.value === 'box') {
        // If no character selected, select first available (or -1 if all done)
        if (currentCharIndex === -1 || currentCharIndex >= uniqueChars.length) {
          const firstAvailable = findFirstAvailableChar();
          setCurrentCharIndex(firstAvailable); // Will be -1 if all done
        }
      }

      setCurrentTool(tool.value);
    }
  };

  const tools = [
    { id: 'pointer', icon: MousePointer2, label: 'Pointer', value: 'pointer', shortcut: 'V or Hold Cmd' },
    { id: 'box', icon: Square, label: 'Box', value: 'box', shortcut: 'M' },
    { id: 'brush', icon: Edit3, label: 'Brush', value: 'brush', shortcut: 'B' },
    { id: 'auto-solve', icon: Zap, label: 'Auto-Solve', value: 'autosolve' },
    { id: 'baseline', icon: Minus, label: 'Baseline', value: 'baseline' },
    { id: 'angled', icon: Slash, label: 'Angled', value: 'angled' },
    { id: 'rotate', icon: RotateCw, label: 'Rotate Canvas', value: 'rotate' },
  ];

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'grid',
      gridTemplateColumns: '100px auto 100px',
      gap: '8px',
      alignItems: 'start',
      zIndex: 11,
      pointerEvents: 'none'
    }}>
      {/* Left: Current Character Box */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {currentChar && (
          <div style={{
            display: 'none', // Hide for now, will show when needed
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '6px',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            pointerEvents: 'auto'
          }}>
            <div style={{
              width: '60px',
              background: '#E3F2FD',
              border: '2px solid #2196F3',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 700,
              color: '#1976D2',
              padding: '4px 0'
            }}>
              {currentChar}
            </div>
          </div>
        )}
      </div>

      {/* Center: Tool Palette + Mode Controls */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '6px',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        pointerEvents: 'auto'
      }}>
        {/* Tool Buttons Row */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {tools.slice(0, 4).map((tool) => {
            const Icon = tool.icon;
            let isActive = currentTool === tool.value;

            // Special handling for modes
            if (tool.value === 'brush' && isBrushBoxMode) isActive = true;
            if (tool.value === 'autosolve' && isSelectingAutoSolveRegion) isActive = true;

            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool)}
                style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  height: '32px',
                  margin: 0,
                  background: isActive ? '#2196F3' : '#f5f5f5',
                  color: isActive ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.target.style.background = '#e0e0e0';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.target.style.background = '#f5f5f5';
                  }
                }}
                title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
              >
                <Icon style={{ width: '16px', height: '16px' }} />
                {tool.label}
              </button>
            );
          })}

          {/* Divider */}
          <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 2px' }}></div>

          {tools.slice(4).map((tool) => {
            const Icon = tool.icon;
            let isActive = currentTool === tool.value;

            // Special handling for modes
            if (tool.value === 'baseline' && isBaselineMode) isActive = true;
            if (tool.value === 'angled' && isAngledBaselineMode) isActive = true;
            if (tool.value === 'rotate' && isRotationMode) isActive = true;

            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool)}
                style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  height: '32px',
                  margin: 0,
                  background: isActive ? '#2196F3' : '#f5f5f5',
                  color: isActive ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.target.style.background = '#e0e0e0';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.target.style.background = '#f5f5f5';
                  }
                }}
                title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
              >
                <Icon style={{ width: '16px', height: '16px' }} />
                {tool.label}
              </button>
            );
          })}
        </div>

        {/* Separator Line */}
        {showModeControls && (
          <div style={{ height: '1px', background: '#ddd', margin: '6px 0' }}></div>
        )}

        {/* Mode-Specific Controls */}
        {showModeControls && <ModeControls />}
      </div>

      {/* Right: Floating Action Buttons */}
      <FloatingActionButtons />
    </div>
  );
}
