import useAnnotatorStore from '../../store/useAnnotatorStore';
import { Pencil } from 'lucide-react';

export default function EditedCharacters() {
  const editedCharData = useAnnotatorStore((state) => state.editedCharData);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const openCharacterEdit = useAnnotatorStore((state) => state.openCharacterEdit);

  // Collect all edited boxes (both manually edited and brush-drawn)
  const editedBoxes = [];

  boxes.forEach((box, index) => {
    // Include if: has editedCharData OR has brushMask
    if (editedCharData[index] || (box.brushMask && box.brushMask.length > 0)) {
      editedBoxes.push({
        index,
        char: box.char,
        box: box,
        hasBrushMask: !!(box.brushMask && box.brushMask.length > 0)
      });
    }
  });

  if (editedBoxes.length === 0) {
    return null;
  }

  return (
    <div className="te-panel">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '6px'
      }}>
        <Pencil style={{ width: '14px', height: '14px', color: 'var(--te-black)' }} />
        <span className="te-small-caps">
          <strong>{editedBoxes.length}</strong> edited character{editedBoxes.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px'
      }}>
        {editedBoxes.map((item) => (
          <button
            key={item.index}
            onClick={() => openCharacterEdit(item.index)}
            className="te-tag te-tag-blue"
            style={{
              cursor: 'pointer',
              border: 'none',
              fontVariationSettings: "'wght' 500"
            }}
            title={`Edit character "${item.char}"`}
          >
            {item.char}
          </button>
        ))}
      </div>
    </div>
  );
}
