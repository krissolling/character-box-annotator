import { RotateCcw } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function TypographyControls() {
  const letterSpacing = useAnnotatorStore((state) => state.letterSpacing);
  const charPadding = useAnnotatorStore((state) => state.charPadding);
  const kerningAdjustments = useAnnotatorStore((state) => state.kerningAdjustments);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const setLetterSpacing = useAnnotatorStore((state) => state.setLetterSpacing);
  const setCharPadding = useAnnotatorStore((state) => state.setCharPadding);
  const updateKerning = useAnnotatorStore((state) => state.updateKerning);

  const hasChanges = letterSpacing !== 0 || charPadding !== 0 || Object.keys(kerningAdjustments).length > 0;

  const resetTypography = () => {
    setLetterSpacing(0);
    setCharPadding(0);
    // Clear all kerning adjustments
    Object.keys(kerningAdjustments).forEach(key => updateKerning(key, 0));
  };

  // Get unique character pairs for kerning
  const getCharacterPairs = () => {
    const sortedBoxes = [...boxes].sort((a, b) => a.x - b.x);
    const pairs = [];
    for (let i = 0; i < sortedBoxes.length - 1; i++) {
      pairs.push({
        index: i,
        char1: sortedBoxes[i].char,
        char2: sortedBoxes[i + 1].char,
        kerning: kerningAdjustments[i] || 0,
      });
    }
    return pairs;
  };

  const characterPairs = getCharacterPairs();

  const panelStyle = {
    background: 'white',
    padding: '15px',
    borderRadius: '12px',
    border: '2px solid #ddd',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  };

  const titleStyle = {
    fontWeight: 600,
    marginBottom: '10px',
    color: '#333',
    fontSize: '14px'
  };

  const controlRowStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px',
    gap: '10px'
  };

  const labelStyle = {
    fontSize: '12px',
    color: '#666',
    minWidth: '100px'
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={titleStyle}>Typography</h3>
        {hasChanges && (
          <button
            onClick={resetTypography}
            style={{
              fontSize: '12px',
              padding: '4px 8px',
              background: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseOver={(e) => e.target.style.background = '#F57C00'}
            onMouseOut={(e) => e.target.style.background = '#FF9800'}
          >
            <RotateCcw style={{ width: '12px', height: '12px' }} />
            Reset
          </button>
        )}
      </div>

      <div>
        {/* Letter Spacing */}
        <div style={{ ...controlRowStyle, marginBottom: '12px' }}>
          <label style={labelStyle}>Letter Spacing</label>
          <input
            type="range"
            min="-20"
            max="50"
            value={letterSpacing}
            onChange={(e) => setLetterSpacing(parseInt(e.target.value))}
            style={sliderStyle}
          />
          <span style={valueStyle}>
            {letterSpacing > 0 ? '+' : ''}{letterSpacing}px
          </span>
        </div>

        {/* Character Padding */}
        <div style={{ ...controlRowStyle, marginBottom: '12px' }}>
          <label style={labelStyle}>Char Padding</label>
          <input
            type="range"
            min="0"
            max="30"
            value={charPadding}
            onChange={(e) => setCharPadding(parseInt(e.target.value))}
            style={sliderStyle}
          />
          <span style={valueStyle}>
            {charPadding > 0 ? '+' : ''}{charPadding}px
          </span>
        </div>

        {/* Kerning Adjustments */}
        {characterPairs.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>
              Per-Pair Kerning
            </h4>
            <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
              {characterPairs.map((pair) => (
                <div key={pair.index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    background: '#f0f0f0',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    minWidth: '50px',
                    textAlign: 'center'
                  }}>
                    {pair.char1}{pair.char2}
                  </span>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    value={pair.kerning}
                    onChange={(e) => updateKerning(pair.index, parseInt(e.target.value))}
                    style={{ flex: 1, height: '4px', accentColor: '#4CAF50' }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 500, minWidth: '35px', textAlign: 'right' }}>
                    {pair.kerning > 0 ? '+' : ''}{pair.kerning}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {boxes.length === 0 && (
          <p style={{ fontSize: '12px', color: '#999', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
            Draw character boxes to see typography controls
          </p>
        )}
      </div>
    </div>
  );
}
