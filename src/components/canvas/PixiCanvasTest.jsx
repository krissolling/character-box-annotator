import { useEffect, useState, useCallback, useRef } from 'react';
import { usePixiRenderer } from '../../renderer/usePixiRenderer';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import ToolPalette from './ToolPalette';
import RightModePanel from './RightModePanel';

/**
 * Test component for pixi.js renderer
 * This will be used to verify the renderer works before full integration
 */
export default function PixiCanvasTest() {
  const image = useAnnotatorStore(state => state.image);
  const boxes = useAnnotatorStore(state => state.boxes);
  const uniqueChars = useAnnotatorStore(state => state.uniqueChars);
  const selectedBox = useAnnotatorStore(state => state.selectedBox);
  const setSelectedBox = useAnnotatorStore(state => state.setSelectedBox);
  const bringBoxToFront = useAnnotatorStore(state => state.bringBoxToFront);
  const updateBox = useAnnotatorStore(state => state.updateBox);
  const addBox = useAnnotatorStore(state => state.addBox);

  // Tool states
  const currentTool = useAnnotatorStore(state => state.currentTool);
  const currentCharIndex = useAnnotatorStore(state => state.currentCharIndex);
  const setCurrentCharIndex = useAnnotatorStore(state => state.setCurrentCharIndex);
  const text = useAnnotatorStore(state => state.text);
  const isBrushBoxMode = useAnnotatorStore(state => state.isBrushBoxMode);
  const brushBoxSize = useAnnotatorStore(state => state.brushBoxSize);
  const brushStrokes = useAnnotatorStore(state => state.brushStrokes);
  const addBrushStroke = useAnnotatorStore(state => state.addBrushStroke);
  const baselines = useAnnotatorStore(state => state.baselines);
  const angledBaselines = useAnnotatorStore(state => state.angledBaselines);
  const addBaseline = useAnnotatorStore(state => state.addBaseline);
  const addAngledBaseline = useAnnotatorStore(state => state.addAngledBaseline);
  const updateBaseline = useAnnotatorStore(state => state.updateBaseline);
  const updateAngledBaseline = useAnnotatorStore(state => state.updateAngledBaseline);
  const setIsDraggingBaseline = useAnnotatorStore(state => state.setIsDraggingBaseline);
  const confirmRotation = useAnnotatorStore(state => state.confirmRotation);
  const imageRotation = useAnnotatorStore(state => state.imageRotation);
  const tempBaselineY = useAnnotatorStore(state => state.tempBaselineY);
  const setTempBaselineY = useAnnotatorStore(state => state.setTempBaselineY);
  const setRotationLineStart = useAnnotatorStore(state => state.setRotationLineStart);
  const setRotationLineEnd = useAnnotatorStore(state => state.setRotationLineEnd);
  const rotationLineStart = useAnnotatorStore(state => state.rotationLineStart);
  const rotationLineEnd = useAnnotatorStore(state => state.rotationLineEnd);
  const angledBaselineLineStart = useAnnotatorStore(state => state.angledBaselineLineStart);
  const angledBaselineLineEnd = useAnnotatorStore(state => state.angledBaselineLineEnd);
  const tempAngledBaselinePos = useAnnotatorStore(state => state.tempAngledBaselinePos);
  const setAngledBaselineLineStart = useAnnotatorStore(state => state.setAngledBaselineLineStart);
  const setAngledBaselineLineEnd = useAnnotatorStore(state => state.setAngledBaselineLineEnd);
  const setTempAngledBaselinePos = useAnnotatorStore(state => state.setTempAngledBaselinePos);

  // Zoom/pan state from Zustand (for syncing with ZoomControls)
  const zoomLevel = useAnnotatorStore(state => state.zoomLevel);
  const panOffset = useAnnotatorStore(state => state.panOffset);
  const setZoomLevel = useAnnotatorStore(state => state.setZoomLevel);
  const setPanOffset = useAnnotatorStore(state => state.setPanOffset);
  const fitToView = useAnnotatorStore(state => state.fitToView);

  // Zoom tool state
  const isZoomMode = useAnnotatorStore(state => state.isZoomMode);
  const zoomDragStart = useAnnotatorStore(state => state.zoomDragStart);
  const zoomStartLevel = useAnnotatorStore(state => state.zoomStartLevel);
  const setZoomDragStart = useAnnotatorStore(state => state.setZoomDragStart);
  const clearZoomDrag = useAnnotatorStore(state => state.clearZoomDrag);

  // Tool actions for keyboard shortcuts
  const setCurrentTool = useAnnotatorStore(state => state.setCurrentTool);
  const startBrushBoxMode = useAnnotatorStore(state => state.startBrushBoxMode);
  const cancelBrushBox = useAnnotatorStore(state => state.cancelBrushBox);
  const startZoomMode = useAnnotatorStore(state => state.startZoomMode);
  const cancelZoom = useAnnotatorStore(state => state.cancelZoom);
  const cancelAutoSolve = useAnnotatorStore(state => state.cancelAutoSolve);
  const cancelRotation = useAnnotatorStore(state => state.cancelRotation);
  const cancelBaseline = useAnnotatorStore(state => state.cancelBaseline);
  const cancelAngledBaseline = useAnnotatorStore(state => state.cancelAngledBaseline);
  const isSelectingAutoSolveRegion = useAnnotatorStore(state => state.isSelectingAutoSolveRegion);
  const autoSolveRegions = useAnnotatorStore(state => state.autoSolveRegions);
  const currentAutoSolveRegion = useAnnotatorStore(state => state.currentAutoSolveRegion);
  const addAutoSolveRegion = useAnnotatorStore(state => state.addAutoSolveRegion);
  const setCurrentAutoSolveRegion = useAnnotatorStore(state => state.setCurrentAutoSolveRegion);
  const isRotationMode = useAnnotatorStore(state => state.isRotationMode);
  const isBaselineMode = useAnnotatorStore(state => state.isBaselineMode);
  const isAngledBaselineMode = useAnnotatorStore(state => state.isAngledBaselineMode);
  const startAutoSolveRegionSelection = useAnnotatorStore(state => state.startAutoSolveRegionSelection);
  const startRotationMode = useAnnotatorStore(state => state.startRotationMode);
  const startBaselineMode = useAnnotatorStore(state => state.startBaselineMode);
  const startAngledBaselineMode = useAnnotatorStore(state => state.startAngledBaselineMode);

  // Temp tool override state for Cmd key
  const [tempToolOverride, setTempToolOverride] = useState(null);
  const [savedModeState, setSavedModeState] = useState(null);

  // Track if we're currently updating from renderer (to prevent feedback loops)
  const isUpdatingFromRenderer = useRef(false);

  const renderer = usePixiRenderer({
    tileSize: 512,
    maxLevels: 4
  });

  // Load image when it changes
  useEffect(() => {
    if (!renderer.isReady || !image) return;

    console.log('🎨 Loading image into pixi renderer...');
    renderer.loadImage(image)
      .then(() => {
        console.log('✅ Image loaded successfully');

        // Fit to view after image loads
        const pixiRenderer = renderer.getRenderer();
        if (pixiRenderer && renderer.canvasRef?.current) {
          const containerRect = renderer.canvasRef.current.parentElement.getBoundingClientRect();
          fitToView(image.width, image.height, containerRect.width, containerRect.height);
        }
      })
      .catch(err => {
        console.error('❌ Failed to load image:', err);
      });
  }, [renderer.isReady, image, fitToView]);

  // Update boxes when they change
  const caseSensitive = useAnnotatorStore(state => state.caseSensitive);

  useEffect(() => {
    if (!renderer.isReady) return;

    // Filter to valid boxes but preserve original indices
    // Respect case sensitivity setting
    const validBoxesWithIndices = boxes
      .map((box, originalIndex) => ({ ...box, originalIndex }))
      .filter(box => {
        if (caseSensitive) {
          return uniqueChars.includes(box.char);
        } else {
          // Case-insensitive: check if any uniqueChar matches ignoring case
          return uniqueChars.some(uc => uc.toLowerCase() === box.char.toLowerCase());
        }
      });
    console.log(`📦 Updating ${validBoxesWithIndices.length} boxes (total: ${boxes.length}, uniqueChars: ${uniqueChars.join('')}, caseSensitive: ${caseSensitive})`);
    if (boxes.length !== validBoxesWithIndices.length) {
      const filtered = boxes.filter(b => {
        if (caseSensitive) return !uniqueChars.includes(b.char);
        return !uniqueChars.some(uc => uc.toLowerCase() === b.char.toLowerCase());
      });
      console.log('📦 Filtered out boxes:', filtered.map(b => b.char));
    }
    renderer.setBoxes(validBoxesWithIndices);
  }, [renderer.isReady, boxes, uniqueChars, caseSensitive]);

  // Sync selected box to renderer
  useEffect(() => {
    if (!renderer.isReady) return;
    renderer.setSelectedBox(selectedBox);
  }, [renderer.isReady, selectedBox]);

  // Sync baselines to renderer
  useEffect(() => {
    if (!renderer.isReady) return;
    const pixiRenderer = renderer.getRenderer();
    if (pixiRenderer) {
      pixiRenderer.setBaselines(baselines, angledBaselines);
    }
  }, [renderer.isReady, baselines, angledBaselines]);

  // Sync image rotation to renderer
  useEffect(() => {
    if (!renderer.isReady) return;
    const pixiRenderer = renderer.getRenderer();
    if (pixiRenderer) {
      pixiRenderer.setImageRotation(imageRotation);
    }
  }, [renderer.isReady, imageRotation]);

  // Sync brush strokes to overlay (and clear when exiting brush mode)
  // Note: We don't depend on brushBoxSize here because the mouse move handler
  // updates the overlay with the current brush size during drag operations
  useEffect(() => {
    if (!renderer.isReady) return;
    const pixiRenderer = renderer.getRenderer();
    if (!pixiRenderer) return;

    if (isBrushBoxMode) {
      // Update overlay with current brush strokes
      pixiRenderer.setOverlayData({
        brushStrokes: brushStrokes,
        brushSize: brushBoxSize
      });
    } else {
      // Clear brush overlay when not in brush mode
      pixiRenderer.setOverlayData({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer.isReady, brushStrokes, isBrushBoxMode]);

  // Sync Zustand zoom/pan to renderer (for ZoomControls buttons)
  useEffect(() => {
    if (!renderer.isReady || isUpdatingFromRenderer.current) return;
    const pixiRenderer = renderer.getRenderer();
    if (!pixiRenderer) return;

    const stage = pixiRenderer.app.stage;
    const currentZoom = stage.scale.x;
    const currentPanX = stage.position.x;
    const currentPanY = stage.position.y;

    // Only update if values differ (with small tolerance for floating point)
    const zoomDiff = Math.abs(currentZoom - zoomLevel) > 0.001;
    const panDiff = Math.abs(currentPanX - panOffset.x) > 0.5 || Math.abs(currentPanY - panOffset.y) > 0.5;

    if (zoomDiff || panDiff) {
      renderer.setZoom(zoomLevel);
      renderer.setPan(panOffset.x, panOffset.y);
    }
  }, [renderer.isReady, zoomLevel, panOffset]);

  // Drag state (declared before useEffects that reference them)
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [boxStart, setBoxStart] = useState(null);
  const [resizeCorner, setResizeCorner] = useState(null);
  const [cursor, setCursor] = useState('default');
  const [draggedBoxPreview, setDraggedBoxPreview] = useState(null);

  // Drawing state
  const [isDrawingBox, setIsDrawingBox] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentBoxDraw, setCurrentBoxDraw] = useState(null);

  // Brush state
  const [currentStroke, setCurrentStroke] = useState([]);
  const [isDrawingStroke, setIsDrawingStroke] = useState(false);
  const [brushSizeDragStart, setBrushSizeDragStart] = useState(null); // For shift+drag brush resize
  const [brushSizeStartValue, setBrushSizeStartValue] = useState(40);
  const [brushSizeDragCenter, setBrushSizeDragCenter] = useState(null); // Locked position for brush circle during resize
  const setBrushBoxSize = useAnnotatorStore(state => state.setBrushBoxSize);

  // Baseline/rotation state
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [lineStart, setLineStart] = useState(null);
  const [lineEnd, setLineEnd] = useState(null);

  // Baseline dragging state
  const [draggingBaseline, setDraggingBaseline] = useState(null); // { id, type: 'horizontal' | 'angled', startY }
  const [baselineDragStartY, setBaselineDragStartY] = useState(null);

  // Auto-solve region drawing state
  const [isDrawingRegion, setIsDrawingRegion] = useState(false);
  const [regionStart, setRegionStart] = useState(null);

  // Keyboard shortcuts for tool selection (v, m, b, z)
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
        if (!image) return;
        cancelZoom();
        startBrushBoxMode();
      } else if (e.key === 'z' || e.key === 'Z') {
        // Z for zoom
        if (!image) return;
        cancelBrushBox();
        cancelAutoSolve();
        cancelRotation();
        cancelBaseline();
        cancelAngledBaseline();
        startZoomMode();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
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
      // Check for Meta key (Cmd on Mac)
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
        // Don't restore if currently dragging or resizing
        if (isDragging || isResizing) {
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
    isDragging,
    isResizing,
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

  // Mouse interaction
  const handleMouseMove = (e) => {
    if (!renderer.isReady) return;

    const rect = renderer.canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pixiRenderer = renderer.getRenderer();
    const stage = pixiRenderer?.app.stage;
    if (!stage) return;

    const imageX = (x - stage.position.x) / stage.scale.x;
    const imageY = (y - stage.position.y) / stage.scale.y;

    // Handle box drawing
    if (isDrawingBox && drawStart) {
      const width = Math.abs(imageX - drawStart.x);
      const height = Math.abs(imageY - drawStart.y);
      const boxX = Math.min(imageX, drawStart.x);
      const boxY = Math.min(imageY, drawStart.y);

      setCurrentBoxDraw({ x: boxX, y: boxY, width, height });

      // Update overlay
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({
          currentBox: { x: boxX, y: boxY, width, height }
        });
      }
      return;
    }

    // Handle dragging existing baseline
    if (draggingBaseline && baselineDragStartY !== null) {
      const deltaY = imageY - baselineDragStartY;

      if (draggingBaseline.type === 'horizontal') {
        const newY = draggingBaseline.originalY + deltaY;
        updateBaseline(draggingBaseline.id, newY);
      } else if (draggingBaseline.type === 'angled') {
        const newStartY = draggingBaseline.originalStartY + deltaY;
        const newEndY = draggingBaseline.originalEndY + deltaY;
        updateAngledBaseline(draggingBaseline.id, newStartY, newEndY);
      }
      return;
    }

    // Handle baseline tool dragging (new baseline)
    if (currentTool === 'baseline' && isDrawingLine) {
      setTempBaselineY(imageY);

      // Update overlay to show temp baseline being dragged
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({
          tempBaseline: imageY
        });
      }
      return;
    }

    // Handle zoom tool drag
    if (isZoomMode && zoomDragStart) {
      // Horizontal drag changes zoom: right = zoom in, left = zoom out
      const deltaX = e.clientX - zoomDragStart.clientX;
      // Scale factor: 200px drag = double/half zoom
      const zoomFactor = Math.pow(2, deltaX / 200);

      const newZoom = Math.max(0.1, Math.min(4.0, zoomStartLevel * zoomFactor));

      // Zoom toward the original cursor position
      if (newZoom !== stage.scale.x) {
        const scaleDifference = newZoom - zoomStartLevel;
        const newPanX = zoomDragStart.panX - zoomDragStart.imageX * scaleDifference;
        const newPanY = zoomDragStart.panY - zoomDragStart.imageY * scaleDifference;

        // Apply to renderer
        stage.scale.set(newZoom, newZoom);
        stage.position.x = newPanX;
        stage.position.y = newPanY;

        // Sync to Zustand store
        isUpdatingFromRenderer.current = true;
        setZoomLevel(newZoom);
        setPanOffset({ x: newPanX, y: newPanY });
        requestAnimationFrame(() => {
          isUpdatingFromRenderer.current = false;
        });

        pixiRenderer.needsRender = true;
      }
      return;
    }

    // Handle angled baseline dragging
    if (currentTool === 'angled') {
      if (angledBaselines.length === 0 && isDrawingLine && lineStart) {
        // First baseline: drawing the line to set angle
        setLineEnd({ x: imageX, y: imageY });
        setAngledBaselineLineEnd({ x: imageX, y: imageY });

        pixiRenderer.setOverlayData({
          drawingLine: {
            start: lineStart,
            end: { x: imageX, y: imageY },
            tool: 'angled'
          }
        });
      } else if (angledBaselines.length > 0 && isDrawingLine && tempAngledBaselinePos) {
        // Subsequent baselines: dragging with locked angle
        setTempAngledBaselinePos({ x: imageX, y: imageY });

        const lastBaseline = angledBaselines[angledBaselines.length - 1];
        pixiRenderer.setOverlayData({
          tempAngledBaseline: {
            pos: { x: imageX, y: imageY },
            angle: lastBaseline.angle
          }
        });
      }
      return;
    }

    // Handle rotation line drawing
    if (currentTool === 'rotate' && isDrawingLine && lineStart) {
      setLineEnd({ x: imageX, y: imageY });
      setRotationLineEnd({ x: imageX, y: imageY });

      // Update overlay to show the line being drawn
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({
          drawingLine: {
            start: lineStart,
            end: { x: imageX, y: imageY },
            tool: 'rotate'
          }
        });
      }
      return;
    }

    // Handle brush size drag (shift+drag)
    if (isBrushBoxMode && brushSizeDragStart !== null && brushSizeDragCenter) {
      const deltaX = e.clientX - brushSizeDragStart;
      // 1px drag = 1px brush size change
      const newSize = Math.max(5, Math.min(600, brushSizeStartValue + deltaX));
      setBrushBoxSize(newSize);

      // Update brush cursor to show new size at locked center position
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({
          brushStrokes: brushStrokes,
          brushSize: newSize,
          brushCursor: { x: brushSizeDragCenter.x, y: brushSizeDragCenter.y, size: newSize }
        });
      }
      return;
    }

    // Handle brushing
    if (isDrawingStroke) {
      const newStroke = [...currentStroke, { x: imageX, y: imageY }];
      setCurrentStroke(newStroke);

      // Update overlay - show both completed strokes and current stroke
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({
          brushStrokes: brushStrokes,
          currentStroke: newStroke,
          brushSize: brushBoxSize
        });
      }
      return;
    }

    // Handle auto-solve region drawing
    if (isDrawingRegion && regionStart) {
      const x = Math.min(regionStart.x, imageX);
      const y = Math.min(regionStart.y, imageY);
      const width = Math.abs(imageX - regionStart.x);
      const height = Math.abs(imageY - regionStart.y);
      const newRegion = { x, y, width, height };
      setCurrentAutoSolveRegion(newRegion);

      // Update overlay with current region
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({
          autoSolveRegions: autoSolveRegions,
          currentAutoSolveRegion: newRegion
        });
      }
      return;
    }

    // Handle dragging
    if (isDragging && selectedBox !== null && dragStart && boxStart) {
      // Reuse pixiRenderer from above (already declared at line 98)
      const dx = imageX - dragStart.x;
      const dy = imageY - dragStart.y;

      // Use preview state instead of updating store
      const preview = {
        index: selectedBox,
        x: boxStart.x + dx,
        y: boxStart.y + dy,
        width: boxStart.width,
        height: boxStart.height
      };
      setDraggedBoxPreview(preview);

      // Force immediate render with preview
      const rend = renderer.getRenderer();
      if (rend) {
        rend.draggedBoxPreview = preview;
        rend.needsRender = true;
      }
      return;
    }

    // Handle resizing
    if (isResizing && selectedBox !== null && dragStart && boxStart && resizeCorner) {
      // Reuse pixiRenderer from above (already declared at line 98)
      const dx = imageX - dragStart.x;
      const dy = imageY - dragStart.y;

      let newBox = { ...boxStart };

      switch (resizeCorner) {
        case 'nw':
          newBox.x = boxStart.x + dx;
          newBox.y = boxStart.y + dy;
          newBox.width = boxStart.width - dx;
          newBox.height = boxStart.height - dy;
          break;
        case 'ne':
          newBox.y = boxStart.y + dy;
          newBox.width = boxStart.width + dx;
          newBox.height = boxStart.height - dy;
          break;
        case 'sw':
          newBox.x = boxStart.x + dx;
          newBox.width = boxStart.width - dx;
          newBox.height = boxStart.height + dy;
          break;
        case 'se':
          newBox.width = boxStart.width + dx;
          newBox.height = boxStart.height + dy;
          break;
        case 'n':
          newBox.y = boxStart.y + dy;
          newBox.height = boxStart.height - dy;
          break;
        case 's':
          newBox.height = boxStart.height + dy;
          break;
        case 'w':
          newBox.x = boxStart.x + dx;
          newBox.width = boxStart.width - dx;
          break;
        case 'e':
          newBox.width = boxStart.width + dx;
          break;
      }

      if (newBox.width > 10 && newBox.height > 10) {
        // Use preview state instead of updating store
        const preview = {
          index: selectedBox,
          ...newBox
        };
        setDraggedBoxPreview(preview);

        // Force immediate render with preview
        pixiRenderer.draggedBoxPreview = preview;
        pixiRenderer.needsRender = true;
      }
      return;
    }

    // Handle cursor based on current state and tool
    // Priority: active operations > tool-specific > hover

    // Active operations take precedence
    if (isPanning) {
      setCursor('grabbing');
      return;
    }
    if (isDragging) {
      setCursor('move');
      return;
    }
    if (isResizing) {
      // Keep current resize cursor
      return;
    }
    if (isDrawingBox) {
      setCursor('crosshair');
      return;
    }
    if (isDrawingStroke) {
      setCursor('none'); // Hide cursor while drawing brush strokes
      return;
    }
    if (isDrawingLine) {
      setCursor('crosshair');
      return;
    }
    if (draggingBaseline) {
      setCursor('ns-resize');
      return;
    }
    if (zoomDragStart) {
      setCursor('ew-resize'); // Horizontal drag cursor for zoom
      return;
    }
    if (brushSizeDragStart !== null && brushSizeDragCenter) {
      setCursor('default'); // Show normal cursor while resizing brush (circle is locked in place)
      // Keep showing brush circle at locked position
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({
          brushStrokes: brushStrokes,
          brushSize: brushBoxSize,
          brushCursor: { x: brushSizeDragCenter.x, y: brushSizeDragCenter.y, size: brushBoxSize }
        });
      }
      return;
    }

    // Tool-specific cursors
    if (currentTool === 'box') {
      setCursor('crosshair');
      return;
    }
    if (isBrushBoxMode) {
      setCursor('none'); // Custom brush cursor rendered by canvas
      // Show brush cursor circle at mouse position
      if (pixiRenderer && !isDrawingStroke) {
        pixiRenderer.setOverlayData({
          brushStrokes: brushStrokes,
          brushSize: brushBoxSize,
          brushCursor: { x: imageX, y: imageY, size: brushBoxSize }
        });
      }
      return;
    }
    if (isZoomMode) {
      setCursor('zoom-in');
      return;
    }
    if (isSelectingAutoSolveRegion) {
      setCursor('crosshair');
      // Update overlay to show regions (even when not drawing)
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({
          autoSolveRegions: autoSolveRegions,
          currentAutoSolveRegion: currentAutoSolveRegion
        });
      }
      return;
    }
    if (currentTool === 'rotate') {
      setCursor('crosshair');
      return;
    }
    if (currentTool === 'baseline') {
      // Check if hovering near an existing baseline
      const BASELINE_HIT_THRESHOLD = 15;
      const nearbyBaseline = baselines.find(b => Math.abs(b.y - imageY) < BASELINE_HIT_THRESHOLD);
      if (nearbyBaseline) {
        setCursor('ns-resize'); // Show resize cursor when near existing baseline
      } else {
        setCursor('crosshair');
      }
      return;
    }
    if (currentTool === 'angled') {
      // Check if hovering near an existing angled baseline
      const BASELINE_HIT_THRESHOLD = 15;
      const nearbyAngledBaseline = angledBaselines.find(b => {
        const slope = (b.endY - b.startY) / (b.endX - b.startX);
        const baselineYAtX = b.startY + slope * (imageX - b.startX);
        return Math.abs(baselineYAtX - imageY) < BASELINE_HIT_THRESHOLD;
      });
      if (nearbyAngledBaseline) {
        setCursor('ns-resize'); // Show resize cursor when near existing baseline
      } else {
        setCursor('crosshair');
      }
      return;
    }

    // Pointer mode: show hover cursors for boxes
    if (currentTool === 'pointer') {
      const handleSize = 30 / stage.scale.x;
      const edgeThreshold = 15 / stage.scale.x;

      // Helper functions for hover detection
      const getCornerCursor = (box, px, py) => {
        const corners = [
          { x: box.x, y: box.y, cursor: 'nwse-resize' },
          { x: box.x + box.width, y: box.y, cursor: 'nesw-resize' },
          { x: box.x, y: box.y + box.height, cursor: 'nesw-resize' },
          { x: box.x + box.width, y: box.y + box.height, cursor: 'nwse-resize' }
        ];
        for (const corner of corners) {
          if (Math.abs(px - corner.x) < handleSize && Math.abs(py - corner.y) < handleSize) {
            return corner.cursor;
          }
        }
        return null;
      };

      const getEdgeCursor = (box, px, py) => {
        const inExtendedXRange = px >= box.x - edgeThreshold && px <= box.x + box.width + edgeThreshold;
        const inExtendedYRange = py >= box.y - edgeThreshold && py <= box.y + box.height + edgeThreshold;

        if (inExtendedXRange && Math.abs(py - box.y) < edgeThreshold) return 'ns-resize';
        if (inExtendedXRange && Math.abs(py - (box.y + box.height)) < edgeThreshold) return 'ns-resize';
        if (inExtendedYRange && Math.abs(px - box.x) < edgeThreshold) return 'ew-resize';
        if (inExtendedYRange && Math.abs(px - (box.x + box.width)) < edgeThreshold) return 'ew-resize';
        return null;
      };

      const isPointInBox = (box, px, py) => {
        return px >= box.x && px <= box.x + box.width &&
               py >= box.y && py <= box.y + box.height;
      };

      // Check corners on all boxes (top to bottom)
      for (let i = boxes.length - 1; i >= 0; i--) {
        const box = boxes[i];
        if (!box) continue;
        const cornerCursor = getCornerCursor(box, imageX, imageY);
        if (cornerCursor) {
          setCursor(cornerCursor);
          renderer.setHoveredBox(i);
          return;
        }
      }

      // Check edges on all boxes (top to bottom)
      for (let i = boxes.length - 1; i >= 0; i--) {
        const box = boxes[i];
        if (!box) continue;
        const edgeCursor = getEdgeCursor(box, imageX, imageY);
        if (edgeCursor) {
          setCursor(edgeCursor);
          renderer.setHoveredBox(i);
          return;
        }
      }

      // Check body on all boxes (top to bottom)
      for (let i = boxes.length - 1; i >= 0; i--) {
        const box = boxes[i];
        if (!box) continue;
        if (isPointInBox(box, imageX, imageY)) {
          setCursor('move');
          renderer.setHoveredBox(i);
          return;
        }
      }

      // No box under cursor
      renderer.setHoveredBox(null);
      setCursor('default');
      return;
    }

    // Default cursor
    setCursor('default');
  };

  const handleMouseClick = (e) => {
    if (!renderer.isReady) return;

    const rect = renderer.canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const boxItem = renderer.findBoxAtPoint(x, y);
    setSelectedBox(boxItem ? boxItem.boxIndex : null);
  };

  // Pan with mouse drag
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Performance monitoring
  const [perfStats, setPerfStats] = useState(null);

  // Update performance stats periodically
  useEffect(() => {
    if (!renderer.isReady) return;

    const updateStats = () => {
      const pixiRenderer = renderer.getRenderer();
      if (!pixiRenderer) return;

      const tileStats = pixiRenderer.tileManager.getStats();
      const viewport = pixiRenderer.getViewport();
      const visible = pixiRenderer.spatialIndex.search(viewport);

      setPerfStats({
        tiles: tileStats.readyTiles,
        visibleBoxes: visible.length,
        totalBoxes: boxes.length,
        memory: performance.memory ?
          Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB' :
          'N/A',
        zoom: Math.round(pixiRenderer.app.stage.scale.x * 100) + '%'
      });
    };

    // Update immediately
    updateStats();

    // Then every 2 seconds
    const interval = setInterval(updateStats, 2000);

    return () => clearInterval(interval);
  }, [renderer.isReady, boxes.length]);

  const handleMouseDown = (e) => {
    if (!renderer.isReady) return;

    // Middle click for pan
    if (e.button === 1 || e.spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const rect = renderer.canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pixiRenderer = renderer.getRenderer();
    const stage = pixiRenderer.app.stage;
    const imageX = (x - stage.position.x) / stage.scale.x;
    const imageY = (y - stage.position.y) / stage.scale.y;

    // Handle box drawing tool
    if (currentTool === 'box') {
      setIsDrawingBox(true);
      setDrawStart({ x: imageX, y: imageY });
      return;
    }

    // Handle brush tool
    if (isBrushBoxMode) {
      // Shift+drag to resize brush
      if (e.shiftKey) {
        setBrushSizeDragStart(e.clientX);
        setBrushSizeStartValue(brushBoxSize);
        setBrushSizeDragCenter({ x: imageX, y: imageY }); // Lock the center position
        // Immediately show brush cursor at locked position
        if (pixiRenderer) {
          pixiRenderer.setOverlayData({
            brushStrokes: brushStrokes,
            brushSize: brushBoxSize,
            brushCursor: { x: imageX, y: imageY, size: brushBoxSize }
          });
        }
        return;
      }
      setIsDrawingStroke(true); // Start drawing a new stroke
      setCurrentStroke([{ x: imageX, y: imageY }]);
      return;
    }

    // Handle zoom tool - drag to zoom
    if (isZoomMode) {
      const currentZoom = stage.scale.x;
      setZoomDragStart({
        clientX: e.clientX,
        clientY: e.clientY,
        imageX,
        imageY,
        panX: stage.position.x,
        panY: stage.position.y
      }, currentZoom);
      return;
    }

    // Handle auto-solve region selection - only allow one region at a time
    if (isSelectingAutoSolveRegion && autoSolveRegions.length === 0) {
      setIsDrawingRegion(true);
      setRegionStart({ x: imageX, y: imageY });
      setCurrentAutoSolveRegion({ x: imageX, y: imageY, width: 0, height: 0 });
      return;
    }

    // Handle baseline tool (click-drag-release)
    if (currentTool === 'baseline') {
      // Check if clicking near an existing horizontal baseline to drag it
      const BASELINE_HIT_THRESHOLD = 15; // pixels
      const nearbyBaseline = baselines.find(b => Math.abs(b.y - imageY) < BASELINE_HIT_THRESHOLD);

      if (nearbyBaseline) {
        // Start dragging existing baseline
        setDraggingBaseline({ id: nearbyBaseline.id, type: 'horizontal', originalY: nearbyBaseline.y });
        setBaselineDragStartY(imageY);
        setIsDraggingBaseline(true);
        return;
      }

      // No nearby baseline - create new one
      setIsDrawingLine(true);
      setTempBaselineY(imageY);
      return;
    }

    // Handle angled baseline tool
    if (currentTool === 'angled') {
      // Check if clicking near an existing angled baseline to drag it
      const BASELINE_HIT_THRESHOLD = 15;
      const nearbyAngledBaseline = angledBaselines.find(b => {
        // Check distance from click point to the baseline line
        // For simplicity, check if Y is near the baseline at this X position
        const slope = (b.endY - b.startY) / (b.endX - b.startX);
        const baselineYAtX = b.startY + slope * (imageX - b.startX);
        return Math.abs(baselineYAtX - imageY) < BASELINE_HIT_THRESHOLD;
      });

      if (nearbyAngledBaseline) {
        // Start dragging existing angled baseline
        setDraggingBaseline({ id: nearbyAngledBaseline.id, type: 'angled', originalStartY: nearbyAngledBaseline.startY, originalEndY: nearbyAngledBaseline.endY });
        setBaselineDragStartY(imageY);
        setIsDraggingBaseline(true);
        return;
      }

      if (angledBaselines.length === 0) {
        // First baseline: start drawing a line to set angle
        setIsDrawingLine(true);
        setLineStart({ x: imageX, y: imageY });
        setLineEnd({ x: imageX, y: imageY });
        setAngledBaselineLineStart({ x: imageX, y: imageY });
        setAngledBaselineLineEnd({ x: imageX, y: imageY });
      } else {
        // Subsequent baselines: start dragging with locked angle
        setIsDrawingLine(true);
        setTempAngledBaselinePos({ x: imageX, y: imageY });
      }
      return;
    }

    // Handle rotation tool (draw line)
    if (currentTool === 'rotate') {
      setIsDrawingLine(true);
      setLineStart({ x: imageX, y: imageY });
      setLineEnd({ x: imageX, y: imageY });
      setRotationLineStart({ x: imageX, y: imageY });
      setRotationLineEnd({ x: imageX, y: imageY });
      return;
    }

    // Pointer mode: check ALL boxes from top to bottom for interaction
    // Priority: corners > edges > body (this allows selecting underlying boxes by their handles)
    const handleSize = 30 / stage.scale.x;
    const edgeThreshold = 15 / stage.scale.x;

    // Helper to check if point is inside box
    const isPointInBox = (box, px, py) => {
      return px >= box.x && px <= box.x + box.width &&
             py >= box.y && py <= box.y + box.height;
    };

    // Helper to get corner at point
    const getCornerAtPoint = (box, px, py) => {
      const corners = [
        { name: 'nw', x: box.x, y: box.y },
        { name: 'ne', x: box.x + box.width, y: box.y },
        { name: 'sw', x: box.x, y: box.y + box.height },
        { name: 'se', x: box.x + box.width, y: box.y + box.height }
      ];
      for (const corner of corners) {
        if (Math.abs(px - corner.x) < handleSize && Math.abs(py - corner.y) < handleSize) {
          return corner.name;
        }
      }
      return null;
    };

    // Helper to get edge at point
    const getEdgeAtPoint = (box, px, py) => {
      const inExtendedXRange = px >= box.x - edgeThreshold && px <= box.x + box.width + edgeThreshold;
      const inExtendedYRange = py >= box.y - edgeThreshold && py <= box.y + box.height + edgeThreshold;

      if (inExtendedXRange && Math.abs(py - box.y) < edgeThreshold) return 'n';
      if (inExtendedXRange && Math.abs(py - (box.y + box.height)) < edgeThreshold) return 's';
      if (inExtendedYRange && Math.abs(px - box.x) < edgeThreshold) return 'w';
      if (inExtendedYRange && Math.abs(px - (box.x + box.width)) < edgeThreshold) return 'e';
      return null;
    };

    // Pass 1: Check corners on ALL boxes (top to bottom)
    for (let i = boxes.length - 1; i >= 0; i--) {
      const box = boxes[i];
      if (!box) continue;

      const corner = getCornerAtPoint(box, imageX, imageY);
      if (corner) {
        setSelectedBox(i);
        bringBoxToFront(i);
        setIsResizing(true);
        setResizeCorner(corner);
        setDragStart({ x: imageX, y: imageY });
        setBoxStart({ ...box });
        return;
      }
    }

    // Pass 2: Check edges on ALL boxes (top to bottom)
    for (let i = boxes.length - 1; i >= 0; i--) {
      const box = boxes[i];
      if (!box) continue;

      const edge = getEdgeAtPoint(box, imageX, imageY);
      if (edge) {
        setSelectedBox(i);
        bringBoxToFront(i);
        setIsResizing(true);
        setResizeCorner(edge);
        setDragStart({ x: imageX, y: imageY });
        setBoxStart({ ...box });
        return;
      }
    }

    // Pass 3: Check body (inside) on ALL boxes (top to bottom)
    for (let i = boxes.length - 1; i >= 0; i--) {
      const box = boxes[i];
      if (!box) continue;

      if (isPointInBox(box, imageX, imageY)) {
        setSelectedBox(i);
        setIsDragging(true);
        setDragStart({ x: imageX, y: imageY });
        setBoxStart({ ...box });
        return;
      }
    }

    // Clicking on empty space deselects
    setSelectedBox(null);
  };

  const handleMouseUp = () => {
    // Finish box drawing
    if (isDrawingBox && currentBoxDraw && currentBoxDraw.width > 10 && currentBoxDraw.height > 10) {
      const char = text[currentCharIndex];
      if (char) {
        // Count existing boxes for this character to determine variantId
        const existingVariants = boxes.filter(b => b.char === char).length;

        addBox({
          x: currentBoxDraw.x,
          y: currentBoxDraw.y,
          width: currentBoxDraw.width,
          height: currentBoxDraw.height,
          char,
          charIndex: currentCharIndex,
          variantId: existingVariants
        });

        console.log('✅ Box added:', char, currentBoxDraw);

        // Auto-advance to next unannotated character
        // Get updated boxes list (including the one we just added)
        const updatedBoxes = [...boxes, { charIndex: currentCharIndex }];
        const annotatedIndices = new Set(updatedBoxes.map(b => b.charIndex));

        // Check if all unique characters have been annotated
        const allAnnotated = uniqueChars.every((_, idx) => annotatedIndices.has(idx));

        if (allAnnotated) {
          // All characters annotated - switch to pointer mode
          setCurrentCharIndex(-1);
          setCurrentTool('pointer');
        } else {
          // Find next character that doesn't have a box yet
          // First search forward from current position
          let nextIndex = currentCharIndex + 1;
          while (nextIndex < uniqueChars.length) {
            if (!annotatedIndices.has(nextIndex)) break;
            nextIndex++;
          }

          // If nothing found forward, search from the beginning
          if (nextIndex >= uniqueChars.length) {
            nextIndex = 0;
            while (nextIndex < currentCharIndex) {
              if (!annotatedIndices.has(nextIndex)) break;
              nextIndex++;
            }
          }

          setCurrentCharIndex(nextIndex);
        }
      }

      // Clear drawing state
      setIsDrawingBox(false);
      setDrawStart(null);
      setCurrentBoxDraw(null);

      // Clear overlay
      const pixiRenderer = renderer.getRenderer();
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({});
      }

      return;
    }

    // Handle baseline drag end (moving existing baseline)
    if (draggingBaseline) {
      setDraggingBaseline(null);
      setBaselineDragStartY(null);
      setIsDraggingBaseline(false);
      return;
    }

    // Handle baseline mouseup (confirm placement of new baseline)
    if (currentTool === 'baseline' && isDrawingLine && tempBaselineY !== null) {
      addBaseline(tempBaselineY);
      setIsDrawingLine(false);
      setTempBaselineY(null);

      // Clear overlay
      const pixiRenderer = renderer.getRenderer();
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({});
      }

      return;
    }

    // Handle zoom tool drag end
    if (isZoomMode && zoomDragStart) {
      clearZoomDrag();
      return;
    }

    // Finish line drawing (first angled baseline or rotation)
    if (isDrawingLine && lineStart && lineEnd) {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 10) { // Minimum line length
        if (currentTool === 'angled' && angledBaselines.length === 0) {
          // First angled baseline: extend to image edges
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const angleRad = angle * (Math.PI / 180);

          // Calculate center point
          const centerX = (lineStart.x + lineEnd.x) / 2;
          const centerY = (lineStart.y + lineEnd.y) / 2;

          // Get image dimensions
          const pixiRenderer = renderer.getRenderer();
          const width = pixiRenderer?.sourceImage?.width || 10000;
          const height = pixiRenderer?.sourceImage?.height || 10000;

          // Calculate edge intersections
          const cos = Math.cos(angleRad);
          const sin = Math.sin(angleRad);
          const intersections = [];

          // Left edge
          if (cos !== 0) {
            const t = -centerX / cos;
            const y = centerY + t * sin;
            if (y >= 0 && y <= height) intersections.push({ x: 0, y, t });
          }

          // Right edge
          if (cos !== 0) {
            const t = (width - centerX) / cos;
            const y = centerY + t * sin;
            if (y >= 0 && y <= height) intersections.push({ x: width, y, t });
          }

          // Top edge
          if (sin !== 0) {
            const t = -centerY / sin;
            const x = centerX + t * cos;
            if (x >= 0 && x <= width) intersections.push({ x, y: 0, t });
          }

          // Bottom edge
          if (sin !== 0) {
            const t = (height - centerY) / sin;
            const x = centerX + t * cos;
            if (x >= 0 && x <= width) intersections.push({ x, y: height, t });
          }

          // Sort and get extremes
          intersections.sort((a, b) => a.t - b.t);

          let start, end;
          if (intersections.length >= 2) {
            start = { x: intersections[0].x, y: intersections[0].y };
            end = { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y };
          } else {
            // Fallback
            const extendLength = Math.max(width, height) * 2;
            start = { x: centerX - cos * extendLength, y: centerY - sin * extendLength };
            end = { x: centerX + cos * extendLength, y: centerY + sin * extendLength };
          }

          addAngledBaseline(start, end, angle);

          // Clear Zustand state
          setAngledBaselineLineStart(null);
          setAngledBaselineLineEnd(null);
        } else if (currentTool === 'rotate') {
          // Always rotate to make the line horizontal
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const currentRotation = imageRotation || 0;
          // Negate angle to make line horizontal
          const newRotation = currentRotation - angle;

          // Update rotation in store
          useAnnotatorStore.setState({ imageRotation: newRotation });
        }
      }

      // Clear line drawing state
      setIsDrawingLine(false);
      setLineStart(null);
      setLineEnd(null);

      // Clear overlay
      const pixiRenderer = renderer.getRenderer();
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({});
      }

      return;
    }

    // Handle subsequent angled baseline mouseup (template mode)
    if (currentTool === 'angled' && angledBaselines.length > 0 && tempAngledBaselinePos && isDrawingLine) {
      const lastBaseline = angledBaselines[angledBaselines.length - 1];
      const angleRad = lastBaseline.angle * (Math.PI / 180);

      // Calculate extended line at cursor position with locked angle
      const pixiRenderer = renderer.getRenderer();
      const width = pixiRenderer?.sourceImage?.width || 10000;
      const height = pixiRenderer?.sourceImage?.height || 10000;

      // Use the lineIntersection utility to extend to edges
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      const intersections = [];

      // Left edge (x = 0)
      if (cos !== 0) {
        const t = -tempAngledBaselinePos.x / cos;
        const y = tempAngledBaselinePos.y + t * sin;
        if (y >= 0 && y <= height) intersections.push({ x: 0, y, t });
      }

      // Right edge (x = width)
      if (cos !== 0) {
        const t = (width - tempAngledBaselinePos.x) / cos;
        const y = tempAngledBaselinePos.y + t * sin;
        if (y >= 0 && y <= height) intersections.push({ x: width, y, t });
      }

      // Top edge (y = 0)
      if (sin !== 0) {
        const t = -tempAngledBaselinePos.y / sin;
        const x = tempAngledBaselinePos.x + t * cos;
        if (x >= 0 && x <= width) intersections.push({ x, y: 0, t });
      }

      // Bottom edge (y = height)
      if (sin !== 0) {
        const t = (height - tempAngledBaselinePos.y) / sin;
        const x = tempAngledBaselinePos.x + t * cos;
        if (x >= 0 && x <= width) intersections.push({ x, y: height, t });
      }

      // Sort by t and get extremes
      intersections.sort((a, b) => a.t - b.t);

      let start, end;
      if (intersections.length >= 2) {
        start = { x: intersections[0].x, y: intersections[0].y };
        end = { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y };
      } else {
        // Fallback
        const extendLength = Math.max(width, height) * 2;
        start = {
          x: tempAngledBaselinePos.x - cos * extendLength,
          y: tempAngledBaselinePos.y - sin * extendLength
        };
        end = {
          x: tempAngledBaselinePos.x + cos * extendLength,
          y: tempAngledBaselinePos.y + sin * extendLength
        };
      }

      addAngledBaseline(start, end, lastBaseline.angle);

      // Clear temp state
      setIsDrawingLine(false);
      setTempAngledBaselinePos(null);

      // Clear overlay
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({});
      }

      return;
    }

    // Finish brush size drag
    if (brushSizeDragStart !== null) {
      setBrushSizeDragStart(null);
      setBrushSizeDragCenter(null);
      return;
    }

    // Finish auto-solve region drawing
    if (isDrawingRegion && currentAutoSolveRegion) {
      // Only add region if it has some size
      if (currentAutoSolveRegion.width > 10 && currentAutoSolveRegion.height > 10) {
        addAutoSolveRegion({ ...currentAutoSolveRegion });
        console.log(`✅ Region ${autoSolveRegions.length + 1} added:`, currentAutoSolveRegion);
      }
      setIsDrawingRegion(false);
      setRegionStart(null);

      // Update overlay to show all regions
      const pixiRenderer = renderer.getRenderer();
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({
          autoSolveRegions: [...autoSolveRegions, currentAutoSolveRegion],
          currentAutoSolveRegion: null
        });
      }
      return;
    }

    // Finish current brush stroke
    if (isDrawingStroke && currentStroke.length > 2) {
      // Add completed stroke to store
      addBrushStroke({ points: currentStroke, size: brushBoxSize });
      setCurrentStroke([]);
      setIsDrawingStroke(false);

      console.log(`🖌️ Stroke completed, total strokes: ${brushStrokes.length + 1}`);

      // Update overlay to show all strokes (including the one we just added)
      const pixiRenderer = renderer.getRenderer();
      if (pixiRenderer) {
        // Note: brushStrokes will update on next render via store subscription
        pixiRenderer.setOverlayData({
          brushStrokes: [...brushStrokes, { points: currentStroke, size: brushBoxSize }],
          brushSize: brushBoxSize
        });
      }

      return;
    }

    // Commit dragged/resized box to store
    if (draggedBoxPreview && selectedBox !== null) {
      updateBox(selectedBox, {
        x: draggedBoxPreview.x,
        y: draggedBoxPreview.y,
        width: draggedBoxPreview.width,
        height: draggedBoxPreview.height
      });
      setDraggedBoxPreview(null);
    }

    setIsPanning(false);
    setIsDragging(false);
    setIsResizing(false);
    setDragStart(null);
    setBoxStart(null);
    setResizeCorner(null);
    setIsDrawingBox(false);
    setDrawStart(null);
    setCurrentBoxDraw(null);
    // Note: isBrushBoxMode is managed by Zustand store, not local state
    setCurrentStroke([]);
    setIsDrawingStroke(false);

    // Clear any drag preview from overlay
    const pixiRenderer = renderer.getRenderer();
    if (pixiRenderer) {
      pixiRenderer.draggedBoxPreview = null;
      pixiRenderer.setOverlayData({});
      pixiRenderer.needsRender = true;
    }
  };

  const handlePanMove = (e) => {
    if (!isPanning || !renderer.isReady) return;

    const pixiRenderer = renderer.getRenderer();
    if (!pixiRenderer) return;

    const deltaX = e.clientX - panStart.x;
    const deltaY = e.clientY - panStart.y;

    const currentPan = pixiRenderer.app.stage.position;
    const newPanX = currentPan.x + deltaX;
    const newPanY = currentPan.y + deltaY;

    renderer.setPan(newPanX, newPanY);

    // Sync to Zustand store
    isUpdatingFromRenderer.current = true;
    setPanOffset({ x: newPanX, y: newPanY });
    requestAnimationFrame(() => {
      isUpdatingFromRenderer.current = false;
    });

    setPanStart({ x: e.clientX, y: e.clientY });
  };

  // Zoom with wheel, pan with trackpad scroll
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    // Get fresh renderer reference
    const pixiRenderer = renderer.getRenderer?.();
    if (!pixiRenderer || !renderer.canvasRef?.current) return;

    // Detect if this is likely a mouse wheel vs trackpad
    // Key differences:
    // - Mouse wheels: deltaMode 1 (line), or larger discrete jumps with minimal deltaX
    // - Trackpads: smooth small deltas, often with deltaX for diagonal scrolling
    // - Trackpad pinch: sends ctrlKey = true

    // Trackpad pinch gestures send wheel events with ctrlKey set to true
    const isPinchZoom = e.ctrlKey;

    // Mouse wheels use deltaMode 1 (DOM_DELTA_LINE)
    const isLineMode = e.deltaMode === 1;

    // Mouse wheel heuristics for deltaMode 0:
    // - No/minimal horizontal movement (trackpad diagonal scroll has significant deltaX)
    // - Larger discrete jumps (mouse wheels typically send bigger deltas)
    const absDeltaX = Math.abs(e.deltaX);
    const absDeltaY = Math.abs(e.deltaY);
    const hasMinimalHorizontal = absDeltaX < 1;
    const hasSignificantVertical = absDeltaY > 1;
    const isMouseWheelHeuristic = hasMinimalHorizontal && hasSignificantVertical;

    const isMouseWheel = isLineMode || isMouseWheelHeuristic;

    // Mouse wheel should always zoom, trackpad pinch should zoom, trackpad scroll should pan
    const shouldZoom = isPinchZoom || isMouseWheel;

    const stage = pixiRenderer.app.stage;

    if (shouldZoom) {
      // Zoom behavior
      const rect = renderer.canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldZoom = stage.scale.x;

      // Use smaller delta for smoother zoom
      // Mouse wheel needs smaller multiplier since deltaY is larger
      // Pinch zoom needs higher multiplier for responsiveness
      const multiplier = isMouseWheel ? 0.002 : 0.025;
      const delta = -e.deltaY * multiplier;
      const newZoom = Math.max(0.1, Math.min(4.0, oldZoom + delta));

      // Calculate zoom point in world coordinates
      const worldX = (mouseX - stage.position.x) / oldZoom;
      const worldY = (mouseY - stage.position.y) / oldZoom;

      // Apply new zoom
      stage.scale.set(newZoom, newZoom);

      // Adjust position to keep mouse point stable
      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;
      stage.position.x = newPanX;
      stage.position.y = newPanY;

      // Sync to Zustand store (mark as updating from renderer to prevent feedback loop)
      isUpdatingFromRenderer.current = true;
      setZoomLevel(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
      requestAnimationFrame(() => {
        isUpdatingFromRenderer.current = false;
      });

      // Force immediate render
      pixiRenderer.needsRender = true;
    } else {
      // Trackpad two-finger scroll to pan
      const panMultiplier = 1.5;
      const currentPan = stage.position;

      const newPanX = currentPan.x - e.deltaX * panMultiplier;
      const newPanY = currentPan.y - e.deltaY * panMultiplier;

      renderer.setPan(newPanX, newPanY);

      // Sync to Zustand store
      isUpdatingFromRenderer.current = true;
      setPanOffset({ x: newPanX, y: newPanY });
      requestAnimationFrame(() => {
        isUpdatingFromRenderer.current = false;
      });
    }
  }, [renderer, setZoomLevel, setPanOffset]);

  if (!image) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#888',
        fontSize: '14px'
      }}>
        Upload an image to test WebGL renderer
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Tool Palette and Mode Panel */}
      <ToolPalette />
      <RightModePanel />

      {/* Performance Stats - compact version */}
      {renderer.isReady && perfStats && (
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          zIndex: 100,
          background: 'rgba(0, 0, 0, 0.6)',
          color: 'rgba(255, 255, 255, 0.8)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '9px',
          fontFamily: 'Monaco, monospace',
          lineHeight: '1.4'
        }}>
          <span style={{ color: '#4ade80' }}>WebGL</span> {perfStats.zoom} • {perfStats.visibleBoxes}/{perfStats.totalBoxes} boxes
        </div>
      )}

      {renderer.error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(220, 38, 38, 0.95)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 1000
        }}>
          ❌ WebGL Error: {renderer.error.message}
        </div>
      )}

      {/* Canvas container */}
      <div
        ref={useCallback((el) => {
          if (el && !el._wheelListenerAttached) {
            el.addEventListener('wheel', handleWheel, { passive: false });
            el._wheelListenerAttached = true;
          }
        }, [handleWheel])}
        style={{ width: '100%', height: '100%', cursor }}
        onMouseMove={isPanning ? handlePanMove : handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleMouseClick}
      >
        <canvas
          ref={renderer.canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
}
