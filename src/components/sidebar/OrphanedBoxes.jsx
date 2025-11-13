import { useRef, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function OrphanedBoxes() {
  const boxes = useAnnotatorStore((state) => state.boxes);
  const image = useAnnotatorStore((state) => state.image);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const charPadding = useAnnotatorStore((state) => state.charPadding);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);
  const text = useAnnotatorStore((state) => state.text);
  const setText = useAnnotatorStore((state) => state.setText);
  const deleteBox = useAnnotatorStore((state) => state.deleteBox);

  // Collect orphaned boxes (characters not in current string)
  const orphanedBoxes = [];
  boxes.forEach((box, index) => {
    if (!uniqueChars.includes(box.char)) {
      orphanedBoxes.push({
        index,
        char: box.char,
        box: box
      });
    }
  });

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

  // Render each character to its own canvas
  const renderCharacter = (canvasRef, box) => {
    if (!canvasRef || !image) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');

    const boxWidth = box.width + charPadding * 2;
    const boxHeight = box.height + charPadding * 2;

    // Set canvas size to match box dimensions
    canvas.width = boxWidth;
    canvas.height = boxHeight;

    // Fill with white background
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

    // Apply brush mask if it exists
    if (box.brushMask && box.brushMask.length > 0) {
      // Create mask using offscreen canvas
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = boxWidth;
      maskCanvas.height = boxHeight;
      const maskCtx = maskCanvas.getContext('2d');

      box.brushMask.forEach(stroke => {
        maskCtx.strokeStyle = 'black';
        maskCtx.fillStyle = 'black';
        maskCtx.lineWidth = stroke.size;
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';

        maskCtx.beginPath();
        stroke.points.forEach((point, i) => {
          const boxRelativeX = point.x - box.x;
          const boxRelativeY = point.y - box.y;
          const x = charPadding + boxRelativeX;
          const y = charPadding + boxRelativeY;
          if (i === 0) {
            maskCtx.moveTo(x, y);
          } else {
            maskCtx.lineTo(x, y);
          }
        });
        maskCtx.stroke();

        stroke.points.forEach(point => {
          const boxRelativeX = point.x - box.x;
          const boxRelativeY = point.y - box.y;
          const x = charPadding + boxRelativeX;
          const y = charPadding + boxRelativeY;
          maskCtx.beginPath();
          maskCtx.arc(x, y, stroke.size / 2, 0, Math.PI * 2);
          maskCtx.fill();
        });
      });

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = boxWidth;
      tempCanvas.height = boxHeight;
      const tempCtx = tempCanvas.getContext('2d');

      tempCtx.drawImage(
        sourceImage,
        box.x, box.y, box.width, box.height,
        charPadding, charPadding, box.width, box.height
      );

      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(maskCanvas, 0, 0);

      ctx.drawImage(tempCanvas, 0, 0);
    } else {
      ctx.drawImage(
        sourceImage,
        box.x, box.y, box.width, box.height,
        charPadding, charPadding, box.width, box.height
      );
    }
  };

  const handleAddToString = (char) => {
    // Add the character to the end of the string
    setText(text + char);
  };

  const handleDeleteBox = (index) => {
    if (confirm(`Permanently delete box for "${boxes[index].char}"? This cannot be undone.`)) {
      deleteBox(index);
    }
  };

  return (
    <div style={panelStyle}>
      <h3 style={titleStyle}>Orphaned Boxes ({orphanedBoxes.length})</h3>

      {orphanedBoxes.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: '#999',
          fontSize: '11px',
          fontStyle: 'italic',
          padding: '4px 0'
        }}>
          All boxes are in use
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {orphanedBoxes.map((item) => (
            <OrphanedBoxThumbnail
              key={item.index}
              item={item}
              renderCharacter={renderCharacter}
              image={image}
              onAddToString={handleAddToString}
              onDelete={handleDeleteBox}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Separate component for each orphaned box thumbnail
function OrphanedBoxThumbnail({ item, renderCharacter, image, onAddToString, onDelete }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && image) {
      renderCharacter(canvasRef.current, item.box);
    }
  }, [item, image, renderCharacter]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      background: '#f9f9f9'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '2px solid #999',
        borderRadius: '4px',
        overflow: 'hidden',
        position: 'relative',
        background: 'white',
        flexShrink: 0
      }}>
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

      <div style={{
        flex: 1,
        fontSize: '13px',
        fontWeight: 600,
        color: '#333'
      }}>
        "{item.char}"
      </div>

      <button
        onClick={() => onAddToString(item.char)}
        title={`Add "${item.char}" back to string`}
        style={{
          padding: '4px 8px',
          fontSize: '11px',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 600
        }}
      >
        <Plus style={{ width: '12px', height: '12px' }} />
        Add
      </button>

      <button
        onClick={() => onDelete(item.index)}
        title={`Permanently delete box for "${item.char}"`}
        style={{
          padding: '4px 8px',
          fontSize: '11px',
          background: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <Trash2 style={{ width: '12px', height: '12px' }} />
      </button>
    </div>
  );
}
