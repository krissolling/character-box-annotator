import * as PIXI from 'pixi.js';
import { TileManager } from './TileManager';
import { SpatialIndex } from './SpatialIndex';
import { screenToImage, getViewportBounds } from './utils/coordinates';
import { extendLineToEdges } from './utils/lineIntersection';

/**
 * Main WebGL renderer using pixi.js
 * Manages rendering layers, tiles, and spatial indexing
 */
export class PixiRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;

    // Initialize PIXI renderer
    this.app = new PIXI.Application();
    this.isInitialized = false;
    this.initPromise = this._initialize();

    // Managers
    this.tileManager = new TileManager({
      tileSize: options.tileSize || 512,
      maxLevels: options.maxLevels || 4,
      cacheSize: options.cacheSize || 100
    });
    this.spatialIndex = new SpatialIndex();

    // Layers (will be created after init)
    this.imageLayer = null;
    this.boxLayer = null;
    this.baselineLayer = null;
    this.overlayLayer = null;

    // State
    this.sourceImage = null;
    this.boxes = [];
    this.baselines = [];
    this.angledBaselines = [];
    this.selectedBoxIndex = null;
    this.hoveredBoxIndex = null;

    // Rendering
    this.needsRender = true;
    this.animationFrameId = null;

    // Viewport tracking
    this.lastViewport = null;
    this.lastZoom = 1.0;

    // Brush stroke cache (to avoid recreating RenderTexture every frame)
    this.cachedBrushSprite = null;
    this.cachedBrushStrokesHash = null;
  }

  /**
   * Initialize PIXI application
   */
  async _initialize() {
    try {
      await this.app.init({
        canvas: this.canvas,
        background: '#ffffff',
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        powerPreference: 'high-performance'
      });

      // Create layer containers
      this.imageLayer = new PIXI.Container();
      this.boxLayer = new PIXI.Container();
      this.baselineLayer = new PIXI.Container();
      this.overlayLayer = new PIXI.Container();

      // Add layers in order (bottom to top)
      this.app.stage.addChild(this.imageLayer);
      this.app.stage.addChild(this.boxLayer);
      this.app.stage.addChild(this.baselineLayer);
      this.app.stage.addChild(this.overlayLayer);

      // Start render loop
      this.startRenderLoop();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize PIXI:', error);
      throw error;
    }
  }

  /**
   * Wait for initialization
   */
  async waitForInit() {
    await this.initPromise;
  }

  /**
   * Load an image
   * @param {HTMLImageElement} image - Source image
   */
  async loadImage(image) {
    await this.waitForInit();

    this.sourceImage = image;

    // Generate tiles
    await this.tileManager.loadImage(image);

    // Initial render
    this.updateImageLayer();
    this.requestRender();
  }

  /**
   * Update image layer with tiles
   */
  updateImageLayer() {
    if (!this.sourceImage) return;

    // Clear existing tiles
    this.imageLayer.removeChildren();

    // Get viewport
    const viewport = this.getViewport();
    const zoomLevel = this.app.stage.scale.x;

    // Get visible tiles
    const tiles = this.tileManager.getTilesForViewport(viewport, zoomLevel);

    // Render each tile
    tiles.forEach(tile => {
      const texture = this.tileManager.getTileTexture(tile);
      if (!texture) return;

      const sprite = new PIXI.Sprite(texture);
      sprite.position.set(tile.bounds.x, tile.bounds.y);

      // Scale sprite to match tile bounds
      sprite.width = tile.bounds.width;
      sprite.height = tile.bounds.height;

      this.imageLayer.addChild(sprite);
    });

    // Preload adjacent tiles in background
    setTimeout(() => {
      this.tileManager.preloadAdjacentTiles(viewport, zoomLevel);
    }, 100);
  }

  /**
   * Update box layer with visible boxes
   */
  updateBoxLayer(draggedBoxPreview = null) {
    // Clear existing boxes
    this.boxLayer.removeChildren();

    if (this.boxes.length === 0) return;

    // Get viewport for culling
    const viewport = this.getViewport();

    // Query spatial index for visible boxes
    const visibleBoxes = this.spatialIndex.search(viewport);

    // Render each visible box
    visibleBoxes.forEach(item => {
      const box = this.boxes[item.boxIndex];
      if (!box) return;

      // Skip rendering if this box is being dragged (show preview instead)
      if (draggedBoxPreview && draggedBoxPreview.index === item.boxIndex) {
        return;
      }

      const isSelected = this.selectedBoxIndex === item.boxIndex;
      const isHovered = this.hoveredBoxIndex === item.boxIndex;

      this.renderBox(box, item.boxIndex, isSelected, isHovered);
    });

    // Render dragged box preview on top
    if (draggedBoxPreview) {
      const box = this.boxes[draggedBoxPreview.index];
      if (box) {
        // Create semi-transparent preview
        const graphics = new PIXI.Graphics();

        // Draw box with dashed outline
        graphics.rect(
          draggedBoxPreview.x,
          draggedBoxPreview.y,
          draggedBoxPreview.width,
          draggedBoxPreview.height
        );
        graphics.stroke({
          width: 3 / this.app.stage.scale.x,
          color: 0x2196F3,
          alpha: 0.8
        });

        // Semi-transparent fill
        graphics.rect(
          draggedBoxPreview.x,
          draggedBoxPreview.y,
          draggedBoxPreview.width,
          draggedBoxPreview.height
        );
        graphics.fill({ color: 0x2196F3, alpha: 0.1 });

        this.boxLayer.addChild(graphics);

        // Add label
        const fontSize = 16 / this.app.stage.scale.x;
        const label = new PIXI.Text({
          text: box.char,
          style: {
            fontFamily: 'Antarctica, sans-serif',
            fontSize: fontSize,
            fill: 0x2196F3,
            fontWeight: '500'
          }
        });

        const labelPadding = 4 / this.app.stage.scale.x;
        label.x = draggedBoxPreview.x + labelPadding;
        label.y = draggedBoxPreview.y + labelPadding;

        this.boxLayer.addChild(label);
      }
    }
  }

  /**
   * Render a single box
   */
  renderBox(box, index, isSelected, isHovered) {
    const graphics = new PIXI.Graphics();

    // Draw box outline
    const color = isSelected ? 0x2196F3 : isHovered ? 0xFF9800 : 0x4CAF50;
    const lineWidth = isSelected ? 3 : isHovered ? 2.5 : 2;

    graphics.rect(box.x, box.y, box.width, box.height);
    graphics.stroke({ width: lineWidth / this.app.stage.scale.x, color });

    // Draw hover fill
    if (isHovered && !isSelected) {
      graphics.rect(box.x, box.y, box.width, box.height);
      graphics.fill({ color: 0x2196F3, alpha: 0.1 });
    }

    // Add character label
    const fontSize = 16 / this.app.stage.scale.x;
    const label = new PIXI.Text({
      text: box.char,
      style: {
        fontFamily: 'Antarctica, sans-serif',
        fontSize: fontSize,
        fill: color,
        fontWeight: '500'
      }
    });

    const labelPadding = 4 / this.app.stage.scale.x;
    label.x = box.x + labelPadding;
    label.y = box.y + labelPadding;

    // Smart positioning (avoid clipping at top)
    if (box.y < fontSize + labelPadding + 5) {
      label.y = box.y + box.height + labelPadding;
    }

    this.boxLayer.addChild(graphics);
    this.boxLayer.addChild(label);

    // Draw corner handles for selected/hovered boxes
    if (isSelected || isHovered) {
      this.renderBoxHandles(box, color);
    }
  }

  /**
   * Render corner and edge handles for a box
   */
  renderBoxHandles(box, color) {
    const handleSize = 8 / this.app.stage.scale.x;

    // Corner handles
    const corners = [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y },
      { x: box.x, y: box.y + box.height },
      { x: box.x + box.width, y: box.y + box.height }
    ];

    corners.forEach(corner => {
      const handle = new PIXI.Graphics();
      handle.rect(
        corner.x - handleSize / 2,
        corner.y - handleSize / 2,
        handleSize,
        handleSize
      );
      handle.fill({ color });
      handle.stroke({ width: 1 / this.app.stage.scale.x, color: 0xFFFFFF });
      this.boxLayer.addChild(handle);
    });

    // Edge handles
    const edgeHandleWidth = 20 / this.app.stage.scale.x;
    const edgeHandleHeight = 6 / this.app.stage.scale.x;
    const edges = [
      { x: box.x + box.width / 2, y: box.y, horizontal: true },
      { x: box.x + box.width / 2, y: box.y + box.height, horizontal: true },
      { x: box.x, y: box.y + box.height / 2, horizontal: false },
      { x: box.x + box.width, y: box.y + box.height / 2, horizontal: false }
    ];

    edges.forEach(edge => {
      const handle = new PIXI.Graphics();
      if (edge.horizontal) {
        handle.rect(
          edge.x - edgeHandleWidth / 2,
          edge.y - edgeHandleHeight / 2,
          edgeHandleWidth,
          edgeHandleHeight
        );
      } else {
        handle.rect(
          edge.x - edgeHandleHeight / 2,
          edge.y - edgeHandleWidth / 2,
          edgeHandleHeight,
          edgeHandleWidth
        );
      }
      handle.fill({ color });
      handle.stroke({ width: 1 / this.app.stage.scale.x, color: 0xFFFFFF });
      this.boxLayer.addChild(handle);
    });
  }

  /**
   * Set boxes to render
   * @param {Array} boxes - Array of box objects
   */
  setBoxes(boxes) {
    this.boxes = boxes;
    this.spatialIndex.rebuild(boxes);
    this.requestRender();
  }

  /**
   * Update a single box
   * @param {number} index - Box index
   * @param {Object} updates - Updated properties
   */
  updateBox(index, updates) {
    if (index < 0 || index >= this.boxes.length) return;

    this.boxes[index] = { ...this.boxes[index], ...updates };
    this.spatialIndex.update(this.boxes[index], index);
    this.requestRender();
  }

  /**
   * Set selected box index
   */
  setSelectedBox(index) {
    this.selectedBoxIndex = index;
    this.requestRender();
  }

  /**
   * Set hovered box index
   */
  setHoveredBox(index) {
    if (this.hoveredBoxIndex !== index) {
      this.hoveredBoxIndex = index;
      this.requestRender();
    }
  }

  /**
   * Set baselines
   */
  setBaselines(baselines, angledBaselines) {
    this.baselines = baselines || [];
    this.angledBaselines = angledBaselines || [];
    this.requestRender();
  }

  /**
   * Set image rotation
   * @param {number} rotation - Rotation angle in degrees
   */
  setImageRotation(rotation) {
    this.imageRotation = rotation || 0;

    // Apply rotation to imageLayer
    if (this.imageLayer) {
      const angleRad = (this.imageRotation * Math.PI) / 180;
      this.imageLayer.rotation = angleRad;

      // Adjust position to rotate around center
      if (this.sourceImage) {
        const centerX = this.sourceImage.width / 2;
        const centerY = this.sourceImage.height / 2;

        this.imageLayer.pivot.set(centerX, centerY);
        this.imageLayer.position.set(centerX, centerY);
      }
    }

    this.requestRender();
  }

  /**
   * Set overlay data
   */
  setOverlayData(overlayData) {
    this.overlayData = overlayData;
    this.needsRender = true;
  }

  /**
   * Find box at a point
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @returns {Object|null} Box item
   */
  findBoxAtPoint(x, y) {
    const imagePos = screenToImage(x, y, this.app.stage);
    const tolerance = 5 / this.app.stage.scale.x;
    return this.spatialIndex.findBoxAtPoint(imagePos.x, imagePos.y, tolerance);
  }

  /**
   * Find all boxes at a point (for click-through selection)
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @param {number} tolerance - Search tolerance in image pixels (for corner/edge hitboxes)
   * @returns {Array} Array of box items
   */
  findAllBoxesAtPoint(x, y, tolerance = 0) {
    const imagePos = screenToImage(x, y, this.app.stage);

    if (tolerance > 0) {
      // Search for ALL boxes, then filter to those within tolerance
      // We can't just search in a rectangle because corners extend beyond the box bounds
      const allBoxes = [];

      // Get all boxes from spatial index
      this.spatialIndex.tree.all().forEach(item => {
        const box = this.boxes[item.boxIndex];
        if (!box) return;

        // Check if cursor is within tolerance of any corner
        const corners = [
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y },
          { x: box.x, y: box.y + box.height },
          { x: box.x + box.width, y: box.y + box.height }
        ];

        const nearCorner = corners.some(corner => {
          const dx = imagePos.x - corner.x;
          const dy = imagePos.y - corner.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          return dist < tolerance;
        });

        if (nearCorner) {
          allBoxes.push(item);
          return;
        }

        // Check if cursor is within tolerance of any edge
        const inXRange = imagePos.x >= box.x - tolerance && imagePos.x <= box.x + box.width + tolerance;
        const inYRange = imagePos.y >= box.y - tolerance && imagePos.y <= box.y + box.height + tolerance;

        const nearEdge =
          (inXRange && (Math.abs(imagePos.y - box.y) < tolerance || Math.abs(imagePos.y - (box.y + box.height)) < tolerance)) ||
          (inYRange && (Math.abs(imagePos.x - box.x) < tolerance || Math.abs(imagePos.x - (box.x + box.width)) < tolerance));

        if (nearEdge) {
          allBoxes.push(item);
        }
      });

      return allBoxes;
    } else {
      return this.spatialIndex.findBoxesAtPoint(imagePos.x, imagePos.y);
    }
  }

  /**
   * Get current viewport in image coordinates
   */
  getViewport() {
    return getViewportBounds(
      this.app.screen.width,
      this.app.screen.height,
      this.app.stage
    );
  }

  /**
   * Set pan offset
   */
  setPan(x, y) {
    this.app.stage.position.set(x, y);
    this.requestRender();
  }

  /**
   * Set zoom level
   */
  setZoom(zoom) {
    this.app.stage.scale.set(zoom, zoom);
    this.requestRender();
  }

  /**
   * Request a render on next frame
   */
  requestRender(draggedBoxPreview = null) {
    this.draggedBoxPreview = draggedBoxPreview;
    this.needsRender = true;
  }

  /**
   * Start render loop
   */
  startRenderLoop() {
    const renderLoop = () => {
      this.animationFrameId = requestAnimationFrame(renderLoop);

      // Only render if needed
      if (this.needsRender) {
        this.render(this.draggedBoxPreview, this.overlayData);
        this.needsRender = false;
      }
    };

    renderLoop();
  }

  /**
   * Update baseline layer
   */
  updateBaselineLayer() {
    this.baselineLayer.removeChildren();

    const scale = this.app.stage.scale.x;

    // Render horizontal baselines
    this.baselines.forEach((baseline, index) => {
      const graphics = new PIXI.Graphics();

      graphics.moveTo(0, baseline.y);
      graphics.lineTo(this.sourceImage?.width || 10000, baseline.y);
      graphics.stroke({
        width: 2 / scale,
        color: baseline.color || 0xFF9800,
        alpha: 0.8
      });

      this.baselineLayer.addChild(graphics);
    });

    // Render angled baselines
    this.angledBaselines.forEach((baseline, index) => {
      const graphics = new PIXI.Graphics();

      graphics.moveTo(baseline.start.x, baseline.start.y);
      graphics.lineTo(baseline.end.x, baseline.end.y);
      graphics.stroke({
        width: 2 / scale,
        color: baseline.color || 0xFF9800,
        alpha: 0.8
      });

      this.baselineLayer.addChild(graphics);
    });
  }

  /**
   * Update overlay layer with temporary elements
   */
  updateOverlayLayer(overlayData = {}) {
    this.overlayLayer.removeChildren();

    const scale = this.app.stage.scale.x;

    // Render corner/edge hitbox visualization
    if (overlayData.showHitboxes && overlayData.hitboxes) {
      const { corners, edges } = overlayData.hitboxes;

      // Draw corner hitboxes (semi-transparent circles)
      if (corners) {
        corners.forEach(corner => {
          const graphics = new PIXI.Graphics();
          graphics.circle(corner.x, corner.y, corner.size);
          graphics.fill({ color: 0x00FF00, alpha: 0.2 });
          graphics.stroke({ width: 1 / scale, color: 0x00FF00, alpha: 0.5 });
          this.overlayLayer.addChild(graphics);
        });
      }

      // Draw edge hitboxes (semi-transparent rectangles)
      if (edges) {
        edges.forEach(edge => {
          const graphics = new PIXI.Graphics();
          graphics.rect(edge.x, edge.y, edge.width, edge.height);
          graphics.fill({ color: 0x0088FF, alpha: 0.15 });
          graphics.stroke({ width: 1 / scale, color: 0x0088FF, alpha: 0.4 });
          this.overlayLayer.addChild(graphics);
        });
      }
    }

    // Render current box being drawn
    if (overlayData.currentBox) {
      const { x, y, width, height } = overlayData.currentBox;
      const graphics = new PIXI.Graphics();

      graphics.rect(x, y, width, height);
      graphics.stroke({
        width: 2 / scale,
        color: 0x2196F3,
        alpha: 0.8
      });
      graphics.fill({ color: 0x2196F3, alpha: 0.1 });

      this.overlayLayer.addChild(graphics);
    }

    // Render auto-solve regions (completed regions)
    if (overlayData.autoSolveRegions && overlayData.autoSolveRegions.length > 0) {
      overlayData.autoSolveRegions.forEach((region, index) => {
        const graphics = new PIXI.Graphics();

        // Draw region rectangle
        graphics.rect(region.x, region.y, region.width, region.height);
        graphics.stroke({
          width: 2 / scale,
          color: 0x4CAF50, // Green for completed regions
          alpha: 0.8
        });
        graphics.fill({ color: 0x4CAF50, alpha: 0.1 });

        this.overlayLayer.addChild(graphics);

        // Draw region number label
        const text = new PIXI.Text({
          text: `${index + 1}`,
          style: {
            fontFamily: 'Arial',
            fontSize: 16 / scale,
            fontWeight: 'bold',
            fill: 0x4CAF50,
            align: 'center'
          }
        });
        text.x = region.x + 8 / scale;
        text.y = region.y + 8 / scale;
        this.overlayLayer.addChild(text);
      });
    }

    // Render current auto-solve region being drawn
    if (overlayData.currentAutoSolveRegion &&
        overlayData.currentAutoSolveRegion.width > 0 &&
        overlayData.currentAutoSolveRegion.height > 0) {
      const region = overlayData.currentAutoSolveRegion;
      const graphics = new PIXI.Graphics();

      // Draw region rectangle with dashed line effect (orange for current)
      graphics.rect(region.x, region.y, region.width, region.height);
      graphics.stroke({
        width: 3 / scale,
        color: 0xFF9800, // Orange for current region
        alpha: 0.8
      });
      graphics.fill({ color: 0xFF9800, alpha: 0.1 });

      this.overlayLayer.addChild(graphics);
    }

    // Render all brush strokes (completed + current) together
    // Use RenderTexture to flatten everything, then apply alpha uniformly
    // Cache the completed strokes sprite to avoid recreating every frame (causes flicker during pan)
    const hasCompletedStrokes = overlayData.brushStrokes && overlayData.brushStrokes.length > 0;
    const hasCurrentStroke = overlayData.currentStroke && overlayData.currentStroke.length > 0;

    if (hasCompletedStrokes || hasCurrentStroke) {
      // Create a hash of completed strokes to detect changes
      const completedStrokesHash = hasCompletedStrokes
        ? JSON.stringify(overlayData.brushStrokes.map(s => s.points?.length || 0))
        : '';

      // Check if we can reuse cached sprite for completed strokes
      const canUseCachedSprite = hasCompletedStrokes &&
        !hasCurrentStroke &&
        this.cachedBrushSprite &&
        this.cachedBrushStrokesHash === completedStrokesHash;

      if (canUseCachedSprite) {
        // Reuse cached sprite - just add it to overlay
        this.overlayLayer.addChild(this.cachedBrushSprite);
      } else {
        // Need to render strokes (either cache changed or we have a current stroke)
        const strokeContainer = new PIXI.Container();

        // Add completed strokes
        if (hasCompletedStrokes) {
          for (const stroke of overlayData.brushStrokes) {
            const points = stroke.points || stroke;
            const strokeSize = stroke.size || overlayData.brushSize || 40;
            const strokeWidth = strokeSize;

            if (points && points.length > 1) {
              const graphics = new PIXI.Graphics();
              graphics.moveTo(points[0].x, points[0].y);
              for (let i = 1; i < points.length; i++) {
                graphics.lineTo(points[i].x, points[i].y);
              }
              graphics.stroke({
                width: strokeWidth,
                color: 0x2196F3,
                cap: 'round',
                join: 'round'
              });
              strokeContainer.addChild(graphics);
            } else if (points && points.length === 1) {
              const graphics = new PIXI.Graphics();
              graphics.circle(points[0].x, points[0].y, strokeWidth / 2);
              graphics.fill({ color: 0x2196F3 });
              strokeContainer.addChild(graphics);
            }
          }
        }

        // Add current stroke being drawn
        if (hasCurrentStroke) {
          const stroke = overlayData.currentStroke;
          const strokeWidth = overlayData.brushSize || 40;

          if (stroke.length > 1) {
            const graphics = new PIXI.Graphics();
            graphics.moveTo(stroke[0].x, stroke[0].y);
            for (let i = 1; i < stroke.length; i++) {
              graphics.lineTo(stroke[i].x, stroke[i].y);
            }
            graphics.stroke({
              width: strokeWidth,
              color: 0x2196F3,
              cap: 'round',
              join: 'round'
            });
            strokeContainer.addChild(graphics);
          } else if (stroke.length === 1) {
            const graphics = new PIXI.Graphics();
            graphics.circle(stroke[0].x, stroke[0].y, strokeWidth / 2);
            graphics.fill({ color: 0x2196F3 });
            strokeContainer.addChild(graphics);
          }
        }

        // Create RenderTexture large enough to hold all strokes
        const bounds = strokeContainer.getBounds();
        if (bounds.width > 0 && bounds.height > 0) {
          const maxBrushSize = overlayData.brushSize || 40;
          const padding = maxBrushSize;
          const textureWidth = Math.ceil(bounds.width + padding * 2);
          const textureHeight = Math.ceil(bounds.height + padding * 2);

          const renderTexture = PIXI.RenderTexture.create({
            width: textureWidth,
            height: textureHeight,
            resolution: window.devicePixelRatio || 2
          });

          strokeContainer.position.set(-bounds.x + padding, -bounds.y + padding);

          this.app.renderer.render({
            container: strokeContainer,
            target: renderTexture
          });

          const sprite = new PIXI.Sprite(renderTexture);
          sprite.position.set(bounds.x - padding, bounds.y - padding);
          sprite.alpha = 0.6;

          this.overlayLayer.addChild(sprite);

          // Cache the sprite if we only have completed strokes (no current stroke)
          if (hasCompletedStrokes && !hasCurrentStroke) {
            // Destroy old cached sprite if it exists
            if (this.cachedBrushSprite) {
              this.cachedBrushSprite.destroy({ texture: true, textureSource: true });
            }
            this.cachedBrushSprite = sprite;
            this.cachedBrushStrokesHash = completedStrokesHash;
          }

          strokeContainer.destroy({ children: true });
        }
      }
    } else {
      // No strokes - clear cache
      if (this.cachedBrushSprite) {
        this.cachedBrushSprite.destroy({ texture: true, textureSource: true });
        this.cachedBrushSprite = null;
        this.cachedBrushStrokesHash = null;
      }
    }

    // Render brush cursor (circle showing brush size)
    if (overlayData.brushCursor) {
      const { x, y, size } = overlayData.brushCursor;
      const graphics = new PIXI.Graphics();

      // Draw brush cursor circle
      graphics.circle(x, y, size / 2);
      graphics.stroke({
        width: 2 / scale,
        color: 0x4CAF50,
        alpha: 1
      });

      this.overlayLayer.addChild(graphics);
    }

    // Render rotation line
    if (overlayData.rotationLine) {
      const { start, end } = overlayData.rotationLine;
      const graphics = new PIXI.Graphics();

      graphics.moveTo(start.x, start.y);
      graphics.lineTo(end.x, end.y);
      graphics.stroke({
        width: 3 / scale,
        color: 0xFF5722,
        alpha: 0.8
      });

      // Draw circles at endpoints
      graphics.circle(start.x, start.y, 8 / scale);
      graphics.circle(end.x, end.y, 8 / scale);
      graphics.fill({ color: 0xFF5722, alpha: 0.8 });

      this.overlayLayer.addChild(graphics);
    }

    // Render temporary baseline (horizontal line at cursor Y)
    if (overlayData.tempBaseline !== undefined && overlayData.tempBaseline !== null) {
      const y = overlayData.tempBaseline;
      const graphics = new PIXI.Graphics();

      graphics.moveTo(0, y);
      graphics.lineTo(this.sourceImage?.width || 10000, y);
      graphics.stroke({
        width: 2 / scale,
        color: 0xFF9800,
        alpha: 0.6
      });

      this.overlayLayer.addChild(graphics);
    }

    // Render temporary angled baseline (locked angle from first baseline)
    if (overlayData.tempAngledBaseline) {
      const { pos, angle } = overlayData.tempAngledBaseline;
      const angleRad = angle * (Math.PI / 180);
      const graphics = new PIXI.Graphics();

      // Calculate line extended to image edges
      const width = this.sourceImage?.width || 10000;
      const height = this.sourceImage?.height || 10000;
      const extended = extendLineToEdges(pos, angleRad, width, height);

      graphics.moveTo(extended.start.x, extended.start.y);
      graphics.lineTo(extended.end.x, extended.end.y);
      graphics.stroke({
        width: 2 / scale,
        color: 0xFF9800,
        alpha: 0.5 // Slightly more transparent to indicate template mode
      });

      this.overlayLayer.addChild(graphics);
    }

    // Render line being drawn (angled baseline or rotation)
    if (overlayData.drawingLine) {
      const { start, end, tool } = overlayData.drawingLine;
      const graphics = new PIXI.Graphics();

      // Extend line to image edges for baselines and rotation
      let lineStart = start;
      let lineEnd = end;

      if (tool === 'angled' || tool === 'rotate') {
        // Calculate line direction
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > 1) {
          // Calculate center point and angle
          const centerX = (start.x + end.x) / 2;
          const centerY = (start.y + end.y) / 2;
          const angleRad = Math.atan2(dy, dx);

          // Extend to image edges
          const width = this.sourceImage?.width || 10000;
          const height = this.sourceImage?.height || 10000;
          const extended = extendLineToEdges({ x: centerX, y: centerY }, angleRad, width, height);

          lineStart = extended.start;
          lineEnd = extended.end;
        }
      }

      graphics.moveTo(lineStart.x, lineStart.y);
      graphics.lineTo(lineEnd.x, lineEnd.y);

      // Different colors for different tools
      const color = tool === 'rotate' ? 0x9C27B0 : 0xFF9800; // Purple for rotate, Orange for baseline

      graphics.stroke({
        width: 3 / scale,
        color,
        alpha: 0.8
      });

      // Draw circles at original (not extended) endpoints
      graphics.circle(start.x, start.y, 8 / scale);
      graphics.circle(end.x, end.y, 8 / scale);
      graphics.fill({ color, alpha: 0.8 });

      this.overlayLayer.addChild(graphics);
    }
  }

  /**
   * Main render function
   */
  render(draggedBoxPreview = null, overlayData = {}) {
    // Check if viewport or zoom changed significantly
    const viewport = this.getViewport();
    const zoom = this.app.stage.scale.x;

    const viewportChanged = !this.lastViewport ||
      Math.abs(viewport.x - this.lastViewport.x) > 50 ||
      Math.abs(viewport.y - this.lastViewport.y) > 50;

    const zoomChanged = Math.abs(zoom - this.lastZoom) > 0.1;

    // Update tiles if viewport changed
    if (viewportChanged || zoomChanged) {
      this.updateImageLayer();
      this.lastViewport = viewport;
      this.lastZoom = zoom;
    }

    // Always update box layer (cheap with culling)
    this.updateBoxLayer(draggedBoxPreview);

    // Update baseline layer
    this.updateBaselineLayer();

    // Update overlay layer
    this.updateOverlayLayer(overlayData);

    // PIXI renders automatically
  }

  /**
   * Resize renderer
   */
  resize(width, height) {
    this.app.renderer.resize(width, height);
    this.requestRender();
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.tileManager.destroy();
    this.spatialIndex.clear();
    this.app.destroy(true);
  }
}
