import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2 } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import SplineSlider from '../ui/SplineSlider';

export default function CharacterEditModal() {
  const canvasRef = useRef(null);
  const cursorCanvasRef = useRef(null);
  const scaleRef = useRef(3); // Store the current scale for use in handlers
  const eraseMaskRef = useRef([]); // Store erase strokes to always apply to original image
  const currentStrokeRef = useRef(null); // Current stroke being drawn
  const maskCanvasRef = useRef(null); // Binary mask canvas for erase visualization
  const [isErasing, setIsErasing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [cursorPos, setCursorPos] = useState(null);

  const editingBoxIndex = useAnnotatorStore((state) => state.editingBoxIndex);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const image = useAnnotatorStore((state) => state.image);
  const editBrushSize = useAnnotatorStore((state) => state.editBrushSize);
  const setEditBrushSize = useAnnotatorStore((state) => state.setEditBrushSize);
  const closeCharacterEdit = useAnnotatorStore((state) => state.closeCharacterEdit);
  const saveEditedChar = useAnnotatorStore((state) => state.saveEditedChar);
  const editedCharData = useAnnotatorStore((state) => state.editedCharData);

  const box = editingBoxIndex !== null ? boxes[editingBoxIndex] : null;

  // Load the character crop when modal opens
  useEffect(() => {
    if (!box || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size to box size with padding
    const PADDING = 20;

    // Calculate scale to fit in modal (max 400px to ensure full modal fits in viewport)
    const MAX_DISPLAY_SIZE = 400;
    const baseWidth = box.width + PADDING * 2;
    const baseHeight = box.height + PADDING * 2;

    let scale = 3; // Default 3x scale for better editing

    // If the scaled size would be too large, reduce the scale
    if (baseWidth * scale > MAX_DISPLAY_SIZE || baseHeight * scale > MAX_DISPLAY_SIZE) {
      scale = Math.min(MAX_DISPLAY_SIZE / baseWidth, MAX_DISPLAY_SIZE / baseHeight);
    }

    const canvasWidth = baseWidth * scale;
    const canvasHeight = baseHeight * scale;

    // Store scale for use in other handlers
    scaleRef.current = scale;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Set cursor canvas to same size
    if (cursorCanvas) {
      cursorCanvas.width = canvasWidth;
      cursorCanvas.height = canvasHeight;
    }

    // Create and initialize mask canvas for erase visualization
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvasWidth;
    maskCanvas.height = canvasHeight;
    maskCanvasRef.current = maskCanvas;

    // Load existing erase mask if this character was previously edited
    if (editingBoxIndex !== null && editedCharData[editingBoxIndex]) {
      const editData = editedCharData[editingBoxIndex];
      // Handle both old format (string) and new format ({ imagePNG, eraseMask })
      if (typeof editData === 'string') {
        // Old format - no erase mask stored
        eraseMaskRef.current = [];
      } else {
        // New format - load the erase mask
        eraseMaskRef.current = editData.eraseMask || [];
      }
    } else {
      eraseMaskRef.current = [];
    }

    // Initialize mask canvas with existing erase strokes
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.fillStyle = 'white';
    maskCtx.globalCompositeOperation = 'lighten'; // Prevents overlaps from getting brighter
    eraseMaskRef.current.forEach(stroke => {
      stroke.points.forEach(point => {
        // Convert from absolute image coordinates to box-relative coordinates
        const boxRelativeX = point.x - box.x;
        const boxRelativeY = point.y - box.y;
        const displayX = (PADDING + boxRelativeX) * scale;
        const displayY = (PADDING + boxRelativeY) * scale;
        const displaySize = stroke.size * scale;

        maskCtx.beginPath();
        maskCtx.arc(displayX, displayY, displaySize / 2, 0, Math.PI * 2);
        maskCtx.fill();
      });
    });
    maskCtx.globalCompositeOperation = 'source-over';

    // ALWAYS render from the original image
    const renderFromOriginal = () => {
      // Clear and draw white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();

      // Draw the FULL character crop first (no clipping) so user can see what's underneath
      ctx.drawImage(
        image,
        box.x, box.y, box.width, box.height,
        PADDING * scale, PADDING * scale, box.width * scale, box.height * scale
      );

      ctx.restore();

      // Now overlay red on MASKED OUT areas (what gets removed)
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#ff0000';

      // If brush mask exists: Red overlay OUTSIDE the mask (everything that gets cut away)
      if (box.brushMask && box.brushMask.length > 0) {
        // Create offscreen canvas to determine what's kept
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');

        // Draw mask shape (what we KEEP)
        maskCtx.fillStyle = 'black';
        maskCtx.strokeStyle = 'black';

        // Stroke each path with proper width
        box.brushMask.forEach(stroke => {
          maskCtx.lineWidth = stroke.size * scale;
          maskCtx.lineCap = 'round';
          maskCtx.lineJoin = 'round';

          maskCtx.beginPath();
          stroke.points.forEach((point, i) => {
            const boxRelativeX = point.x - box.x;
            const boxRelativeY = point.y - box.y;
            const x = (PADDING + boxRelativeX) * scale;
            const y = (PADDING + boxRelativeY) * scale;
            if (i === 0) {
              maskCtx.moveTo(x, y);
            } else {
              maskCtx.lineTo(x, y);
            }
          });
          maskCtx.stroke();

          // Add circles at each point
          stroke.points.forEach(point => {
            const boxRelativeX = point.x - box.x;
            const boxRelativeY = point.y - box.y;
            const x = (PADDING + boxRelativeX) * scale;
            const y = (PADDING + boxRelativeY) * scale;
            maskCtx.beginPath();
            maskCtx.arc(x, y, (stroke.size * scale) / 2, 0, Math.PI * 2);
            maskCtx.fill();
          });
        });

        // Fill interior
        maskCtx.beginPath();
        box.brushMask.forEach(stroke => {
          if (stroke.points.length > 0) {
            const firstPoint = stroke.points[0];
            const boxRelativeX = firstPoint.x - box.x;
            const boxRelativeY = firstPoint.y - box.y;
            maskCtx.moveTo((PADDING + boxRelativeX) * scale, (PADDING + boxRelativeY) * scale);

            stroke.points.slice(1).forEach(point => {
              const boxRelativeX = point.x - box.x;
              const boxRelativeY = point.y - box.y;
              maskCtx.lineTo((PADDING + boxRelativeX) * scale, (PADDING + boxRelativeY) * scale);
            });
          }
        });
        maskCtx.closePath();
        maskCtx.fill('nonzero');

        // Fill entire canvas with red, then remove red from kept areas
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      }

      // Erase mask: Red multiply overlay on erased areas
      if (maskCanvasRef.current && eraseMaskRef.current.length > 0) {
        // Create red overlay layer
        const redCanvas = document.createElement('canvas');
        redCanvas.width = canvas.width;
        redCanvas.height = canvas.height;
        const redCtx = redCanvas.getContext('2d');

        // Draw original character (no filter)
        if (box.brushMask && box.brushMask.length > 0) {
          redCtx.save();
          redCtx.beginPath();
          box.brushMask.forEach(stroke => {
            stroke.points.forEach((point, i) => {
              const boxRelativeX = point.x - box.x;
              const boxRelativeY = point.y - box.y;
              const x = (PADDING + boxRelativeX) * scale;
              const y = (PADDING + boxRelativeY) * scale;
              if (i === 0) {
                redCtx.moveTo(x, y);
              } else {
                redCtx.lineTo(x, y);
              }
            });
          });
          box.brushMask.forEach(stroke => {
            const radius = (stroke.size / 2) * scale;
            stroke.points.forEach(point => {
              const boxRelativeX = point.x - box.x;
              const boxRelativeY = point.y - box.y;
              const x = (PADDING + boxRelativeX) * scale;
              const y = (PADDING + boxRelativeY) * scale;
              redCtx.moveTo(x + radius, y);
              redCtx.arc(x, y, radius, 0, Math.PI * 2);
            });
          });
          redCtx.clip();
        }

        redCtx.drawImage(
          image,
          box.x, box.y, box.width, box.height,
          PADDING * scale, PADDING * scale, box.width * scale, box.height * scale
        );

        if (box.brushMask && box.brushMask.length > 0) {
          redCtx.restore();
        }

        // Apply semi-transparent red overlay over the character
        redCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        redCtx.fillRect(0, 0, redCanvas.width, redCanvas.height);

        // Clip red layer to erased areas only (use mask canvas)
        redCtx.globalCompositeOperation = 'destination-in';
        redCtx.drawImage(maskCanvasRef.current, 0, 0);

        // Composite red overlay onto main canvas
        ctx.drawImage(redCanvas, 0, 0);
      }

      ctx.restore();
    };

    if (image) {
      renderFromOriginal();
      setHasChanges(eraseMaskRef.current.length > 0);
    }
  }, [box, image, editingBoxIndex, editedCharData]);

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

    // Draw brush size indicator circle
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cursorPos.x, cursorPos.y, editBrushSize / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Draw crosshair at center
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cursorPos.x - 5, cursorPos.y);
    ctx.lineTo(cursorPos.x + 5, cursorPos.y);
    ctx.moveTo(cursorPos.x, cursorPos.y - 5);
    ctx.lineTo(cursorPos.x, cursorPos.y + 5);
    ctx.stroke();
  }, [cursorPos, editBrushSize]);

  // Re-render canvas from original image with all masks applied
  const rerender = () => {
    if (!canvasRef.current || !image || !box) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const PADDING = 20;
    const scale = scaleRef.current;

    // Clear and draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Apply brush mask if it exists (from the annotation phase)
    if (box.brushMask && box.brushMask.length > 0) {
      ctx.beginPath();
      box.brushMask.forEach(stroke => {
        stroke.points.forEach((point, i) => {
          // Convert from absolute image coordinates to box-relative coordinates
          const boxRelativeX = point.x - box.x;
          const boxRelativeY = point.y - box.y;
          const x = (PADDING + boxRelativeX) * scale;
          const y = (PADDING + boxRelativeY) * scale;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
      });

      box.brushMask.forEach(stroke => {
        const radius = (stroke.size / 2) * scale;
        stroke.points.forEach(point => {
          // Convert from absolute image coordinates to box-relative coordinates
          const boxRelativeX = point.x - box.x;
          const boxRelativeY = point.y - box.y;
          const x = (PADDING + boxRelativeX) * scale;
          const y = (PADDING + boxRelativeY) * scale;
          ctx.moveTo(x + radius, y);
          ctx.arc(x, y, radius, 0, Math.PI * 2);
        });
      });

      ctx.clip();
    }

    // Draw the character crop from ORIGINAL image
    ctx.drawImage(
      image,
      box.x, box.y, box.width, box.height,
      PADDING * scale, PADDING * scale, box.width * scale, box.height * scale
    );

    ctx.restore();

    // Apply red multiply overlay for erased areas
    if (maskCanvasRef.current) {
      // Create red overlay layer
      const redCanvas = document.createElement('canvas');
      redCanvas.width = canvas.width;
      redCanvas.height = canvas.height;
      const redCtx = redCanvas.getContext('2d');

      // Draw original character (no filter)
      if (box.brushMask && box.brushMask.length > 0) {
        redCtx.save();
        redCtx.beginPath();
        box.brushMask.forEach(stroke => {
          stroke.points.forEach((point, i) => {
            const boxRelativeX = point.x - box.x;
            const boxRelativeY = point.y - box.y;
            const x = (PADDING + boxRelativeX) * scale;
            const y = (PADDING + boxRelativeY) * scale;
            if (i === 0) {
              redCtx.moveTo(x, y);
            } else {
              redCtx.lineTo(x, y);
            }
          });
        });
        box.brushMask.forEach(stroke => {
          const radius = (stroke.size / 2) * scale;
          stroke.points.forEach(point => {
            const boxRelativeX = point.x - box.x;
            const boxRelativeY = point.y - box.y;
            const x = (PADDING + boxRelativeX) * scale;
            const y = (PADDING + boxRelativeY) * scale;
            redCtx.moveTo(x + radius, y);
            redCtx.arc(x, y, radius, 0, Math.PI * 2);
          });
        });
        redCtx.clip();
      }

      redCtx.drawImage(
        image,
        box.x, box.y, box.width, box.height,
        PADDING * scale, PADDING * scale, box.width * scale, box.height * scale
      );

      if (box.brushMask && box.brushMask.length > 0) {
        redCtx.restore();
      }

      // Apply semi-transparent red overlay over the character
      redCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      redCtx.fillRect(0, 0, redCanvas.width, redCanvas.height);

      // Clip red layer to erased areas only (use mask canvas)
      redCtx.globalCompositeOperation = 'destination-in';
      redCtx.drawImage(maskCanvasRef.current, 0, 0);

      // Composite red overlay onto main canvas
      ctx.drawImage(redCanvas, 0, 0);
    }
  };

  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    setIsErasing(true);

    // Start a new stroke
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;

    // Convert to box-relative coordinates (remove padding and scale)
    const PADDING = 20;
    const scale = scaleRef.current;
    const boxRelativeX = (displayX - (PADDING * scale)) / scale;
    const boxRelativeY = (displayY - (PADDING * scale)) / scale;

    // Convert to ABSOLUTE image coordinates (add box position)
    const imageX = box.x + boxRelativeX;
    const imageY = box.y + boxRelativeY;

    currentStrokeRef.current = {
      size: editBrushSize / scale, // Absolute pixel size
      points: [{
        x: imageX,  // Absolute image coordinates
        y: imageY   // Absolute image coordinates
      }]
    };

    erase(e);
  };

  const handleMouseMove = (e) => {
    // Update cursor position for visual feedback
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (!isErasing) return;
    erase(e);
  };

  const handleMouseEnter = (e) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    // If mouse button is still held down when re-entering, start a new stroke
    if (e.buttons === 1 && !isErasing) {
      setIsErasing(true);

      // Start a new stroke at entry point
      const rect = canvas.getBoundingClientRect();
      const displayX = e.clientX - rect.left;
      const displayY = e.clientY - rect.top;

      const PADDING = 20;
      const scale = scaleRef.current;
      const boxRelativeX = (displayX - (PADDING * scale)) / scale;
      const boxRelativeY = (displayY - (PADDING * scale)) / scale;

      const imageX = box.x + boxRelativeX;
      const imageY = box.y + boxRelativeY;

      currentStrokeRef.current = {
        size: editBrushSize / scale,
        points: [{
          x: imageX,
          y: imageY
        }]
      };

      erase(e);
    }
  };

  const handleMouseLeave = () => {
    setCursorPos(null);

    // If user leaves canvas while erasing, finalize the stroke
    if (isErasing) {
      setIsErasing(false);

      if (currentStrokeRef.current) {
        eraseMaskRef.current.push(currentStrokeRef.current);
        currentStrokeRef.current = null;
        setHasChanges(true);
      }
    }
  };

  const handleMouseUp = () => {
    setIsErasing(false);

    // Finish the stroke and add to mask
    if (currentStrokeRef.current) {
      eraseMaskRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      setHasChanges(true);
    }
  };

  const erase = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentStrokeRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;

    // Convert to box-relative coordinates (remove padding and scale)
    const PADDING = 20;
    const scale = scaleRef.current;
    const boxRelativeX = (displayX - (PADDING * scale)) / scale;
    const boxRelativeY = (displayY - (PADDING * scale)) / scale;

    // Convert to ABSOLUTE image coordinates (add box position)
    const imageX = box.x + boxRelativeX;
    const imageY = box.y + boxRelativeY;

    // Interpolate between last point and current point for smooth strokes
    const points = currentStrokeRef.current.points;
    const lastPoint = points[points.length - 1];

    // Calculate distance between last point and current point
    const dx = imageX - lastPoint.x;
    const dy = imageY - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Interpolate if distance is greater than half the brush size
    const stepSize = (editBrushSize / scale) / 2;
    if (distance > stepSize) {
      const steps = Math.ceil(distance / stepSize);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const interpX = lastPoint.x + dx * t;
        const interpY = lastPoint.y + dy * t;
        points.push({
          x: interpX,  // Absolute image coordinates
          y: interpY   // Absolute image coordinates
        });

        // Draw interpolated point to mask canvas
        const interpDisplayX = (interpX - box.x) * scale + (PADDING * scale);
        const interpDisplayY = (interpY - box.y) * scale + (PADDING * scale);

        if (maskCanvasRef.current) {
          const maskCtx = maskCanvasRef.current.getContext('2d');
          maskCtx.globalCompositeOperation = 'lighten';
          maskCtx.fillStyle = 'white';
          maskCtx.beginPath();
          maskCtx.arc(interpDisplayX, interpDisplayY, editBrushSize / 2, 0, Math.PI * 2);
          maskCtx.fill();
          maskCtx.globalCompositeOperation = 'source-over';
        }
      }
      // Re-render after interpolation to show red overlay
      rerender();
    } else {
      // Add point to current stroke in ABSOLUTE image coordinates
      points.push({
        x: imageX,  // Absolute image coordinates
        y: imageY   // Absolute image coordinates
      });

      // Draw point to mask canvas
      if (maskCanvasRef.current) {
        const maskCtx = maskCanvasRef.current.getContext('2d');
        maskCtx.globalCompositeOperation = 'lighten';
        maskCtx.fillStyle = 'white';
        maskCtx.beginPath();
        maskCtx.arc(displayX, displayY, editBrushSize / 2, 0, Math.PI * 2);
        maskCtx.fill();
        maskCtx.globalCompositeOperation = 'source-over';
      }

      // Re-render to show red overlay
      rerender();
    }
  };

  const handleDeleteMask = () => {
    if (editingBoxIndex === null) return;

    // Confirm deletion
    if (!confirm('Delete all mask data for this character? The bounding box will be preserved.')) {
      return;
    }

    // Remove editedCharData for this box
    const newEditedCharData = { ...editedCharData };
    delete newEditedCharData[editingBoxIndex];
    useAnnotatorStore.getState().setEditedCharData(newEditedCharData);

    // Clear brushMask from the box if it exists
    if (box.brushMask) {
      const updatedBox = { ...box };
      delete updatedBox.brushMask;
      const newBoxes = [...boxes];
      newBoxes[editingBoxIndex] = updatedBox;
      useAnnotatorStore.getState().setBoxes(newBoxes);
    }

    // Close the modal
    closeCharacterEdit();
  };

  const handleSave = () => {
    if (!canvasRef.current || !hasChanges) {
      closeCharacterEdit();
      return;
    }

    const canvas = canvasRef.current;
    const PADDING = 20;
    const scale = scaleRef.current;

    // Create a new canvas at ORIGINAL size (not scaled) WITHOUT padding for the final output PNG
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = box.width;
    outputCanvas.height = box.height;

    const outputCtx = outputCanvas.getContext('2d');

    // Copy only the center part (without padding) and scale down to original size
    const scaledPadding = PADDING * scale;
    const scaledWidth = box.width * scale;
    const scaledHeight = box.height * scale;

    outputCtx.drawImage(
      canvas,
      scaledPadding, scaledPadding, scaledWidth, scaledHeight,  // source (center region of scaled canvas)
      0, 0, box.width, box.height                                // dest (original size, no padding)
    );

    const imagePNG = outputCanvas.toDataURL('image/png');

    // Save both the PNG (for display) and the erase mask (for future editing)
    const editData = {
      imagePNG,  // For display in word preview
      eraseMask: eraseMaskRef.current  // For future editing sessions
    };

    saveEditedChar(editingBoxIndex, editData);
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
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #ddd'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            Edit Character: {box.char}
          </h2>
          <button
            onClick={closeCharacterEdit}
            style={{
              padding: '4px',
              background: 'none',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            <X style={{ width: '24px', height: '24px' }} />
          </button>
        </div>

        {/* Controls */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #ddd',
          background: '#f9fafb'
        }}>
          <div style={{ flex: 1 }}>
            <label className="te-control-label" style={{
              display: 'block',
              marginBottom: '8px'
            }}>
              Brush Size
            </label>
            <SplineSlider
              value={editBrushSize}
              onChange={setEditBrushSize}
              min={5}
              max={100}
              step={5}
              showInput={true}
              inputWidth="40px"
            />
          </div>

          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '8px'
          }}>
            Click and drag to erase unwanted pixels. Use "Delete Mask" to remove all masking.
          </p>
        </div>

        {/* Canvas */}
        <div style={{
          padding: '16px',
          display: 'flex',
          justifyContent: 'center',
          background: '#f3f4f6'
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
                display: 'block'
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

        {/* Footer */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          {/* Delete Mask button on the left */}
          {(box.brushMask || editedCharData[editingBoxIndex]) && (
            <button
              onClick={handleDeleteMask}
              style={{
                padding: '8px 24px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
              onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
              title="Delete all mask data (brush and erase masks) for this character"
            >
              <Trash2 style={{ width: '16px', height: '16px' }} />
              Delete Mask
            </button>
          )}

          {/* Right-side buttons */}
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button
              onClick={closeCharacterEdit}
              style={{
                padding: '8px 24px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#d1d5db'}
              onMouseOut={(e) => e.currentTarget.style.background = '#e5e7eb'}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 24px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#059669'}
              onMouseOut={(e) => e.currentTarget.style.background = '#10b981'}
            >
              <Save style={{ width: '16px', height: '16px' }} />
              {hasChanges ? 'Save Changes' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
