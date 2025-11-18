import { useRef, useEffect, useState } from 'react';
import { Pipette, Package } from 'lucide-react';
import JSZip from 'jszip';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function WordPreview() {
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const charPositionsRef = useRef([]); // Store character bounding boxes for click detection
  const kerningHandlesRef = useRef([]); // Store kerning handle positions
  const rotatedImageRef = useRef(null); // Cache rotated image
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [debugClickAreas, setDebugClickAreas] = useState(false);
  const [lastClickPos, setLastClickPos] = useState(null);
  const [draggingKerningIndex, setDraggingKerningIndex] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartKerning, setDragStartKerning] = useState(0);
  const [handleRenderTrigger, setHandleRenderTrigger] = useState(0);
  const [hoveredCharPosition, setHoveredCharPosition] = useState(null);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [variantPickerData, setVariantPickerData] = useState(null); // { position, char, charIndex, currentVariant, availableVariants }
  const isHoveringButtonRef = useRef(false);
  const hoverClearTimeoutRef = useRef(null);

  const image = useAnnotatorStore((state) => state.image);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const letterSpacing = useAnnotatorStore((state) => state.letterSpacing);
  const charPadding = useAnnotatorStore((state) => state.charPadding);
  const kerningAdjustments = useAnnotatorStore((state) => state.kerningAdjustments);
  const text = useAnnotatorStore((state) => state.text);
  const baselines = useAnnotatorStore((state) => state.baselines);
  const angledBaselines = useAnnotatorStore((state) => state.angledBaselines);
  const openCharacterEdit = useAnnotatorStore((state) => state.openCharacterEdit);
  const editedCharData = useAnnotatorStore((state) => state.editedCharData);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const imageFilters = useAnnotatorStore((state) => state.imageFilters);
  const levelsAdjustment = useAnnotatorStore((state) => state.levelsAdjustment);
  const updateFilter = useAnnotatorStore((state) => state.updateFilter);
  const updateKerning = useAnnotatorStore((state) => state.updateKerning);
  const imageFile = useAnnotatorStore((state) => state.imageFile);
  const selectedVariants = useAnnotatorStore((state) => state.selectedVariants);
  const textPositionVariants = useAnnotatorStore((state) => state.textPositionVariants);
  const setPositionVariant = useAnnotatorStore((state) => state.setPositionVariant);
  const clearPositionVariant = useAnnotatorStore((state) => state.clearPositionVariant);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${text}_word_image.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadJSON = () => {
    // Create JSON data with all relevant state INCLUDING eraseMask
    const jsonData = {
      text,
      boxes: boxes.map((box, index) => ({
        char: box.char,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        brushMask: box.brushMask,
        eraseMask: editedCharData[index]?.eraseMask || null // Include erase mask data
      })),
      letterSpacing,
      charPadding,
      kerningAdjustments,
      baselines,
      angledBaselines,
      imageRotation,
      imageFilters,
      levelsAdjustment
    };

    // Convert to JSON string and download
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${text}_annotations.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    if (!image || !imageFile) {
      alert('No image loaded to include in ZIP');
      return;
    }

    const zip = new JSZip();

    // Add the original image
    zip.file(imageFile.name, imageFile);

    // Create JSON data with all relevant state INCLUDING eraseMask
    const jsonData = {
      text,
      imageName: imageFile.name, // Store image filename for reference
      boxes: boxes.map((box, index) => ({
        char: box.char,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        brushMask: box.brushMask,
        eraseMask: editedCharData[index]?.eraseMask || null
      })),
      letterSpacing,
      charPadding,
      kerningAdjustments,
      baselines,
      angledBaselines,
      imageRotation,
      imageFilters,
      levelsAdjustment
    };

    // Add JSON to zip
    const jsonString = JSON.stringify(jsonData, null, 2);
    zip.file('annotations.json', jsonString);

    // Generate zip and download
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.download = `${text || 'annotation'}_project.zip`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleWhitePoint = () => {
    setEyedropperActive(!eyedropperActive);
  };

  // Render a character box thumbnail to canvas (similar to CharacterPicker)
  const renderCharacterThumbnail = (canvasElement, box) => {
    if (!canvasElement || !image) return;

    const ctx = canvasElement.getContext('2d');

    const boxWidth = box.width + charPadding * 2;
    const boxHeight = box.height + charPadding * 2;

    canvasElement.width = boxWidth;
    canvasElement.height = boxHeight;

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

    ctx.drawImage(
      sourceImage,
      box.x, box.y, box.width, box.height,
      charPadding, charPadding, box.width, box.height
    );
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Character positions are stored in logical coordinates (naturalWidth/naturalHeight)
    const naturalWidth = parseFloat(canvas.dataset.naturalWidth || canvas.width);
    const naturalHeight = parseFloat(canvas.dataset.naturalHeight || canvas.height);

    // Account for object-fit: contain scaling and letterboxing
    // The canvas maintains aspect ratio and is centered within the rect
    const canvasAspect = naturalWidth / naturalHeight;
    const rectAspect = rect.width / rect.height;

    let renderedWidth, renderedHeight, offsetX, offsetY;

    if (canvasAspect > rectAspect) {
      // Canvas is wider - letterboxed top/bottom
      renderedWidth = rect.width;
      renderedHeight = rect.width / canvasAspect;
      offsetX = 0;
      offsetY = (rect.height - renderedHeight) / 2;
    } else {
      // Canvas is taller - letterboxed left/right
      renderedWidth = rect.height * canvasAspect;
      renderedHeight = rect.height;
      offsetX = (rect.width - renderedWidth) / 2;
      offsetY = 0;
    }

    // Adjust click coordinates for letterboxing offset
    const adjustedClickX = clickX - offsetX;
    const adjustedClickY = clickY - offsetY;

    // Scale to logical canvas coordinates
    const scaleX = naturalWidth / renderedWidth;
    const scaleY = naturalHeight / renderedHeight;
    const canvasX = adjustedClickX * scaleX;
    const canvasY = adjustedClickY * scaleY;

    console.log('DEBUG: Click detection info:', {
      clickXY: { x: clickX, y: clickY },
      rectSize: { w: rect.width, h: rect.height },
      naturalSize: { w: naturalWidth, h: naturalHeight },
      renderedSize: { w: renderedWidth, h: renderedHeight },
      offset: { x: offsetX, y: offsetY },
      adjustedClickXY: { x: adjustedClickX, y: adjustedClickY },
      scale: { x: scaleX, y: scaleY },
      canvasXY: { x: canvasX, y: canvasY }
    });

    // If in eyedropper mode, sample the pixel from the DISPLAYED (filtered) canvas
    if (eyedropperActive) {
      const ctx = canvas.getContext('2d');

      // For pixel sampling, we need DPR-scaled coordinates
      const dpr = window.devicePixelRatio || 1;
      const pixelX = Math.floor(canvasX * dpr);
      const pixelY = Math.floor(canvasY * dpr);

      try {
        const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
        const displayedValue = pixel[0]; // This is the filtered/displayed value

        console.log('Sampled displayed pixel value:', displayedValue);

        if (displayedValue > 0 && displayedValue < 255) {
          // We want to adjust so this displayed value becomes 255 (white)
          // displayedValue came from: originalValue * (brightness/100) * (contrast/100) + other filters
          // Simplified approach: just increase brightness proportionally
          const currentBrightness = imageFilters.brightness;
          const multiplier = 255 / displayedValue;
          const newBrightness = Math.round(currentBrightness * multiplier);

          console.log('Adjusting brightness from', currentBrightness, 'to', newBrightness);
          updateFilter('brightness', Math.min(200, Math.max(0, newBrightness)));
        } else if (displayedValue === 255) {
          console.log('Pixel is already white (255)');
        } else {
          console.log('Pixel is black (0), cannot adjust to white');
        }
      } catch (error) {
        console.error('Error sampling pixel:', error);
      }

      setEyedropperActive(false);
      return;
    }

    // Store click position for debug visualization
    if (debugClickAreas) {
      setLastClickPos({ x: canvasX, y: canvasY });
    }

    // Find which character was clicked (use canvas coordinates)
    console.log('Click at canvas coords:', canvasX, canvasY);
    console.log('Total character positions:', charPositionsRef.current.length);

    let foundChar = false;
    for (let i = 0; i < charPositionsRef.current.length; i++) {
      const pos = charPositionsRef.current[i];
      console.log(`Char ${i}: x=${pos.x}, y=${pos.y}, w=${pos.width}, h=${pos.height}`);

      if (canvasX >= pos.x && canvasX <= pos.x + pos.width &&
          canvasY >= pos.y && canvasY <= pos.y + pos.height) {
        // Find the original box index in the boxes array
        const originalIndex = boxes.findIndex(box => box === pos.box);
        if (originalIndex !== -1) {
          console.log('✓ Clicked character:', boxes[originalIndex].char, 'at index', originalIndex);
          openCharacterEdit(originalIndex);
          foundChar = true;
        }
        break;
      }
    }

    if (!foundChar) {
      console.log('No character found at click position');
    }
  };

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Track which character is being hovered (for variant picker button)
    if (!eyedropperActive && !draggingKerningIndex) {
      const naturalWidth = parseFloat(canvas.dataset.naturalWidth || canvas.width);
      const naturalHeight = parseFloat(canvas.dataset.naturalHeight || canvas.height);

      const canvasAspect = naturalWidth / naturalHeight;
      const rectAspect = rect.width / rect.height;
      let renderedWidth, renderedHeight, offsetX, offsetY;

      if (canvasAspect > rectAspect) {
        renderedWidth = rect.width;
        renderedHeight = rect.width / canvasAspect;
        offsetX = 0;
        offsetY = (rect.height - renderedHeight) / 2;
      } else {
        renderedWidth = rect.height * canvasAspect;
        renderedHeight = rect.height;
        offsetX = (rect.width - renderedWidth) / 2;
        offsetY = 0;
      }

      const scaleX = naturalWidth / renderedWidth;
      const scaleY = naturalHeight / renderedHeight;
      const canvasX = (x - offsetX) * scaleX;
      const canvasY = (y - offsetY) * scaleY;

      // Find which character is being hovered
      let foundPosition = null;
      for (let i = 0; i < charPositionsRef.current.length; i++) {
        const pos = charPositionsRef.current[i];
        if (canvasX >= pos.x && canvasX <= pos.x + pos.width &&
            canvasY >= pos.y && canvasY <= pos.y + pos.height) {
          foundPosition = pos.position;
          break;
        }
      }

      // Clear any pending timeout
      if (hoverClearTimeoutRef.current) {
        clearTimeout(hoverClearTimeoutRef.current);
        hoverClearTimeoutRef.current = null;
      }

      if (foundPosition !== null) {
        // Immediately set hover when over a character
        setHoveredCharPosition(foundPosition);
      } else if (!isHoveringButtonRef.current) {
        // Add a small delay before clearing to allow moving to button
        hoverClearTimeoutRef.current = setTimeout(() => {
          setHoveredCharPosition(null);
        }, 100); // 100ms grace period
      }
    }

    // Eyedropper cursor follower
    if (eyedropperActive) {
      const cursorFollower = document.getElementById('eyedropper-cursor');
      const outerRing = document.getElementById('eyedropper-ring');

      if (cursorFollower && outerRing) {
        cursorFollower.style.left = e.clientX + 'px';
        cursorFollower.style.top = e.clientY + 'px';
        outerRing.style.left = e.clientX + 'px';
        outerRing.style.top = e.clientY + 'px';
      }
    }
  };

  // Kerning handle drag handlers
  const handleKerningMouseDown = (e, index) => {
    e.stopPropagation();
    setDraggingKerningIndex(index);
    setDragStartX(e.clientX);
    setDragStartKerning(kerningAdjustments[index] || 0);
  };

  const handleKerningMouseMove = (e) => {
    if (draggingKerningIndex === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const naturalWidth = parseFloat(canvas.dataset.naturalWidth || canvas.width);
    const naturalHeight = parseFloat(canvas.dataset.naturalHeight || canvas.height);

    // Calculate scale factor accounting for letterboxing
    const canvasAspect = naturalWidth / naturalHeight;
    const rectAspect = rect.width / rect.height;
    let renderedWidth;

    if (canvasAspect > rectAspect) {
      renderedWidth = rect.width;
    } else {
      renderedWidth = rect.height * canvasAspect;
    }

    const scale = naturalWidth / renderedWidth;
    const deltaX = e.clientX - dragStartX;
    const deltaXInCanvasUnits = deltaX * scale;
    const newKerning = Math.round(dragStartKerning + deltaXInCanvasUnits);

    updateKerning(draggingKerningIndex, newKerning);
  };

  const handleKerningMouseUp = () => {
    setDraggingKerningIndex(null);
  };

  // Variant picker handlers
  const openVariantPicker = (position) => {
    const char = text[position];
    const charIndex = uniqueChars.indexOf(char);
    if (charIndex === -1) return;

    // Get all boxes for this character
    const availableVariants = boxes.filter(box => box.charIndex === charIndex);
    if (availableVariants.length <= 1) return; // No need for picker if only one variant

    // Get current variant for this position
    const currentVariant = textPositionVariants[position] !== undefined
      ? textPositionVariants[position]
      : (selectedVariants[charIndex] || 0);

    setVariantPickerData({
      position,
      char,
      charIndex,
      currentVariant,
      availableVariants
    });
    setVariantPickerOpen(true);
  };

  const handleVariantSelect = (variantId) => {
    if (!variantPickerData) return;

    const { position, charIndex } = variantPickerData;
    const globalDefault = selectedVariants[charIndex] || 0;

    if (variantId === globalDefault) {
      // If selecting the global default, clear the override
      clearPositionVariant(position);
    } else {
      // Set position-specific override
      setPositionVariant(position, variantId);
    }

    setVariantPickerOpen(false);
    setVariantPickerData(null);
  };

  // Add global mouse event listeners for kerning drag
  useEffect(() => {
    if (draggingKerningIndex !== null) {
      window.addEventListener('mousemove', handleKerningMouseMove);
      window.addEventListener('mouseup', handleKerningMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleKerningMouseMove);
        window.removeEventListener('mouseup', handleKerningMouseUp);
      };
    }
  }, [draggingKerningIndex, dragStartX, dragStartKerning, kerningAdjustments]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverClearTimeoutRef.current) {
        clearTimeout(hoverClearTimeoutRef.current);
      }
    };
  }, []);

  // Handle eyedropper cursor elements
  useEffect(() => {
    if (eyedropperActive) {
      // Create cursor follower
      const cursorFollower = document.createElement('div');
      cursorFollower.id = 'eyedropper-cursor';
      cursorFollower.style.cssText = `
        position: fixed;
        width: 8px;
        height: 8px;
        background: #2196F3;
        border: 2px solid white;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.5), 0 0 8px rgba(33, 150, 243, 0.8);
      `;

      const outerRing = document.createElement('div');
      outerRing.id = 'eyedropper-ring';
      outerRing.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        border: 1px solid #2196F3;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
        opacity: 0.5;
      `;

      document.body.appendChild(cursorFollower);
      document.body.appendChild(outerRing);

      // ESC to cancel
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          setEyedropperActive(false);
        }
      };
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('keydown', handleEscape);
        if (document.body.contains(cursorFollower)) document.body.removeChild(cursorFollower);
        if (document.body.contains(outerRing)) document.body.removeChild(outerRing);
      };
    }
  }, [eyedropperActive]);

  const panelStyle = {
    background: 'white',
    border: '2px solid #ddd',
    borderRadius: '8px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  const titleStyle = {
    fontWeight: 600,
    marginBottom: '10px',
    color: '#333',
    fontSize: '14px'
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      // Clear canvas if no data
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    // Allow rendering even with no boxes - we'll show placeholders
    if (!text || text.length === 0) {
      // No text to render
      return;
    }

    // No need to preload edited images anymore - we apply erase masks dynamically

    // Create rotated version of image if needed
    if (imageRotation !== 0 && image) {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      tempCanvas.width = image.width;
      tempCanvas.height = image.height;

      // Apply same rotation as main canvas
      const centerX = image.width / 2;
      const centerY = image.height / 2;
      tempCtx.translate(centerX, centerY);
      tempCtx.rotate(imageRotation * Math.PI / 180);
      tempCtx.translate(-centerX, -centerY);

      tempCtx.drawImage(image, 0, 0);
      rotatedImageRef.current = tempCanvas;
    } else {
      rotatedImageRef.current = null;
    }

    // Render canvas (no need to wait for image loading since we apply masks dynamically)
    renderCanvas();
    // Trigger re-render of kerning handles after canvas is rendered
    setHandleRenderTrigger(prev => prev + 1);
  }, [image, boxes, letterSpacing, charPadding, kerningAdjustments, baselines, angledBaselines, editedCharData, imageRotation, imageFilters, levelsAdjustment, debugClickAreas, lastClickPos, text, selectedVariants, textPositionVariants, uniqueChars]);

  // Apply advanced color adjustments (shadows/highlights) to canvas
  const applyAdvancedAdjustments = (ctx, width, height) => {
    if (imageFilters.shadows === 0 && imageFilters.highlights === 0) {
      return; // Skip if no adjustments needed
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const shadowsAdjust = imageFilters.shadows / 100; // -1 to 1
    const highlightsAdjust = imageFilters.highlights / 100; // -1 to 1

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calculate luminance (grayscale value)
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const normalizedLuminance = luminance / 255;

      // Shadows affect darker pixels more (luminance < 0.5)
      if (normalizedLuminance < 0.5 && shadowsAdjust !== 0) {
        const shadowWeight = (0.5 - normalizedLuminance) * 2; // 0 to 1, stronger in darker areas
        const adjustment = shadowsAdjust * shadowWeight * 50; // Max ±50 adjustment
        data[i] = Math.max(0, Math.min(255, r + adjustment));
        data[i + 1] = Math.max(0, Math.min(255, g + adjustment));
        data[i + 2] = Math.max(0, Math.min(255, b + adjustment));
      }

      // Highlights affect brighter pixels more (luminance > 0.5)
      if (normalizedLuminance > 0.5 && highlightsAdjust !== 0) {
        const highlightWeight = (normalizedLuminance - 0.5) * 2; // 0 to 1, stronger in brighter areas
        const adjustment = highlightsAdjust * highlightWeight * 50; // Max ±50 adjustment
        data[i] = Math.max(0, Math.min(255, r + adjustment));
        data[i + 1] = Math.max(0, Math.min(255, g + adjustment));
        data[i + 2] = Math.max(0, Math.min(255, b + adjustment));
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    // Allow rendering with no boxes - will show placeholders for all characters
    if (!text || text.length === 0) return;

    // Use rotated image if available, otherwise use original
    const sourceImage = rotatedImageRef.current || image;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Instead of using boxes directly, create an array based on the text string
    // This allows us to show "HELLO" with two L's instead of just "HELO"
    // Now also respects per-position variants (overrides) and global selected variants
    // Keep ALL characters (even without boxes) to show placeholders
    const textChars = text.split('');
    const displayBoxes = textChars.map((char, position) => {
      // Find the charIndex for this character
      const charIndex = uniqueChars.indexOf(char);
      if (charIndex === -1) return { char, box: undefined, position }; // Unknown character

      // Check for per-position override first, then fall back to global selected variant
      const selectedVariantId = textPositionVariants[position] !== undefined
        ? textPositionVariants[position]
        : (selectedVariants[charIndex] || 0);

      // Find the box with matching charIndex and variantId
      const box = boxes.find(box => box.charIndex === charIndex && box.variantId === selectedVariantId);

      return { char, box, position }; // Return char, box, and position
    });

    // Clear character positions for click detection
    charPositionsRef.current = [];
    // Clear kerning handle positions
    kerningHandlesRef.current = [];

    // Check if there are any angled baselines
    const angledBaseline = angledBaselines && angledBaselines.length > 0 ? angledBaselines[0] : null;
    const hasAngledBaseline = angledBaseline !== null;
    const baselineAngle = hasAngledBaseline ? angledBaseline.angle : 0;
    const baselineAngleRad = baselineAngle * (Math.PI / 180);
    const baselineSlope = Math.tan(baselineAngleRad);

    // Find boxes with baseline alignment
    const baselinedBoxes = displayBoxes.filter(item => item.box && item.box.baseline_offset !== undefined);

    // FIRST PASS: Calculate average dimensions from actual boxes
    let totalBoxWidth = 0;
    let totalBoxHeight = 0;
    let boxCount = 0;

    displayBoxes.forEach(item => {
      if (item.box) {
        totalBoxWidth += item.box.width;
        totalBoxHeight += item.box.height;
        boxCount++;
      }
    });

    // Calculate average dimensions for placeholders
    const avgBoxWidth = boxCount > 0 ? Math.round(totalBoxWidth / boxCount) : 40;
    const avgBoxHeight = boxCount > 0 ? Math.round(totalBoxHeight / boxCount) : 60;

    // SECOND PASS: Calculate total width and max height using correct dimensions
    let totalWidth = 0;
    let maxHeight = 0;
    let unifiedBaselineY = 0;

    displayBoxes.forEach((item, index) => {
      const { box } = item;

      // Use actual box dimensions or placeholder dimensions (now with correct averages)
      let boxWidth, boxHeight;
      if (box) {
        boxWidth = box.width + charPadding * 2;
        boxHeight = box.height + charPadding * 2;
      } else {
        // Placeholder: use calculated average dimensions
        boxWidth = avgBoxWidth + charPadding * 2;
        boxHeight = avgBoxHeight + charPadding * 2;
      }

      totalWidth += boxWidth;
      if (index < displayBoxes.length - 1) {
        totalWidth += letterSpacing;
        // Add per-pair kerning
        const kerning = kerningAdjustments[index] || 0;
        totalWidth += kerning;
      }

      maxHeight = Math.max(maxHeight, boxHeight);
    });

    // Calculate canvas height based on baseline alignment
    let canvasHeight = maxHeight;

    if (baselinedBoxes.length > 0) {
      // Find maximum offset above baseline (ensures no character gets cut off)
      const maxOffsetAbove = Math.max(...baselinedBoxes.map(item => item.box.baseline_offset));
      unifiedBaselineY = maxOffsetAbove;

      // Calculate maximum space needed below baseline
      const maxBelowBaseline = Math.max(...baselinedBoxes.map(item => {
        const paddedHeight = item.box.height + charPadding * 2;
        return paddedHeight - item.box.baseline_offset;
      }));

      // Canvas height needs to fit both above and below baseline
      const baselineRequiredHeight = maxOffsetAbove + maxBelowBaseline;
      canvasHeight = Math.max(canvasHeight, baselineRequiredHeight);

      // For angled baselines, we need extra height to account for the slope
      if (hasAngledBaseline) {
        // Add vertical space for the slope
        const slopeHeight = Math.abs(totalWidth * baselineSlope);
        canvasHeight += slopeHeight;

        // Adjust unified baseline Y if slope is negative (going up)
        if (baselineSlope < 0) {
          unifiedBaselineY += slopeHeight;
        }
      }
    }

    // Add some padding to the canvas
    const canvasPadding = 20;
    totalWidth += canvasPadding * 2;
    canvasHeight += canvasPadding * 2;

    // Set canvas internal resolution
    canvas.width = totalWidth * dpr;
    canvas.height = canvasHeight * dpr;
    // Don't set style dimensions - let CSS handle scaling
    // Store natural dimensions as data attributes for aspect ratio reference
    canvas.dataset.naturalWidth = totalWidth;
    canvas.dataset.naturalHeight = canvasHeight;

    ctx.scale(dpr, dpr);

    // Fill background (dark when inverted, white otherwise)
    ctx.fillStyle = imageFilters.invert ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, totalWidth, canvasHeight);

    // Draw baseline for visualization (only in debug mode)
    if (debugClickAreas && unifiedBaselineY > 0) {
      ctx.save();
      ctx.strokeStyle = hasAngledBaseline ? 'rgba(34, 197, 94, 0.8)' : 'rgba(59, 130, 246, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();

      if (hasAngledBaseline) {
        // Draw angled baseline (green)
        const startY = canvasPadding + unifiedBaselineY;
        const endY = startY + (totalWidth - canvasPadding * 2) * baselineSlope;
        ctx.moveTo(canvasPadding, startY);
        ctx.lineTo(totalWidth - canvasPadding, endY);

        // Add label
        ctx.stroke();
        ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('ANGLED BASELINE', canvasPadding + 5, startY - 5);
      } else {
        // Draw horizontal baseline (blue)
        const y = canvasPadding + unifiedBaselineY;
        ctx.moveTo(canvasPadding, y);
        ctx.lineTo(totalWidth - canvasPadding, y);

        // Add label
        ctx.stroke();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('BASELINE', canvasPadding + 5, y - 5);
      }

      ctx.restore();
    }

    // Draw each character crop
    let currentX = canvasPadding;

    displayBoxes.forEach((item, index) => {
      const { char, box } = item;

      // Calculate box dimensions (use actual or placeholder)
      let boxWidth, boxHeight;
      if (box) {
        boxWidth = box.width + charPadding * 2;
        boxHeight = box.height + charPadding * 2;
      } else {
        // Placeholder dimensions
        boxWidth = avgBoxWidth + charPadding * 2;
        boxHeight = avgBoxHeight + charPadding * 2;
      }

      // Calculate Y position based on baseline alignment
      let yPos = canvasPadding;

      if (box && box.baseline_offset !== undefined && unifiedBaselineY > 0) {
        // Calculate baseline Y at current horizontal position
        let baselineYAtCurrentPos = unifiedBaselineY;

        if (hasAngledBaseline) {
          // For angled baseline, calculate Y based on horizontal distance and slope
          const offsetX = currentX - canvasPadding;
          baselineYAtCurrentPos = unifiedBaselineY + (offsetX * baselineSlope);
        }

        // Align to baseline using stored offset
        yPos = canvasPadding + baselineYAtCurrentPos - box.baseline_offset;
      } else if (unifiedBaselineY > 0) {
        // No baseline association but baseline exists - align bottom edge to baseline
        let baselineYAtCurrentPos = unifiedBaselineY;

        if (hasAngledBaseline) {
          const offsetX = currentX - canvasPadding;
          baselineYAtCurrentPos = unifiedBaselineY + (offsetX * baselineSlope);
        }

        yPos = canvasPadding + baselineYAtCurrentPos - boxHeight;
      } else {
        // No baseline at all - center vertically in canvas
        yPos = (canvasHeight - boxHeight) / 2;
      }

      // Draw character crop from original image or edited version, OR placeholder
      try {
        if (!box) {
          // PLACEHOLDER RENDERING for characters without boxes
          ctx.save();

          // Draw placeholder box with dotted border
          ctx.strokeStyle = '#999';
          ctx.fillStyle = '#f5f5f5';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.fillRect(currentX, yPos, boxWidth, boxHeight);
          ctx.strokeRect(currentX, yPos, boxWidth, boxHeight);
          ctx.setLineDash([]);

          // Draw the character text in center
          ctx.fillStyle = '#999';
          ctx.font = `${Math.round(boxHeight * 0.5)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(char, currentX + boxWidth / 2, yPos + boxHeight / 2);

          ctx.restore();

          // Store placeholder position for click detection (though clicking does nothing)
          charPositionsRef.current.push({
            x: currentX,
            y: yPos,
            width: boxWidth,
            height: boxHeight,
            box: null, // No box associated
            char: item.char,
            position: item.position
          });
        } else {
          // NORMAL RENDERING for actual boxes
          ctx.save();

          // Apply filters
          const filters = [];
          if (imageFilters.grayscale > 0) {
            filters.push(`grayscale(${imageFilters.grayscale}%)`);
          }
          if (imageFilters.invert) {
            filters.push('invert(100%)');
          }
          if (imageFilters.brightness !== 100) {
            filters.push(`brightness(${imageFilters.brightness}%)`);
          }
          if (imageFilters.contrast !== 100) {
            filters.push(`contrast(${imageFilters.contrast}%)`);
          }
          const filterString = filters.join(' ') || 'none';
          console.log('WordPreview filters:', { imageFilters, filters, filterString });
          ctx.filter = filterString;

          // Find original box index
          const originalBoxIndex = boxes.findIndex(b => b === box);

        // UNIFIED RENDERING PATH: Always use tempCanvas for consistency
        // This ensures filters, masks, and blending work identically for all characters
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = boxWidth;
        tempCanvas.height = boxHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Apply filters to temp canvas (same as main canvas)
        tempCtx.filter = ctx.filter;
        console.log('tempCtx.filter before drawImage:', tempCtx.filter);
        console.log('sourceImage type:', sourceImage instanceof HTMLCanvasElement ? 'Canvas' : 'Image');

        // Draw the character to temp canvas
        tempCtx.drawImage(
          sourceImage,
          box.x, box.y, box.width, box.height,
          charPadding, charPadding, box.width, box.height
        );

        // Sample a pixel to verify filter was applied
        const testPixel = tempCtx.getImageData(charPadding + 1, charPadding + 1, 1, 1).data;
        console.log('Pixel after filter draw:', testPixel);

        // Apply brush mask if it exists (for clipping)
        if (box.brushMask && box.brushMask.length > 0) {
          // Create mask using offscreen canvas to properly handle stroke width
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = boxWidth;
          maskCanvas.height = boxHeight;
          const maskCtx = maskCanvas.getContext('2d');

          // Build a combined path from all brush strokes
          maskCtx.fillStyle = 'black';
          maskCtx.strokeStyle = 'black';

          // First, stroke each path with proper width to create the outline
          box.brushMask.forEach(stroke => {
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

            // Add circles at each point for full coverage
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

          // Now create a unified path from all strokes and fill the interior
          maskCtx.beginPath();
          box.brushMask.forEach(stroke => {
            if (stroke.points.length > 0) {
              const firstPoint = stroke.points[0];
              const boxRelativeX = firstPoint.x - box.x;
              const boxRelativeY = firstPoint.y - box.y;
              maskCtx.moveTo(charPadding + boxRelativeX, charPadding + boxRelativeY);

              stroke.points.slice(1).forEach(point => {
                const boxRelativeX = point.x - box.x;
                const boxRelativeY = point.y - box.y;
                maskCtx.lineTo(charPadding + boxRelativeX, charPadding + boxRelativeY);
              });
            }
          });
          // Close the path and fill interior using nonzero winding rule
          maskCtx.closePath();
          maskCtx.fill('nonzero');

          // Apply mask using destination-in (keeps only pixels where mask is opaque)
          tempCtx.globalCompositeOperation = 'destination-in';
          tempCtx.drawImage(maskCanvas, 0, 0);
          tempCtx.globalCompositeOperation = 'source-over';
        }

        // Apply erase mask if it exists (from character editing) - BEFORE drawing to main canvas
        // This ensures transparent areas don't reveal white background when kerned
        if (originalBoxIndex !== -1 && editedCharData[originalBoxIndex]) {
          const editData = editedCharData[originalBoxIndex];
          const eraseMask = typeof editData === 'string' ? null : editData.eraseMask;

          if (eraseMask && eraseMask.length > 0) {
            eraseMask.forEach(stroke => {
              tempCtx.globalCompositeOperation = 'destination-out';
              tempCtx.fillStyle = 'rgba(0,0,0,1)';
              stroke.points.forEach(point => {
                // Convert from absolute image coordinates to box-relative coordinates
                const boxRelativeX = point.x - box.x;
                const boxRelativeY = point.y - box.y;
                const x = charPadding + boxRelativeX;
                const y = charPadding + boxRelativeY;
                tempCtx.beginPath();
                tempCtx.arc(x, y, stroke.size / 2, 0, Math.PI * 2);
                tempCtx.fill();
              });
              tempCtx.globalCompositeOperation = 'source-over';
            });
          }
        }

        // Reset filter on main canvas before drawing (filter already applied to tempCanvas)
        ctx.filter = 'none';

        // Draw the result to main canvas with multiply blend for black text
        // Use normal source-over when inverted (since inverted white text doesn't work with multiply)
        ctx.globalCompositeOperation = imageFilters.invert ? 'source-over' : 'multiply';
        ctx.drawImage(tempCanvas, 0, 0, boxWidth, boxHeight, currentX, yPos, boxWidth, boxHeight);
        ctx.globalCompositeOperation = 'source-over';

          ctx.restore();

          // Store character position for click detection
          charPositionsRef.current.push({
            x: currentX,
            y: yPos,
            width: boxWidth,
            height: boxHeight,
            box: box,
            char: item.char,
            position: item.position
          });

          // Store kerning handle position (for all except first character)
          // Handle should be at the left edge of current character (before it's drawn)
          if (index > 0) {
            // Calculate handle position at the gap between previous and current character
            // This is where we are now, before drawing the current character
            const prevCharRightEdge = currentX - letterSpacing - (kerningAdjustments[index - 1] || 0);
            const handleX = prevCharRightEdge + (letterSpacing / 2) + ((kerningAdjustments[index - 1] || 0) / 2);

            kerningHandlesRef.current.push({
              index: index - 1, // Kerning adjustment index (between prev and current char)
              x: handleX,
              y: yPos + boxHeight + 5, // Position below the character
              canvasHeight: canvasHeight
            });
          }
        } // End of else block for normal rendering
      } catch (error) {
        console.error('Error drawing character:', error);
      }

      // Move to next position
      currentX += boxWidth + letterSpacing;

      // Add per-pair kerning
      if (index < displayBoxes.length - 1) {
        const kerning = kerningAdjustments[index] || 0;
        currentX += kerning;
      }
    });

    // Apply Photoshop-style Levels adjustment if set
    if (levelsAdjustment) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const { shadowInput, highlightInput, midtones, gammaCorrection, outShadow, outHighlight, crushThreshold } = levelsAdjustment;

      for (let i = 0; i < data.length; i += 4) {
        let value = data[i]; // R channel (grayscale so R=G=B)

        // Step 1: Apply input levels (stretch contrast)
        value = 255 * ((value - shadowInput) / (highlightInput - shadowInput));
        value = Math.max(0, Math.min(255, value));

        // Step 2: Apply midtones (gamma correction - aggressive brightening)
        if (midtones !== 128) {
          value = 255 * Math.pow((value / 255), gammaCorrection);
        }

        // Step 3: Output levels
        value = (value / 255) * (outHighlight - outShadow) + outShadow;

        // Step 4: CRUSH GRAYS - threshold to push values to extremes
        // This eliminates mid-tones and creates pure black/white
        if (crushThreshold !== undefined) {
          // Apply a sigmoid-like curve to push values away from middle
          const distance = Math.abs(value - crushThreshold);
          const pushFactor = 1.5; // Higher = more aggressive crushing

          if (value < crushThreshold) {
            // Push dark grays toward black
            value = value * Math.pow(1 - (distance / crushThreshold), 1/pushFactor);
          } else {
            // Push light grays toward white
            value = 255 - ((255 - value) * Math.pow(1 - (distance / (255 - crushThreshold)), 1/pushFactor));
          }
        }

        // Clamp and apply
        value = Math.max(0, Math.min(255, Math.round(value)));
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
      }

      ctx.putImageData(imageData, 0, 0);
    }

    // Apply shadows/highlights adjustments after all characters are drawn
    // Use actual canvas dimensions (scaled by DPR)
    applyAdvancedAdjustments(ctx, canvas.width, canvas.height);

    // DEBUG: Draw clickable areas if debug mode is enabled
    if (debugClickAreas) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      charPositionsRef.current.forEach((pos, index) => {
        // Color-code boxes based on baseline association
        if (pos.box && pos.box.baseline_id !== undefined) {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'; // Blue for baselined
        } else {
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Red for non-baselined
        }
        ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);

        // Draw character label with baseline info
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.font = '12px monospace';
        let label = pos.box ? `[${index}] ${pos.box.char}` : `[${index}] placeholder`;

        // Add baseline info if present
        if (pos.box && pos.box.baseline_id !== undefined) {
          label += ` B:${pos.box.baseline_id}`;
          ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
        }

        ctx.fillText(label, pos.x + 2, pos.y + 12);
      });

      ctx.setLineDash([]);

      // Draw last click position as a crosshair
      if (lastClickPos) {
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lastClickPos.x - 10, lastClickPos.y);
        ctx.lineTo(lastClickPos.x + 10, lastClickPos.y);
        ctx.moveTo(lastClickPos.x, lastClickPos.y - 10);
        ctx.lineTo(lastClickPos.x, lastClickPos.y + 10);
        ctx.stroke();

        // Draw circle around click point
        ctx.beginPath();
        ctx.arc(lastClickPos.x, lastClickPos.y, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };

  // Show empty state only if no image OR no text string
  // If there's text but no boxes, we'll render placeholders for all characters
  if (!image || !text || text.length === 0) {
    return (
      <div style={panelStyle}>
        <div style={{ padding: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>
            {!image ? 'Upload an image to get started' : 'Enter text to preview'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ padding: '12px', borderBottom: '2px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <h3 style={titleStyle}>Word Preview</h3>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setDebugClickAreas(!debugClickAreas)}
            title="Toggle click area debug visualization"
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              background: debugClickAreas ? '#f97316' : '#f0f0f0',
              color: debugClickAreas ? 'white' : '#333',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Debug
          </button>
          <button
            onClick={handleWhitePoint}
            title="Set White Point - Click on a pixel that should be white (Esc to cancel)"
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              background: eyedropperActive ? '#2196F3' : '#f0f0f0',
              color: eyedropperActive ? 'white' : '#333',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Pipette style={{ width: '14px', height: '14px' }} />
          </button>
          <button
            onClick={handleDownload}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Download PNG
          </button>
          <button
            onClick={handleDownloadJSON}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Download JSON
          </button>
          <button
            onClick={handleDownloadZip}
            title="Download ZIP with image and complete annotations"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              background: '#9C27B0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Package style={{ width: '14px', height: '14px' }} />
            ZIP
          </button>
        </div>
      </div>
      <div
        ref={canvasContainerRef}
        onMouseLeave={() => setHoveredCharPosition(null)}
        style={{
          padding: '12px',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
          position: 'relative',
          background: eyedropperActive ? 'rgba(33, 150, 243, 0.1)' : 'transparent',
          border: eyedropperActive ? '2px solid #2196F3' : '2px solid transparent',
          transition: 'all 0.2s'
        }}
      >
        <canvas
          ref={canvasRef}
          id="word-preview-canvas"
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          style={{
            width: '100%',
            height: '100%',
            cursor: eyedropperActive ? 'none' : 'pointer',
            display: 'block',
            objectFit: 'contain'
          }}
        />
        {/* Kerning adjustment handles */}
        {kerningHandlesRef.current.map((handle, i) => {
          const canvas = canvasRef.current;
          if (!canvas) return null;

          const rect = canvas.getBoundingClientRect();
          const naturalWidth = parseFloat(canvas.dataset.naturalWidth || canvas.width);
          const naturalHeight = parseFloat(canvas.dataset.naturalHeight || canvas.height);

          // Calculate letterboxing offset and scale
          const canvasAspect = naturalWidth / naturalHeight;
          const rectAspect = rect.width / rect.height;

          let renderedWidth, renderedHeight, offsetX, offsetY;

          if (canvasAspect > rectAspect) {
            renderedWidth = rect.width;
            renderedHeight = rect.width / canvasAspect;
            offsetX = 0;
            offsetY = (rect.height - renderedHeight) / 2;
          } else {
            renderedWidth = rect.height * canvasAspect;
            renderedHeight = rect.height;
            offsetX = (rect.width - renderedWidth) / 2;
            offsetY = 0;
          }

          const scaleX = renderedWidth / naturalWidth;
          const scaleY = renderedHeight / naturalHeight;

          // Convert handle position to display coordinates
          const displayX = handle.x * scaleX + offsetX;
          const displayY = handle.y * scaleY + offsetY;

          const isDragging = draggingKerningIndex === handle.index;

          return (
            <div
              key={`kerning-handle-${handle.index}`}
              onMouseDown={(e) => handleKerningMouseDown(e, handle.index)}
              style={{
                position: 'absolute',
                left: `${displayX}px`,
                top: `${displayY}px`,
                width: '12px',
                height: '20px',
                background: isDragging ? '#2196F3' : '#FF9800',
                border: '2px solid white',
                borderRadius: '3px',
                cursor: 'ew-resize',
                transform: 'translateX(-50%)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: isDragging ? 'none' : 'background 0.2s',
                zIndex: 10,
                pointerEvents: 'auto'
              }}
              title={`Adjust kerning (current: ${kerningAdjustments[handle.index] || 0}px)`}
            />
          );
        })}

        {/* Variant picker hover button */}
        {hoveredCharPosition !== null && (() => {
          const char = text[hoveredCharPosition];
          const charIndex = uniqueChars.indexOf(char);
          if (charIndex === -1) {
            return null;
          }

          const availableVariants = boxes.filter(box => box.charIndex === charIndex);
          if (availableVariants.length <= 1) {
            return null; // Only show if multiple variants exist
          }

          const charPos = charPositionsRef.current.find(p => p.position === hoveredCharPosition);
          if (!charPos) {
            return null;
          }

          const canvas = canvasRef.current;
          if (!canvas) {
            return null;
          }

          const rect = canvas.getBoundingClientRect();
          const naturalWidth = parseFloat(canvas.dataset.naturalWidth || canvas.width);
          const naturalHeight = parseFloat(canvas.dataset.naturalHeight || canvas.height);

          const canvasAspect = naturalWidth / naturalHeight;
          const rectAspect = rect.width / rect.height;
          let renderedWidth, renderedHeight, offsetX, offsetY;

          if (canvasAspect > rectAspect) {
            renderedWidth = rect.width;
            renderedHeight = rect.width / canvasAspect;
            offsetX = 0; // Relative to parent, not page
            offsetY = (rect.height - renderedHeight) / 2;
          } else {
            renderedWidth = rect.height * canvasAspect;
            renderedHeight = rect.height;
            offsetX = (rect.width - renderedWidth) / 2;
            offsetY = 0; // Relative to parent, not page
          }

          const scaleX = renderedWidth / naturalWidth;
          const scaleY = renderedHeight / naturalHeight;

          const displayX = offsetX + charPos.x * scaleX + (charPos.width * scaleX / 2);
          const displayY = offsetY + charPos.y * scaleY - 8;

          // Get currently selected variant for this position
          const currentSelectedVariantId = textPositionVariants[hoveredCharPosition] !== undefined
            ? textPositionVariants[hoveredCharPosition]
            : (selectedVariants[charIndex] || 0);

          return (
            <div
              style={{
                position: 'absolute',
                left: `${displayX}px`,
                top: `${displayY}px`,
                transform: 'translate(-50%, -100%)',
                display: 'flex',
                gap: '4px',
                pointerEvents: 'auto',
                zIndex: 1000
              }}
              onMouseEnter={(e) => {
                isHoveringButtonRef.current = true;
                // Cancel any pending clear timeout
                if (hoverClearTimeoutRef.current) {
                  clearTimeout(hoverClearTimeoutRef.current);
                  hoverClearTimeoutRef.current = null;
                }
              }}
              onMouseLeave={(e) => {
                isHoveringButtonRef.current = false;
                // Clear hover state when leaving button
                setHoveredCharPosition(null);
              }}
            >
              {availableVariants.map((box) => (
                <VariantHoverThumbnail
                  key={box.variantId}
                  box={box}
                  isSelected={currentSelectedVariantId === box.variantId}
                  onClick={() => {
                    if (currentSelectedVariantId === box.variantId) {
                      // If clicking current selection, clear the override
                      clearPositionVariant(hoveredCharPosition);
                    } else {
                      // Set new variant for this position
                      setPositionVariant(hoveredCharPosition, box.variantId);
                    }
                  }}
                  renderFn={renderCharacterThumbnail}
                />
              ))}
            </div>
          );
        })()}

        {/* Variant Picker Popup */}
        {variantPickerOpen && variantPickerData && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => {
              setVariantPickerOpen(false);
              setVariantPickerData(null);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                maxWidth: '500px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
                Select Variant for '{variantPickerData.char}' at position {variantPickerData.position}
              </h3>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {variantPickerData.availableVariants.map((variant) => {
                  const isGlobalDefault = (selectedVariants[variantPickerData.charIndex] || 0) === variant.variantId;
                  const isCurrent = variantPickerData.currentVariant === variant.variantId;
                  const isOverride = textPositionVariants[variantPickerData.position] === variant.variantId;

                  return (
                    <div
                      key={variant.variantId}
                      onClick={() => handleVariantSelect(variant.variantId)}
                      style={{
                        border: isCurrent ? '3px solid #2196F3' : '2px solid #ddd',
                        borderRadius: '8px',
                        padding: '8px',
                        cursor: 'pointer',
                        background: isCurrent ? '#E3F2FD' : 'white',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) e.currentTarget.style.borderColor = '#2196F3';
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) e.currentTarget.style.borderColor = '#ddd';
                      }}
                    >
                      <div style={{
                        width: '80px',
                        height: '80px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                        marginBottom: '8px'
                      }}>
                        {/* TODO: Render variant thumbnail */}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '12px' }}>
                        <div style={{ fontWeight: 600 }}>Variant {variant.variantId}</div>
                        {isGlobalDefault && (
                          <div style={{ color: '#4CAF50', fontSize: '10px' }}>Global Default</div>
                        )}
                        {isOverride && !isGlobalDefault && (
                          <div style={{ color: '#9C27B0', fontSize: '10px' }}>Override</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setVariantPickerOpen(false);
                  setVariantPickerData(null);
                }}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  background: '#e0e0e0',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Separate component for variant thumbnail in hover UI
function VariantHoverThumbnail({ box, isSelected, onClick, renderFn }) {
  const canvasRef = useRef(null);
  const image = useAnnotatorStore((state) => state.image);

  useEffect(() => {
    if (canvasRef.current && image) {
      renderFn(canvasRef.current, box);
    }
  }, [box, image, renderFn]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: '32px',
        height: '32px',
        border: `2px solid ${isSelected ? '#2196F3' : 'white'}`,
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: 'pointer',
        background: isSelected ? '#E3F2FD' : 'white',
        transition: 'all 0.2s',
        boxShadow: isSelected ? '0 0 0 2px rgba(33, 150, 243, 0.4)' : '0 2px 8px rgba(0,0,0,0.3)'
      }}
      title={`Variant ${box.variantId + 1}${isSelected ? ' (selected)' : ''}`}
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
    </div>
  );
}
