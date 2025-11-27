import useAnnotatorStore from '../../store/useAnnotatorStore';
import { Pencil } from 'lucide-react';

export default function EditedCharacters() {
  const boxes = useAnnotatorStore((state) => state.boxes);
  const openCharacterEdit = useAnnotatorStore((state) => state.openCharacterEdit);

  // Collect all boxes that have an eraseMask
  const editedBoxes = [];

  boxes.forEach((box, index) => {
    // Include if box has an eraseMask
    if (box.eraseMask) {
      editedBoxes.push({
        index,
        char: box.char,
        box: box
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
          <strong>{editedBoxes.length}</strong> masked character{editedBoxes.length !== 1 ? 's' : ''}
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
