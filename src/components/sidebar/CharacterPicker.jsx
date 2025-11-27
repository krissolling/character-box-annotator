import { useState } from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function CharacterPicker() {
  const text = useAnnotatorStore((state) => state.text);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);
  const currentCharIndex = useAnnotatorStore((state) => state.currentCharIndex);
  const setCurrentCharIndex = useAnnotatorStore((state) => state.setCurrentCharIndex);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const selectedBox = useAnnotatorStore((state) => state.selectedBox);
  const deleteBox = useAnnotatorStore((state) => state.deleteBox);
  const setSelectedBox = useAnnotatorStore((state) => state.setSelectedBox);
  const setCurrentTool = useAnnotatorStore((state) => state.setCurrentTool);
  const caseSensitive = useAnnotatorStore((state) => state.caseSensitive);
  const setCaseSensitive = useAnnotatorStore((state) => state.setCaseSensitive);

  // Mode cancel functions to properly switch to box tool
  const cancelBrushBox = useAnnotatorStore((state) => state.cancelBrushBox);
  const cancelAutoSolve = useAnnotatorStore((state) => state.cancelAutoSolve);
  const cancelRotation = useAnnotatorStore((state) => state.cancelRotation);
  const cancelBaseline = useAnnotatorStore((state) => state.cancelBaseline);
  const cancelAngledBaseline = useAnnotatorStore((state) => state.cancelAngledBaseline);

  // Track hovered position for delete button
  const [hoveredPosition, setHoveredPosition] = useState(null);

  const handleEditString = () => {
    const currentText = text || '';
    const newText = prompt('Edit the string to annotate:', currentText);

    if (newText !== null && newText !== currentText) {
      // User confirmed and text changed
      if (newText.trim() === '') {
        alert('String cannot be empty');
        return;
      }

      // Simply update text - boxes for removed characters become orphaned automatically
      // Orphaned boxes are hidden in canvas but preserved in storage
      // They will reappear if the character is added back to the string
      useAnnotatorStore.getState().updateTextOnly(newText);
    }
  };

  // Show button to set text if no text has been set
  if (uniqueChars.length === 0) {
    return (
      <div className="te-panel" style={{ padding: '12px', textAlign: 'center' }}>
        <p style={{
          fontSize: '12px',
          color: 'var(--te-gray-dark)',
          marginBottom: '8px',
          fontVariationSettings: "'wght' 400"
        }}>
          No text string set
        </p>
        <button
          onClick={handleEditString}
          className="te-btn te-btn-primary"
          style={{ width: '100%' }}
        >
          Set Text String
        </button>
      </div>
    );
  }

  // Check which characters have boxes
  const charsWithBoxes = new Set(boxes.map(b => b.char));

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '12px' }}
    >
      {/* Case sensitivity toggle */}
      <button
        onClick={() => setCaseSensitive(!caseSensitive)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: caseSensitive ? 'var(--te-blue)' : 'var(--te-gray-panel)',
          border: `1px solid ${caseSensitive ? 'var(--te-blue)' : 'var(--te-gray-mid)'}`,
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-inner)',
          cursor: 'pointer',
          padding: '6px 8px',
          transition: 'all 0.15s'
        }}
        title={caseSensitive ? 'Case sensitive (click to allow substitution)' : 'Case insensitive (A can substitute for a)'}
      >
        <span style={{
          fontSize: '14px',
          fontVariationSettings: "'wght' 600",
          color: caseSensitive ? 'var(--te-white)' : 'var(--te-gray-dark)',
          lineHeight: 1
        }}>
          Aa
        </span>
      </button>

      <div className="te-panel" style={{ padding: '8px' }}>

      {/* Horizontal character boxes - show full text string */}
      <div style={{
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        alignItems: 'flex-start'
      }}>
        {text.split('').map((char, position) => {
          // Find the unique char index for this character
          const charIndex = uniqueChars.indexOf(char);
          const isCurrent = currentCharIndex === charIndex;
          const isDrawn = charsWithBoxes.has(char);
          const isHoveredPosition = hoveredPosition === position;

          const handleDeleteChar = (e) => {
            e.stopPropagation();
            // Find the box for this character
            const boxIndex = boxes.findIndex(b => b.char === char);
            if (boxIndex !== -1) {
              if (confirm(`Delete box for "${char}"?`)) {
                deleteBox(boxIndex);

                if (selectedBox === boxIndex) {
                  setSelectedBox(null);
                }
              }
            }
          };

          const handleCharClick = () => {
            // Don't allow selecting characters that are already drawn
            if (isDrawn) {
              return;
            }
            cancelBrushBox();
            cancelAutoSolve();
            cancelRotation();
            cancelBaseline();
            cancelAngledBaseline();
            setCurrentCharIndex(charIndex);
            setCurrentTool('box');
          };

          // Determine background color
          let bgColor = 'var(--te-gray-light)';
          if (isCurrent) {
            bgColor = 'var(--te-orange)';
          } else if (isDrawn) {
            bgColor = 'var(--te-green)';
          }

          // Determine cursor - not clickable if already drawn (unless hovering delete button)
          const cursorStyle = isDrawn ? 'default' : 'pointer';

          return (
            <div
              key={position}
              onClick={handleCharClick}
              onMouseEnter={() => setHoveredPosition(position)}
              onMouseLeave={() => setHoveredPosition(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 6px',
                borderRadius: 'var(--radius-sm)',
                background: bgColor,
                border: `1px solid ${isCurrent ? 'var(--te-orange)' : isDrawn ? 'var(--te-green)' : 'var(--te-gray-mid)'}`,
                boxShadow: 'var(--shadow-inner)',
                cursor: cursorStyle,
                minWidth: '44px',
                position: 'relative'
              }}
            >
              {/* Character */}
              <span style={{
                fontSize: '20px',
                fontVariationSettings: "'wght' 300",
                color: isCurrent ? 'var(--te-white)' : 'var(--te-black)',
                lineHeight: 1
              }}>
                {char}
              </span>

              {/* Delete button (if drawn and hovered) */}
              {isDrawn && isHoveredPosition && (
                <button
                  onClick={handleDeleteChar}
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '14px',
                    height: '14px',
                    padding: 0,
                    background: 'var(--te-red)',
                    border: 'none',
                    borderRadius: '50%',
                    color: 'var(--te-white)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px'
                  }}
                  title={`Delete box for "${char}"`}
                >
                  <Trash2 style={{ width: '8px', height: '8px' }} />
                </button>
              )}
            </div>
          );
        })}

      </div>
      </div>

      {/* Edit button */}
      <button
        onClick={handleEditString}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--te-gray-panel)',
            border: '1px solid var(--te-gray-mid)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-inner)',
            cursor: 'pointer',
            padding: '6px'
          }}
          title="Edit string"
        >
          <Edit2 style={{ width: '12px', height: '12px', color: 'var(--te-black)' }} />
        </button>
    </div>
  );
}
