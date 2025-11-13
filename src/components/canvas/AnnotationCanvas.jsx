import { useRef, useEffect, useState } from 'react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import ToolPalette from './ToolPalette';
import ZoomControls from './ZoomControls';

export default function AnnotationCanvas() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState(null);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [currentStroke, setCurrentStroke] = useState([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredBox, setHoveredBox] = useState(null);
  const [hoverCorner, setHoverCorner] = useState(null);
  const [cursorStyle, setCursorStyle] = useState('crosshair');
  const [tempToolOverride, setTempToolOverride] = useState(null);
  const [originalTool, setOriginalTool] = useState(null);
  const [savedModeState, setSavedModeState] = useState(null);

  const image = useAnnotatorStore((state) => state.image);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const currentTool = useAnnotatorStore((state) => state.currentTool);
  const setCurrentTool = useAnnotatorStore((state) => state.setCurrentTool);
  const currentCharIndex = useAnnotatorStore((state) => state.currentCharIndex);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);
  const addBox = useAnnotatorStore((state) => state.addBox);
  const selectedBox = useAnnotatorStore((state) => state.selectedBox);
  const setSelectedBox = useAnnotatorStore((state) => state.setSelectedBox);
  const selectedVariants = useAnnotatorStore((state) => state.selectedVariants);

  // Mode cancel/start functions for Cmd key handling
  const cancelAutoSolve = useAnnotatorStore((state) => state.cancelAutoSolve);
  const cancelBrushBox = useAnnotatorStore((state) => state.cancelBrushBox);
  const cancelRotation = useAnnotatorStore((state) => state.cancelRotation);
  const cancelBaseline = useAnnotatorStore((state) => state.cancelBaseline);
  const cancelAngledBaseline = useAnnotatorStore((state) => state.cancelAngledBaseline);
  const startAutoSolveRegionSelection = useAnnotatorStore((state) => state.startAutoSolveRegionSelection);
  const startBrushBoxMode = useAnnotatorStore((state) => state.startBrushBoxMode);
  const startRotationMode = useAnnotatorStore((state) => state.startRotationMode);
  const startBaselineMode = useAnnotatorStore((state) => state.startBaselineMode);
  const startAngledBaselineMode = useAnnotatorStore((state) => state.startAngledBaselineMode);
  const zoomLevel = useAnnotatorStore((state) => state.zoomLevel);
  const panOffset = useAnnotatorStore((state) => state.panOffset);
  const isPanning = useAnnotatorStore((state) => state.isPanning);
  const setIsPanning = useAnnotatorStore((state) => state.setIsPanning);
  const setPanOffset = useAnnotatorStore((state) => state.setPanOffset);
  const zoomIn = useAnnotatorStore((state) => state.zoomIn);
  const zoomOut = useAnnotatorStore((state) => state.zoomOut);
  const resetZoom = useAnnotatorStore((state) => state.resetZoom);
  const fitToView = useAnnotatorStore((state) => state.fitToView);
  const isDraggingBox = useAnnotatorStore((state) => state.isDraggingBox);
  const isResizingBox = useAnnotatorStore((state) => state.isResizingBox);
  const resizeCorner = useAnnotatorStore((state) => state.resizeCorner);
  const dragStartPos = useAnnotatorStore((state) => state.dragStartPos);
  const boxStartPos = useAnnotatorStore((state) => state.boxStartPos);
  const setIsDraggingBox = useAnnotatorStore((state) => state.setIsDraggingBox);
  const setIsResizingBox = useAnnotatorStore((state) => state.setIsResizingBox);
  const setDragStart = useAnnotatorStore((state) => state.setDragStart);
  const updateBox = useAnnotatorStore((state) => state.updateBox);

  // Auto-solve state
  const isSelectingAutoSolveRegion = useAnnotatorStore((state) => state.isSelectingAutoSolveRegion);
  const autoSolveRegions = useAnnotatorStore((state) => state.autoSolveRegions);
  const currentAutoSolveRegion = useAnnotatorStore((state) => state.currentAutoSolveRegion);
  const addAutoSolveRegion = useAnnotatorStore((state) => state.addAutoSolveRegion);
  const setCurrentAutoSolveRegion = useAnnotatorStore((state) => state.setCurrentAutoSolveRegion);

  // Brush box state
  const isBrushBoxMode = useAnnotatorStore((state) => state.isBrushBoxMode);
  const brushBoxSize = useAnnotatorStore((state) => state.brushBoxSize);
  const brushStrokes = useAnnotatorStore((state) => state.brushStrokes);
  const addBrushStroke = useAnnotatorStore((state) => state.addBrushStroke);
  const setBrushBoxSize = useAnnotatorStore((state) => state.setBrushBoxSize);
  const confirmBrushBox = useAnnotatorStore((state) => state.confirmBrushBox);
  const nextChar = useAnnotatorStore((state) => state.nextChar);

  // Rotation state
  const isRotationMode = useAnnotatorStore((state) => state.isRotationMode);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const rotationLineStart = useAnnotatorStore((state) => state.rotationLineStart);
  const rotationLineEnd = useAnnotatorStore((state) => state.rotationLineEnd);
  const setRotationLineStart = useAnnotatorStore((state) => state.setRotationLineStart);
  const setRotationLineEnd = useAnnotatorStore((state) => state.setRotationLineEnd);
  const confirmRotation = useAnnotatorStore((state) => state.confirmRotation);

  // Baseline state
  const isBaselineMode = useAnnotatorStore((state) => state.isBaselineMode);
  const baselines = useAnnotatorStore((state) => state.baselines);
  const tempBaselineY = useAnnotatorStore((state) => state.tempBaselineY);
  const setTempBaselineY = useAnnotatorStore((state) => state.setTempBaselineY);
  const addBaseline = useAnnotatorStore((state) => state.addBaseline);

  // Angled baseline state
  const isAngledBaselineMode = useAnnotatorStore((state) => state.isAngledBaselineMode);
  const angledBaselines = useAnnotatorStore((state) => state.angledBaselines);
  const angledBaselineLineStart = useAnnotatorStore((state) => state.angledBaselineLineStart);
  const angledBaselineLineEnd = useAnnotatorStore((state) => state.angledBaselineLineEnd);
  const tempAngledBaselinePos = useAnnotatorStore((state) => state.tempAngledBaselinePos);
  const setAngledBaselineLineStart = useAnnotatorStore((state) => state.setAngledBaselineLineStart);
  const setAngledBaselineLineEnd = useAnnotatorStore((state) => state.setAngledBaselineLineEnd);
  const setTempAngledBaselinePos = useAnnotatorStore((state) => state.setTempAngledBaselinePos);
  const addAngledBaseline = useAnnotatorStore((state) => state.addAngledBaseline);

  // Use temp tool override if Cmd is held, otherwise use current tool
  const effectiveTool = tempToolOverride || currentTool;

  // Auto-fit image to view on mount
  useEffect(() => {
    if (!image || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    fitToView(image.width, image.height, containerRect.width, containerRect.height);
  }, [image]); // Only run when image changes (initial load)

  // Handle keyboard shortcuts for tool selection
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ignore if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') {
        // V for pointer (selection tool)
        cancelBrushBox();
        cancelAutoSolve();
        cancelRotation();
        cancelBaseline();
        cancelAngledBaseline();
        setCurrentTool('pointer');
      } else if (e.key === 'm' || e.key === 'M') {
        // M for box mode
        cancelBrushBox();
        cancelAutoSolve();
        cancelRotation();
        cancelBaseline();
        cancelAngledBaseline();
        setCurrentTool('box');
      } else if (e.key === 'b' || e.key === 'B') {
        // B for brush
        if (!image) {
          alert('Please upload an image first.');
          return;
        }
        startBrushBoxMode();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [
    image,
    setCurrentTool,
    cancelBrushBox,
    cancelAutoSolve,
    cancelRotation,
    cancelBaseline,
    cancelAngledBaseline,
    startBrushBoxMode
  ]);

  // Handle Cmd key for temporary pointer mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Meta key (Cmd on Mac, Windows key on Windows)
      if (e.metaKey && !tempToolOverride) {
        // Save current tool and mode state
        const modeState = {
          tool: currentTool,
          isBrushBoxMode,
          isSelectingAutoSolveRegion,
          isRotationMode,
          isBaselineMode,
          isAngledBaselineMode
        };
        setSavedModeState(modeState);

        // Cancel all active modes
        cancelBrushBox();
        cancelAutoSolve();
        cancelRotation();
        cancelBaseline();
        cancelAngledBaseline();

        // Switch to pointer tool
        setCurrentTool('pointer');
        setTempToolOverride('pointer');
      }
    };

    const handleKeyUp = (e) => {
      // When Meta key is released, restore original mode
      if (e.key === 'Meta' && tempToolOverride === 'pointer' && savedModeState) {
        // Don't restore if currently dragging or resizing - wait for mouse up
        if (isDraggingBox || isResizingBox) {
          // Just clear the temp override flag, but keep savedModeState
          // It will be restored on mouse up
          setTempToolOverride(null);
          return;
        }

        setTempToolOverride(null);

        // Restore original tool
        setCurrentTool(savedModeState.tool);

        // Restore active modes
        if (savedModeState.isBrushBoxMode) {
          startBrushBoxMode();
        } else if (savedModeState.isSelectingAutoSolveRegion) {
          startAutoSolveRegionSelection();
        } else if (savedModeState.isRotationMode) {
          startRotationMode();
        } else if (savedModeState.isBaselineMode) {
          startBaselineMode();
        } else if (savedModeState.isAngledBaselineMode) {
          startAngledBaselineMode();
        }

        setSavedModeState(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    currentTool,
    tempToolOverride,
    savedModeState,
    isBrushBoxMode,
    isSelectingAutoSolveRegion,
    isRotationMode,
    isBaselineMode,
    isAngledBaselineMode,
    setCurrentTool,
    cancelBrushBox,
    cancelAutoSolve,
    cancelRotation,
    cancelBaseline,
    cancelAngledBaseline,
    startBrushBoxMode,
    startAutoSolveRegionSelection,
    startRotationMode,
    startBaselineMode,
    startAngledBaselineMode
  ]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size with zoom
    const displayWidth = image.width * zoomLevel;
    const displayHeight = image.height * zoomLevel;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.scale(dpr, dpr);

    // Apply rotation (without pan - pan is applied via CSS transform)
    ctx.save();

    // Apply rotation if set
    if (imageRotation !== 0) {
      const centerX = displayWidth / 2;
      const centerY = displayHeight / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate(imageRotation * Math.PI / 180);
      ctx.translate(-centerX, -centerY);
    }

    // Draw image (filters only applied in WordPreview, not main canvas)
    ctx.drawImage(image, 0, 0, displayWidth, displayHeight);

    ctx.restore();

    // Draw existing boxes (scaled for zoom) - OUTSIDE rotation transform
    boxes.forEach((box, index) => {
      const isSelected = selectedBox === index;
      const isHovered = hoveredBox === index && !isSelected;

      // Highlight hovered box with a fill
      if (isHovered) {
        ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
        ctx.fillRect(box.x * zoomLevel, box.y * zoomLevel, box.width * zoomLevel, box.height * zoomLevel);
      }

      ctx.strokeStyle = isSelected ? '#2196F3' : isHovered ? '#FF9800' : '#4CAF50';
      ctx.lineWidth = isSelected ? 3 : isHovered ? 2.5 : 2;
      ctx.strokeRect(box.x * zoomLevel, box.y * zoomLevel, box.width * zoomLevel, box.height * zoomLevel);

      // Draw character label with smart positioning to avoid edge cutoff
      ctx.fillStyle = isSelected ? '#2196F3' : isHovered ? '#FF9800' : '#4CAF50';
      ctx.font = `bold 16px Arial`;

      // Calculate label position based on box location
      const labelPadding = 4;
      const labelHeight = 16; // Font size
      let labelX = box.x * zoomLevel + labelPadding;
      let labelY = box.y * zoomLevel + labelHeight + labelPadding;

      // If box is near top edge, draw label below the box instead
      if (box.y * zoomLevel < labelHeight + labelPadding + 5) {
        labelY = (box.y + box.height) * zoomLevel + labelHeight + labelPadding;
      }

      // If box is near left edge, ensure label doesn't go off-canvas
      if (box.x * zoomLevel < labelPadding) {
        labelX = labelPadding;
      }

      ctx.fillText(box.char, labelX, labelY);

      // Draw star indicator if this is the selected variant for this character
      const selectedVariantId = selectedVariants[box.charIndex] || 0;
      const isSelectedVariant = box.variantId === selectedVariantId;
      if (isSelectedVariant && boxes.filter(b => b.charIndex === box.charIndex).length > 1) {
        // Only show star if there are multiple variants for this character
        const starSize = 12;
        const starX = (box.x + box.width) * zoomLevel - starSize - 2;
        const starY = box.y * zoomLevel + starSize + 2;
        ctx.fillStyle = '#FFD700'; // Gold color
        ctx.font = `${starSize}px Arial`;
        ctx.fillText('⭐', starX, starY);
      }

      // Draw corner handles for selected or hovered box
      if (isSelected || isHovered) {
        const handleSize = 8;
        const corners = [
          { x: box.x * zoomLevel, y: box.y * zoomLevel }, // nw
          { x: (box.x + box.width) * zoomLevel, y: box.y * zoomLevel }, // ne
          { x: box.x * zoomLevel, y: (box.y + box.height) * zoomLevel }, // sw
          { x: (box.x + box.width) * zoomLevel, y: (box.y + box.height) * zoomLevel }, // se
        ];

        corners.forEach(corner => {
          ctx.fillStyle = isSelected ? '#2196F3' : '#FF9800';
          ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1;
          ctx.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
        });

        // Draw edge handles (midpoint of each side)
        const edgeHandleWidth = 20;
        const edgeHandleHeight = 6;
        const edges = [
          { x: (box.x + box.width / 2) * zoomLevel, y: box.y * zoomLevel, type: 'horizontal' }, // top
          { x: (box.x + box.width / 2) * zoomLevel, y: (box.y + box.height) * zoomLevel, type: 'horizontal' }, // bottom
          { x: box.x * zoomLevel, y: (box.y + box.height / 2) * zoomLevel, type: 'vertical' }, // left
          { x: (box.x + box.width) * zoomLevel, y: (box.y + box.height / 2) * zoomLevel, type: 'vertical' }, // right
        ];

        edges.forEach(edge => {
          ctx.fillStyle = isSelected ? '#2196F3' : '#FF9800';
          if (edge.type === 'horizontal') {
            ctx.fillRect(edge.x - edgeHandleWidth / 2, edge.y - edgeHandleHeight / 2, edgeHandleWidth, edgeHandleHeight);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(edge.x - edgeHandleWidth / 2, edge.y - edgeHandleHeight / 2, edgeHandleWidth, edgeHandleHeight);
          } else {
            ctx.fillRect(edge.x - edgeHandleHeight / 2, edge.y - edgeHandleWidth / 2, edgeHandleHeight, edgeHandleWidth);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(edge.x - edgeHandleHeight / 2, edge.y - edgeHandleWidth / 2, edgeHandleHeight, edgeHandleWidth);
          }
        });
      }
    });

    // Draw current box being drawn
    if (currentBox) {
      ctx.save();
      ctx.strokeStyle = '#FF9800';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(currentBox.x * zoomLevel, currentBox.y * zoomLevel, currentBox.width * zoomLevel, currentBox.height * zoomLevel);
      ctx.setLineDash([]);

      // Draw character label for currently drawn box with smart positioning
      const currentChar = uniqueChars[currentCharIndex];
      if (currentChar) {
        ctx.fillStyle = '#FF9800';
        ctx.font = `bold 16px Arial`;

        // Calculate label position based on box location
        const labelPadding = 4;
        const labelHeight = 16; // Font size
        let labelX = currentBox.x * zoomLevel + labelPadding;
        let labelY = currentBox.y * zoomLevel + labelHeight + labelPadding;

        // If box is near top edge, draw label below the box instead
        if (currentBox.y * zoomLevel < labelHeight + labelPadding + 5) {
          labelY = (currentBox.y + currentBox.height) * zoomLevel + labelHeight + labelPadding;
        }

        // If box is near left edge, ensure label doesn't go off-canvas
        if (currentBox.x * zoomLevel < labelPadding) {
          labelX = labelPadding;
        }

        ctx.fillText(currentChar, labelX, labelY);
      }

      ctx.restore();
    }

    // Draw auto-solve regions
    if (isSelectingAutoSolveRegion) {
      ctx.save();

      // Draw completed regions
      autoSolveRegions.forEach((region, index) => {
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 3;
        ctx.strokeRect(region.x * zoomLevel, region.y * zoomLevel, region.width * zoomLevel, region.height * zoomLevel);
        ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
        ctx.fillRect(region.x * zoomLevel, region.y * zoomLevel, region.width * zoomLevel, region.height * zoomLevel);

        // Draw region number
        ctx.fillStyle = '#2196F3';
        ctx.font = `bold 20px Arial`;
        ctx.fillText(`${index + 1}`, region.x * zoomLevel + 8, region.y * zoomLevel + 28);
      });

      // Draw current region being drawn
      if (currentAutoSolveRegion && currentAutoSolveRegion.width > 0 && currentAutoSolveRegion.height > 0) {
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(
          currentAutoSolveRegion.x * zoomLevel,
          currentAutoSolveRegion.y * zoomLevel,
          currentAutoSolveRegion.width * zoomLevel,
          currentAutoSolveRegion.height * zoomLevel
        );
        ctx.fillStyle = 'rgba(255, 152, 0, 0.1)';
        ctx.fillRect(
          currentAutoSolveRegion.x * zoomLevel,
          currentAutoSolveRegion.y * zoomLevel,
          currentAutoSolveRegion.width * zoomLevel,
          currentAutoSolveRegion.height * zoomLevel
        );
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    // Draw brush strokes
    if (isBrushBoxMode) {
      ctx.save();

      // Draw all completed strokes
      brushStrokes.forEach((stroke) => {
        const points = stroke.points || stroke; // Support old format (array) and new format (object)
        const strokeSize = stroke.size || brushBoxSize; // Use stored size or fallback to current size

        if (points.length > 0) {
          ctx.strokeStyle = 'rgba(76, 175, 80, 0.6)';
          ctx.lineWidth = strokeSize * zoomLevel;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.beginPath();
          ctx.moveTo(points[0].x * zoomLevel, points[0].y * zoomLevel);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x * zoomLevel, points[i].y * zoomLevel);
          }
          ctx.stroke();
        }
      });

      // Draw current stroke being drawn
      if (currentStroke.length > 0) {
        ctx.strokeStyle = 'rgba(33, 150, 243, 0.8)';
        ctx.lineWidth = brushBoxSize * zoomLevel;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(currentStroke[0].x * zoomLevel, currentStroke[0].y * zoomLevel);
        for (let i = 1; i < currentStroke.length; i++) {
          ctx.lineTo(currentStroke[i].x * zoomLevel, currentStroke[i].y * zoomLevel);
        }
        ctx.stroke();
      }

      // Draw brush cursor preview at mouse position
      if (mousePos.x > 0 && mousePos.y > 0 && !isDrawing) {
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mousePos.x * zoomLevel, mousePos.y * zoomLevel, (brushBoxSize / 2) * zoomLevel, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Draw rotation line
    if (isRotationMode && rotationLineStart) {
      ctx.save();

      // Draw the line
      ctx.strokeStyle = '#9C27B0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rotationLineStart.x * zoomLevel, rotationLineStart.y * zoomLevel);

      if (rotationLineEnd) {
        ctx.lineTo(rotationLineEnd.x * zoomLevel, rotationLineEnd.y * zoomLevel);
      }
      ctx.stroke();

      // Draw start and end points
      ctx.fillStyle = '#9C27B0';
      ctx.beginPath();
      ctx.arc(rotationLineStart.x * zoomLevel, rotationLineStart.y * zoomLevel, 5, 0, Math.PI * 2);
      ctx.fill();

      if (rotationLineEnd) {
        ctx.beginPath();
        ctx.arc(rotationLineEnd.x * zoomLevel, rotationLineEnd.y * zoomLevel, 5, 0, Math.PI * 2);
        ctx.fill();

        // Show angle hint
        const dx = rotationLineEnd.x - rotationLineStart.x;
        const dy = rotationLineEnd.y - rotationLineStart.y;
        const lineLength = Math.sqrt(dx * dx + dy * dy);

        if (lineLength > 30) {
          const angleRad = Math.atan2(dy, dx);
          const angleDeg = angleRad * (180 / Math.PI);

          const midX = ((rotationLineStart.x + rotationLineEnd.x) / 2) * zoomLevel;
          const midY = ((rotationLineStart.y + rotationLineEnd.y) / 2) * zoomLevel;

          ctx.fillStyle = 'rgba(156, 39, 176, 0.9)';
          ctx.fillRect(midX - 40, midY - 20, 80, 30);
          ctx.fillStyle = 'white';
          ctx.font = `bold 14px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${angleDeg.toFixed(1)}°`, midX, midY);
        }
      }

      ctx.restore();
    }

    // Draw baselines
    if (baselines.length > 0 || (isBaselineMode && tempBaselineY !== null)) {
      ctx.save();

      // Draw all saved baselines
      baselines.forEach((baseline) => {
        ctx.strokeStyle = baseline.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(0, baseline.y * zoomLevel);
        ctx.lineTo(displayWidth, baseline.y * zoomLevel);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw baseline label
        ctx.fillStyle = baseline.color;
        ctx.font = `bold 12px Arial`;
        ctx.fillText(`Baseline ${baseline.id}`, 5, baseline.y * zoomLevel - 5);
      });

      // Draw temporary baseline being dragged
      if (isBaselineMode && tempBaselineY !== null) {
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(0, tempBaselineY * zoomLevel);
        ctx.lineTo(displayWidth, tempBaselineY * zoomLevel);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw label
        ctx.fillStyle = '#FF9800';
        ctx.font = `bold 14px Arial`;
        ctx.fillText('New Baseline', 5, tempBaselineY * zoomLevel - 5);
      }

      ctx.restore();
    }

    // Draw angled baselines
    if (angledBaselines.length > 0 || (isAngledBaselineMode && (angledBaselineLineStart || tempAngledBaselinePos))) {
      ctx.save();

      // Draw all saved angled baselines
      angledBaselines.forEach((baseline) => {
        // Calculate angle and extend line infinitely across canvas
        const angleRad = baseline.angle * (Math.PI / 180);
        const centerX = (baseline.start.x + baseline.end.x) / 2;
        const centerY = (baseline.start.y + baseline.end.y) / 2;

        // Extend line to cover entire canvas (2000px should be enough)
        const lineLength = 2000;
        const halfLength = lineLength / 2;

        const extendedStart = {
          x: centerX - Math.cos(angleRad) * halfLength,
          y: centerY - Math.sin(angleRad) * halfLength,
        };

        const extendedEnd = {
          x: centerX + Math.cos(angleRad) * halfLength,
          y: centerY + Math.sin(angleRad) * halfLength,
        };

        ctx.strokeStyle = baseline.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(extendedStart.x * zoomLevel, extendedStart.y * zoomLevel);
        ctx.lineTo(extendedEnd.x * zoomLevel, extendedEnd.y * zoomLevel);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw baseline label
        ctx.fillStyle = baseline.color;
        ctx.font = `bold 12px Arial`;
        const midX = centerX * zoomLevel;
        const midY = centerY * zoomLevel;
        ctx.fillText(`Angled ${baseline.id} (${baseline.angle.toFixed(1)}°)`, midX + 5, midY - 5);
      });

      // Draw temporary angled baseline
      if (isAngledBaselineMode) {
        // First baseline: Draw line being drawn (extended across image)
        if (angledBaselines.length === 0 && angledBaselineLineStart && angledBaselineLineEnd) {
          // Calculate angle
          const dx = angledBaselineLineEnd.x - angledBaselineLineStart.x;
          const dy = angledBaselineLineEnd.y - angledBaselineLineStart.y;
          const angleRad = Math.atan2(dy, dx);
          const angleDeg = angleRad * (180 / Math.PI);

          // Calculate center point
          const centerX = (angledBaselineLineStart.x + angledBaselineLineEnd.x) / 2;
          const centerY = (angledBaselineLineStart.y + angledBaselineLineEnd.y) / 2;

          // Extend the line across the image
          const lineLength = 2000;
          const halfLength = lineLength / 2;

          const extendedStart = {
            x: centerX - Math.cos(angleRad) * halfLength,
            y: centerY - Math.sin(angleRad) * halfLength,
          };

          const extendedEnd = {
            x: centerX + Math.cos(angleRad) * halfLength,
            y: centerY + Math.sin(angleRad) * halfLength,
          };

          // Draw extended line
          ctx.strokeStyle = '#FF9800';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 5]);
          ctx.beginPath();
          ctx.moveTo(extendedStart.x * zoomLevel, extendedStart.y * zoomLevel);
          ctx.lineTo(extendedEnd.x * zoomLevel, extendedEnd.y * zoomLevel);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw label
          ctx.fillStyle = '#FF9800';
          ctx.font = `bold 14px Arial`;
          ctx.fillText(`${angleDeg.toFixed(1)}°`, centerX * zoomLevel + 5, centerY * zoomLevel - 5);
        }
        // Subsequent baselines: Draw baseline at stored angle
        else if (angledBaselines.length > 0 && tempAngledBaselinePos) {
          const lastBaseline = angledBaselines[angledBaselines.length - 1];
          const angleRad = lastBaseline.angle * (Math.PI / 180);
          const lineLength = 2000;
          const halfLength = lineLength / 2;

          const start = {
            x: tempAngledBaselinePos.x - Math.cos(angleRad) * halfLength,
            y: tempAngledBaselinePos.y - Math.sin(angleRad) * halfLength,
          };

          const end = {
            x: tempAngledBaselinePos.x + Math.cos(angleRad) * halfLength,
            y: tempAngledBaselinePos.y + Math.sin(angleRad) * halfLength,
          };

          ctx.strokeStyle = '#FF9800';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 5]);
          ctx.beginPath();
          ctx.moveTo(start.x * zoomLevel, start.y * zoomLevel);
          ctx.lineTo(end.x * zoomLevel, end.y * zoomLevel);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw label
          ctx.fillStyle = '#FF9800';
          ctx.font = `bold 14px Arial`;
          ctx.fillText('New Angled Baseline', tempAngledBaselinePos.x * zoomLevel + 5, tempAngledBaselinePos.y * zoomLevel - 5);
        }
      }

      ctx.restore();
    }
  }, [image, boxes, currentBox, selectedBox, hoveredBox, zoomLevel, panOffset, isSelectingAutoSolveRegion, autoSolveRegions, currentAutoSolveRegion, isBrushBoxMode, brushStrokes, currentStroke, brushBoxSize, mousePos, isDrawing, imageRotation, isRotationMode, rotationLineStart, rotationLineEnd, baselines, isBaselineMode, tempBaselineY, angledBaselines, isAngledBaselineMode, angledBaselineLineStart, angledBaselineLineEnd, tempAngledBaselinePos]);

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    // Get mouse position relative to canvas (accounting for zoom only)
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;

    // TODO: Need to account for imageRotation
    // Problem: Image is rotated via canvas context transform,
    // but boxes are drawn in non-rotated coordinates
    // Need to find correct transformation

    return { x, y };
  };

  const getCornerAtPoint = (box, x, y) => {
    const handleSize = 20 / zoomLevel; // Larger hit area (constant screen size - in image coords)
    const corners = [
      { name: 'nw', x: box.x, y: box.y },
      { name: 'ne', x: box.x + box.width, y: box.y },
      { name: 'sw', x: box.x, y: box.y + box.height },
      { name: 'se', x: box.x + box.width, y: box.y + box.height },
    ];

    for (const corner of corners) {
      if (Math.abs(x - corner.x) < handleSize && Math.abs(y - corner.y) < handleSize) {
        return corner.name;
      }
    }
    return null;
  };

  const getEdgeAtPoint = (box, x, y) => {
    const edgeThreshold = 10 / zoomLevel; // Hit area for edges
    const inXRange = x >= box.x && x <= box.x + box.width;
    const inYRange = y >= box.y && y <= box.y + box.height;

    // Check top edge
    if (inXRange && Math.abs(y - box.y) < edgeThreshold) {
      return 'n';
    }
    // Check bottom edge
    if (inXRange && Math.abs(y - (box.y + box.height)) < edgeThreshold) {
      return 's';
    }
    // Check left edge
    if (inYRange && Math.abs(x - box.x) < edgeThreshold) {
      return 'w';
    }
    // Check right edge
    if (inYRange && Math.abs(x - (box.x + box.width)) < edgeThreshold) {
      return 'e';
    }
    return null;
  };

  const isPointInBox = (box, x, y) => {
    return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  };

  const handleMouseDown = (e) => {
    // Pan with space or middle mouse button
    if (e.button === 1 || e.spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const pos = getMousePos(e);

    // Auto-solve region selection mode
    if (isSelectingAutoSolveRegion) {
      setStartPos(pos);
      setCurrentAutoSolveRegion({ x: pos.x, y: pos.y, width: 0, height: 0 });
      return;
    }

    // Brush box mode - start drawing a stroke
    if (isBrushBoxMode) {
      // Don't allow drawing if no character is selected (all done)
      if (currentCharIndex === -1) {
        return;
      }
      // Check if current character already has a box
      if (currentCharIndex >= 0 && currentCharIndex < uniqueChars.length) {
        const hasBox = boxes.some(box => box.charIndex === currentCharIndex);
        if (hasBox) {
          // Character already has a box, don't allow drawing
          return;
        }
      }
      setIsDrawing(true);
      setCurrentStroke([pos]);
      return;
    }

    // Rotation mode - start drawing rotation line
    if (isRotationMode) {
      setRotationLineStart(pos);
      setRotationLineEnd(pos);
      return;
    }

    // Baseline mode - start dragging baseline
    if (isBaselineMode) {
      setTempBaselineY(pos.y);
      return;
    }

    // Angled baseline mode
    if (isAngledBaselineMode) {
      // If no baselines yet, draw a line to set the angle
      if (angledBaselines.length === 0) {
        setAngledBaselineLineStart(pos);
        setAngledBaselineLineEnd(pos);
      } else {
        // If baselines exist, use the angle from the last one
        // Just set the position for the temporary baseline
        setTempAngledBaselinePos(pos);
      }
      return;
    }

    // Pointer mode: only allow selecting, moving, and resizing existing boxes
    if (effectiveTool === 'pointer') {
      // Check all boxes from top to bottom for interaction
      for (let i = boxes.length - 1; i >= 0; i--) {
        const box = boxes[i];

        // Check if clicking on a corner handle (for resizing)
        const corner = getCornerAtPoint(box, pos.x, pos.y);
        if (corner) {
          setSelectedBox(i); // Select the box
          setIsResizingBox(true, corner);
          setDragStart(pos, { ...box });
          return;
        }

        // Check if clicking on an edge (for resizing)
        const edge = getEdgeAtPoint(box, pos.x, pos.y);
        if (edge) {
          setSelectedBox(i); // Select the box
          setIsResizingBox(true, edge);
          setDragStart(pos, { ...box });
          return;
        }

        // Check if clicking inside the box (for dragging)
        if (isPointInBox(box, pos.x, pos.y)) {
          setSelectedBox(i); // Select the box
          setIsDraggingBox(true);
          setDragStart(pos, { ...box });
          // Auto-switch to box tool after clicking on a box
          useAnnotatorStore.getState().setCurrentTool('box');
          return;
        }
      }

      // Clicking on empty space deselects
      setSelectedBox(null);
      return;
    }

    // Box mode: only allow drawing new boxes
    if (effectiveTool === 'box') {
      // Don't allow drawing if no character is selected (all done)
      if (currentCharIndex === -1) {
        return;
      }
      // Allow drawing multiple boxes for the same character (variants)
      setIsDrawing(true);
      setStartPos(pos);
      setCurrentBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
      return;
    }
  };

  const handleMouseMove = (e) => {
    const pos = getMousePos(e);

    // Update mouse position for brush cursor preview
    if (isBrushBoxMode) {
      setMousePos(pos);
    }

    // Detect hover state for cursor and highlighting (only when in pointer mode and not drawing/dragging)
    if (effectiveTool === 'pointer' && !isDrawing && !isDraggingBox && !isResizingBox && !isPanning && !isBrushBoxMode && !isSelectingAutoSolveRegion && !isRotationMode && !isBaselineMode && !isAngledBaselineMode) {
      let foundHover = false;
      let foundCorner = null;
      let cursor = 'default';

      // Check each box for hover
      for (let i = boxes.length - 1; i >= 0; i--) {
        const box = boxes[i];

        // Check corners first (highest priority)
        const corner = getCornerAtPoint(box, pos.x, pos.y);
        if (corner) {
          setHoveredBox(i);
          setHoverCorner(corner);
          foundHover = true;
          foundCorner = corner;

          // Set cursor based on corner
          if (corner === 'nw' || corner === 'se') {
            cursor = 'nwse-resize';
          } else {
            cursor = 'nesw-resize';
          }
          break;
        }

        // Check edges (medium priority)
        const edge = getEdgeAtPoint(box, pos.x, pos.y);
        if (edge) {
          setHoveredBox(i);
          setHoverCorner(edge);
          foundHover = true;
          foundCorner = edge;

          // Set cursor based on edge
          if (edge === 'n' || edge === 's') {
            cursor = 'ns-resize';
          } else {
            cursor = 'ew-resize';
          }
          break;
        }

        // Check if inside box body (lowest priority)
        if (pos.x >= box.x && pos.x <= box.x + box.width &&
            pos.y >= box.y && pos.y <= box.y + box.height) {
          setHoveredBox(i);
          setHoverCorner(null);
          foundHover = true;
          cursor = 'move';
          break;
        }
      }

      if (!foundHover) {
        setHoveredBox(null);
        setHoverCorner(null);
      }

      setCursorStyle(cursor);
    } else {
      // Clear hover state when not in box mode
      if (hoveredBox !== null) {
        setHoveredBox(null);
        setHoverCorner(null);
      }

      // Set appropriate cursor based on current state
      if (isPanning) {
        setCursorStyle('grabbing');
      } else if (isBrushBoxMode) {
        setCursorStyle('none');
      } else if (isSelectingAutoSolveRegion) {
        setCursorStyle('crosshair');
      } else {
        setCursorStyle('crosshair');
      }
    }

    // Handle panning
    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setPanOffset({
        x: panOffset.x + deltaX,
        y: panOffset.y + deltaY
      });
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Auto-solve region selection - update region as user drags
    if (isSelectingAutoSolveRegion && startPos && currentAutoSolveRegion) {
      const x = Math.min(startPos.x, pos.x);
      const y = Math.min(startPos.y, pos.y);
      const width = Math.abs(pos.x - startPos.x);
      const height = Math.abs(pos.y - startPos.y);
      setCurrentAutoSolveRegion({ x, y, width, height });
      return;
    }

    // Brush box mode - continue drawing stroke
    if (isBrushBoxMode && isDrawing) {
      setCurrentStroke((prev) => {
        if (prev.length === 0) {
          return [pos];
        }

        // Interpolate between last point and current point for smooth strokes
        const lastPoint = prev[prev.length - 1];
        const dx = pos.x - lastPoint.x;
        const dy = pos.y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Interpolate if distance is greater than half the brush size
        const stepSize = brushBoxSize / 2;
        if (distance > stepSize) {
          const steps = Math.ceil(distance / stepSize);
          const newPoints = [];
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            newPoints.push({
              x: lastPoint.x + dx * t,
              y: lastPoint.y + dy * t
            });
          }
          return [...prev, ...newPoints];
        } else {
          return [...prev, pos];
        }
      });
      return;
    }

    // Rotation mode - update rotation line end
    if (isRotationMode && rotationLineStart) {
      setRotationLineEnd(pos);
      return;
    }

    // Baseline mode - update temporary baseline position
    if (isBaselineMode && tempBaselineY !== null) {
      setTempBaselineY(pos.y);
      return;
    }

    // Angled baseline mode
    if (isAngledBaselineMode) {
      // If no baselines yet, update the line end (drawing initial line)
      if (angledBaselines.length === 0 && angledBaselineLineStart) {
        setAngledBaselineLineEnd(pos);
      }
      // For subsequent baselines, update position during drag
      else if (angledBaselines.length > 0 && tempAngledBaselinePos !== null) {
        setTempAngledBaselinePos(pos);
      }
      return;
    }

    // Handle box dragging
    if (isDraggingBox && selectedBox !== null) {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;
      updateBox(selectedBox, {
        x: boxStartPos.x + dx,
        y: boxStartPos.y + dy,
      });
      return;
    }

    // Handle box resizing
    if (isResizingBox && selectedBox !== null) {
      const box = { ...boxStartPos };
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;

      switch (resizeCorner) {
        case 'nw':
          box.x = boxStartPos.x + dx;
          box.y = boxStartPos.y + dy;
          box.width = boxStartPos.width - dx;
          box.height = boxStartPos.height - dy;
          break;
        case 'ne':
          box.y = boxStartPos.y + dy;
          box.width = boxStartPos.width + dx;
          box.height = boxStartPos.height - dy;
          break;
        case 'sw':
          box.x = boxStartPos.x + dx;
          box.width = boxStartPos.width - dx;
          box.height = boxStartPos.height + dy;
          break;
        case 'se':
          box.width = boxStartPos.width + dx;
          box.height = boxStartPos.height + dy;
          break;
        // Edge resizing
        case 'n':
          box.y = boxStartPos.y + dy;
          box.height = boxStartPos.height - dy;
          break;
        case 's':
          box.height = boxStartPos.height + dy;
          break;
        case 'w':
          box.x = boxStartPos.x + dx;
          box.width = boxStartPos.width - dx;
          break;
        case 'e':
          box.width = boxStartPos.width + dx;
          break;
      }

      // Ensure minimum size
      if (box.width > 10 && box.height > 10) {
        updateBox(selectedBox, box);
      }
      return;
    }

    if (!isDrawing || currentTool !== 'box') return;

    const width = pos.x - startPos.x;
    const height = pos.y - startPos.y;

    setCurrentBox({
      x: width < 0 ? pos.x : startPos.x,
      y: height < 0 ? pos.y : startPos.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Auto-solve region selection - add region to array
    if (isSelectingAutoSolveRegion && currentAutoSolveRegion &&
        currentAutoSolveRegion.width > 10 && currentAutoSolveRegion.height > 10) {
      addAutoSolveRegion({ ...currentAutoSolveRegion });
      console.log(`✅ Region ${autoSolveRegions.length + 1} added:`, currentAutoSolveRegion);
      setStartPos({ x: 0, y: 0 });
      return;
    }

    // Brush box mode - finish stroke
    if (isBrushBoxMode && isDrawing && currentStroke.length > 1) {
      addBrushStroke({ points: [...currentStroke], size: brushBoxSize });
      setCurrentStroke([]);
      setIsDrawing(false);
      return;
    }

    if (isBrushBoxMode && isDrawing) {
      setIsDrawing(false);
      setCurrentStroke([]);
      return;
    }

    // Rotation mode - confirm rotation line
    if (isRotationMode && rotationLineStart && rotationLineEnd) {
      confirmRotation();
      return;
    }

    // Baseline mode - add baseline at current position
    if (isBaselineMode && tempBaselineY !== null) {
      addBaseline(tempBaselineY);
      return;
    }

    // Angled baseline mode - add angled baseline
    if (isAngledBaselineMode) {
      // First baseline: Draw line to set angle
      if (angledBaselines.length === 0 && angledBaselineLineStart && angledBaselineLineEnd) {
        const dx = angledBaselineLineEnd.x - angledBaselineLineStart.x;
        const dy = angledBaselineLineEnd.y - angledBaselineLineStart.y;
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = angleRad * (180 / Math.PI);

        // Calculate center point of the drawn line
        const centerX = (angledBaselineLineStart.x + angledBaselineLineEnd.x) / 2;
        const centerY = (angledBaselineLineStart.y + angledBaselineLineEnd.y) / 2;

        // Extend the line across the image
        const lineLength = 2000;
        const halfLength = lineLength / 2;

        const extendedStart = {
          x: centerX - Math.cos(angleRad) * halfLength,
          y: centerY - Math.sin(angleRad) * halfLength,
        };

        const extendedEnd = {
          x: centerX + Math.cos(angleRad) * halfLength,
          y: centerY + Math.sin(angleRad) * halfLength,
        };

        addAngledBaseline(extendedStart, extendedEnd, angleDeg);
        return;
      }

      // Subsequent baselines: Use stored angle from last baseline
      if (angledBaselines.length > 0 && tempAngledBaselinePos) {
        const lastBaseline = angledBaselines[angledBaselines.length - 1];
        const angleRad = lastBaseline.angle * (Math.PI / 180);

        // Create a line segment at the stored angle, centered at tempAngledBaselinePos
        // Make it long enough to span the entire image
        const lineLength = 2000;
        const halfLength = lineLength / 2;

        const start = {
          x: tempAngledBaselinePos.x - Math.cos(angleRad) * halfLength,
          y: tempAngledBaselinePos.y - Math.sin(angleRad) * halfLength,
        };

        const end = {
          x: tempAngledBaselinePos.x + Math.cos(angleRad) * halfLength,
          y: tempAngledBaselinePos.y + Math.sin(angleRad) * halfLength,
        };

        addAngledBaseline(start, end, lastBaseline.angle);
        return;
      }
    }

    if (isDraggingBox) {
      setIsDraggingBox(false);
      return;
    }

    if (isResizingBox) {
      setIsResizingBox(false, null);
      return;
    }

    if (isDrawing && currentBox && currentBox.width > 5 && currentBox.height > 5) {
      const currentChar = uniqueChars[currentCharIndex];
      addBox({
        ...currentBox,
        char: currentChar,
        charIndex: currentCharIndex,
      });

      // Check if all unique characters have been annotated
      const store = useAnnotatorStore.getState();
      const allBoxes = [...store.boxes, { char: currentChar, charIndex: currentCharIndex }];
      const annotatedChars = new Set(allBoxes.map(box => box.char));
      const allAnnotated = uniqueChars.every(char => annotatedChars.has(char));

      if (allAnnotated) {
        // All characters have been annotated - switch to pointer mode
        store.setCurrentTool('pointer');
        store.setCurrentCharIndex(-1);
      } else {
        // Find next character that doesn't have a box yet
        // First search forward from current position
        let nextIndex = currentCharIndex + 1;
        while (nextIndex < uniqueChars.length) {
          const hasBox = allBoxes.some(box => box.charIndex === nextIndex);
          if (!hasBox) break;
          nextIndex++;
        }

        // If nothing found forward, search from the beginning
        if (nextIndex >= uniqueChars.length) {
          nextIndex = 0;
          while (nextIndex < currentCharIndex) {
            const hasBox = allBoxes.some(box => box.charIndex === nextIndex);
            if (!hasBox) break;
            nextIndex++;
          }
        }

        // Move to next unannotated character if found
        if (nextIndex < uniqueChars.length) {
          const hasBox = allBoxes.some(box => box.charIndex === nextIndex);
          if (!hasBox) {
            store.setCurrentCharIndex(nextIndex);
          }
        }
      }
    }

    setIsDrawing(false);
    setCurrentBox(null);
  };

  const handleCanvasClick = (e) => {
    // Check if clicking on an existing box
    const pos = getMousePos(e);
    const clickedBoxIndex = boxes.findIndex(box =>
      pos.x >= box.x && pos.x <= box.x + box.width &&
      pos.y >= box.y && pos.y <= box.y + box.height
    );

    setSelectedBox(clickedBoxIndex >= 0 ? clickedBoxIndex : null);
  };

  // Keyboard shortcuts for zoom and brush
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Zoom shortcuts
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }

      // Brush size shortcuts
      if (isBrushBoxMode) {
        if (e.key === '[') {
          e.preventDefault();
          setBrushBoxSize(brushBoxSize - 5);
        } else if (e.key === ']') {
          e.preventDefault();
          setBrushBoxSize(brushBoxSize + 5);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom, isBrushBoxMode, brushBoxSize, setBrushBoxSize]);

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();

    // Calculate minimum zoom to allow 50% of viewport height
    let minZoom = 0.1;
    if (containerRef.current && image) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerHeight = containerRect.height;

      // Min zoom is 50% of viewport height
      minZoom = (containerHeight * 0.5) / image.height;
    }

    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(minZoom, Math.min(4.0, zoomLevel + delta));

    // Zoom toward cursor position
    if (canvasRef.current && newZoom !== zoomLevel) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();

      // Get mouse position relative to canvas
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Get mouse position in image coordinates (before zoom)
      const imageX = (mouseX - panOffset.x) / zoomLevel;
      const imageY = (mouseY - panOffset.y) / zoomLevel;

      // Calculate new pan offset to keep mouse position fixed
      const newPanX = mouseX - imageX * newZoom;
      const newPanY = mouseY - imageY * newZoom;

      useAnnotatorStore.getState().setZoomLevel(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    } else {
      useAnnotatorStore.getState().setZoomLevel(newZoom);
    }
  };

  if (!image) return null;

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <ToolPalette />
      <ZoomControls />

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white'
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={(e) => {
            // Clear temporary baseline if user leaves canvas while drawing
            if (isBaselineMode && tempBaselineY !== null) {
              setTempBaselineY(null);
            }

            // Clear temporary angled baseline if user leaves canvas while drawing
            if (isAngledBaselineMode) {
              setAngledBaselineLineStart(null);
              setAngledBaselineLineEnd(null);
              setTempAngledBaselinePos(null);
            }

            handleMouseUp(e);
            setHoveredBox(null);
            setHoverCorner(null);
            setCursorStyle('crosshair');
          }}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          style={{
            border: '2px solid #ddd',
            borderRadius: '8px',
            cursor: cursorStyle,
            display: 'block',
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`
          }}
        />
      </div>

      {/* Help messages */}
      {!isSelectingAutoSolveRegion && !isBrushBoxMode && (
        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded">
          Hold Space or Middle-Click to Pan
        </div>
      )}

      {isSelectingAutoSolveRegion && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          Draw one or more regions around text to auto-detect characters
        </div>
      )}

      {isBrushBoxMode && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          Paint over the character - Use [ / ] to adjust brush size
        </div>
      )}

      {isRotationMode && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          Draw a line along the desired baseline angle
        </div>
      )}

      {isBaselineMode && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          Click and drag to position baseline, release to confirm
        </div>
      )}
    </div>
  );
}
