import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import ToolPalette from './ToolPalette';
import RightModePanel from './RightModePanel';

export default function AnnotationCanvas() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const lastMouseUpdateRef = useRef(0);
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
  const animationFrameRef = useRef(null);
  
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
  const startZoomMode = useAnnotatorStore((state) => state.startZoomMode);
  const cancelZoom = useAnnotatorStore((state) => state.cancelZoom);
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
  const brushSizeDragStart = useAnnotatorStore((state) => state.brushSizeDragStart);
  const brushSizeStartValue = useAnnotatorStore((state) => state.brushSizeStartValue);
  const setBrushSizeDragStart = useAnnotatorStore((state) => state.setBrushSizeDragStart);
  const clearBrushSizeDrag = useAnnotatorStore((state) => state.clearBrushSizeDrag);
  
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
  
  // Zoom tool state
  const isZoomMode = useAnnotatorStore((state) => state.isZoomMode);
  const zoomDragStart = useAnnotatorStore((state) => state.zoomDragStart);
  const zoomStartLevel = useAnnotatorStore((state) => state.zoomStartLevel);
  const setZoomDragStart = useAnnotatorStore((state) => state.setZoomDragStart);
  const clearZoomDrag = useAnnotatorStore((state) => state.clearZoomDrag);
  const setZoomLevel = useAnnotatorStore((state) => state.setZoomLevel);
  
  const canvasStyle = useMemo(() => ({
    position: 'absolute',
    borderRadius: '8px',
    transformOrigin: '0 0',
    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`
  }), [panOffset.x, panOffset.y, zoomLevel]);
  
  // Use temp tool override if Cmd is held, otherwise use current tool
  const effectiveTool = tempToolOverride || currentTool;
  
  // Auto-fit image to view on mount and when container resizes
  useEffect(() => {
    if (!image || !containerRef.current) return;
    
    const container = containerRef.current;
    
    const doFit = () => {
      const containerRect = container.getBoundingClientRect();
      if (containerRect.width > 0 && containerRect.height > 0) {
        fitToView(image.width, image.height, containerRect.width, containerRect.height);
      }
    };
    
    // Initial fit
    doFit();
    
    // Fit on resize
    const resizeObserver = new ResizeObserver(() => {
      doFit();
    });
    resizeObserver.observe(container);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [image, fitToView]); // Run when image changes or fitToView updates
  
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
        cancelZoom();
        setCurrentTool('pointer');
      } else if (e.key === 'm' || e.key === 'M') {
        // M for box mode
        cancelBrushBox();
        cancelAutoSolve();
        cancelRotation();
        cancelBaseline();
        cancelAngledBaseline();
        cancelZoom();
        setCurrentTool('box');
      } else if (e.key === 'b' || e.key === 'B') {
        // B for brush
        if (!image) {
          alert('Please upload an image first.');
          return;
        }
        cancelZoom();
        startBrushBoxMode();
      } else if (e.key === 'z' || e.key === 'Z') {
        // Z for zoom
        if (!image) {
          alert('Please upload an image first.');
          return;
        }
        cancelBrushBox();
        cancelAutoSolve();
        cancelRotation();
        cancelBaseline();
        cancelAngledBaseline();
        startZoomMode();
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
    cancelZoom,
    startBrushBoxMode,
    startZoomMode
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
          isAngledBaselineMode,
          isZoomMode
        };
        setSavedModeState(modeState);
        
        // Cancel all active modes
        cancelBrushBox();
        cancelAutoSolve();
        cancelRotation();
        cancelBaseline();
        cancelAngledBaseline();
        cancelZoom();
        
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
        } else if (savedModeState.isZoomMode) {
          startZoomMode();
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
    isZoomMode,
    setCurrentTool,
    cancelBrushBox,
    cancelAutoSolve,
    cancelRotation,
    cancelBaseline,
    cancelAngledBaseline,
    cancelZoom,
    startBrushBoxMode,
    startAutoSolveRegionSelection,
    startRotationMode,
    startBaselineMode,
    startAngledBaselineMode,
    startZoomMode
  ]);
  
  
  
  // Replace your entire drawing useEffect with this:
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    
    // Cancel any pending frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Schedule draw on next frame (batches rapid state changes)
    animationFrameRef.current = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio * 2 || 1;
      
      // Calculate canvas size to fit rotated image without clipping
      const angleRad = Math.abs(imageRotation * Math.PI / 180);
      const cos = Math.abs(Math.cos(angleRad));
      const sin = Math.abs(Math.sin(angleRad));
      
      // Bounding box of rotated rectangle
      const canvasWidth = Math.ceil(image.width * cos + image.height * sin);
      const canvasHeight = Math.ceil(image.height * cos + image.width * sin);
      
      // Helper function to extend line to canvas edges
      const extendLineToCanvasEdges = (centerX, centerY, angleRad, canvasWidth, canvasHeight) => {
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        
        // Calculate intersections with all 4 edges
        const intersections = [];
        
        // Left edge (x = 0)
        if (cos !== 0) {
          const t = -centerX / cos;
          const y = centerY + t * sin;
          if (y >= 0 && y <= canvasHeight) {
            intersections.push({ x: 0, y, t });
          }
        }
        
        // Right edge (x = canvasWidth)
        if (cos !== 0) {
          const t = (canvasWidth - centerX) / cos;
          const y = centerY + t * sin;
          if (y >= 0 && y <= canvasHeight) {
            intersections.push({ x: canvasWidth, y, t });
          }
        }
        
        // Top edge (y = 0)
        if (sin !== 0) {
          const t = -centerY / sin;
          const x = centerX + t * cos;
          if (x >= 0 && x <= canvasWidth) {
            intersections.push({ x, y: 0, t });
          }
        }
        
        // Bottom edge (y = canvasHeight)
        if (sin !== 0) {
          const t = (canvasHeight - centerY) / sin;
          const x = centerX + t * cos;
          if (x >= 0 && x <= canvasHeight) {
            intersections.push({ x, y: canvasHeight, t });
          }
        }
        
        // Sort by parameter t (distance along line from center)
        intersections.sort((a, b) => a.t - b.t);
        
        // Return the two endpoints (one in each direction from center)
        if (intersections.length >= 2) {
          return {
            start: { x: intersections[0].x, y: intersections[0].y },
            end: { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y }
          };
        }
        
        // Fallback to original 2000px if something goes wrong
        return {
          start: { x: centerX - cos * 1000, y: centerY - sin * 1000 },
          end: { x: centerX + cos * 1000, y: centerY + sin * 1000 }
        };
      };
      
      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      
      ctx.scale(dpr, dpr);
      
      // Apply rotation (without pan - pan is applied via CSS transform)
      ctx.save();
      
      // Calculate offset to center the image in the larger canvas
      const offsetX = (canvasWidth - image.width) / 2;
      const offsetY = (canvasHeight - image.height) / 2;
      
      // Apply rotation if set
      if (imageRotation !== 0) {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(imageRotation * Math.PI / 180);
        ctx.translate(-centerX, -centerY);
      }
      
      // Draw image centered in the larger canvas
      ctx.drawImage(image, offsetX, offsetY, image.width, image.height);
      
      ctx.restore();
      
      // Draw existing boxes (scaled for zoom) - OUTSIDE rotation transform
      // UI sizes are divided by zoomLevel to remain constant on screen
      const uiScale = 1 / zoomLevel;
      
      boxes.forEach((box, index) => {
        const isSelected = selectedBox === index;
        const isHovered = hoveredBox === index && !isSelected;
        const isOrphaned = !uniqueChars.includes(box.char);
        
        // Skip rendering orphaned boxes
        if (isOrphaned) {
          return;
        }
        
        // Apply offset to box coordinates for drawing
        const drawX = box.x + offsetX;
        const drawY = box.y + offsetY;
        
        // Highlight hovered box with a fill
        if (isHovered) {
          ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
          ctx.fillRect(drawX, drawY, box.width, box.height);
        }
        
        ctx.strokeStyle = isSelected ? '#2196F3' : isHovered ? '#FF9800' : '#4CAF50';
        ctx.lineWidth = (isSelected ? 3 : isHovered ? 2.5 : 2) * uiScale;
        ctx.strokeRect(drawX, drawY, box.width, box.height);
        
        // Draw character label with smart positioning
        ctx.fillStyle = isSelected ? '#2196F3' : isHovered ? '#FF9800' : '#4CAF50';
        const fontSize = 16 * uiScale;
        ctx.font = `500 ${fontSize}px Antarctica, sans-serif`;
        
        const labelPadding = 4 * uiScale;
        const labelHeight = fontSize;
        let labelX = drawX + labelPadding;
        let labelY = drawY + labelHeight + labelPadding;
        
        if (box.y < labelHeight + labelPadding + 5 * uiScale) {
          labelY = (drawY + box.height) + labelHeight + labelPadding;
        }
        
        if (box.x < labelPadding) {
          labelX = offsetX + labelPadding;
        }
        
        ctx.fillText(box.char, labelX, labelY);
        
        // Draw star indicator if this is the selected variant
        const selectedVariantId = selectedVariants[box.charIndex] || 0;
        const isSelectedVariant = box.variantId === selectedVariantId;
        if (isSelectedVariant && boxes.filter(b => b.charIndex === box.charIndex).length > 1) {
          const starSize = 12 * uiScale;
          const starX = (drawX + box.width) - starSize - 2 * uiScale;
          const starY = drawY + starSize + 2 * uiScale;
          ctx.fillStyle = '#FFD700';
          ctx.font = `${starSize}px Antarctica, sans-serif`;
          ctx.fillText('⭐', starX, starY);
        }
        
        // Draw corner handles for selected or hovered box
        if (isSelected || isHovered) {
          const handleSize = 8 * uiScale;
          const corners = [
            { x: drawX, y: drawY },
            { x: (drawX + box.width), y: drawY },
            { x: drawX, y: (drawY + box.height) },
            { x: (drawX + box.width), y: (drawY + box.height) },
          ];
          
          corners.forEach(corner => {
            ctx.fillStyle = isSelected ? '#2196F3' : '#FF9800';
            ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1 * uiScale;
            ctx.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
          });
          
          // Draw edge handles
          const edgeHandleWidth = 20 * uiScale;
          const edgeHandleHeight = 6 * uiScale;
          const edges = [
            { x: (drawX + box.width / 2), y: drawY, type: 'horizontal' },
            { x: (drawX + box.width / 2), y: (drawY + box.height), type: 'horizontal' },
            { x: drawX, y: (drawY + box.height / 2), type: 'vertical' },
            { x: (drawX + box.width), y: (drawY + box.height / 2), type: 'vertical' },
          ];
          
          edges.forEach(edge => {
            ctx.fillStyle = isSelected ? '#2196F3' : '#FF9800';
            if (edge.type === 'horizontal') {
              ctx.fillRect(edge.x - edgeHandleWidth / 2, edge.y - edgeHandleHeight / 2, edgeHandleWidth, edgeHandleHeight);
              ctx.strokeStyle = 'white';
              ctx.lineWidth = 1 * uiScale;
              ctx.strokeRect(edge.x - edgeHandleWidth / 2, edge.y - edgeHandleHeight / 2, edgeHandleWidth, edgeHandleHeight);
            } else {
              ctx.fillRect(edge.x - edgeHandleHeight / 2, edge.y - edgeHandleWidth / 2, edgeHandleHeight, edgeHandleWidth);
              ctx.strokeStyle = 'white';
              ctx.lineWidth = 1 * uiScale;
              ctx.strokeRect(edge.x - edgeHandleHeight / 2, edge.y - edgeHandleWidth / 2, edgeHandleHeight, edgeHandleWidth);
            }
          });
        }
      });
      
      // Draw current box being drawn
      if (currentBox) {
        ctx.save();
        const drawX = currentBox.x + offsetX;
        const drawY = currentBox.y + offsetY;
        
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 2 * uiScale;
        ctx.setLineDash([5 * uiScale, 5 * uiScale]);
        ctx.strokeRect(drawX, drawY, currentBox.width, currentBox.height);
        ctx.setLineDash([]);
        
        const currentChar = uniqueChars[currentCharIndex];
        if (currentChar) {
          ctx.fillStyle = '#FF9800';
          const fontSize = 16 * uiScale;
          ctx.font = `500 ${fontSize}px Antarctica, sans-serif`;
          
          const labelPadding = 4 * uiScale;
          const labelHeight = fontSize;
          let labelX = drawX + labelPadding;
          let labelY = drawY + labelHeight + labelPadding;
          
          if (currentBox.y < labelHeight + labelPadding + 5 * uiScale) {
            labelY = (drawY + currentBox.height) + labelHeight + labelPadding;
          }
          
          if (currentBox.x < labelPadding) {
            labelX = offsetX + labelPadding;
          }
          
          ctx.fillText(currentChar, labelX, labelY);
        }
        
        ctx.restore();
      }
      
      // Draw auto-solve regions
      if (isSelectingAutoSolveRegion) {
        ctx.save();
        
        autoSolveRegions.forEach((region, index) => {
          const drawX = region.x + offsetX;
          const drawY = region.y + offsetY;
          
          ctx.strokeStyle = '#2196F3';
          ctx.lineWidth = 3 * uiScale;
          ctx.strokeRect(drawX, drawY, region.width, region.height);
          ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
          ctx.fillRect(drawX, drawY, region.width, region.height);
          
          ctx.fillStyle = '#2196F3';
          const fontSize = 20 * uiScale;
          ctx.font = `500 ${fontSize}px Antarctica, sans-serif`;
          ctx.fillText(`${index + 1}`, drawX + 8 * uiScale, drawY + 28 * uiScale);
        });
        
        if (currentAutoSolveRegion && currentAutoSolveRegion.width > 0 && currentAutoSolveRegion.height > 0) {
          const drawX = currentAutoSolveRegion.x + offsetX;
          const drawY = currentAutoSolveRegion.y + offsetY;
          
          ctx.strokeStyle = '#FF9800';
          ctx.lineWidth = 3 * uiScale;
          ctx.setLineDash([8 * uiScale, 8 * uiScale]);
          ctx.strokeRect(drawX, drawY, currentAutoSolveRegion.width, currentAutoSolveRegion.height);
          ctx.fillStyle = 'rgba(255, 152, 0, 0.1)';
          ctx.fillRect(drawX, drawY, currentAutoSolveRegion.width, currentAutoSolveRegion.height);
          ctx.setLineDash([]);
        }
        
        ctx.restore();
      }
      
      // Draw brush strokes
      if (isBrushBoxMode) {
        ctx.save();
        
        brushStrokes.forEach((stroke) => {
          const points = stroke.points || stroke;
          const strokeSize = stroke.size || brushBoxSize;
          
          if (points.length > 0) {
            ctx.strokeStyle = 'rgba(76, 175, 80, 0.6)';
            ctx.lineWidth = strokeSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
            for (let i = 1; i < points.length; i++) {
              ctx.lineTo(points[i].x + offsetX, points[i].y + offsetY);
            }
            ctx.stroke();
          }
        });
        
        if (currentStroke.length > 0) {
          ctx.strokeStyle = 'rgba(33, 150, 243, 0.8)';
          ctx.lineWidth = brushBoxSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          ctx.beginPath();
          ctx.moveTo(currentStroke[0].x + offsetX, currentStroke[0].y + offsetY);
          for (let i = 1; i < currentStroke.length; i++) {
            ctx.lineTo(currentStroke[i].x + offsetX, currentStroke[i].y + offsetY);
          }
          ctx.stroke();
        }
        
        if (mousePos.x > 0 && mousePos.y > 0 && !isDrawing) {
          ctx.strokeStyle = '#4CAF50';
          ctx.lineWidth = 2 * uiScale;
          ctx.beginPath();
          ctx.arc(mousePos.x + offsetX, mousePos.y + offsetY, (brushBoxSize / 2), 0, Math.PI * 2);
          ctx.stroke();
        }
        
        ctx.restore();
      }
      
      // Draw rotation line
      if (isRotationMode && rotationLineStart) {
        ctx.save();
        
        const startX = rotationLineStart.x + offsetX;
        const startY = rotationLineStart.y + offsetY;
        
        ctx.strokeStyle = '#9C27B0';
        ctx.lineWidth = 3 * uiScale;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        
        if (rotationLineEnd) {
          const endX = rotationLineEnd.x + offsetX;
          const endY = rotationLineEnd.y + offsetY;
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          ctx.fillStyle = '#9C27B0';
          ctx.beginPath();
          ctx.arc(startX, startY, 5 * uiScale, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(endX, endY, 5 * uiScale, 0, Math.PI * 2);
          ctx.fill();
          
          const dx = rotationLineEnd.x - rotationLineStart.x;
          const dy = rotationLineEnd.y - rotationLineStart.y;
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          
          if (lineLength > 30) {
            const angleRad = Math.atan2(dy, dx);
            const angleDeg = angleRad * (180 / Math.PI);
            
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            
            ctx.fillStyle = 'rgba(156, 39, 176, 0.9)';
            ctx.fillRect(midX - 40, midY - 20, 80, 30);
            ctx.fillStyle = 'white';
            ctx.font = `bold 14px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${angleDeg.toFixed(1)}°`, midX, midY);
          }
        } else {
          ctx.stroke();
          
          ctx.fillStyle = '#9C27B0';
          ctx.beginPath();
          ctx.arc(startX, startY, 5 * uiScale, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      }
      
      // Draw baselines
      if (baselines.length > 0 || (isBaselineMode && tempBaselineY !== null)) {
        ctx.save();
        
        baselines.forEach((baseline) => {
          const drawY = baseline.y + offsetY;
          
          ctx.strokeStyle = baseline.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 5]);
          ctx.beginPath();
          ctx.moveTo(0, drawY);
          ctx.lineTo(canvasWidth, drawY);
          ctx.stroke();
          ctx.setLineDash([]);
          
          ctx.fillStyle = baseline.color;
          ctx.font = `500 12px Antarctica, sans-serif`;
          ctx.fillText(`Baseline ${baseline.id}`, 5, drawY - 5);
        });
        
        if (isBaselineMode && tempBaselineY !== null) {
          const drawY = tempBaselineY + offsetY;
          
          ctx.strokeStyle = '#FF9800';
          ctx.lineWidth = 3 * uiScale;
          ctx.setLineDash([10, 5]);
          ctx.beginPath();
          ctx.moveTo(0, drawY);
          ctx.lineTo(canvasWidth, drawY);
          ctx.stroke();
          ctx.setLineDash([]);
          
          ctx.fillStyle = '#FF9800';
          ctx.font = `500 14px Antarctica, sans-serif`;
          ctx.fillText('New Baseline', 5, drawY - 5);
        }
        
        ctx.restore();
      }
      
      // Draw angled baselines
      if (angledBaselines.length > 0 || (isAngledBaselineMode && (angledBaselineLineStart || tempAngledBaselinePos))) {
        ctx.save();
        
        angledBaselines.forEach((baseline) => {
          const angleRad = baseline.angle * (Math.PI / 180);
          const centerX = (baseline.start.x + baseline.end.x) / 2;
          const centerY = (baseline.start.y + baseline.end.y) / 2;
          
          const extended = extendLineToCanvasEdges(centerX, centerY, angleRad, image.width, image.height);
          const extendedStart = extended.start;
          const extendedEnd = extended.end;
          
          ctx.strokeStyle = baseline.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 5]);
          ctx.beginPath();
          ctx.moveTo(extendedStart.x + offsetX, extendedStart.y + offsetY);
          ctx.lineTo(extendedEnd.x + offsetX, extendedEnd.y + offsetY);
          ctx.stroke();
          ctx.setLineDash([]);
          
          ctx.fillStyle = baseline.color;
          ctx.font = `500 12px Antarctica, sans-serif`;
          const midX = centerX + offsetX;
          const midY = centerY + offsetY;
          ctx.fillText(`Angled ${baseline.id} (${baseline.angle.toFixed(1)}°)`, midX + 5, midY - 5);
        });
        
        if (isAngledBaselineMode) {
          if (angledBaselines.length === 0 && angledBaselineLineStart && angledBaselineLineEnd) {
            const dx = angledBaselineLineEnd.x - angledBaselineLineStart.x;
            const dy = angledBaselineLineEnd.y - angledBaselineLineStart.y;
            const angleRad = Math.atan2(dy, dx);
            const angleDeg = angleRad * (180 / Math.PI);
            
            const centerX = (angledBaselineLineStart.x + angledBaselineLineEnd.x) / 2;
            const centerY = (angledBaselineLineStart.y + angledBaselineLineEnd.y) / 2;
            
            const extended = extendLineToCanvasEdges(centerX, centerY, angleRad, image.width, image.height);
            const extendedStart = extended.start;
            const extendedEnd = extended.end;
            
            ctx.strokeStyle = '#FF9800';
            ctx.lineWidth = 3 * uiScale;
            ctx.setLineDash([10, 5]);
            ctx.beginPath();
            ctx.moveTo(extendedStart.x + offsetX, extendedStart.y + offsetY);
            ctx.lineTo(extendedEnd.x + offsetX, extendedEnd.y + offsetY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = '#FF9800';
            ctx.font = `500 14px Antarctica, sans-serif`;
            ctx.fillText(`${angleDeg.toFixed(1)}°`, centerX + offsetX + 5, centerY + offsetY - 5);
          }
          else if (angledBaselines.length > 0 && tempAngledBaselinePos) {
            const lastBaseline = angledBaselines[angledBaselines.length - 1];
            const angleRad = lastBaseline.angle * (Math.PI / 180);
            
            const extended = extendLineToCanvasEdges(
              tempAngledBaselinePos.x,
              tempAngledBaselinePos.y,
              angleRad,
              image.width,
              image.height
            );
            const start = extended.start;
            const end = extended.end;
            
            ctx.strokeStyle = '#FF9800';
            ctx.lineWidth = 3 * uiScale;
            ctx.setLineDash([10, 5]);
            ctx.beginPath();
            ctx.moveTo(start.x + offsetX, start.y + offsetY);
            ctx.lineTo(end.x + offsetX, end.y + offsetY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = '#FF9800';
            ctx.font = `500 14px Antarctica, sans-serif`;
            ctx.fillText('New Angled Baseline', tempAngledBaselinePos.x + offsetX + 5, tempAngledBaselinePos.y + offsetY - 5);
          }
        }
        
        ctx.restore();
      }
    });
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    image, boxes, currentBox, selectedBox, hoveredBox, zoomLevel, 
    isSelectingAutoSolveRegion, autoSolveRegions, currentAutoSolveRegion,
    isBrushBoxMode, brushStrokes, currentStroke, brushBoxSize, mousePos, 
    isDrawing, imageRotation, isRotationMode, rotationLineStart, rotationLineEnd,
    baselines, isBaselineMode, tempBaselineY, angledBaselines, isAngledBaselineMode,
    angledBaselineLineStart, angledBaselineLineEnd, tempAngledBaselinePos,
    uniqueChars, currentCharIndex, selectedVariants
  ]);
  const getMousePos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const angleRad = Math.abs(imageRotation * Math.PI / 180);
    const cos = Math.abs(Math.cos(angleRad));
    const sin = Math.abs(Math.sin(angleRad));
    const canvasWidth = image.width * cos + image.height * sin;
    const canvasHeight = image.height * cos + image.width * sin;
    const offsetX = (canvasWidth - image.width) / 2;
    const offsetY = (canvasHeight - image.height) / 2;
    
    const x = (e.clientX - rect.left) / zoomLevel - offsetX;
    const y = (e.clientY - rect.top) / zoomLevel - offsetY;
    
    return { x, y };
  }, [image, imageRotation, zoomLevel]);
  
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
    
    // Brush box mode - start drawing a stroke or adjusting brush size
    if (isBrushBoxMode) {
      // Shift+drag to adjust brush size
      if (e.shiftKey) {
        setBrushSizeDragStart(e.clientX, brushBoxSize);
        return;
      }
      
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
    
    // Zoom mode - drag to zoom
    if (isZoomMode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      // Store client position for delta calculation and image position for zoom center
      const imageX = (e.clientX - rect.left) / zoomLevel;
      const imageY = (e.clientY - rect.top) / zoomLevel;
      setZoomDragStart({
        clientX: e.clientX,
        clientY: e.clientY,
        imageX,
        imageY,
        panX: panOffset.x,
        panY: panOffset.y
      }, zoomLevel);
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
          // Stay in pointer mode to allow manipulation
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
      const now = performance.now();
      if (now - lastMouseUpdateRef.current > 16) { // ~60fps max
        setMousePos(pos);
        lastMouseUpdateRef.current = now;
      }
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
      
      // Brush size drag adjustment
      if (isBrushBoxMode && brushSizeDragStart !== null) {
        const deltaX = e.clientX - brushSizeDragStart;
        // 1px drag = 1px brush size change
        const newSize = brushSizeStartValue + deltaX;
        setBrushBoxSize(newSize);
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
      
      // Zoom mode - drag to change zoom level
      if (isZoomMode && zoomDragStart) {
        // Horizontal drag changes zoom: right = zoom in, left = zoom out
        const deltaX = e.clientX - zoomDragStart.clientX;
        // Scale factor: 200px drag = double/half zoom
        const zoomFactor = Math.pow(2, deltaX / 200);
        
        // Calculate min zoom similar to wheel
        let minZoom = 0.1;
        if (containerRef.current && image) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const containerHeight = containerRect.height;
          minZoom = (containerHeight * 0.5) / image.height;
        }
        
        const newZoom = Math.max(minZoom, Math.min(4.0, zoomStartLevel * zoomFactor));
        
        // Zoom toward the original cursor position (same as wheel zoom)
        if (newZoom !== zoomLevel) {
          const scaleDifference = newZoom - zoomStartLevel;
          const newPanX = zoomDragStart.panX - zoomDragStart.imageX * scaleDifference;
          const newPanY = zoomDragStart.panY - zoomDragStart.imageY * scaleDifference;
          
          setZoomLevel(newZoom);
          setPanOffset({ x: newPanX, y: newPanY });
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
        
        // Brush size drag end
        if (isBrushBoxMode && brushSizeDragStart !== null) {
          clearBrushSizeDrag();
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
        
        // Zoom mode - end drag
        if (isZoomMode && zoomDragStart) {
          clearZoomDrag();
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
            
            // Extend the line to canvas edges
            const canvasWidth = image.width;
            const canvasHeight = image.height;
            
            // Calculate intersections with canvas edges
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const intersections = [];
            
            // Left edge (x = 0)
            if (cos !== 0) {
              const t = -centerX / cos;
              const y = centerY + t * sin;
              if (y >= 0 && y <= canvasHeight) intersections.push({ x: 0, y, t });
            }
            
            // Right edge (x = canvasWidth)
            if (cos !== 0) {
              const t = (canvasWidth - centerX) / cos;
              const y = centerY + t * sin;
              if (y >= 0 && y <= canvasHeight) intersections.push({ x: canvasWidth, y, t });
            }
            
            // Top edge (y = 0)
            if (sin !== 0) {
              const t = -centerY / sin;
              const x = centerX + t * cos;
              if (x >= 0 && x <= canvasWidth) intersections.push({ x, y: 0, t });
            }
            
            // Bottom edge (y = canvasHeight)
            if (sin !== 0) {
              const t = (canvasHeight - centerY) / sin;
              const x = centerX + t * cos;
              if (x >= 0 && x <= canvasHeight) intersections.push({ x, y: canvasHeight, t });
            }
            
            intersections.sort((a, b) => a.t - b.t);
            
            const extendedStart = intersections.length >= 2
            ? { x: intersections[0].x, y: intersections[0].y }
            : { x: centerX - cos * 1000, y: centerY - sin * 1000 };
            
            const extendedEnd = intersections.length >= 2
            ? { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y }
            : { x: centerX + cos * 1000, y: centerY + sin * 1000 };
            
            addAngledBaseline(extendedStart, extendedEnd, angleDeg);
            return;
          }
          
          // Subsequent baselines: Use stored angle from last baseline
          if (angledBaselines.length > 0 && tempAngledBaselinePos) {
            const lastBaseline = angledBaselines[angledBaselines.length - 1];
            const angleRad = lastBaseline.angle * (Math.PI / 180);
            
            // Extend to canvas edges
            const canvasWidth = image.width;
            const canvasHeight = image.height;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const intersections = [];
            
            // Left edge (x = 0)
            if (cos !== 0) {
              const t = -tempAngledBaselinePos.x / cos;
              const y = tempAngledBaselinePos.y + t * sin;
              if (y >= 0 && y <= canvasHeight) intersections.push({ x: 0, y, t });
            }
            
            // Right edge (x = canvasWidth)
            if (cos !== 0) {
              const t = (canvasWidth - tempAngledBaselinePos.x) / cos;
              const y = tempAngledBaselinePos.y + t * sin;
              if (y >= 0 && y <= canvasHeight) intersections.push({ x: canvasWidth, y, t });
            }
            
            // Top edge (y = 0)
            if (sin !== 0) {
              const t = -tempAngledBaselinePos.y / sin;
              const x = tempAngledBaselinePos.x + t * cos;
              if (x >= 0 && x <= canvasWidth) intersections.push({ x, y: 0, t });
            }
            
            // Bottom edge (y = canvasHeight)
            if (sin !== 0) {
              const t = (canvasHeight - tempAngledBaselinePos.y) / sin;
              const x = tempAngledBaselinePos.x + t * cos;
              if (x >= 0 && x <= canvasHeight) intersections.push({ x, y: canvasHeight, t });
            }
            
            intersections.sort((a, b) => a.t - b.t);
            
            const start = intersections.length >= 2
            ? { x: intersections[0].x, y: intersections[0].y }
            : { x: tempAngledBaselinePos.x - cos * 1000, y: tempAngledBaselinePos.y - sin * 1000 };
            
            const end = intersections.length >= 2
            ? { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y }
            : { x: tempAngledBaselinePos.x + cos * 1000, y: tempAngledBaselinePos.y + sin * 1000 };
            
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
      
      const handleCanvasClick = useCallback((e) => {
        const pos = getMousePos(e);
        const clickedBoxIndex = boxes.findIndex(box =>
          pos.x >= box.x && pos.x <= box.x + box.width &&
          pos.y >= box.y && pos.y <= box.y + box.height
        );
        setSelectedBox(clickedBoxIndex >= 0 ? clickedBoxIndex : null);
      }, [boxes, setSelectedBox, getMousePos]);
      
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
            if (image && containerRef.current) {
              const containerRect = containerRef.current.getBoundingClientRect();
              resetZoom(image.width, image.height, containerRect.width, containerRect.height);
            }
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
      
      // Mouse wheel zoom (pinch) and pan (scroll)
      const handleWheel = useCallback((e) => {
        e.preventDefault();
        
        // Detect if this is likely a mouse wheel vs trackpad
        // Key differences:
        // - Mouse wheels: deltaMode 1 (line), or deltaMode 0 with discrete integer steps, no deltaX
        // - Trackpads: deltaMode 0 with smooth/fractional deltas, often have deltaX
        // - Trackpad pinch: sends ctrlKey = true
        
        // Trackpad pinch gestures send wheel events with ctrlKey set to true
        const isPinchZoom = e.ctrlKey;
        
        // Mouse wheels use deltaMode 1 (DOM_DELTA_LINE)
        const isLineMode = e.deltaMode === 1;
        
        // In pixel mode (deltaMode 0), mouse wheels have:
        // - No horizontal movement (deltaX === 0)
        // - Integer deltaY values (trackpads often have fractional)
        const isDiscreteScroll = e.deltaMode === 0 &&
        e.deltaX === 0 &&
        Number.isInteger(e.deltaY);
        
        const isMouseWheel = isLineMode || isDiscreteScroll;
        
        // Mouse wheel should always zoom, trackpad pinch should zoom, trackpad scroll should pan
        const shouldZoom = isPinchZoom || isMouseWheel;
        
        if (shouldZoom) {
          // Zoom behavior
          // Calculate minimum zoom to allow 50% of viewport height
          let minZoom = 0.1;
          if (containerRef.current && image) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const containerHeight = containerRect.height;
            
            // Min zoom is 50% of viewport height
            minZoom = (containerHeight * 0.5) / image.height;
          }
          
          // Use smaller delta for smoother zoom
          // Mouse wheel needs smaller multiplier since deltaY is larger
          // Pinch zoom needs higher multiplier for responsiveness
          const multiplier = isMouseWheel ? 0.002 : 0.025;
          const delta = -e.deltaY * multiplier;
          const newZoom = Math.max(minZoom, Math.min(4.0, zoomLevel + delta));
          
          // Zoom toward cursor position (react-zoom-pan-pinch approach)
          if (canvasRef.current && newZoom !== zoomLevel) {
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            
            // Get mouse position relative to canvas in image coordinates
            const mouseX = (e.clientX - rect.left) / zoomLevel;
            const mouseY = (e.clientY - rect.top) / zoomLevel;
            
            // Calculate new position using react-zoom-pan-pinch formula
            const scaleDifference = newZoom - zoomLevel;
            const newPanX = panOffset.x - mouseX * scaleDifference;
            const newPanY = panOffset.y - mouseY * scaleDifference;
            
            useAnnotatorStore.getState().setZoomLevel(newZoom);
            setPanOffset({ x: newPanX, y: newPanY });
          } else {
            useAnnotatorStore.getState().setZoomLevel(newZoom);
          }
        } else {
          // Trackpad two-finger scroll to pan
          const panMultiplier = 1.5;
          const newPanX = panOffset.x - e.deltaX * panMultiplier;
          const newPanY = panOffset.y - e.deltaY * panMultiplier;
          setPanOffset({ x: newPanX, y: newPanY });
        }
      }, [zoomLevel, panOffset, image]);
      
      // Attach wheel event listener to container (not canvas) so it works in white space
      useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
          container.removeEventListener('wheel', handleWheel);
        };
      }, [handleWheel]);
      
      if (!image) return null;
      
      return (
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
        <ToolPalette />
        <RightModePanel />
        
        <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={(e) => {
          // Clear temporary baseline if user leaves container while drawing
          if (isBaselineMode && tempBaselineY !== null) {
            setTempBaselineY(null);
          }
          
          // Clear temporary angled baseline if user leaves container while drawing
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
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: '8px',
          background: 'white',
          cursor: cursorStyle
        }}
        >
        <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={canvasStyle}
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