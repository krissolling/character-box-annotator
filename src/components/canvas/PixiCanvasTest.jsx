import { useEffect, useState, useCallback } from 'react';
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
  const text = useAnnotatorStore(state => state.text);
  const isBrushBoxMode = useAnnotatorStore(state => state.isBrushBoxMode);
  const brushBoxSize = useAnnotatorStore(state => state.brushBoxSize);
  const brushStrokes = useAnnotatorStore(state => state.brushStrokes);
  const addBrushStroke = useAnnotatorStore(state => state.addBrushStroke);
  const baselines = useAnnotatorStore(state => state.baselines);
  const angledBaselines = useAnnotatorStore(state => state.angledBaselines);
  const addBaseline = useAnnotatorStore(state => state.addBaseline);
  const addAngledBaseline = useAnnotatorStore(state => state.addAngledBaseline);
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
      })
      .catch(err => {
        console.error('❌ Failed to load image:', err);
      });
  }, [renderer.isReady, image]);

  // Update boxes when they change
  useEffect(() => {
    if (!renderer.isReady) return;

    const validBoxes = boxes.filter(box => uniqueChars.includes(box.char));
    console.log(`📦 Updating ${validBoxes.length} boxes`);
    renderer.setBoxes(validBoxes);
  }, [renderer.isReady, boxes, uniqueChars]);

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

  // Sync brush strokes to overlay
  useEffect(() => {
    if (!renderer.isReady) return;
    const pixiRenderer = renderer.getRenderer();
    if (pixiRenderer && isBrushBoxMode) {
      // Update overlay with current brush strokes
      pixiRenderer.setOverlayData({
        brushStrokes: brushStrokes,
        brushSize: brushBoxSize
      });
    }
  }, [renderer.isReady, brushStrokes, isBrushBoxMode, brushBoxSize]);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [boxStart, setBoxStart] = useState(null);
  const [resizeCorner, setResizeCorner] = useState(null);
  const [cursor, setCursor] = useState('default');
  const [draggedBoxPreview, setDraggedBoxPreview] = useState(null); // Preview during drag/resize

  // Drawing state
  const [isDrawingBox, setIsDrawingBox] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentBoxDraw, setCurrentBoxDraw] = useState(null);

  // Brush state (local - for current stroke being drawn)
  const [currentStroke, setCurrentStroke] = useState([]);
  const [isDrawingStroke, setIsDrawingStroke] = useState(false); // Currently drawing a stroke

  // Baseline/rotation state
  const [isDrawingLine, setIsDrawingLine] = useState(false); // Drawing baseline or rotation line
  const [lineStart, setLineStart] = useState(null);
  const [lineEnd, setLineEnd] = useState(null);

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

    // Handle baseline tool hover (show temporary baseline line)
    if (currentTool === 'baseline' && !isDrawingLine) {
      setTempBaselineY(imageY);

      // Update overlay to show temp baseline
      if (pixiRenderer) {
        pixiRenderer.setOverlayData({
          tempBaseline: imageY
        });
      }
      return;
    }

    // Handle angled baseline hover/drawing
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
      } else if (angledBaselines.length > 0 && !isDrawingLine) {
        // Subsequent baselines: show preview at cursor with locked angle
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

    // Handle hover and cursor changes
    if (!isPanning && !isDragging && !isResizing && !isDrawingBox && !isBrushBoxMode) {
      // Set cursor for drawing tools
      if (currentTool === 'box') {
        setCursor('crosshair');
        return;
      }

      if (isBrushBoxMode) {
        setCursor('crosshair');
        return;
      }

      // Smart hover: Show hover on boxes whose corners/edges are under cursor
      // This matches the click behavior for consistency
      // Use tolerance of 30px to include corner/edge hitbox zones
      const handleSize = 30 / pixiRenderer.app.stage.scale.x;
      const allBoxesAtPoint = renderer.findAllBoxesAtPoint(x, y, handleSize);
      let hoverBoxItem = null;

      if (allBoxesAtPoint.length > 0) {
        const edgeThreshold = 15 / pixiRenderer.app.stage.scale.x;

        // Check if cursor is near any box's corner or edge (same logic as click)
        for (const item of allBoxesAtPoint) {
          const box = boxes[item.boxIndex];
          if (!box) continue;

          // Check corners
          const corners = [
            { x: box.x, y: box.y },
            { x: box.x + box.width, y: box.y },
            { x: box.x, y: box.y + box.height },
            { x: box.x + box.width, y: box.y + box.height }
          ];

          const nearCorner = corners.some(corner =>
            Math.abs(imageX - corner.x) < handleSize &&
            Math.abs(imageY - corner.y) < handleSize
          );

          if (nearCorner) {
            hoverBoxItem = item;
            break;
          }

          // Check edges (with extended hitbox outside the box)
          const inExtendedXRange = imageX >= box.x - edgeThreshold && imageX <= box.x + box.width + edgeThreshold;
          const inExtendedYRange = imageY >= box.y - edgeThreshold && imageY <= box.y + box.height + edgeThreshold;

          const nearEdge =
            (inExtendedXRange && (Math.abs(imageY - box.y) < edgeThreshold || Math.abs(imageY - (box.y + box.height)) < edgeThreshold)) ||
            (inExtendedYRange && (Math.abs(imageX - box.x) < edgeThreshold || Math.abs(imageX - (box.x + box.width)) < edgeThreshold));

          if (nearEdge) {
            hoverBoxItem = item;
            break;
          }
        }

        // If no corner/edge match, hover the topmost box
        if (!hoverBoxItem) {
          hoverBoxItem = allBoxesAtPoint[allBoxesAtPoint.length - 1];
        }
      }

      renderer.setHoveredBox(hoverBoxItem ? hoverBoxItem.boxIndex : null);

      // Visualize hitboxes for the hovered box
      if (hoverBoxItem) {
        const box = boxes[hoverBoxItem.boxIndex];
        const handleSize = 30 / pixiRenderer.app.stage.scale.x;
        const edgeThreshold = 15 / pixiRenderer.app.stage.scale.x;

        // Calculate corner hitboxes (circles)
        const corners = [
          { x: box.x, y: box.y, size: handleSize },
          { x: box.x + box.width, y: box.y, size: handleSize },
          { x: box.x, y: box.y + box.height, size: handleSize },
          { x: box.x + box.width, y: box.y + box.height, size: handleSize }
        ];

        // Calculate edge hitboxes (rectangles)
        const edges = [
          // Top edge
          { x: box.x, y: box.y - edgeThreshold / 2, width: box.width, height: edgeThreshold },
          // Bottom edge
          { x: box.x, y: box.y + box.height - edgeThreshold / 2, width: box.width, height: edgeThreshold },
          // Left edge
          { x: box.x - edgeThreshold / 2, y: box.y, width: edgeThreshold, height: box.height },
          // Right edge
          { x: box.x + box.width - edgeThreshold / 2, y: box.y, width: edgeThreshold, height: box.height }
        ];

        pixiRenderer.setOverlayData({
          showHitboxes: true,
          hitboxes: { corners, edges }
        });
      } else {
        pixiRenderer.setOverlayData({});
      }

      // Update cursor based on hover
      if (hoverBoxItem && selectedBox === hoverBoxItem.boxIndex) {
        const box = boxes[hoverBoxItem.boxIndex];
        // Reuse pixiRenderer and stage from above (already declared)
        const handleSize = 30 / stage.scale.x;
        const edgeThreshold = 15 / stage.scale.x;

        // Check corners
        const corners = [
          { name: 'nw', x: box.x, y: box.y, cursor: 'nwse-resize' },
          { name: 'ne', x: box.x + box.width, y: box.y, cursor: 'nesw-resize' },
          { name: 'sw', x: box.x, y: box.y + box.height, cursor: 'nesw-resize' },
          { name: 'se', x: box.x + box.width, y: box.y + box.height, cursor: 'nwse-resize' }
        ];

        let foundCorner = false;
        for (const corner of corners) {
          if (Math.abs(imageX - corner.x) < handleSize && Math.abs(imageY - corner.y) < handleSize) {
            setCursor(corner.cursor);
            foundCorner = true;
            break;
          }
        }

        if (!foundCorner) {
          // Check edges
          const inXRange = imageX >= box.x && imageX <= box.x + box.width;
          const inYRange = imageY >= box.y && imageY <= box.y + box.height;

          if (inXRange && Math.abs(imageY - box.y) < edgeThreshold) {
            setCursor('ns-resize');
          } else if (inXRange && Math.abs(imageY - (box.y + box.height)) < edgeThreshold) {
            setCursor('ns-resize');
          } else if (inYRange && Math.abs(imageX - box.x) < edgeThreshold) {
            setCursor('ew-resize');
          } else if (inYRange && Math.abs(imageX - (box.x + box.width)) < edgeThreshold) {
            setCursor('ew-resize');
          } else {
            setCursor('move');
          }
        }
      } else if (hoverBoxItem) {
        setCursor('pointer');
      } else {
        setCursor('default');
      }
    } else if (isDragging) {
      setCursor('move');
    } else if (isPanning) {
      setCursor('grabbing');
    }
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
      setIsDrawingStroke(true); // Start drawing a new stroke
      setCurrentStroke([{ x: imageX, y: imageY }]);
      return;
    }

    // Handle baseline tool (click to add horizontal baseline)
    if (currentTool === 'baseline') {
      addBaseline(imageY);
      return;
    }

    // Handle angled baseline tool
    if (currentTool === 'angled') {
      if (angledBaselines.length === 0) {
        // First baseline: start drawing a line to set angle
        setIsDrawingLine(true);
        setLineStart({ x: imageX, y: imageY });
        setLineEnd({ x: imageX, y: imageY });
        setAngledBaselineLineStart({ x: imageX, y: imageY });
        setAngledBaselineLineEnd({ x: imageX, y: imageY });
      } else {
        // Subsequent baselines: store position, will add on mouseUp
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

    // Find all boxes at this point for click-through selection
    // Use tolerance of 30px to include corner/edge hitbox zones
    const handleSize = 30 / stage.scale.x;
    const allBoxesAtPoint = renderer.findAllBoxesAtPoint(x, y, handleSize);

    // Smart selection: Prioritize boxes whose corners/edges are under the cursor
    // This makes it easier to select underlying boxes by their corners/edges
    let boxItem = null;
    if (allBoxesAtPoint.length > 0) {
      const edgeThreshold = 15 / stage.scale.x;

      // Check if cursor is near any box's corner or edge
      for (const item of allBoxesAtPoint) {
        const box = boxes[item.boxIndex];
        if (!box) continue;

        // Check corners
        const corners = [
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y },
          { x: box.x, y: box.y + box.height },
          { x: box.x + box.width, y: box.y + box.height }
        ];

        const nearCorner = corners.some(corner =>
          Math.abs(imageX - corner.x) < handleSize &&
          Math.abs(imageY - corner.y) < handleSize
        );

        if (nearCorner) {
          boxItem = item;
          // Bring this box to front if it's not already selected
          if (selectedBox !== item.boxIndex) {
            bringBoxToFront(item.boxIndex);
          }
          break;
        }

        // Check edges (with extended hitbox outside the box)
        const inExtendedXRange = imageX >= box.x - edgeThreshold && imageX <= box.x + box.width + edgeThreshold;
        const inExtendedYRange = imageY >= box.y - edgeThreshold && imageY <= box.y + box.height + edgeThreshold;

        const inXRange = imageX >= box.x && imageX <= box.x + box.width;
        const inYRange = imageY >= box.y && imageY <= box.y + box.height;

        const nearEdge =
          (inExtendedXRange && (Math.abs(imageY - box.y) < edgeThreshold || Math.abs(imageY - (box.y + box.height)) < edgeThreshold)) ||
          (inExtendedYRange && (Math.abs(imageX - box.x) < edgeThreshold || Math.abs(imageX - (box.x + box.width)) < edgeThreshold));

        if (nearEdge) {
          boxItem = item;
          // Bring this box to front if it's not already selected
          if (selectedBox !== item.boxIndex) {
            bringBoxToFront(item.boxIndex);
          }
          break;
        }
      }

      // If no corner/edge match, select the topmost box
      if (!boxItem) {
        boxItem = allBoxesAtPoint[allBoxesAtPoint.length - 1];
      }
    }

    // Alt+Click: Cycle through overlapping boxes (like Figma, Sketch, etc.)
    if (e.altKey && allBoxesAtPoint.length > 1) {
      const currentIndex = allBoxesAtPoint.findIndex(b => b.boxIndex === selectedBox);
      if (currentIndex !== -1) {
        // Cycle to next box
        const nextIndex = (currentIndex + 1) % allBoxesAtPoint.length;
        setSelectedBox(allBoxesAtPoint[nextIndex].boxIndex);
      } else {
        // Select the topmost box
        setSelectedBox(boxItem.boxIndex);
      }
      return;
    }

    if (boxItem) {
      const box = boxes[boxItem.boxIndex];
      const handleSize = 30 / stage.scale.x;
      const edgeThreshold = 15 / stage.scale.x;

      // Check if clicking on a corner or edge (works for both selected and unselected boxes)
      // Check corners first (higher priority)
      const corners = [
        { name: 'nw', x: box.x, y: box.y },
        { name: 'ne', x: box.x + box.width, y: box.y },
        { name: 'sw', x: box.x, y: box.y + box.height },
        { name: 'se', x: box.x + box.width, y: box.y + box.height }
      ];

      for (const corner of corners) {
        if (Math.abs(imageX - corner.x) < handleSize && Math.abs(imageY - corner.y) < handleSize) {
          // Select box if not already selected, then start corner resize
          if (selectedBox !== boxItem.boxIndex) {
            setSelectedBox(boxItem.boxIndex);
          }
          setIsResizing(true);
          setResizeCorner(corner.name);
          setDragStart({ x: imageX, y: imageY });
          setBoxStart({ ...box });
          return;
        }
      }

      // Check edges (with extended hitbox outside the box)
      const inExtendedXRange = imageX >= box.x - edgeThreshold && imageX <= box.x + box.width + edgeThreshold;
      const inExtendedYRange = imageY >= box.y - edgeThreshold && imageY <= box.y + box.height + edgeThreshold;

      if (inExtendedXRange && Math.abs(imageY - box.y) < edgeThreshold) {
        // Top edge
        if (selectedBox !== boxItem.boxIndex) {
          setSelectedBox(boxItem.boxIndex);
        }
        setIsResizing(true);
        setResizeCorner('n');
        setDragStart({ x: imageX, y: imageY });
        setBoxStart({ ...box });
        return;
      }
      if (inExtendedXRange && Math.abs(imageY - (box.y + box.height)) < edgeThreshold) {
        // Bottom edge
        if (selectedBox !== boxItem.boxIndex) {
          setSelectedBox(boxItem.boxIndex);
        }
        setIsResizing(true);
        setResizeCorner('s');
        setDragStart({ x: imageX, y: imageY });
        setBoxStart({ ...box });
        return;
      }
      if (inExtendedYRange && Math.abs(imageX - box.x) < edgeThreshold) {
        // Left edge
        if (selectedBox !== boxItem.boxIndex) {
          setSelectedBox(boxItem.boxIndex);
        }
        setIsResizing(true);
        setResizeCorner('w');
        setDragStart({ x: imageX, y: imageY });
        setBoxStart({ ...box });
        return;
      }
      if (inExtendedYRange && Math.abs(imageX - (box.x + box.width)) < edgeThreshold) {
        // Right edge
        if (selectedBox !== boxItem.boxIndex) {
          setSelectedBox(boxItem.boxIndex);
        }
        setIsResizing(true);
        setResizeCorner('e');
        setDragStart({ x: imageX, y: imageY });
        setBoxStart({ ...box });
        return;
      }

      // Clicking on body of box (not on corner/edge)
      if (selectedBox === boxItem.boxIndex) {
        // Already selected: start drag
        setIsDragging(true);
        setDragStart({ x: imageX, y: imageY });
        setBoxStart({ ...box });
      } else {
        // Not selected: just select it
        setSelectedBox(boxItem.boxIndex);
      }
    }
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

    // Finish line drawing (first angled baseline or rotation)
    if (isDrawingLine && lineStart && lineEnd) {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 10) { // Minimum line length
        if (currentTool === 'angled' && angledBaselines.length === 0) {
          // First angled baseline: add with drawn angle
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          addAngledBaseline(lineStart, lineEnd, angle);

          // Clear Zustand state
          setAngledBaselineLineStart(null);
          setAngledBaselineLineEnd(null);
        } else if (currentTool === 'rotate') {
          // Use confirmRotation which snaps to nearest horizontal or vertical
          confirmRotation();
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
    if (currentTool === 'angled' && angledBaselines.length > 0 && tempAngledBaselinePos) {
      const lastBaseline = angledBaselines[angledBaselines.length - 1];
      const angleRad = lastBaseline.angle * (Math.PI / 180);

      // Calculate extended line in both directions
      const extendLength = (renderer.getRenderer()?.sourceImage?.width || 10000) * 2;
      const dirX = Math.cos(angleRad);
      const dirY = Math.sin(angleRad);

      const start = {
        x: tempAngledBaselinePos.x - dirX * extendLength,
        y: tempAngledBaselinePos.y - dirY * extendLength
      };
      const end = {
        x: tempAngledBaselinePos.x + dirX * extendLength,
        y: tempAngledBaselinePos.y + dirY * extendLength
      };

      addAngledBaseline(start, end, lastBaseline.angle);

      // Clear temp state
      setTempAngledBaselinePos(null);

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
    renderer.setPan(currentPan.x + deltaX, currentPan.y + deltaY);

    setPanStart({ x: e.clientX, y: e.clientY });
  };

  // Zoom with wheel
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    // Get fresh renderer reference
    const pixiRenderer = renderer.getRenderer?.();
    if (!pixiRenderer || !renderer.canvasRef?.current) return;

    const rect = renderer.canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const stage = pixiRenderer.app.stage;
    const oldZoom = stage.scale.x;

    const delta = -e.deltaY * 0.002;
    const newZoom = Math.max(0.1, Math.min(4.0, oldZoom + delta));

    // Calculate zoom point in world coordinates
    const worldX = (mouseX - stage.position.x) / oldZoom;
    const worldY = (mouseY - stage.position.y) / oldZoom;

    // Apply new zoom
    stage.scale.set(newZoom, newZoom);

    // Adjust position to keep mouse point stable
    stage.position.x = mouseX - worldX * newZoom;
    stage.position.y = mouseY - worldY * newZoom;

    // Force immediate render
    pixiRenderer.needsRender = true;
  }, [renderer]);

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

      {/* Performance Stats */}
      {renderer.isReady && perfStats && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          zIndex: 100,
          background: 'rgba(0, 0, 0, 0.85)',
          color: 'white',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'Monaco, monospace',
          backdropFilter: 'blur(10px)',
          lineHeight: '1.6'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#4ade80' }}>
            ⚡ WebGL Renderer
          </div>
          <div>📦 Boxes: {perfStats.visibleBoxes} / {perfStats.totalBoxes}</div>
          <div>🗺️ Tiles: {perfStats.tiles}</div>
          <div>🔍 Zoom: {perfStats.zoom}</div>
          <div>💾 Memory: {perfStats.memory}</div>
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
