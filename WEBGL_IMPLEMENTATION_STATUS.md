# WebGL + Tile-Based Rendering Implementation Status

## ✅ Completed Components

### Core Infrastructure
- **Dependencies Installed**: pixi.js ^8.0.0 and rbush ^4.0.0
- **File Structure Created**: All necessary directories and files in `src/renderer/`

### 1. Coordinate Utilities (`src/renderer/utils/coordinates.js`)
- ✅ Screen to image coordinate conversion
- ✅ Image to screen coordinate conversion
- ✅ Viewport bounds calculation
- ✅ LOD (Level of Detail) calculation
- ✅ Viewport intersection testing
- ✅ Bounds expansion for preloading

### 2. Spatial Index (`src/renderer/SpatialIndex.js`)
- ✅ R-tree wrapper using rbush
- ✅ Insert, update, remove operations
- ✅ Viewport-based box queries
- ✅ Point-based box finding (hover/click)
- ✅ Hit testing for corners, edges, and inside
- ✅ Index rebuild functionality

### 3. Tile Manager (`src/renderer/TileManager.js`)
- ✅ Tile pyramid generation (4 levels: 100%, 50%, 25%, 12.5%)
- ✅ Dynamic tile loading based on viewport
- ✅ LOD selection based on zoom level
- ✅ Tile texture caching
- ✅ LRU cache eviction
- ✅ Tile preloading for adjacent tiles
- ✅ Statistics and monitoring
- ⚠️ Currently synchronous (Web Worker migration pending)

### 4. Pixi Renderer (`src/renderer/PixiRenderer.js`)
- ✅ WebGL context initialization
- ✅ Layer system (image, boxes, baselines, overlay)
- ✅ Tile-based image rendering
- ✅ Box rendering with culling
- ✅ Corner and edge handle rendering
- ✅ Hover and selection state
- ✅ Pan and zoom support
- ✅ Render loop with dirty flag optimization
- ✅ Viewport-based tile updates

### 5. React Hook (`src/renderer/usePixiRenderer.js`)
- ✅ Easy React integration
- ✅ Automatic resize handling
- ✅ Cleanup on unmount
- ✅ Error handling
- ✅ API methods for common operations

### 6. Test Component (`src/components/canvas/PixiCanvasTest.jsx`)
- ✅ Toggle between WebGL and Canvas 2D
- ✅ Basic mouse interaction (hover, click)
- ✅ Pan with middle-click
- ✅ Zoom with mouse wheel
- ✅ Status display

## 📋 Architecture Highlights

### Performance Features
1. **Tile-Based Rendering**
   - Large images divided into 512x512 tiles
   - Only visible tiles are loaded and rendered
   - Pyramid structure for different zoom levels (LOD)

2. **Spatial Indexing**
   - R-tree for O(log n) box queries
   - Only render boxes intersecting viewport
   - Fast hit testing for mouse interaction

3. **GPU Acceleration**
   - All rendering done on GPU via WebGL
   - Hardware-accelerated transforms (pan/zoom)
   - Batched rendering by pixi.js

4. **Render Optimization**
   - Dirty flag system (only render when needed)
   - Viewport change detection
   - Zoom level thresholds for tile updates

### Layer System
```
stage (PIXI.Container)
├── imageLayer      # Tile sprites
├── boxLayer        # Annotation boxes + labels
├── baselineLayer   # Horizontal/angled baselines (TODO)
└── overlayLayer    # Interactive elements (TODO)
```

### Coordinate System
- **Image coordinates**: Absolute pixel positions on source image
- **Screen coordinates**: Canvas pixel positions
- **Stage transform**: Pan offset + zoom scale
- All conversions handled by utility functions

## 🚧 TODO: Integration Steps

### Step 1: Test the Renderer (Optional but Recommended)
To verify everything works before full integration:

1. Import test component in `App.jsx` or `MainAnnotator.jsx`
2. Temporarily replace AnnotationCanvas with PixiCanvasTest
3. Upload an image and draw some boxes
4. Verify rendering, hover, click, pan, zoom all work
5. Check browser console for any errors

```jsx
// In MainAnnotator.jsx or similar
import PixiCanvasTest from './canvas/PixiCanvasTest';

// Replace <AnnotationCanvas /> with:
<PixiCanvasTest />
```

### Step 2: Migrate AnnotationCanvas
The main work is adapting `AnnotationCanvas.jsx` to use the new renderer:

#### 2.1 Replace Canvas Elements
```jsx
// OLD: Three canvas refs
const imageCanvasRef = useRef(null);
const boxesCanvasRef = useRef(null);
const overlayCanvasRef = useRef(null);

// NEW: Use pixi renderer hook
const renderer = usePixiRenderer({
  tileSize: 512,
  maxLevels: 4
});
```

#### 2.2 Remove Canvas useEffect Hooks
- Delete the three large useEffect hooks that render to canvasRefs
- They will be replaced by renderer.setBoxes() calls

#### 2.3 Update Mouse Coordinate Conversion
```jsx
// OLD: getMousePos using canvas rect and zoom
const getMousePos = useCallback((e) => {
  // ... old canvas-based logic
}, [image, imageRotation, zoomLevel]);

// NEW: Use renderer's coordinate conversion
const getMousePos = useCallback((e) => {
  if (!renderer.isReady) return { x: 0, y: 0 };
  const rect = renderer.canvasRef.current.getBoundingClientRect();
  return screenToImage(
    e.clientX - rect.left,
    e.clientY - rect.top,
    renderer.getRenderer().app.stage
  );
}, [renderer.isReady]);
```

#### 2.4 Update Box Hover/Select Logic
```jsx
// OLD: Manual iteration through boxes
for (let i = boxes.length - 1; i >= 0; i--) {
  const box = boxes[i];
  // ... hit testing logic
}

// NEW: Use spatial index
const handleMouseMove = (e) => {
  const rect = renderer.canvasRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const boxItem = renderer.findBoxAtPoint(x, y);
  setHoveredBox(boxItem ? boxItem.boxIndex : null);
  renderer.setHoveredBox(boxItem ? boxItem.boxIndex : null);
};
```

#### 2.5 Sync Boxes to Renderer
```jsx
// Add effect to sync boxes
useEffect(() => {
  if (!renderer.isReady) return;

  const validBoxes = boxes.filter(box => uniqueChars.includes(box.char));
  renderer.setBoxes(validBoxes);
}, [renderer.isReady, boxes, uniqueChars]);
```

#### 2.6 Update Pan/Zoom Handlers
```jsx
// Pan
const handlePan = (deltaX, deltaY) => {
  const newOffset = {
    x: panOffset.x + deltaX,
    y: panOffset.y + deltaY
  };
  setPanOffset(newOffset);
  renderer.setPan(newOffset.x, newOffset.y);
};

// Zoom
const handleZoom = (newZoom) => {
  setZoomLevel(newZoom);
  renderer.setZoom(newZoom);
};
```

#### 2.7 Replace Canvas JSX
```jsx
// OLD: Three canvas elements
<canvas ref={imageCanvasRef} style={canvasStyle} />
<canvas ref={boxesCanvasRef} style={...} />
<canvas ref={overlayCanvasRef} style={...} />

// NEW: Single canvas from renderer
<canvas
  ref={renderer.canvasRef}
  style={{
    width: '100%',
    height: '100%',
    display: 'block',
    cursor: cursorStyle
  }}
  onMouseMove={handleMouseMove}
  onMouseDown={handleMouseDown}
  onMouseUp={handleMouseUp}
  onClick={handleClick}
/>
```

### Step 3: Handle Overlay Layer (Current Stroke, Rotation Line, etc.)
The overlay layer needs special handling for tools:

#### Current approach:
- Brush strokes, rotation lines, temp baselines rendered in overlay canvas
- These need to be drawn using PIXI.Graphics

#### Implementation:
1. Create helper functions to render overlays
2. Call them from existing tool handlers
3. Store overlay graphics in renderer

```jsx
// Example: Render current brush stroke
useEffect(() => {
  if (!renderer.isReady || !isBrushBoxMode) return;

  const pixiRenderer = renderer.getRenderer();
  pixiRenderer.overlayLayer.removeChildren();

  if (currentStroke.length > 0) {
    const graphics = new PIXI.Graphics();
    graphics.moveTo(currentStroke[0].x, currentStroke[0].y);
    for (let i = 1; i < currentStroke.length; i++) {
      graphics.lineTo(currentStroke[i].x, currentStroke[i].y);
    }
    graphics.stroke({ width: brushBoxSize, color: 0x2196F3, alpha: 0.8 });
    pixiRenderer.overlayLayer.addChild(graphics);
    renderer.requestRender();
  }
}, [renderer.isReady, isBrushBoxMode, currentStroke, brushBoxSize]);
```

### Step 4: Add Baselines Rendering
Create a method in PixiRenderer to render baselines:

```javascript
// In PixiRenderer.js
updateBaselineLayer() {
  this.baselineLayer.removeChildren();

  // Horizontal baselines
  this.baselines.forEach(baseline => {
    const graphics = new PIXI.Graphics();
    graphics.moveTo(0, baseline.y);
    graphics.lineTo(this.sourceImage.width, baseline.y);
    graphics.stroke({ width: 2, color: baseline.color, alpha: 1 });
    // TODO: Add dashed line support
    this.baselineLayer.addChild(graphics);
  });

  // Angled baselines
  this.angledBaselines.forEach(baseline => {
    const graphics = new PIXI.Graphics();
    graphics.moveTo(baseline.start.x, baseline.start.y);
    graphics.lineTo(baseline.end.x, baseline.end.y);
    graphics.stroke({ width: 2, color: baseline.color, alpha: 1 });
    this.baselineLayer.addChild(graphics);
  });
}
```

### Step 5: WebGL Fallback
Add detection and fallback to Canvas 2D:

```jsx
// In AnnotationCanvas.jsx
const [webglAvailable, setWebglAvailable] = useState(true);

useEffect(() => {
  // Detect WebGL support
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    console.warn('WebGL not available, falling back to Canvas 2D');
    setWebglAvailable(false);
  }
}, []);

// Conditionally render
return webglAvailable ? (
  <PixiRendererCanvas />
) : (
  <OriginalCanvas2D />
);
```

## 🚀 Performance Optimizations (Phase 2)

### Web Worker for Tile Generation
Currently tile generation is synchronous. To avoid blocking:

1. Create `src/renderer/workers/tileGenerator.worker.js`
2. Move tile slicing logic to worker
3. Post tiles back to main thread as they're ready
4. Show loading progress

### Additional Optimizations
- **Object pooling**: Reuse PIXI.Graphics objects
- **Texture atlasing**: Combine small textures
- **Culling improvements**: More aggressive culling for distant boxes
- **Brush mask rendering**: Implement using PIXI.Graphics or custom shaders
- **Filter support**: WebGL shaders for brightness, contrast, invert, etc.

## 📊 Expected Performance Improvements

### Before (Canvas 2D)
- ~30fps with 100MP image at high zoom
- ~20fps with 500+ boxes
- Memory: ~800MB with 100MP image
- Jank during pan/zoom

### After (WebGL + Tiles)
- **60fps** with any size image
- **60fps** with 1000+ boxes
- Memory: **~300MB** (only visible tiles loaded)
- **Smooth** pan/zoom with no jank

### Benchmarking
Add performance monitoring:

```javascript
const stats = {
  fps: 0,
  renderTime: 0,
  visibleTiles: 0,
  visibleBoxes: 0,
  memoryUsage: performance.memory?.usedJSHeapSize || 0
};
```

## 🐛 Known Issues / Edge Cases

1. **Image Rotation**: Currently not implemented in WebGL version
   - Need to apply rotation transform to stage
   - Or regenerate tiles after rotation

2. **Brush Masks**: Not yet rendered
   - Need to implement using PIXI.Graphics paths
   - Or use custom mask shader

3. **Filters**: Not implemented
   - brightness, contrast, shadows, highlights need PIXI.Filter
   - Custom shaders for complex filters

4. **Export**: Full resolution rendering
   - May need to render in chunks if exceeds GPU limits
   - Or fall back to Canvas 2D for export

5. **Touch/Gesture Support**: Not implemented
   - Need to add pinch-zoom for mobile
   - Touch events for pan

## 📁 File Structure Summary

```
src/renderer/
├── PixiRenderer.js           # Main renderer class
├── TileManager.js            # Tile loading & caching
├── SpatialIndex.js           # R-tree for box culling
├── usePixiRenderer.js        # React hook
├── utils/
│   └── coordinates.js        # Coordinate transformations
└── workers/
    └── tileGenerator.worker.js  # TODO: Web Worker for tiles

src/components/canvas/
├── AnnotationCanvas.jsx      # Main canvas (to be migrated)
└── PixiCanvasTest.jsx        # Test component
```

## 🎯 Next Steps

1. **Test current implementation**: Use PixiCanvasTest component
2. **Fix any bugs found**: Iterate on core renderer
3. **Migrate AnnotationCanvas**: Follow integration steps above
4. **Add overlay rendering**: Brush strokes, rotation lines, etc.
5. **Add baseline rendering**: Horizontal and angled
6. **Implement filters**: WebGL shaders
7. **Add Web Worker**: Non-blocking tile generation
8. **Performance testing**: Benchmark with large images
9. **WebGL fallback**: Graceful degradation
10. **Polish and bug fixes**: Edge cases

## 📚 Documentation

- **WEBGL_MIGRATION_PLAN.md**: Overall architecture and design
- **WEBGL_IMPLEMENTATION_STATUS.md**: This file - current status
- **CLAUDE.md**: Updated with WebGL renderer notes (TODO)

## 💡 Tips for Integration

1. **Start small**: Test with PixiCanvasTest first
2. **Incremental migration**: Don't change everything at once
3. **Keep old code**: Comment out Canvas 2D code, don't delete yet
4. **Use feature flag**: Toggle between old and new renderer
5. **Test thoroughly**: All tools, all modes, all edge cases
6. **Monitor performance**: Use browser DevTools Performance tab
7. **Check memory**: Look for memory leaks with heap snapshots

## ✨ Success Criteria

- [ ] All existing functionality works
- [ ] 60fps pan/zoom on 100MP images
- [ ] 60fps with 1000+ annotation boxes
- [ ] Memory usage under 500MB
- [ ] No visual regressions
- [ ] Smooth user experience
- [ ] Graceful fallback if WebGL unavailable

---

**Status**: Core infrastructure complete ✅
**Next**: Integration testing and AnnotationCanvas migration 🚧
