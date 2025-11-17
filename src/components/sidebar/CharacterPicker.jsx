import { useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
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
  const image = useAnnotatorStore((state) => state.image);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const charPadding = useAnnotatorStore((state) => state.charPadding);
  const selectedVariants = useAnnotatorStore((state) => state.selectedVariants);
  const setSelectedVariant = useAnnotatorStore((state) => state.setSelectedVariant);
  const textPositionVariants = useAnnotatorStore((state) => state.textPositionVariants);
  const clearAllPositionVariantsForChar = useAnnotatorStore((state) => state.clearAllPositionVariantsForChar);
  const getVariantsForChar = useAnnotatorStore((state) => state.getVariantsForChar);

  if (uniqueChars.length === 0) return null;

  // Count boxes per character
  const charCounts = {};
  boxes.forEach(box => {
    charCounts[box.char] = (charCounts[box.char] || 0) + 1;
  });

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

  // Render a character box thumbnail to canvas
  const renderCharacterThumbnail = (canvasRef, box) => {
    if (!canvasRef || !image) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');

    const boxWidth = box.width + charPadding * 2;
    const boxHeight = box.height + charPadding * 2;

    canvas.width = boxWidth;
    canvas.height = boxHeight;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, boxWidth, boxHeight);

    // Use rotated image if needed
    let sourceImage = image;
    if (imageRotation !== 0) {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = image.width;
      tempCanvas.height = image.height;
      const centerX = image.width / 2;
      const centerY = image.height / 2;
      tempCtx.translate(centerX, centerY);
      tempCtx.rotate(imageRotation * Math.PI / 180);
      tempCtx.translate(-centerX, -centerY);
      tempCtx.drawImage(image, 0, 0);
      sourceImage = tempCanvas;
    }

    ctx.drawImage(
      sourceImage,
      box.x, box.y, box.width, box.height,
      charPadding, charPadding, box.width, box.height
    );
  };

  const panelStyle = {
    background: 'white',
    padding: '10px',
    borderRadius: '12px',
    border: '2px solid #ddd',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  };

  return (
    <div style={panelStyle}>
      {/* Text display with Edit button */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#333',
          marginBottom: '6px',
          textAlign: 'center'
        }}>
          {text}
        </div>
        <button
          onClick={handleEditString}
          style={{
            width: '100%',
            padding: '6px 12px',
            background: '#f5f5f5',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#e0e0e0'}
          onMouseOut={(e) => e.target.style.background = '#f5f5f5'}
        >
          Edit String
        </button>
      </div>

      {/* Character status list */}
      <div style={{ marginBottom: '10px' }}>
        {uniqueChars.map((char, index) => {
          const isCurrent = currentCharIndex === index;
          const count = charCounts[char] || 0;
          const isDrawn = count > 0;

          const handleDeleteChar = (e) => {
            e.stopPropagation(); // Prevent selecting the character
            if (confirm(`Delete all ${count} box(es) for "${char}"?`)) {
              // Find all boxes for this character and delete them
              const boxesToDelete = boxes
                .map((box, idx) => ({ box, idx }))
                .filter(({ box }) => box.char === char)
                .reverse(); // Delete from end to avoid index shifting

              boxesToDelete.forEach(({ idx }) => {
                deleteBox(idx);
              });

              // Deselect if current box was deleted
              if (selectedBox !== null && boxes[selectedBox]?.char === char) {
                setSelectedBox(null);
              }
            }
          };

          const variants = getVariantsForChar(index);
          const currentSelectedVariant = selectedVariants[index] || 0;

          return (
            <div
              key={index}
              style={{
                padding: '10px',
                marginBottom: '8px',
                background: isCurrent ? '#E3F2FD' : '#f9f9f9',
                border: `2px solid ${isCurrent ? '#2196F3' : '#ddd'}`,
                borderRadius: '6px',
                transition: 'all 0.2s'
              }}
            >
              {/* Character header */}
              <div
                onClick={() => {
                  setCurrentCharIndex(index);
                  setCurrentTool('box');
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#333'
                }}>
                  {char}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: isDrawn ? '#4CAF50' : '#999',
                    fontWeight: 500
                  }}>
                    {isDrawn ? `${count} drawn` : 'Not drawn'}
                  </div>
                  {isDrawn && (
                    <button
                      onClick={handleDeleteChar}
                      style={{
                        padding: '4px',
                        background: 'none',
                        border: 'none',
                        color: '#f44336',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#ffebee'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                      title={`Delete all boxes for "${char}"`}
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Variant thumbnails (only if multiple variants exist) */}
              {variants.length > 1 && (
                <>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {variants.map((box) => (
                      <VariantThumbnail
                        key={box.variantId}
                        box={box}
                        isSelected={currentSelectedVariant === box.variantId}
                        onClick={() => setSelectedVariant(index, box.variantId)}
                        renderFn={renderCharacterThumbnail}
                      />
                    ))}
                  </div>

                  {/* Clear Overrides button (only if position overrides exist) */}
                  {(() => {
                    const char = uniqueChars[index];
                    const overrideCount = Object.keys(textPositionVariants).filter(pos => {
                      return text[pos] === char;
                    }).length;

                    if (overrideCount === 0) return null;

                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearAllPositionVariantsForChar(char);
                        }}
                        style={{
                          marginTop: '8px',
                          padding: '4px 8px',
                          background: '#f3e5f5',
                          color: '#9C27B0',
                          border: '1px solid #9C27B0',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          width: '100%'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#9C27B0';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f3e5f5';
                          e.currentTarget.style.color = '#9C27B0';
                        }}
                        title={`Clear ${overrideCount} position override${overrideCount !== 1 ? 's' : ''} for '${char}'`}
                      >
                        Clear {overrideCount} Override{overrideCount !== 1 ? 's' : ''}
                      </button>
                    );
                  })()}
                </>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

// Separate component for variant thumbnail
function VariantThumbnail({ box, isSelected, onClick, renderFn }) {
  const canvasRef = useRef(null);
  const image = useAnnotatorStore((state) => state.image);

  useEffect(() => {
    if (canvasRef.current && image) {
      renderFn(canvasRef.current, box);
    }
  }, [box, image, renderFn]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation(); // Don't trigger character selection
        onClick();
      }}
      style={{
        width: '36px',
        height: '36px',
        border: `2px solid ${isSelected ? '#2196F3' : '#ddd'}`,
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: 'pointer',
        background: isSelected ? '#E3F2FD' : 'white',
        transition: 'all 0.2s',
        boxShadow: isSelected ? '0 0 0 2px rgba(33, 150, 243, 0.2)' : 'none'
      }}
      title={`Variant ${box.variantId + 1}${isSelected ? ' (selected)' : ''}`}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
  );
}
