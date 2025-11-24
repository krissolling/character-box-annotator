# WebGL Renderer Testing Guide

## Setup Complete ✅

The WebGL renderer is now integrated into your app with a toggle switch in the top-right corner.

## How to Test

### 1. Start the Application

The dev server should already be running. Open your browser to:
```
http://localhost:5173
```

### 2. Load Test Data

1. Upload an image (any size, but larger is better for testing)
2. Enter some text to annotate
3. Start drawing boxes around characters (use Box tool or press 'M')
4. Draw at least 5-10 boxes to see the rendering performance

### 3. Enable WebGL Renderer

Look for the toggle in the **top-right corner**:
```
⚡ WebGL Renderer (Test Mode)
```

Click the checkbox to switch from Canvas 2D to WebGL rendering.

### 4. Open Chrome DevTools

Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)

## Testing Checklist

### Visual Tests

- [ ] **Image renders correctly**: Compare WebGL vs Canvas 2D rendering
- [ ] **Boxes render with correct colors**: Green outline, labels visible
- [ ] **Hover works**: Boxes highlight orange when hovered
- [ ] **Selection works**: Boxes highlight blue when clicked
- [ ] **Corner handles visible**: When box is selected/hovered
- [ ] **Labels positioned correctly**: Character labels above/below boxes

### Interaction Tests

- [ ] **Mouse wheel zoom**: Smooth zoom in/out
- [ ] **Middle-click pan**: Can drag the canvas around
- [ ] **Box hover detection**: Hover over boxes shows orange highlight
- [ ] **Box selection**: Click selects box (blue highlight)
- [ ] **Zoom maintains position**: Zooming keeps cursor point stable

### Performance Tests (Chrome DevTools)

#### 1. Check Frame Rate (Performance Tab)

1. Open DevTools → **Performance** tab
2. Click **Record** (red circle)
3. While recording:
   - Zoom in/out with mouse wheel (10-15 times)
   - Pan around the image rapidly
   - Hover over multiple boxes
4. Stop recording
5. Look for **green bars** (should be consistently at 60fps)
6. Check for any **red/yellow warnings**

**Expected Results:**
- ✅ Consistent 60fps during all interactions
- ✅ No dropped frames
- ✅ Smooth green bars in flame chart

#### 2. Check Memory Usage (Memory Tab)

1. DevTools → **Memory** tab
2. Select "Heap snapshot"
3. Click "Take snapshot"
4. Interact with the app (zoom, pan, draw boxes)
5. Take another snapshot
6. Compare memory usage

**Expected Results:**
- ✅ Memory usage stable (not constantly increasing)
- ✅ Typical range: 100-300MB for large images
- ✅ No memory leaks after repeated interactions

#### 3. Check GPU Usage (Rendering Tab)

1. DevTools → **More tools** → **Rendering**
2. Enable "Frame Rendering Stats"
3. Look for green FPS counter overlay on page

**Expected Results:**
- ✅ FPS counter shows 60fps
- ✅ GPU time < 16ms per frame
- ✅ No GPU stalls or warnings

### Console Monitoring

Watch the browser console for these log messages:

```
🎨 Loading image into pixi renderer...
✅ Image loaded successfully
📦 Updating X boxes
```

**Check for:**
- [ ] No error messages (red text)
- [ ] No warnings about WebGL context
- [ ] Tile generation completes quickly

### Advanced Testing

#### Test with Large Images

1. Upload a 10+ megapixel image
2. Enable WebGL renderer
3. Zoom in to 200-400%
4. Pan around rapidly
5. Check Performance tab for consistent 60fps

#### Test with Many Boxes

1. Create 50+ annotation boxes
2. Enable WebGL renderer
3. Zoom out to see all boxes
4. Pan and zoom
5. Hover over boxes near edges
6. Performance should remain smooth

#### Test Spatial Index

Open console and run:
```javascript
// Get renderer instance
const renderer = window.__PIXI_RENDERER__;

// Check spatial index
console.log('Total boxes:', renderer.spatialIndex.size());

// Check visible boxes
const viewport = renderer.getViewport();
const visible = renderer.spatialIndex.search(viewport);
console.log('Visible boxes:', visible.length);
```

Expected: Only visible boxes should be rendered (check console logs).

#### Test Tile System

Open console and run:
```javascript
const stats = window.__PIXI_RENDERER__.tileManager.getStats();
console.table(stats);
```

Expected output:
```
┌─────────────────┬────────┐
│     (index)     │ Values │
├─────────────────┼────────┤
│   totalTiles    │   64   │
│   readyTiles    │   64   │
│  textureCount   │   16   │
│   cacheSize     │  100   │
│ pyramidLevels   │   4    │
└─────────────────┴────────┘
```

## Performance Benchmarks

### Before (Canvas 2D)
Record these metrics with Canvas 2D enabled:
- FPS during pan: _____
- FPS during zoom: _____
- Memory usage: _____
- Time to render 100 boxes: _____

### After (WebGL)
Record these metrics with WebGL enabled:
- FPS during pan: _____
- FPS during zoom: _____
- Memory usage: _____
- Time to render 100 boxes: _____

### Expected Improvements
- **FPS**: 2x improvement (30fps → 60fps)
- **Memory**: 50% reduction (800MB → 300MB)
- **Responsiveness**: No jank or stutter

## Common Issues

### Issue: Black screen after enabling WebGL
**Cause**: WebGL not supported or initialization failed
**Fix**: Check console for error messages, try refreshing page
**Console**: Look for "Failed to initialize PIXI" error

### Issue: Boxes not rendering
**Cause**: Boxes not synced to renderer or outside viewport
**Console check**:
```javascript
console.log('Boxes in store:', boxes.length);
console.log('Boxes in renderer:', renderer.boxes.length);
console.log('Boxes in spatial index:', renderer.spatialIndex.size());
```

### Issue: Poor performance (< 30fps)
**Possible causes**:
- GPU acceleration disabled in browser
- Too many tiles in cache
- Integrated GPU (vs discrete)

**Console check**:
```javascript
// Check tile statistics
const stats = window.__PIXI_RENDERER__.tileManager.getStats();
console.log('Tiles loaded:', stats.textureCount);

// Check visible boxes
const visible = window.__PIXI_RENDERER__.spatialIndex.search(
  window.__PIXI_RENDERER__.getViewport()
);
console.log('Visible boxes:', visible.length);
```

### Issue: Memory increasing over time
**Cause**: Memory leak in tile cache or graphics objects
**Test**: Pan around for 2 minutes, take heap snapshot, compare
**Fix**: Reduce cache size in TileManager options

## DevTools Tips

### 1. Enable Paint Flashing
Shows what areas are being repainted:
- DevTools → Rendering → Paint flashing: **Enabled**
- Only hovered/moved boxes should flash

### 2. Check Compositor Layers
See what's GPU accelerated:
- DevTools → Layers tab
- Canvas should be on its own layer

### 3. Monitor Network
Make sure tiles aren't re-fetching:
- DevTools → Network tab
- Should see NO network requests after initial load
- All tiles generated locally

### 4. JavaScript Profiler
Find performance bottlenecks:
- DevTools → Performance → JavaScript Profiler
- Look for expensive function calls
- TileManager and SpatialIndex should be fast

## Debugging Commands

Add to browser console for debugging:

### Enable verbose logging
```javascript
window.__PIXI_RENDERER__.debug = true;
```

### Force render
```javascript
window.__PIXI_RENDERER__.requestRender();
```

### Clear tile cache
```javascript
window.__PIXI_RENDERER__.tileManager.clear();
```

### Rebuild spatial index
```javascript
const boxes = [...]; // your boxes array
window.__PIXI_RENDERER__.spatialIndex.rebuild(boxes);
```

### Get viewport info
```javascript
const viewport = window.__PIXI_RENDERER__.getViewport();
console.log('Viewport:', viewport);
console.log('Zoom:', window.__PIXI_RENDERER__.app.stage.scale.x);
```

## Export Global Renderer (for debugging)

Add this to `usePixiRenderer.js` for easier debugging:

```javascript
// In usePixiRenderer.js, after renderer.waitForInit():
if (typeof window !== 'undefined') {
  window.__PIXI_RENDERER__ = rendererRef.current;
}
```

## Test Results Template

Copy this to document your test results:

```markdown
## Test Results

**Date**: _____
**Browser**: Chrome _____
**Image Size**: _____ x _____ pixels
**Number of Boxes**: _____

### Canvas 2D Performance
- Pan FPS: _____
- Zoom FPS: _____
- Memory: _____
- Jank/Stutter: Yes / No

### WebGL Performance
- Pan FPS: _____
- Zoom FPS: _____
- Memory: _____
- Jank/Stutter: Yes / No

### Issues Found
1. _____
2. _____

### Visual Comparison
- Image quality: Same / Different
- Box rendering: Same / Different
- UI responsiveness: Better / Same / Worse

### Verdict
WebGL renderer is: ✅ Ready / ⚠️ Needs work / ❌ Not working
```

## Next Steps After Testing

1. **If everything works**: Proceed with full AnnotationCanvas migration
2. **If issues found**: Debug and fix before migrating
3. **Document performance**: Record benchmarks for future reference
4. **Test on different machines**: Various GPUs, screen sizes

## Success Criteria

- [x] WebGL initializes without errors
- [x] All boxes render correctly
- [x] Hover and click work
- [x] Pan and zoom are smooth (60fps)
- [x] Memory usage is reasonable (< 500MB)
- [x] No visual regressions vs Canvas 2D
- [x] Console shows no errors or warnings

When all criteria are met, the renderer is ready for production! 🚀
