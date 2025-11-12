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

      // Smart box preservation: only remove boxes for characters that no longer exist
      if (boxes.length > 0) {
        const newChars = [...new Set(newText.split(''))];
        const oldChars = [...new Set(currentText.split(''))];
        const removedChars = oldChars.filter(c => !newChars.includes(c));

        if (removedChars.length > 0) {
          const removedList = removedChars.join(', ');
          if (!confirm(`This will remove boxes for: ${removedList}\n\nBoxes for other characters will be preserved. Continue?`)) {
            return;
          }

          // Keep only boxes for characters that still exist in new string
          const preservedBoxes = boxes.filter(box => newChars.includes(box.char));

          // Update editedCharData to match new box indices
          const oldEditedCharData = useAnnotatorStore.getState().editedCharData;
          const newEditedCharData = {};

          preservedBoxes.forEach((box, newIndex) => {
            const oldIndex = boxes.indexOf(box);
            if (oldEditedCharData[oldIndex]) {
              newEditedCharData[newIndex] = oldEditedCharData[oldIndex];
            }
          });

          useAnnotatorStore.getState().setBoxes(preservedBoxes);
          useAnnotatorStore.getState().setEditedCharData(newEditedCharData);
        }
        // If no characters removed, keep all boxes
      }

      // Update text
      useAnnotatorStore.getState().setText(newText);
    }
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

          return (
            <div
              key={index}
              onClick={() => setCurrentCharIndex(index)}
              style={{
                padding: '10px',
                marginBottom: '8px',
                background: isCurrent ? '#E3F2FD' : '#f9f9f9',
                border: `2px solid ${isCurrent ? '#2196F3' : '#ddd'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
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
          );
        })}
      </div>

    </div>
  );
}
