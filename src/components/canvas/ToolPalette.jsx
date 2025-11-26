import { Square, Paintbrush, Zap, RotateCw, Minus, Slash, MousePointer2, Search, RefreshCcw } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import ZoomControls from './ZoomControls';
import SplineSlider from '../ui/SplineSlider';

export default function ToolPalette() {
  const currentTool = useAnnotatorStore((state) => state.currentTool);
  const setCurrentTool = useAnnotatorStore((state) => state.setCurrentTool);
  const startAutoSolveRegionSelection = useAnnotatorStore((state) => state.startAutoSolveRegionSelection);
  const startBrushBoxMode = useAnnotatorStore((state) => state.startBrushBoxMode);
  const startRotationMode = useAnnotatorStore((state) => state.startRotationMode);
  const startBaselineMode = useAnnotatorStore((state) => state.startBaselineMode);
  const startAngledBaselineMode = useAnnotatorStore((state) => state.startAngledBaselineMode);
  const startZoomMode = useAnnotatorStore((state) => state.startZoomMode);
  const cancelAutoSolve = useAnnotatorStore((state) => state.cancelAutoSolve);
  const cancelBrushBox = useAnnotatorStore((state) => state.cancelBrushBox);
  const cancelRotation = useAnnotatorStore((state) => state.cancelRotation);
  const cancelBaseline = useAnnotatorStore((state) => state.cancelBaseline);
  const cancelAngledBaseline = useAnnotatorStore((state) => state.cancelAngledBaseline);
  const cancelZoom = useAnnotatorStore((state) => state.cancelZoom);
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
  const isZoomMode = useAnnotatorStore((state) => state.isZoomMode);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const resetRotation = useAnnotatorStore((state) => state.resetRotation);
  const brushBoxSize = useAnnotatorStore((state) => state.brushBoxSize);
  const setBrushBoxSize = useAnnotatorStore((state) => state.setBrushBoxSize);

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

  const handleToolClick = (tool) => {
    // Helper to cancel all modes except the one being activated
    const cancelOtherModes = (except) => {
      if (except !== 'autosolve') cancelAutoSolve();
      if (except !== 'brush') cancelBrushBox();
      if (except !== 'rotate') cancelRotation();
      if (except !== 'baseline') cancelBaseline();
      if (except !== 'angled') cancelAngledBaseline();
      if (except !== 'zoom') cancelZoom();
    };

    if (tool.value === 'autosolve') {
      if (!text || text.length === 0) {
        alert('Please write a string first before using auto-solve.');
        return;
      }
      if (!image) {
        alert('Please upload an image first.');
        return;
      }
      cancelOtherModes('autosolve');
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
      cancelOtherModes('brush');
      // If no character selected, select first available (or -1 if all done)
      if (currentCharIndex === -1 || currentCharIndex >= uniqueChars.length) {
        const firstAvailable = findFirstAvailableChar();
        setCurrentCharIndex(firstAvailable);
      }
      startBrushBoxMode();
    } else if (tool.value === 'rotate') {
      if (!image) {
        alert('Please upload an image first.');
        return;
      }
      cancelOtherModes('rotate');
      if (!isRotationMode) {
        startRotationMode();
      }
    } else if (tool.value === 'baseline') {
      if (!image) {
        alert('Please upload an image first.');
        return;
      }
      cancelOtherModes('baseline');
      if (!isBaselineMode) {
        startBaselineMode();
      }
    } else if (tool.value === 'angled') {
      if (!image) {
        alert('Please upload an image first.');
        return;
      }
      cancelOtherModes('angled');
      if (!isAngledBaselineMode) {
        startAngledBaselineMode();
      }
    } else if (tool.value === 'zoom') {
      if (!image) {
        alert('Please upload an image first.');
        return;
      }
      cancelOtherModes('zoom');
      if (!isZoomMode) {
        startZoomMode();
      }
    } else {
      // For box tool and pointer, explicitly clear all modes
      cancelOtherModes(null);

      // If switching to box mode, select character
      if (tool.value === 'box') {
        if (currentCharIndex === -1 || currentCharIndex >= uniqueChars.length) {
          const firstAvailable = findFirstAvailableChar();
          setCurrentCharIndex(firstAvailable);
        }
      }

      setCurrentTool(tool.value);
    }
  };

  const tools = [
    { id: 'pointer', icon: MousePointer2, label: 'Pointer', value: 'pointer', shortcut: 'V' },
    { id: 'box', icon: Square, label: 'Box', value: 'box', shortcut: 'M' },
    { id: 'brush', icon: Paintbrush, label: 'Brush', value: 'brush', shortcut: 'B' },
    { id: 'auto-solve', icon: Zap, label: 'Auto-Solve', value: 'autosolve' },
    { id: 'baseline', icon: Minus, label: 'Baseline', value: 'baseline' },
    // { id: 'angled', icon: Slash, label: 'Angled', value: 'angled' }, // Hidden for now
    { id: 'rotate', icon: RotateCw, label: 'Rotate', value: 'rotate' },
  ];

  return (
    <div className="te-tool-palette" style={{
      position: 'absolute',
      top: '50%',
      left: '12px',
      transform: 'translateY(-50%)',
      zIndex: 11
    }}>
      {tools.map((tool, index) => {
        const Icon = tool.icon;
        let isActive = currentTool === tool.value;

        // Special handling for modes
        if (tool.value === 'brush' && isBrushBoxMode) isActive = true;
        if (tool.value === 'zoom' && isZoomMode) isActive = true;
        if (tool.value === 'autosolve' && isSelectingAutoSolveRegion) isActive = true;
        if (tool.value === 'baseline' && isBaselineMode) isActive = true;
        if (tool.value === 'angled' && isAngledBaselineMode) isActive = true;
        if (tool.value === 'rotate' && isRotationMode) isActive = true;

        // Add separators after auto-solve (index 3) and after rotate (index 6)
        const showSeparator = index === 3 || index === 6;

        return (
          <div key={tool.id} style={{ position: 'relative' }}>
            <button
              onClick={() => handleToolClick(tool)}
              className={`te-tool-btn ${isActive ? 'active' : ''}`}
              title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
            >
              <Icon style={{ width: '14px', height: '14px' }} />
            </button>
            {/* Brush size slider - show next to brush button when active */}
            {tool.value === 'brush' && isBrushBoxMode && (
              <div style={{
                position: 'absolute',
                left: '100%',
                top: '0',
                marginLeft: '12px',
                display: 'grid',
                gridTemplateColumns: '1fr',
                alignItems: 'center',
                height: '32px',
                width: '139px' // 91px slider + 44px input + 4px gap
              }}>
                <SplineSlider
                  value={brushBoxSize}
                  onChange={setBrushBoxSize}
                  min={5}
                  max={600}
                  step={1}
                  showInput={true}
                  inputWidth="44px"
                />
              </div>
            )}
            {/* Rotation info - show next to rotate button when active */}
            {tool.value === 'rotate' && isRotationMode && (
              <div style={{
                position: 'absolute',
                left: '100%',
                top: '0',
                marginLeft: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
                height: '32px'
              }}>
                <span style={{
                  fontSize: '10px',
                  fontVariationSettings: "'wght' 500",
                  background: 'var(--te-gray-panel)',
                  padding: '0 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--te-gray-mid)',
                  boxShadow: 'var(--shadow-inner)',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {imageRotation.toFixed(1)}°
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetRotation();
                  }}
                  className="te-tool-btn"
                  title="Reset rotation"
                >
                  <RefreshCcw style={{ width: '12px', height: '12px' }} />
                </button>
              </div>
            )}
            {showSeparator && (
              <div className="te-tool-separator" />
            )}
          </div>
        );
      })}

      {/* Zoom tool button */}
      <button
        onClick={() => {
          if (!image) {
            alert('Please upload an image first.');
            return;
          }
          if (!isZoomMode) {
            startZoomMode();
          }
        }}
        className={`te-tool-btn ${isZoomMode ? 'active' : ''}`}
        title="Zoom (Z)"
      >
        <Search style={{ width: '14px', height: '14px' }} />
      </button>

      {/* Zoom controls */}
      <ZoomControls />
    </div>
  );
}
