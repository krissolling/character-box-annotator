import { useRef, useEffect } from 'react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function EditedCharacters() {
  const editedCharData = useAnnotatorStore((state) => state.editedCharData);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const image = useAnnotatorStore((state) => state.image);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const charPadding = useAnnotatorStore((state) => state.charPadding);

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
  const renderCharacter = (canvasRef, box, index) => {
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

    ctx.save();

    // Apply brush mask if it exists
    if (box.brushMask && box.brushMask.length > 0) {
      ctx.beginPath();
      box.brushMask.forEach(stroke => {
        stroke.points.forEach((point, i) => {
          // Denormalize from 0-1 coordinates to pixel coordinates
          const pixelX = point.x * box.width;
          const pixelY = point.y * box.height;
          const x = charPadding + pixelX;
          const y = charPadding + pixelY;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
      });

      // Create rounded caps for strokes
      box.brushMask.forEach(stroke => {
        // Denormalize size from 0-1 to pixels
        const pixelSize = stroke.size * Math.max(box.width, box.height);
        const radius = pixelSize / 2;
        stroke.points.forEach(point => {
          // Denormalize from 0-1 coordinates to pixel coordinates
          const pixelX = point.x * box.width;
          const pixelY = point.y * box.height;
          const x = charPadding + pixelX;
          const y = charPadding + pixelY;
          ctx.moveTo(x + radius, y);
          ctx.arc(x, y, radius, 0, Math.PI * 2);
        });
      });

      ctx.clip();
    }

    // Draw the character from original image
    ctx.drawImage(
      sourceImage,
      box.x, box.y, box.width, box.height,
      charPadding, charPadding, box.width, box.height
    );

    ctx.restore();

    // Apply erase mask if it exists
    const editData = editedCharData[index];
    const eraseMask = editData && typeof editData !== 'string' ? editData.eraseMask : null;

    if (eraseMask && eraseMask.length > 0) {
      eraseMask.forEach(stroke => {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
        stroke.points.forEach(point => {
          // Denormalize from 0-1 coordinates to pixel coordinates
          const pixelX = point.x * box.width;
          const pixelY = point.y * box.height;
          const pixelSize = stroke.size * Math.max(box.width, box.height);
          const x = charPadding + pixelX;
          const y = charPadding + pixelY;
          ctx.beginPath();
          ctx.arc(x, y, pixelSize / 2, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
      });
    }
  };

  return (
    <div style={panelStyle}>
      <h3 style={titleStyle}>Edited Characters</h3>

      {editedBoxes.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: '#999',
          fontSize: '13px',
          fontStyle: 'italic',
          padding: '20px 0'
        }}>
          No edited characters yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {editedBoxes.map((item) => (
            <CharacterThumbnail
              key={item.index}
              item={item}
              renderCharacter={renderCharacter}
              image={image}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Separate component for each character thumbnail
function CharacterThumbnail({ item, renderCharacter, image }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && image) {
      renderCharacter(canvasRef.current, item.box, item.index);
    }
  }, [item, image, renderCharacter]);

  return (
    <div
      style={{
        width: '50px',
        height: '50px',
        border: '2px solid #2196F3',
        borderRadius: '6px',
        overflow: 'hidden',
        position: 'relative',
        background: 'white'
      }}
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
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(33, 150, 243, 0.9)',
        color: 'white',
        fontSize: '10px',
        textAlign: 'center',
        padding: '2px'
      }}>
        {item.char}
      </div>
    </div>
  );
}
