# WebGL + Tile-Based Rendering Migration Plan

## Architecture Overview

### Current System (Canvas 2D)
- 3 canvas layers: image, boxes, overlay
- CSS transform for pan/zoom
- All boxes rendered every frame
- No spatial indexing
- Direct image rendering (memory limits with large images)

### New System (WebGL + Tiles)
- Single pixi.js WebGL context
- Tile-based image rendering with pyramid
- Spatial indexing with rbush for viewport culling
- Web Worker for tile generation
- Fallback to Canvas 2D if WebGL unavailable

## Component Architecture

```
src/
├── renderer/
│   ├── PixiRenderer.js          # Main pixi.js rendering engine
│   ├── TileManager.js            # Tile loading, caching, and viewport management
│   ├── SpatialIndex.js           # rbush wrapper for box culling
│   ├── layers/
│   │   ├── ImageLayer.js         # Tile-based image rendering
│   │   ├── BoxLayer.js           # Annotation boxes with culling
│   │   ├── OverlayLayer.js       # Temporary/interactive elements
│   │   └── BaselineLayer.js      # Baseline rendering
│   ├── workers/
│   │   └── tileGenerator.worker.js  # Web Worker for tile slicing
│   └── utils/
│       ├── coordinates.js        # Coordinate transformation utilities
│       └── graphics.js           # Reusable PIXI.Graphics helpers
└── components/
    └── canvas/
        └── AnnotationCanvas.jsx  # Modified to use PixiRenderer
```

## Tile System Design

### Tile Pyramid
```
Level 0 (full res):     256x256 tiles
Level 1 (50%):          256x256 tiles (2x fewer)
Level 2 (25%):          256x256 tiles (4x fewer)
Level 3 (12.5%):        256x256 tiles (8x fewer)
```

### Tile Loading Strategy
1. **Viewport calculation**: Determine which tiles intersect current view
2. **LOD selection**: Choose appropriate pyramid level based on zoom
3. **Preloading**: Load adjacent tiles during idle time
4. **Cache management**: LRU cache with configurable size limit (e.g., 100 tiles)

### Tile Data Structure
```javascript
{
  id: 'L0_x2_y3',           // Unique identifier
  level: 0,                 // Pyramid level
  x: 2, y: 3,               // Tile grid position
  bounds: {x, y, w, h},     // World coordinates
  texture: PIXI.Texture,    // GPU texture (null if not loaded)
  status: 'loading' | 'ready' | 'error',
  priority: 1.0             // Loading priority (0-1)
}
```

## Spatial Index Design

### R-tree Structure (rbush)
- Each box stored with its bounding rectangle
- Efficient queries for visible boxes in viewport
- Fast insertion/deletion when boxes added/removed
- Supports hover hit testing

### Box Data Structure
```javascript
{
  minX, minY, maxX, maxY,  // Required by rbush
  boxIndex: 0,             // Index in store.boxes array
  charIndex: 0,            // Character index
  char: 'A'                // Character for quick access
}
```

## Layer System

### Container Hierarchy
```
stage (PIXI.Container)
├── imageLayer (PIXI.Container)
│   └── tiles[] (PIXI.Sprite)
├── boxLayer (PIXI.Container)
│   ├── boxes[] (PIXI.Graphics)
│   └── labels[] (PIXI.Text)
├── baselineLayer (PIXI.Container)
│   └── lines[] (PIXI.Graphics)
└── overlayLayer (PIXI.Container)
    ├── currentBox (PIXI.Graphics)
    ├── currentStroke (PIXI.Graphics)
    └── dragPreview (PIXI.Graphics)
```

## Coordinate Systems

### Image Coordinates
- Absolute pixel positions on source image
- Used for storing box positions: `box.x = 100`
- Independent of zoom/pan

### Screen Coordinates
- Pixel positions on screen/canvas
- Mouse events provide these
- Need conversion to image coordinates

### Stage Coordinates
- pixi.js stage position and scale
- `stage.position.set(panX, panY)`
- `stage.scale.set(zoom, zoom)`

### Conversion Functions
```javascript
// Screen to image coordinates
function screenToImage(screenX, screenY, stage) {
  return {
    x: (screenX - stage.position.x) / stage.scale.x,
    y: (screenY - stage.position.y) / stage.scale.y
  };
}

// Image to screen coordinates
function imageToScreen(imageX, imageY, stage) {
  return {
    x: imageX * stage.scale.x + stage.position.x,
    y: imageY * stage.scale.y + stage.position.y
  };
}
```

## Rendering Pipeline

### Frame Render Flow
1. **Update viewport bounds** from stage transform
2. **Query spatial index** for visible boxes
3. **Update tile visibility** and load/unload as needed
4. **Render layers** (pixi.js handles this automatically):
   - Image layer: Visible tiles only
   - Box layer: Only boxes from spatial query
   - Baseline layer: Only baselines intersecting viewport
   - Overlay layer: Current drawing operations

### Performance Optimizations
- **Culling**: Only render visible elements
- **Batching**: pixi.js automatically batches similar graphics
- **Texture atlas**: Consider atlasing small textures
- **Object pooling**: Reuse PIXI.Graphics objects
- **Dirty flag**: Only update graphics when data changes

## Mouse Interaction

### Event Flow
1. Mouse event fires on canvas
2. Convert screen coords to image coords
3. Query spatial index for hit testing
4. Update hovered/selected state
5. Render overlay for feedback

### Hover Detection
```javascript
function getHoveredBox(mouseX, mouseY, spatialIndex) {
  // Expand point to small search area
  const tolerance = 5 / zoomLevel; // Constant screen size
  const results = spatialIndex.search({
    minX: mouseX - tolerance,
    minY: mouseY - tolerance,
    maxX: mouseX + tolerance,
    maxY: mouseY + tolerance
  });
  return results[0]; // Return topmost box
}
```

## Web Worker Implementation

### Message Protocol
```javascript
// Main -> Worker
{
  type: 'generateTiles',
  imageData: ImageData,
  tileSize: 256,
  levels: 4
}

// Worker -> Main
{
  type: 'tileReady',
  tile: {
    level: 0,
    x: 2, y: 3,
    imageData: ImageData
  }
}

{
  type: 'progress',
  current: 10,
  total: 100
}

{
  type: 'complete'
}
```

### Tile Generation Algorithm
```javascript
function generateTiles(imageData, tileSize, levels) {
  const tiles = [];

  for (let level = 0; level < levels; level++) {
    const scale = 1 / Math.pow(2, level);
    const scaledWidth = Math.floor(imageData.width * scale);
    const scaledHeight = Math.floor(imageData.height * scale);

    // Scale down image for this level
    const scaledImage = scaleImageData(imageData, scale);

    // Slice into tiles
    const tilesX = Math.ceil(scaledWidth / tileSize);
    const tilesY = Math.ceil(scaledHeight / tileSize);

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tile = extractTile(scaledImage, tx, ty, tileSize);
        tiles.push({
          level, x: tx, y: ty,
          imageData: tile
        });

        // Post immediately for progressive loading
        postMessage({ type: 'tileReady', tile });
      }
    }
  }

  postMessage({ type: 'complete' });
}
```

## Fallback Strategy

### WebGL Detection
```javascript
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch (e) {
    return false;
  }
}
```

### Fallback Mode
If WebGL unavailable:
1. Keep existing Canvas 2D implementation
2. Log warning to console
3. Consider adding UI notice for user
4. Could still benefit from spatial indexing

## Migration Strategy

### Phase 1: Setup (This session)
- Install pixi.js and rbush
- Create basic file structure
- Implement TileManager (without worker first)
- Create SpatialIndex wrapper

### Phase 2: Core Renderer
- Implement PixiRenderer
- Create ImageLayer with tile support
- Create BoxLayer with culling
- Test basic rendering

### Phase 3: Integration
- Modify AnnotationCanvas to use PixiRenderer
- Update coordinate transformations
- Port all mouse interactions
- Test all tools (box, brush, rotate, etc.)

### Phase 4: Optimization
- Add Web Worker for tile generation
- Implement tile preloading
- Add performance monitoring
- Fine-tune cache sizes

### Phase 5: Polish
- Add loading indicators
- Implement fallback mode
- Performance testing with large images
- Bug fixes and edge cases

## Performance Targets

### Metrics
- **60fps** pan/zoom with 100MP image
- **60fps** interaction with 1000+ boxes
- **< 2s** initial load for 100MP image (progressive loading)
- **< 100ms** hover response time
- **< 500MB** memory usage for typical session

### Monitoring
```javascript
// FPS counter
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb
document.body.appendChild(stats.dom);

// Memory usage
performance.memory.usedJSHeapSize;

// Render time
const start = performance.now();
renderer.render(stage);
const renderTime = performance.now() - start;
```

## Testing Plan

### Unit Tests
- Tile generation algorithm
- Spatial index queries
- Coordinate transformations
- Viewport calculations

### Integration Tests
- Load 100MP test image
- Create 1000 boxes
- Test all annotation tools
- Pan/zoom smoothness
- Memory leak testing

### Performance Tests
- Measure FPS during pan/zoom
- Measure interaction latency
- Memory usage over time
- Load time for various image sizes

## Known Challenges

### Challenge 1: Brush Masks
- Currently stored in absolute coordinates
- Need to update when boxes move
- Consider normalizing to 0-1 range

### Challenge 2: Image Rotation
- Tiles generated from original image
- Rotation applied via transform
- May need to regenerate tiles after rotation

### Challenge 3: Filters
- WebGL shaders for filters
- PIXI.Filter for brightness, contrast, etc.
- Custom shaders for complex filters

### Challenge 4: Export
- Need to render full resolution
- May exceed GPU texture limits
- Render in chunks if needed

## Dependencies

```json
{
  "pixi.js": "^8.0.0",      // WebGL rendering
  "rbush": "^4.0.0"         // Spatial indexing
}
```

## API Design

### PixiRenderer Hook
```javascript
const {
  renderer,      // PIXI.Renderer
  stage,         // PIXI.Container
  isReady,       // Boolean
  error,         // Error | null
  loadImage,     // (imageData: ImageData) => Promise<void>
  addBox,        // (box: Box) => void
  updateBox,     // (index: number, box: Partial<Box>) => void
  removeBox,     // (index: number) => void
  clear,         // () => void
  destroy        // () => void
} = usePixiRenderer({
  canvasRef,
  onError: (error) => console.error(error)
});
```

### Usage in AnnotationCanvas
```javascript
function AnnotationCanvas() {
  const canvasRef = useRef(null);
  const boxes = useAnnotatorStore(state => state.boxes);

  const renderer = usePixiRenderer({ canvasRef });

  // Sync boxes to renderer when they change
  useEffect(() => {
    if (!renderer.isReady) return;
    boxes.forEach((box, i) => renderer.updateBox(i, box));
  }, [boxes, renderer.isReady]);

  return <div ref={canvasRef} />;
}
```

## Success Criteria

✅ 60fps pan/zoom on 100MP image
✅ 60fps with 1000+ boxes
✅ All existing tools work correctly
✅ Memory usage under 500MB
✅ No regressions in functionality
✅ Graceful fallback if WebGL unavailable
✅ Progressive loading with visual feedback

## Next Steps

1. Install dependencies
2. Create TileManager (simple version)
3. Create SpatialIndex wrapper
4. Create basic PixiRenderer
5. Test with existing AnnotationCanvas
6. Iterate and optimize
