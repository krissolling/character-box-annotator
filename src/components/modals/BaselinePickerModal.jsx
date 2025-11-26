import { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';

/**
 * Calculate relevance score for a line based on target characters
 */
function calculateRelevance(line, uniqueChars) {
  if (!line.symbols || !uniqueChars || uniqueChars.length === 0) return 0;

  const foundChars = new Set();
  line.symbols.forEach(symbol => {
    if (symbol.text && uniqueChars.includes(symbol.text)) {
      foundChars.add(symbol.text);
    }
  });
  return foundChars.size;
}

/**
 * Sort and group lines by relevance and font size
 * Lines with most relevant characters come first
 * Lines with similar font sizes are grouped together
 */
function sortLinesByRelevance(lines, uniqueChars) {
  if (!lines || lines.length === 0) return [];

  // Calculate relevance and add to each line
  const linesWithScores = lines.map(line => ({
    ...line,
    relevance: calculateRelevance(line, uniqueChars),
    relevancePercent: uniqueChars.length > 0
      ? Math.round((calculateRelevance(line, uniqueChars) / uniqueChars.length) * 100)
      : 0
  }));

  // Sort by relevance (descending), then by font size (descending)
  linesWithScores.sort((a, b) => {
    // Primary: relevance
    if (b.relevance !== a.relevance) {
      return b.relevance - a.relevance;
    }
    // Secondary: font size (larger first)
    return b.fontSize - a.fontSize;
  });

  // Group similar sizes together (within 20% of each other)
  // If a high-relevance line exists, pull similar-sized lines up
  const result = [];
  const used = new Set();

  for (let i = 0; i < linesWithScores.length; i++) {
    if (used.has(i)) continue;

    const currentLine = linesWithScores[i];
    result.push(currentLine);
    used.add(i);

    // If this line has relevance, look for similar-sized lines
    if (currentLine.relevance > 0) {
      const sizeTolerance = currentLine.fontSize * 0.25; // 25% tolerance

      for (let j = i + 1; j < linesWithScores.length; j++) {
        if (used.has(j)) continue;

        const otherLine = linesWithScores[j];
        const sizeDiff = Math.abs(otherLine.fontSize - currentLine.fontSize);

        // If similar size, add it right after (even if less relevant)
        if (sizeDiff <= sizeTolerance) {
          result.push(otherLine);
          used.add(j);
        }
      }
    }
  }

  return result;
}

/**
 * Modal to let user select which detected text lines to use for annotation
 * Shows thumbnail previews of each line with detected text
 */
export default function BaselinePickerModal({
  isOpen,
  lineGroups,
  image,
  uniqueChars,
  onSelect,
  onCancel
}) {
  const [selectedLines, setSelectedLines] = useState(new Set());
  const canvasRefs = useRef({});

  // Sort lines by relevance
  const sortedLineGroups = useMemo(() => {
    return sortLinesByRelevance(lineGroups, uniqueChars);
  }, [lineGroups, uniqueChars]);

  // Draw line previews when modal opens
  useEffect(() => {
    if (!isOpen || !sortedLineGroups || !image) return;

    sortedLineGroups.forEach((line, index) => {
      const canvas = canvasRefs.current[index];
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const bbox = line.bbox;

      // Add padding around the line
      const padding = 10;
      const cropX = Math.max(0, bbox.x - padding);
      const cropY = Math.max(0, bbox.y - padding);
      const cropWidth = Math.min(image.width - cropX, bbox.width + padding * 2);
      const cropHeight = Math.min(image.height - cropY, bbox.height + padding * 2);

      // Scale to fit canvas width (max 400px)
      const maxWidth = 400;
      const scale = Math.min(1, maxWidth / cropWidth);

      canvas.width = cropWidth * scale;
      canvas.height = cropHeight * scale;

      // Draw cropped region
      ctx.drawImage(
        image,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, canvas.width, canvas.height
      );

      // Draw baseline if available
      if (line.baseline) {
        ctx.strokeStyle = 'rgba(255, 107, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const baselineY0 = (line.baseline.y0 - cropY) * scale;
        const baselineY1 = (line.baseline.y1 - cropY) * scale;
        const baselineX0 = (line.baseline.x0 - cropX) * scale;
        const baselineX1 = (line.baseline.x1 - cropX) * scale;
        ctx.moveTo(baselineX0, baselineY0);
        ctx.lineTo(baselineX1, baselineY1);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }, [isOpen, sortedLineGroups, image]);

  // Start with no lines selected
  useEffect(() => {
    if (isOpen) {
      setSelectedLines(new Set());
    }
  }, [isOpen]);

  const toggleLine = (lineId) => {
    setSelectedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = sortedLineGroups.filter(l => selectedLines.has(l.id));
    onSelect(selected);
  };

  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--te-gray-panel)',
        borderRadius: '8px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--te-gray-mid)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            <h2 style={{
              fontSize: '14px',
              fontVariationSettings: "'wght' 600",
              color: 'var(--te-black)',
              margin: 0
            }}>
              Select Text Lines
            </h2>
            <p style={{
              fontSize: '11px',
              color: 'var(--te-gray-dark)',
              margin: '4px 0 0 0'
            }}>
              Choose which detected lines to annotate
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              padding: '4px',
              background: 'none',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <X style={{ width: '20px', height: '20px', color: 'var(--te-gray-dark)' }} />
          </button>
        </div>

        {/* Line list */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px'
        }}>
          {(!sortedLineGroups || sortedLineGroups.length === 0) ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--te-gray-dark)',
              fontSize: '12px'
            }}>
              No text lines detected in image
            </div>
          ) : (
            sortedLineGroups.map((line, index) => (
              <div
                key={line.id}
                onClick={() => toggleLine(line.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px',
                  marginBottom: '8px',
                  background: selectedLines.has(line.id)
                    ? 'rgba(74, 222, 128, 0.15)'
                    : line.relevance > 0
                      ? 'rgba(59, 130, 246, 0.08)'
                      : 'var(--te-bg)',
                  border: `2px solid ${selectedLines.has(line.id) ? 'var(--te-green)' : line.relevance > 0 ? 'var(--te-blue)' : 'var(--te-gray-mid)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: `2px solid ${selectedLines.has(line.id) ? 'var(--te-green)' : 'var(--te-gray-mid)'}`,
                  background: selectedLines.has(line.id) ? 'var(--te-green)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {selectedLines.has(line.id) && (
                    <Check style={{ width: '14px', height: '14px', color: 'var(--te-black)' }} />
                  )}
                </div>

                {/* Preview canvas */}
                <canvas
                  ref={el => canvasRefs.current[index] = el}
                  style={{
                    maxWidth: '300px',
                    height: 'auto',
                    maxHeight: '60px',
                    borderRadius: '4px',
                    border: '1px solid var(--te-gray-mid)'
                  }}
                />

                {/* Line info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '12px',
                    fontVariationSettings: "'wght' 500",
                    color: 'var(--te-black)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>"{line.text}"</span>
                    {line.relevance > 0 && (
                      <span style={{
                        fontSize: '9px',
                        fontVariationSettings: "'wght' 600",
                        background: 'var(--te-blue)',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        flexShrink: 0
                      }}>
                        {line.relevance}/{uniqueChars?.length || 0} match
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: 'var(--te-gray-dark)',
                    marginTop: '2px'
                  }}>
                    ~{line.fontSize}px • {line.symbols.length} chars
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--te-gray-mid)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          flexShrink: 0
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: 'var(--te-gray-light)',
              color: 'var(--te-black)',
              border: '1px solid var(--te-gray-mid)',
              borderRadius: '6px',
              fontSize: '12px',
              fontVariationSettings: "'wght' 500",
              cursor: 'pointer'
            }}
          >
            Skip OCR
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedLines.size === 0}
            style={{
              padding: '8px 16px',
              background: selectedLines.size > 0 ? 'var(--te-green)' : 'var(--te-gray-mid)',
              color: 'var(--te-black)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontVariationSettings: "'wght' 500",
              cursor: selectedLines.size > 0 ? 'pointer' : 'not-allowed',
              opacity: selectedLines.size > 0 ? 1 : 0.6
            }}
          >
            Use Selected ({selectedLines.size})
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
