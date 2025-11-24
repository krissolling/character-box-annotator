import { useRef, useEffect, useState } from 'react';
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
  const image = useAnnotatorStore((state) => state.image);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const charPadding = useAnnotatorStore((state) => state.charPadding);
  const selectedVariants = useAnnotatorStore((state) => state.selectedVariants);
  const setSelectedVariant = useAnnotatorStore((state) => state.setSelectedVariant);
  const textPositionVariants = useAnnotatorStore((state) => state.textPositionVariants);
  const clearAllPositionVariantsForChar = useAnnotatorStore((state) => state.clearAllPositionVariantsForChar);
  const getVariantsForChar = useAnnotatorStore((state) => state.getVariantsForChar);

  // Mode cancel functions to properly switch to box tool
  const cancelBrushBox = useAnnotatorStore((state) => state.cancelBrushBox);
  const cancelAutoSolve = useAnnotatorStore((state) => state.cancelAutoSolve);
  const cancelRotation = useAnnotatorStore((state) => state.cancelRotation);
  const cancelBaseline = useAnnotatorStore((state) => state.cancelBaseline);
  const cancelAngledBaseline = useAnnotatorStore((state) => state.cancelAngledBaseline);

  // Track which character has expanded variants
  const [expandedChar, setExpandedChar] = useState(null);
  // Track hovered character for delete button
  const [hoveredChar, setHoveredChar] = useState(null);
  // Track if panel is hovered for edit button
  const [panelHovered, setPanelHovered] = useState(false);

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

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', paddingRight: '40px', marginRight: '-40px' }}
      onMouseEnter={() => setPanelHovered(true)}
      onMouseLeave={() => setPanelHovered(false)}
    >
      {/* Edit button - outside panel, show on hover */}
      {panelHovered && (
        <button
          onClick={handleEditString}
          style={{
            position: 'absolute',
            top: '50%',
            right: '4px',
            transform: 'translateY(-50%)',
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
      )}

      <div className="te-panel" style={{ padding: '8px' }}>

      {/* Horizontal character boxes */}
      <div style={{
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        alignItems: 'flex-start'
      }}>
        {uniqueChars.map((char, index) => {
          const isCurrent = currentCharIndex === index;
          const count = charCounts[char] || 0;
          const isDrawn = count > 0;
          const variants = getVariantsForChar(index);
          const currentSelectedVariant = selectedVariants[index] || 0;
          const isExpanded = expandedChar === index;

          const handleDeleteChar = (e) => {
            e.stopPropagation();
            if (confirm(`Delete all ${count} box(es) for "${char}"?`)) {
              const boxesToDelete = boxes
                .map((box, idx) => ({ box, idx }))
                .filter(({ box }) => box.char === char)
                .reverse();

              boxesToDelete.forEach(({ idx }) => {
                deleteBox(idx);
              });

              if (selectedBox !== null && boxes[selectedBox]?.char === char) {
                setSelectedBox(null);
              }
            }
          };

          const handleCharClick = () => {
            cancelBrushBox();
            cancelAutoSolve();
            cancelRotation();
            cancelBaseline();
            cancelAngledBaseline();
            setCurrentCharIndex(index);
            setCurrentTool('box');

            // Toggle expanded state for variants
            if (variants.length > 1) {
              setExpandedChar(isExpanded ? null : index);
            }
          };

          // Determine background color
          let bgColor = 'var(--te-gray-light)';
          if (isCurrent) {
            bgColor = 'var(--te-orange)';
          } else if (isDrawn) {
            bgColor = 'var(--te-green)';
          }

          return (
            <div
              key={index}
              onClick={handleCharClick}
              onMouseEnter={() => setHoveredChar(index)}
              onMouseLeave={() => setHoveredChar(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 6px',
                borderRadius: 'var(--radius-sm)',
                background: bgColor,
                border: `1px solid ${isCurrent ? 'var(--te-orange)' : isDrawn ? 'var(--te-green)' : 'var(--te-gray-mid)'}`,
                boxShadow: 'var(--shadow-inner)',
                cursor: 'pointer',
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

              {/* Count indicator - centered, only show on hover if more than 1 */}
              {count > 1 && hoveredChar === index && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '10px',
                  fontVariationSettings: "'wght' 600",
                  padding: '2px 6px',
                  borderRadius: '3px',
                  background: isCurrent ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)',
                  color: isCurrent ? 'var(--te-orange)' : 'var(--te-white)'
                }}>
                  {count}
                </div>
              )}

              {/* Delete button (only if drawn and hovered) */}
              {isDrawn && hoveredChar === index && (
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
                  title={`Delete all boxes for "${char}"`}
                >
                  <Trash2 style={{ width: '8px', height: '8px' }} />
                </button>
              )}

              {/* Variant indicator */}
              {variants.length > 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: '-2px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: isCurrent ? 'var(--te-white)' : 'var(--te-blue)'
                }} />
              )}

              {/* Expanded variants dropdown */}
              {isExpanded && variants.length > 1 && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '8px',
                    padding: '6px',
                    background: 'var(--te-white)',
                    border: '1px solid var(--te-gray-mid)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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

                  {/* Clear Overrides button */}
                  {(() => {
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
                        className="te-btn te-btn-ghost"
                        style={{
                          width: '100%',
                          height: '24px',
                          fontSize: '9px'
                        }}
                      >
                        Clear {overrideCount} Override{overrideCount !== 1 ? 's' : ''}
                      </button>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}

      </div>
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
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: '44px',
        height: '40px',
        border: `2px solid ${isSelected ? 'var(--te-orange)' : 'var(--te-gray-mid)'}`,
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        cursor: 'pointer',
        background: isSelected ? 'var(--te-orange)' : 'var(--te-white)',
        transition: 'all 0.15s',
        boxShadow: 'var(--shadow-inner)'
      }}
      title={`Variant ${box.variantId + 1}${isSelected ? ' (selected)' : ''}`}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block'
        }}
      />
    </div>
  );
}
