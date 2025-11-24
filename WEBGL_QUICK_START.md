# WebGL Renderer - Quick Start Guide

## What We Built

A high-performance WebGL-based renderer using pixi.js that replaces the Canvas 2D rendering system. Key features:

- **Tile-based image rendering**: Large images split into chunks, only visible tiles loaded
- **Spatial indexing**: R-tree for O(log n) box queries, massive performance gain
- **GPU acceleration**: All rendering on GPU via WebGL
- **Viewport culling**: Only render what's visible

## Quick Test (5 minutes)

### Option 1: Use Test Component

1. Open `src/App.jsx` or `src/components/MainAnnotator.jsx`

2. Import the test component:
```jsx
import PixiCanvasTest from './canvas/PixiCanvasTest';
```

3. Temporarily replace `<AnnotationCanvas />` with:
```jsx
<PixiCanvasTest />
```

4. Run the app, upload an image, draw some boxes

5. Click "Enable WebGL Renderer" checkbox

6. Test: hover (should highlight), click (should select), mouse wheel (zoom), middle-click drag (pan)

### Option 2: Quick Integration Test

Add this to the top of `AnnotationCanvas.jsx`:

```jsx
import { usePixiRenderer } from '../../renderer/usePixiRenderer';

// Inside component:
const pixiRenderer = usePixiRenderer({ tileSize: 512, maxLevels: 4 });

// After existing useEffect hooks, add:
useEffect(() => {
  if (!pixiRenderer.isReady || !image) return;
  pixiRenderer.loadImage(image);
}, [pixiRenderer.isReady, image]);

useEffect(() => {
  if (!pixiRenderer.isReady) return;
  const validBoxes = boxes.filter(box => uniqueChars.includes(box.char));
  pixiRenderer.setBoxes(validBoxes);
}, [pixiRenderer.isReady, boxes, uniqueChars]);

// Add to JSX (next to existing canvases):
<canvas ref={pixiRenderer.canvasRef} style={{ position: 'absolute', top: 0, left: 0, opacity: 0.5 }} />
```

This renders WebGL version semi-transparently over the Canvas 2D version so you can compare.

## File Overview

```
src/renderer/
├── PixiRenderer.js          # Main renderer (600 lines)
├── TileManager.js           # Tile loading (280 lines)
├── SpatialIndex.js          # R-tree wrapper (180 lines)
├── usePixiRenderer.js       # React hook (100 lines)
└── utils/
    └── coordinates.js       # Coordinate math (80 lines)
```

**Total: ~1,240 lines of well-documented code**

## Key Concepts

### 1. Tiles
Images are sliced into 512x512 pixel tiles at multiple resolution levels:
- Level 0: Full resolution
- Level 1: 50% resolution
- Level 2: 25% resolution
- Level 3: 12.5% resolution

At high zoom, use level 0. At low zoom, use level 3. Only visible tiles are loaded.

### 2. Spatial Index
All boxes stored in an R-tree. When viewport changes:
```javascript
const visibleBoxes = spatialIndex.search(viewport);
// Only render these boxes (not all 1000+)
```

### 3. Layers
Four separate layers, rendered bottom to top:
- **Image layer**: Tile sprites
- **Box layer**: Annotation boxes (culled to viewport)
- **Baseline layer**: Horizontal/angled baselines (TODO)
- **Overlay layer**: Current stroke, rotation line, etc. (TODO)

### 4. Coordinates
- **Image coords**: Absolute pixels on source image (e.g., box.x = 100)
- **Screen coords**: Canvas pixel position
- **Stage transform**: Pan + zoom applied by pixi.js

Use `screenToImage(x, y, stage)` to convert mouse events.

## Performance Expectations

| Metric | Canvas 2D | WebGL (Expected) |
|--------|-----------|------------------|
| FPS (100MP image) | ~30fps | **60fps** |
| FPS (1000 boxes) | ~20fps | **60fps** |
| Memory (100MP) | ~800MB | **~300MB** |
| Pan/Zoom | Janky | **Smooth** |

## Common Issues

### Issue: Black screen
**Solution**: Check browser console for WebGL errors. Some browsers/devices don't support WebGL.

### Issue: Boxes not rendering
**Solution**: Make sure `renderer.setBoxes(boxes)` is called after `loadImage()`.

### Issue: Mouse clicks not working
**Solution**: Verify coordinate conversion using `screenToImage()`.

### Issue: Memory usage high
**Solution**: Reduce `cacheSize` in TileManager options (default 100 tiles).

## Next Steps

1. **Test**: Use PixiCanvasTest to verify rendering works
2. **Migrate**: Move AnnotationCanvas to use pixi renderer
3. **Overlay**: Add support for brush strokes, rotation lines, etc.
4. **Baselines**: Implement baseline rendering
5. **Worker**: Move tile generation to Web Worker (currently blocks UI)
6. **Filters**: Add WebGL shader support for image filters
7. **Polish**: Handle edge cases, add fallback

## Debugging Tips

### Enable verbose logging:
```javascript
// In PixiRenderer.js constructor:
this.debug = true;

// In render():
if (this.debug) {
  console.log('Rendering:', {
    visibleTiles: tiles.length,
    visibleBoxes: visibleBoxes.length,
    viewport,
    zoom: this.app.stage.scale.x
  });
}
```

### Check tile statistics:
```javascript
const stats = renderer.getRenderer().tileManager.getStats();
console.log('Tile stats:', stats);
// { totalTiles, readyTiles, textureCount, cacheSize, pyramidLevels }
```

### Inspect spatial index:
```javascript
const spatialIndex = renderer.getRenderer().spatialIndex;
console.log('Indexed boxes:', spatialIndex.size());

const viewport = renderer.getViewport();
const visible = spatialIndex.search(viewport);
console.log('Visible boxes:', visible.length);
```

## API Reference

### usePixiRenderer(options)
```javascript
const renderer = usePixiRenderer({
  tileSize: 512,    // Tile size in pixels
  maxLevels: 4,     // Pyramid levels
  cacheSize: 100    // Max tiles in cache
});
```

**Returns:**
- `canvasRef`: React ref for the canvas element
- `isReady`: Boolean, true when initialized
- `error`: Error object if initialization failed
- `loadImage(image)`: Load an HTMLImageElement
- `setBoxes(boxes)`: Update all boxes
- `updateBox(index, updates)`: Update single box
- `setSelectedBox(index)`: Set selected box
- `setHoveredBox(index)`: Set hovered box
- `findBoxAtPoint(x, y)`: Find box at screen coordinates
- `setPan(x, y)`: Set pan offset
- `setZoom(zoom)`: Set zoom level
- `getViewport()`: Get viewport bounds
- `requestRender()`: Force re-render

## Performance Monitoring

Add to your component:

```jsx
const [stats, setStats] = useState(null);

useEffect(() => {
  if (!renderer.isReady) return;

  const interval = setInterval(() => {
    const pixiRenderer = renderer.getRenderer();
    if (pixiRenderer) {
      const tileStats = pixiRenderer.tileManager.getStats();
      const viewport = pixiRenderer.getViewport();
      const visible = pixiRenderer.spatialIndex.search(viewport);

      setStats({
        tiles: tileStats.readyTiles,
        textures: tileStats.textureCount,
        boxes: visible.length,
        memory: (performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(0) + ' MB'
      });
    }
  }, 1000);

  return () => clearInterval(interval);
}, [renderer.isReady]);

// Display in UI:
{stats && (
  <div className="stats">
    Tiles: {stats.tiles} | Boxes: {stats.boxes} | Memory: {stats.memory}
  </div>
)}
```

## Resources

- **WEBGL_MIGRATION_PLAN.md**: Full architecture and design doc
- **WEBGL_IMPLEMENTATION_STATUS.md**: Current status and integration guide
- **pixi.js docs**: https://pixijs.com/docs
- **rbush docs**: https://github.com/mourner/rbush

## Questions?

Check the implementation files for detailed comments and examples. Every function is documented with JSDoc.

---

**TL;DR**: Core renderer is done. Test with `PixiCanvasTest`, then migrate `AnnotationCanvas` by replacing canvas rendering with `usePixiRenderer()` hook. See WEBGL_IMPLEMENTATION_STATUS.md for detailed integration steps.
