import { useState, useRef, useEffect } from 'react';
import { Trash2, Archive } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import { eraseMaskToImageData } from '../../utils/maskUtils';

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

    // Draw character to temp canvas first
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = boxWidth;
    tempCanvas.height = boxHeight;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(
      sourceImage,
      box.x, box.y, box.width, box.height,
      charPadding, charPadding, box.width, box.height
    );

    // Apply eraseMask if exists (with absolute coordinate clipping)
    if (box.eraseMask) {
      const { width: maskWidth, height: maskHeight, offsetX, offsetY } = box.eraseMask;

      // Calculate intersection between mask and box (absolute coords)
      const maskStartX = offsetX !== undefined ? offsetX : box.x;
      const maskStartY = offsetY !== undefined ? offsetY : box.y;
      const maskEndX = maskStartX + maskWidth;
      const maskEndY = maskStartY + maskHeight;

      const intersectX = Math.max(maskStartX, box.x);
      const intersectY = Math.max(maskStartY, box.y);
      const intersectEndX = Math.min(maskEndX, box.x + box.width);
      const intersectEndY = Math.min(maskEndY, box.y + box.height);

      const intersectWidth = intersectEndX - intersectX;
      const intersectHeight = intersectEndY - intersectY;

      if (intersectWidth > 0 && intersectHeight > 0) {
        const srcX = intersectX - maskStartX;
        const srcY = intersectY - maskStartY;
        const dstX = intersectX - box.x + charPadding;
        const dstY = intersectY - box.y + charPadding;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = maskWidth;
        maskCanvas.height = maskHeight;
        const maskCtx = maskCanvas.getContext('2d');

        const imageData = eraseMaskToImageData(box.eraseMask);
        maskCtx.putImageData(imageData, 0, 0);

        tempCtx.globalCompositeOperation = 'destination-out';
        tempCtx.drawImage(
          maskCanvas,
          srcX, srcY, intersectWidth, intersectHeight,
          dstX, dstY, intersectWidth, intersectHeight
        );
        tempCtx.globalCompositeOperation = 'source-over';
      }
    }

    ctx.drawImage(tempCanvas, 0, 0);
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
    <>
      <style>{`
        .orphaned-boxes-container:hover .orphaned-box-delete-btn {
          opacity: 1 !important;
        }
      `}</style>
      <div className="te-panel orphaned-boxes-container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '6px'
        }}>
          <Archive style={{ width: '14px', height: '14px', color: 'var(--te-black)' }} />
          <span className="te-small-caps">
            <strong>{orphanedBoxes.length}</strong> orphaned box{orphanedBoxes.length !== 1 ? 'es' : ''}
          </span>
        </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px'
      }}>
        {orphanedBoxes.map((item) => (
          <OrphanedBoxItem
            key={item.index}
            item={item}
            image={image}
            renderCharacter={renderCharacter}
            onDelete={() => handleDeleteBox(item.index)}
          />
        ))}
      </div>
    </div>
    </>
  );
}

function OrphanedBoxItem({ item, image, renderCharacter, onDelete }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && image) {
      renderCharacter(canvasRef.current, item.box);
    }
  }, [item.box, image, renderCharacter]);

  return (
    <div
      className="orphaned-box-item"
      style={{
        position: 'relative',
        display: 'inline-block'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '40px',
          maxHeight: '40px',
          border: '1px solid var(--te-gray-300)',
          borderRadius: '4px'
        }}
        title={`Orphaned: "${item.char}"`}
      />
      <button
        onClick={onDelete}
        className="orphaned-box-delete-btn"
        style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          width: '16px',
          height: '16px',
          padding: 0,
          background: '#ef4444',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.2s'
        }}
        title={`Delete "${item.char}"`}
      >
        <Trash2 style={{ width: '10px', height: '10px', color: 'white' }} />
      </button>
    </div>
  );
}
