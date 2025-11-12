import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function FilterControls() {
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

  const panelStyle = {
    background: 'white',
    padding: '10px',
    borderRadius: '12px',
    border: '2px solid #ddd',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  };

  const titleStyle = {
    fontWeight: 600,
    marginBottom: '8px',
    color: '#333',
    fontSize: '13px'
  };

  const controlRowStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px',
    gap: '6px'
  };

  const labelStyle = {
    fontSize: '10px',
    color: '#666',
    width: '50px',
    flex: '0 0 50px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const valueStyle = {
    fontSize: '12px',
    color: '#333',
    minWidth: '40px',
    textAlign: 'right',
    fontWeight: 500
  };

  const sliderStyle = {
    flex: 1,
    height: '6px',
    accentColor: '#4CAF50'
  };

  return (
    <div style={panelStyle}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '10px' }}>
        Visual Controls
      </h3>

      {/* Invert */}
      <div style={controlRowStyle}>
        <label style={labelStyle}>Invert</label>
        <div style={{ flex: 1 }}></div>
        <input
          type="checkbox"
          checked={imageFilters.invert}
          onChange={(e) => updateFilter('invert', e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* Brightness */}
      <div style={{ ...controlRowStyle, marginBottom: '12px' }}>
        <label style={labelStyle}>Brightness</label>
        <input
          type="range"
          min="0"
          max="200"
          value={imageFilters.brightness}
          onChange={(e) => updateFilter('brightness', parseInt(e.target.value))}
          style={sliderStyle}
        />
      </div>

      {/* Contrast */}
      <div style={{ ...controlRowStyle, marginBottom: '12px' }}>
        <label style={labelStyle}>Contrast</label>
        <input
          type="range"
          min="0"
          max="200"
          value={imageFilters.contrast}
          onChange={(e) => updateFilter('contrast', parseInt(e.target.value))}
          style={sliderStyle}
        />
      </div>

      {/* Grayscale */}
      <div style={{ ...controlRowStyle, marginBottom: '12px' }}>
        <label style={labelStyle}>Grayscale</label>
        <input
          type="range"
          min="0"
          max="100"
          value={imageFilters.grayscale}
          onChange={(e) => updateFilter('grayscale', parseInt(e.target.value))}
          style={sliderStyle}
        />
      </div>

      {/* Shadows */}
      <div style={{ ...controlRowStyle, marginBottom: '12px' }}>
        <label style={labelStyle}>Shadows</label>
        <input
          type="range"
          min="-100"
          max="100"
          value={imageFilters.shadows}
          onChange={(e) => updateFilter('shadows', parseInt(e.target.value))}
          style={sliderStyle}
        />
      </div>

      {/* Highlights */}
      <div style={{ ...controlRowStyle, marginBottom: '12px' }}>
        <label style={labelStyle}>Highlights</label>
        <input
          type="range"
          min="-100"
          max="100"
          value={imageFilters.highlights}
          onChange={(e) => updateFilter('highlights', parseInt(e.target.value))}
          style={sliderStyle}
        />
      </div>

      {/* Auto and Reset buttons */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        <button
          onClick={handleAutoAdjust}
          disabled={!image || boxes.length === 0}
          style={{
            flex: 1,
            padding: '8px',
            background: (image && boxes.length > 0) ? '#4CAF50' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: (image && boxes.length > 0) ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => {
            if (image && boxes.length > 0) e.target.style.background = '#45a049';
          }}
          onMouseOut={(e) => {
            if (image && boxes.length > 0) e.target.style.background = '#4CAF50';
          }}
        >
          Auto
        </button>
        <button
          onClick={resetFilters}
          disabled={!hasChanges}
          style={{
            flex: 1,
            padding: '8px',
            background: hasChanges ? '#f5f5f5' : '#e0e0e0',
            color: hasChanges ? '#333' : '#999',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: hasChanges ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => {
            if (hasChanges) e.target.style.background = '#e0e0e0';
          }}
          onMouseOut={(e) => {
            if (hasChanges) e.target.style.background = '#f5f5f5';
          }}
        >
          Reset
        </button>
      </div>

    </div>
  );
}
