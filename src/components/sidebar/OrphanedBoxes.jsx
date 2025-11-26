import { useState, useRef, useEffect } from 'react';
import { Trash2, Archive } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function OrphanedBoxes() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const image = useAnnotatorStore((state) => state.image);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const charPadding = useAnnotatorStore((state) => state.charPadding);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);
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


  // Render each character to its own canvas
  const renderCharacter = (canvasRef, box) => {
    if (!canvasRef || !image) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');

    const boxWidth = box.width + charPadding * 2;
    const boxHeight = box.height + charPadding * 2;

    canvas.width = boxWidth;
    canvas.height = boxHeight;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, boxWidth, boxHeight);

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

    if (box.brushMask && box.brushMask.length > 0) {
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

  const handleDeleteBox = (index) => {
    if (confirm(`Permanently delete box for "${boxes[index].char}"? This cannot be undone.`)) {
      deleteBox(index);
    }
  };

  if (orphanedBoxes.length === 0) {
    return null;
  }

  return (
    <div className="te-panel">
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Archive style={{ width: '14px', height: '14px', color: 'var(--te-black)' }} />
          <span className="te-small-caps">
            <strong>{orphanedBoxes.length}</strong> orphaned box{orphanedBoxes.length !== 1 ? 'es' : ''}
          </span>
        </div>
        <button
          onClick={() => setIsModalOpen(!isModalOpen)}
          className="te-btn te-btn-secondary"
          style={{ height: '28px', fontSize: '10px' }}
        >
          {isModalOpen ? 'Hide' : 'View'}
        </button>
      </div>

      {/* Expandable content */}
      {isModalOpen && (
        <div style={{
          marginTop: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {orphanedBoxes.map((item) => (
            <OrphanedBoxThumbnail
              key={item.index}
              item={item}
              renderCharacter={renderCharacter}
              image={image}
              onDelete={handleDeleteBox}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Separate component for each orphaned box thumbnail
function OrphanedBoxThumbnail({ item, renderCharacter, image, onDelete }) {
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
      padding: '8px',
      border: '1px solid var(--te-gray-mid)',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--te-gray-light)',
      boxShadow: 'var(--shadow-inner)'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '1px solid var(--te-gray-mid)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--te-white)',
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
        fontSize: '14px',
        fontVariationSettings: "'wght' 500",
        color: 'var(--te-black)'
      }}>
        "{item.char}"
      </div>

      <button
        onClick={() => onDelete(item.index)}
        title={`Permanently delete box for "${item.char}"`}
        className="te-btn te-btn-danger te-btn-icon"
        style={{ height: '28px', width: '28px' }}
      >
        <Trash2 style={{ width: '12px', height: '12px' }} />
      </button>
    </div>
  );
}
