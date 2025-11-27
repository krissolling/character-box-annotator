import { useRef } from 'react';
import { Trash2, Edit3 } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function BoxActionsPanel() {
  const lastLoggedRef = useRef(null);

  const selectedBox = useAnnotatorStore((state) => state.selectedBox);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const deleteBox = useAnnotatorStore((state) => state.deleteBox);
  const openCharacterEdit = useAnnotatorStore((state) => state.openCharacterEdit);

  // Only show when a box is selected
  if (selectedBox === null || !boxes[selectedBox]) {
    return null;
  }

  const box = boxes[selectedBox];


  const handleDelete = () => {
    if (confirm(`Delete box for "${box.char}"?`)) {
      deleteBox(selectedBox);
    }
  };

  const handleEdit = () => {
    openCharacterEdit(selectedBox);
  };

  return (
    <div className="te-panel" style={{ padding: '8px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px'
      }}>
        <span className="te-small-caps" style={{ fontSize: '10px' }}>
          Selected: <strong>"{box.char}"</strong>
        </span>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={handleEdit}
          className="te-btn te-btn-secondary"
          style={{
            flex: 1,
            height: '28px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
          title="Edit character mask"
        >
          <Edit3 style={{ width: '12px', height: '12px' }} />
          Edit
        </button>

        <button
          onClick={handleDelete}
          className="te-btn te-btn-danger te-btn-icon"
          style={{ height: '28px', width: '28px' }}
          title="Delete box"
        >
          <Trash2 style={{ width: '12px', height: '12px' }} />
        </button>
      </div>
    </div>
  );
}
