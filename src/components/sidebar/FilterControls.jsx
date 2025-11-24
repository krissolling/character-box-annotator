import { useState } from 'react';
import { ChevronDown, ChevronUp, Pipette, Sun, Wand2, RotateCcw } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import SplineSlider from '../ui/SplineSlider';

export default function FilterControls({ eyedropperActive, setEyedropperActive }) {
  const [slidersExpanded, setSlidersExpanded] = useState(false);
  const imageFilters = useAnnotatorStore((state) => state.imageFilters);
  const updateFilter = useAnnotatorStore((state) => state.updateFilter);
  const resetFilters = useAnnotatorStore((state) => state.resetFilters);
  const setLevelsAdjustment = useAnnotatorStore((state) => state.setLevelsAdjustment);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const image = useAnnotatorStore((state) => state.image);
  const charPadding = useAnnotatorStore((state) => state.charPadding);

  const hasChanges =
    imageFilters.invert !== false ||
    imageFilters.brightness !== 100 ||
    imageFilters.contrast !== 100 ||
    imageFilters.grayscale !== 100;

  // Auto-adjustment: Original HTML algorithm (simpler, more effective)
  const handleAutoAdjust = () => {
    if (!image || boxes.length === 0) return;

    // Get the WORD PREVIEW canvas specifically (not the main annotation canvas)
    const wordPreviewCanvas = document.getElementById('word-preview-canvas');
    if (!wordPreviewCanvas) {
      console.error('Word preview canvas not found');
      return;
    }

    const ctx = wordPreviewCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, wordPreviewCanvas.width, wordPreviewCanvas.height);
    const data = imageData.data;

    // Build luminance histogram (0-255)
    const histogram = new Array(256).fill(0);
    let totalPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];

      // Skip transparent pixels (background)
      if (alpha < 10) continue;

      // Calculate luminance
      const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      histogram[luminance]++;
      totalPixels++;
    }

    if (totalPixels === 0) {
      console.error('No visible pixels to analyze');
      return;
    }

    // Find min/max luminance with 5% outlier clipping (more aggressive)
    const clipThreshold = totalPixels * 0.05;
    let minLuminance = 0;
    let maxLuminance = 255;
    let accumulated = 0;

    // Find min (skip darkest 5%)
    for (let i = 0; i < 256; i++) {
      accumulated += histogram[i];
      if (accumulated > clipThreshold) {
        minLuminance = i;
        break;
      }
    }

    // Find max (skip brightest 5%)
    accumulated = 0;
    for (let i = 255; i >= 0; i--) {
      accumulated += histogram[i];
      if (accumulated > clipThreshold) {
        maxLuminance = i;
        break;
      }
    }

    // Prevent division by zero
    if (maxLuminance <= minLuminance) {
      console.error('Image has insufficient tonal range for auto adjustment');
      return;
    }

    // Calculate adjustments
    const currentRange = maxLuminance - minLuminance;
    const targetRange = 255;
    const midpoint = (minLuminance + maxLuminance) / 2;

    // Contrast: moderate boost for separation without overdoing it
    const contrastAdjust = Math.round((targetRange / currentRange) * 100);
    const boostedContrast = Math.round(contrastAdjust * 1.15); // 15% boost
    const finalContrast = Math.min(200, Math.max(120, boostedContrast)); // Minimum 120

    // Brightness: boost higher to compensate for aggressive shadows
    const brightnessShift = 128 - midpoint;
    const brightnessAdjust = Math.round(100 + (brightnessShift / 255) * 80 + 18); // Higher offset (+18)
    const finalBrightness = Math.min(150, Math.max(105, brightnessAdjust)); // Raised minimum to 105

    // Analyze dark/light distribution for shadows/highlights
    let darkPixels = 0;
    let lightPixels = 0;
    for (let i = 0; i < 128; i++) darkPixels += histogram[i];
    for (let i = 128; i < 256; i++) lightPixels += histogram[i];

    const darkRatio = darkPixels / totalPixels;
    const lightRatio = lightPixels / totalPixels;

    // Shadows: very aggressively darken shadows to crush blacks
    let shadowsAdjust = -60; // Default: heavily darken shadows
    if (darkRatio > 0.7) {
      // If already extremely dark, lift them a bit
      shadowsAdjust = Math.round((darkRatio - 0.8) * 100 - 40);
    }
    const finalShadows = Math.min(0, Math.max(-100, shadowsAdjust));

    // Highlights: very aggressively brighten highlights to blow out whites
    let highlightsAdjust = 75; // Default: heavily brighten highlights
    if (lightRatio > 0.7) {
      // If already extremely bright, reduce slightly but keep aggressive
      highlightsAdjust = Math.round((0.8 - lightRatio) * 100 + 60);
    }
    const finalHighlights = Math.min(100, Math.max(55, highlightsAdjust)); // Raised minimum to 55

    console.log('Auto-Adjust Analysis:', {
      minLuminance,
      maxLuminance,
      midpoint,
      darkRatio: darkRatio.toFixed(2),
      lightRatio: lightRatio.toFixed(2),
      finalBrightness,
      finalContrast,
      finalShadows,
      finalHighlights
    });

    // Clear levels adjustment (we're using brightness/contrast/shadows/highlights instead)
    setLevelsAdjustment(null);

    // Update sliders
    updateFilter('brightness', finalBrightness);
    updateFilter('contrast', finalContrast);
    updateFilter('shadows', finalShadows);
    updateFilter('highlights', finalHighlights);
  };

  return (
    <div className="te-panel">
      {/* Header with icon */}
      <div className="te-panel-header">
        <span className="te-panel-header-icon">
          <Sun size={14} />
        </span>
        <span className="te-panel-header-title">Visual</span>
        <button
          onClick={() => setSlidersExpanded(!slidersExpanded)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--te-gray-dark)',
            opacity: 0.6
          }}
          title={slidersExpanded ? 'Collapse sliders' : 'Expand sliders'}
        >
          {slidersExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Invert - Yes/No toggle buttons */}
      <div className="te-control-row">
        <span className="te-control-label">Invert</span>
        <div className="te-toggle-group">
          <button
            className={`te-toggle-option ${imageFilters.invert ? 'te-toggle-option-active' : 'te-toggle-option-inactive'}`}
            onClick={() => updateFilter('invert', true)}
          >
            <span>Yes</span>
          </button>
          <button
            className={`te-toggle-option ${!imageFilters.invert ? 'te-toggle-option-active' : 'te-toggle-option-inactive'}`}
            onClick={() => updateFilter('invert', false)}
          >
            <span>No</span>
          </button>
        </div>
      </div>

      {/* Collapsible Sliders */}
      {slidersExpanded && (
        <div style={{ marginTop: '8px' }}>
          {/* Brightness */}
          <div className="te-control-row">
            <span className="te-control-label">Bright</span>
            <SplineSlider
              value={imageFilters.brightness}
              onChange={(val) => updateFilter('brightness', val)}
              min={0}
              max={200}
              showInput={true}
            />
          </div>

          {/* Contrast */}
          <div className="te-control-row">
            <span className="te-control-label">Contrast</span>
            <SplineSlider
              value={imageFilters.contrast}
              onChange={(val) => updateFilter('contrast', val)}
              min={0}
              max={200}
              showInput={true}
            />
          </div>

          {/* Grayscale */}
          <div className="te-control-row">
            <span className="te-control-label">Gray</span>
            <SplineSlider
              value={imageFilters.grayscale}
              onChange={(val) => updateFilter('grayscale', val)}
              min={0}
              max={100}
              showInput={true}
            />
          </div>

          {/* Shadows */}
          <div className="te-control-row">
            <span className="te-control-label">Shadows</span>
            <SplineSlider
              value={imageFilters.shadows}
              onChange={(val) => updateFilter('shadows', val)}
              min={-100}
              max={100}
              showInput={true}
            />
          </div>

          {/* Highlights */}
          <div className="te-control-row">
            <span className="te-control-label">Hilights</span>
            <SplineSlider
              value={imageFilters.highlights}
              onChange={(val) => updateFilter('highlights', val)}
              min={-100}
              max={100}
              showInput={true}
            />
          </div>

        </div>
      )}

      {/* Action buttons - Always visible */}
      <div className="te-control-row" style={{ marginTop: '8px' }}>
        <span className="te-control-label">Actions</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* White Point Eyedropper */}
          <button
            onClick={() => setEyedropperActive && setEyedropperActive(!eyedropperActive)}
            disabled={!image || boxes.length === 0}
            className={`te-btn te-btn-icon ${eyedropperActive ? 'active' : 'te-btn-secondary'}`}
            style={{
              flex: 1,
              background: eyedropperActive ? 'var(--te-orange)' : (image && boxes.length > 0) ? undefined : 'var(--te-gray-mid)',
              borderColor: eyedropperActive ? 'var(--te-orange)' : (image && boxes.length > 0) ? undefined : 'var(--te-gray-mid)',
              color: eyedropperActive ? 'var(--te-white)' : (image && boxes.length > 0) ? undefined : 'var(--te-gray-dark)',
              cursor: (image && boxes.length > 0) ? 'pointer' : 'not-allowed'
            }}
            title="Set white point by clicking on word preview"
          >
            <Pipette style={{ width: '14px', height: '14px' }} />
          </button>
          {/* Auto */}
          <button
            onClick={handleAutoAdjust}
            disabled={!image || boxes.length === 0}
            className="te-btn te-btn-icon"
            style={{
              flex: 1,
              background: (image && boxes.length > 0) ? 'var(--te-green)' : 'var(--te-gray-mid)',
              color: (image && boxes.length > 0) ? 'var(--te-black)' : 'var(--te-gray-dark)',
              borderColor: (image && boxes.length > 0) ? 'var(--te-green)' : 'var(--te-gray-mid)',
              cursor: (image && boxes.length > 0) ? 'pointer' : 'not-allowed'
            }}
            title="Auto adjust levels"
          >
            <Wand2 style={{ width: '14px', height: '14px' }} />
          </button>
          {/* Reset */}
          <button
            onClick={resetFilters}
            disabled={!hasChanges}
            className="te-btn te-btn-icon te-btn-secondary"
            style={{
              flex: 1,
              opacity: hasChanges ? 1 : 0.5,
              cursor: hasChanges ? 'pointer' : 'not-allowed'
            }}
            title="Reset filters"
          >
            <RotateCcw style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </div>

    </div>
  );
}
