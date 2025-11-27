import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2 } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import SplineSlider from '../ui/SplineSlider';
import { eraseMaskToImageData, strokesToEraseMask, mergeEraseMasks } from '../../utils/maskUtils';

export default function CharacterEditModal() {
  const canvasRef = useRef(null);
  const cursorCanvasRef = useRef(null);
  const scaleRef = useRef(3);
  const newStrokesRef = useRef([]); // New strokes painted in this session
  const currentStrokeRef = useRef(null); // Current stroke being drawn
  const displayMaskCanvasRef = useRef(null); // For rendering the red overlay
  const [isErasing, setIsErasing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [cursorPos, setCursorPos] = useState(null);

  const editingBoxIndex = useAnnotatorStore((state) => state.editingBoxIndex);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const image = useAnnotatorStore((state) => state.image);
  const editBrushSize = useAnnotatorStore((state) => state.editBrushSize);
  const setEditBrushSize = useAnnotatorStore((state) => state.setEditBrushSize);
  const closeCharacterEdit = useAnnotatorStore((state) => state.closeCharacterEdit);
  const mergeBoxEraseMask = useAnnotatorStore((state) => state.mergeBoxEraseMask);
  const clearBoxEraseMask = useAnnotatorStore((state) => state.clearBoxEraseMask);

  const box = editingBoxIndex !== null ? boxes[editingBoxIndex] : null;

  // Load the character crop when modal opens
  useEffect(() => {
    if (!box || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    const ctx = canvas.getContext('2d');

    const PADDING = 20;
    const viewportHeight = window.innerHeight;
    const maxCanvasHeight = viewportHeight * 0.9 - 140;
    const MAX_DISPLAY_SIZE = Math.min(400, maxCanvasHeight);

    const baseWidth = box.width + PADDING * 2;
    const baseHeight = box.height + PADDING * 2;

    let scale = 3;
    if (baseWidth * scale > MAX_DISPLAY_SIZE || baseHeight * scale > MAX_DISPLAY_SIZE) {
      scale = Math.min(MAX_DISPLAY_SIZE / baseWidth, MAX_DISPLAY_SIZE / baseHeight);
    }
    scale = Math.max(1, scale);

    const canvasWidth = baseWidth * scale;
    const canvasHeight = baseHeight * scale;

    console.log('📐 Character Editor Setup:', {
      boxWidth: box.width,
      boxHeight: box.height,
      padding: PADDING,
      baseWidth,
      baseHeight,
      scale,
      canvasWidth,
      canvasHeight,
      boxPosition: { x: box.x, y: box.y }
    });

    scaleRef.current = scale;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    if (cursorCanvas) {
      cursorCanvas.width = canvasWidth;
      cursorCanvas.height = canvasHeight;
    }

    // Create display mask canvas for red overlay visualization
    const displayMaskCanvas = document.createElement('canvas');
    displayMaskCanvas.width = canvasWidth;
    displayMaskCanvas.height = canvasHeight;
    displayMaskCanvasRef.current = displayMaskCanvas;

    // Reset new strokes for this session
    newStrokesRef.current = [];

    // Initialize display mask from existing eraseMask (handle absolute coordinates)
    if (box.eraseMask) {
      const { offsetX, offsetY, width: maskWidth, height: maskHeight } = box.eraseMask;

      // Calculate intersection between mask (at absolute position) and box
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
        const displayCtx = displayMaskCanvas.getContext('2d');
        const maskImageData = eraseMaskToImageData(box.eraseMask);

        // Create temp canvas at mask size
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = maskWidth;
        tempCanvas.height = maskHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(maskImageData, 0, 0);

        // Calculate source rect (what part of mask to draw)
        const srcX = intersectX - maskStartX;
        const srcY = intersectY - maskStartY;

        // Calculate destination rect IN BOX-RELATIVE PIXELS (not scaled display coords)
        // The intersection is at absolute coords (intersectX, intersectY)
        // The box is at absolute coords (box.x, box.y)
        // So in box-relative coords, the intersection starts at:
        const boxRelativeX = intersectX - box.x;
        const boxRelativeY = intersectY - box.y;

        // Now convert to scaled display coordinates
        const dstX = boxRelativeX * scale + PADDING * scale;
        const dstY = boxRelativeY * scale + PADDING * scale;

        // Draw only the intersecting portion, scaled
        displayCtx.imageSmoothingEnabled = false;
        displayCtx.drawImage(
          tempCanvas,
          srcX, srcY, intersectWidth, intersectHeight,  // Source rect in mask
          dstX, dstY, intersectWidth * scale, intersectHeight * scale  // Dest rect in display
        );
      }
    }

    // Render the canvas
    renderCanvas();

    function renderCanvas() {
      const PADDING = 20;
      const scale = scaleRef.current;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw the character from original image
      ctx.drawImage(
        image,
        box.x, box.y, box.width, box.height,
        PADDING * scale, PADDING * scale, box.width * scale, box.height * scale
      );

      // Draw red overlay for existing eraseMask + new strokes
      if (displayMaskCanvasRef.current) {
        const redOverlay = document.createElement('canvas');
        redOverlay.width = canvas.width;
        redOverlay.height = canvas.height;
        const redCtx = redOverlay.getContext('2d');

        // Draw character again for red overlay base
        redCtx.drawImage(
          image,
          box.x, box.y, box.width, box.height,
          PADDING * scale, PADDING * scale, box.width * scale, box.height * scale
        );

        // Apply semi-transparent red
        redCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        redCtx.fillRect(0, 0, canvas.width, canvas.height);

        // Clip to masked areas only
        redCtx.globalCompositeOperation = 'destination-in';
        redCtx.drawImage(displayMaskCanvasRef.current, 0, 0);

        // Draw red overlay on main canvas
        ctx.drawImage(redOverlay, 0, 0);
      }
    }

    if (image) {
      setHasChanges(false);
    }
  }, [box, image, editingBoxIndex]);

  // Draw cursor circle overlay
  useEffect(() => {
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas || !cursorPos) {
      if (cursorCanvas) {
        const ctx = cursorCanvas.getContext('2d');
        ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
      }
      return;
    }

    const ctx = cursorCanvas.getContext('2d');
    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

    // Calculate CSS scaling to show correct brush size in display
    const mainCanvas = canvasRef.current;
    if (mainCanvas) {
      const rect = mainCanvas.getBoundingClientRect();
      const cssScaleX = mainCanvas.width / rect.width;
      const displayBrushSize = editBrushSize / cssScaleX;

      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, displayBrushSize / 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursorPos.x - 5, cursorPos.y);
      ctx.lineTo(cursorPos.x + 5, cursorPos.y);
      ctx.moveTo(cursorPos.x, cursorPos.y - 5);
      ctx.lineTo(cursorPos.x, cursorPos.y + 5);
      ctx.stroke();
    }
  }, [cursorPos, editBrushSize]);

  const rerender = () => {
    if (!canvasRef.current || !image || !box) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const PADDING = 20;
    const scale = scaleRef.current;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw original character
    ctx.drawImage(
      image,
      box.x, box.y, box.width, box.height,
      PADDING * scale, PADDING * scale, box.width * scale, box.height * scale
    );

    // Draw red overlay for masked areas
    if (displayMaskCanvasRef.current) {
      const redOverlay = document.createElement('canvas');
      redOverlay.width = canvas.width;
      redOverlay.height = canvas.height;
      const redCtx = redOverlay.getContext('2d');

      redCtx.drawImage(
        image,
        box.x, box.y, box.width, box.height,
        PADDING * scale, PADDING * scale, box.width * scale, box.height * scale
      );

      redCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      redCtx.fillRect(0, 0, canvas.width, canvas.height);

      redCtx.globalCompositeOperation = 'destination-in';
      redCtx.drawImage(displayMaskCanvasRef.current, 0, 0);

      ctx.drawImage(redOverlay, 0, 0);
    }
  };

  const handleMouseDown = (e) => {
    if (!canvasRef.current || !box) return;
    setIsErasing(true);

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Account for CSS scaling of the canvas
    const cssScaleX = canvas.width / rect.width;
    const cssScaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * cssScaleX;
    const mouseY = (e.clientY - rect.top) * cssScaleY;

    const PADDING = 20;
    const scale = scaleRef.current;
    // Store coordinates relative to box (0,0 at box top-left)
    const boxRelativeX = (mouseX - PADDING * scale) / scale;
    const boxRelativeY = (mouseY - PADDING * scale) / scale;

    currentStrokeRef.current = {
      size: editBrushSize / scale,
      points: [{ x: boxRelativeX, y: boxRelativeY }]
    };

    paintPoint(mouseX, mouseY);
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // For cursor display (no CSS scaling needed - cursor is in display coordinates)
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    setCursorPos({ x: cursorX, y: cursorY });

    if (!isErasing) return;

    // For painting (account for CSS scaling)
    const cssScaleX = canvas.width / rect.width;
    const cssScaleY = canvas.height / rect.height;
    const canvasX = cursorX * cssScaleX;
    const canvasY = cursorY * cssScaleY;

    paintPoint(canvasX, canvasY);
  };

  const handleMouseEnter = (e) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      setCursorPos({ x: cursorX, y: cursorY });

      if (e.buttons === 1 && !isErasing && box) {
        setIsErasing(true);

        // Account for CSS scaling
        const cssScaleX = canvas.width / rect.width;
        const cssScaleY = canvas.height / rect.height;
        const canvasX = cursorX * cssScaleX;
        const canvasY = cursorY * cssScaleY;

        const PADDING = 20;
        const scale = scaleRef.current;
        const boxRelativeX = (canvasX - PADDING * scale) / scale;
        const boxRelativeY = (canvasY - PADDING * scale) / scale;

        currentStrokeRef.current = {
          size: editBrushSize / scale,
          points: [{ x: boxRelativeX, y: boxRelativeY }]
        };

        paintPoint(canvasX, canvasY);
      }
    }
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
    if (isErasing) {
      setIsErasing(false);
      if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
        newStrokesRef.current.push(currentStrokeRef.current);
        currentStrokeRef.current = null;
        setHasChanges(true);
      }
    }
  };

  const handleMouseUp = () => {
    setIsErasing(false);
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      newStrokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      setHasChanges(true);
    }
  };

  const paintPoint = (displayX, displayY) => {
    if (!currentStrokeRef.current || !box) return;

    const PADDING = 20;
    const scale = scaleRef.current;

    // Convert display coordinates to box-relative coordinates
    // Display canvas has padding and is scaled, so:
    // 1. Subtract scaled padding to get to image area
    // 2. Divide by scale to get actual pixel coordinates
    const boxRelativeX = (displayX - PADDING * scale) / scale;
    const boxRelativeY = (displayY - PADDING * scale) / scale;

    console.log('🎨 Paint coords:', {
      displayX, displayY,
      scale,
      padding: PADDING,
      scaledPadding: PADDING * scale,
      boxRelativeX, boxRelativeY,
      convertBackX: (boxRelativeX + PADDING) * scale,
      convertBackY: (boxRelativeY + PADDING) * scale
    });

    // Add point to stroke
    const points = currentStrokeRef.current.points;
    const lastPoint = points[points.length - 1];

    const dx = boxRelativeX - lastPoint.x;
    const dy = boxRelativeY - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const strokeSize = currentStrokeRef.current.size;
    const stepSize = strokeSize / 2;

    if (distance > stepSize) {
      const steps = Math.ceil(distance / stepSize);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const interpX = lastPoint.x + dx * t;
        const interpY = lastPoint.y + dy * t;
        points.push({ x: interpX, y: interpY });

        // Paint to display mask canvas - convert box-relative to display coords
        const dispX = (interpX + PADDING) * scale;
        const dispY = (interpY + PADDING) * scale;
        console.log('  🔄 Interpolated point:', { interpX, interpY, dispX, dispY });
        paintToDisplayMask(dispX, dispY, editBrushSize);
      }
    } else {
      points.push({ x: boxRelativeX, y: boxRelativeY });
      // Paint to display mask canvas - convert box-relative to display coords
      const dispX = (boxRelativeX + PADDING) * scale;
      const dispY = (boxRelativeY + PADDING) * scale;
      console.log('  ✏️ Direct point:', { boxRelativeX, boxRelativeY, dispX, dispY, shouldMatch: displayX === dispX && displayY === dispY });
      paintToDisplayMask(dispX, dispY, editBrushSize);
    }

    rerender();
  };

  const paintToDisplayMask = (displayX, displayY, size) => {
    if (!displayMaskCanvasRef.current) return;
    const ctx = displayMaskCanvasRef.current.getContext('2d');

    console.log('🖌️ Paint to display mask:', {
      displayX, displayY, size,
      canvasWidth: displayMaskCanvasRef.current.width,
      canvasHeight: displayMaskCanvasRef.current.height
    });

    ctx.globalCompositeOperation = 'lighten';
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(displayX, displayY, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };

  const handleDeleteMask = () => {
    if (editingBoxIndex === null) return;

    if (!confirm('Delete all mask data for this character?')) {
      return;
    }

    clearBoxEraseMask(editingBoxIndex);
    closeCharacterEdit();
  };

  const handleSave = () => {
    if (!hasChanges || editingBoxIndex === null || !box) {
      closeCharacterEdit();
      return;
    }

    // Convert new strokes to eraseMask format
    // Strokes are stored with coordinates relative to box (0,0 at top-left)
    // Need to convert to absolute coordinates for strokesToEraseMask
    const absoluteStrokes = newStrokesRef.current.map(stroke => ({
      ...stroke,
      points: stroke.points.map(p => ({
        x: p.x + box.x,
        y: p.y + box.y
      }))
    }));

    const newEraseMask = strokesToEraseMask(
      absoluteStrokes,
      Math.round(box.width),
      Math.round(box.height),
      box.x,
      box.y,
      false // not inverted - these are direct erase strokes
    );

    // Merge with existing mask
    mergeBoxEraseMask(editingBoxIndex, newEraseMask);
    closeCharacterEdit();
  };

  if (editingBoxIndex === null || !box) {
    return null;
  }

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '768px',
        width: 'auto',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #ddd',
          background: '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexShrink: 0
        }}>
          <h2 style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#333',
            margin: 0,
            whiteSpace: 'nowrap'
          }}>
            Edit: {box.char}
          </h2>

          <div style={{ width: '120px', flexShrink: 0 }}>
            <SplineSlider
              value={editBrushSize}
              onChange={setEditBrushSize}
              min={5}
              max={100}
              step={5}
              showInput={true}
              inputWidth="36px"
            />
          </div>

          {box.eraseMask && (
            <button
              onClick={handleDeleteMask}
              style={{
                padding: '6px 12px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 500,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
              onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
              title="Delete all mask data"
            >
              <Trash2 style={{ width: '14px', height: '14px' }} />
              Delete
            </button>
          )}

          <div style={{ flex: 1 }} />

          <button
            onClick={closeCharacterEdit}
            style={{
              padding: '6px 16px',
              background: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 500,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background 0.2s',
              flexShrink: 0
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#d1d5db'}
            onMouseOut={(e) => e.currentTarget.style.background = '#e5e7eb'}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 500,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#059669'}
            onMouseOut={(e) => e.currentTarget.style.background = '#10b981'}
          >
            <Save style={{ width: '14px', height: '14px' }} />
            {hasChanges ? 'Save' : 'Close'}
          </button>
        </div>

        {/* Canvas */}
        <div style={{
          padding: '16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f3f4f6',
          flex: 1,
          minHeight: 0
        }}>
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '4px',
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
            position: 'relative'
          }}>
            <canvas
              ref={canvasRef}
              style={{
                border: '2px solid #d1d5db',
                imageRendering: 'pixelated',
                display: 'block',
                maxWidth: '100%',
                maxHeight: 'calc(90vh - 100px)'
              }}
            />
            <canvas
              ref={cursorCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onMouseEnter={handleMouseEnter}
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                border: '2px solid transparent',
                cursor: 'none',
                pointerEvents: 'all'
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
