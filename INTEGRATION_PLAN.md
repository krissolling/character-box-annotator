# WebGL Integration Plan

## Current Status

✅ **Working in WebGL**:
- Tile-based image rendering
- Box rendering with viewport culling
- Box selection (click)
- Box hover
- Box dragging (smooth with preview)
- Box resizing (corners + edges)
- Zoom (mouse wheel, cursor-centered)
- Pan (middle-click drag)
- Dynamic cursors
- Performance monitoring

❌ **Not Yet in WebGL**:
- Box drawing tool
- Brush tool
- Rotation tool
- Zoom tool (drag to zoom)
- Baseline rendering
- Image filters
- Brush masks
- Image rotation
- Auto-solve tool
- All overlay elements

## 🎯 Recommended Approach: Gradual Migration

### Why Gradual?
1. **Low risk** - Can roll back at any time
2. **Testable** - Test each feature as you go
3. **User choice** - Keep toggle for users to compare
4. **Debug friendly** - Issues are isolated to new code
5. **Production safe** - Don't break existing workflow

### Phase 1: Make Toggle Production-Ready (1-2 hours)

**Goal**: Clean up the toggle UI and make it usable in production

**Tasks**:
1. Move toggle to a better location (tool palette?)
2. Add keyboard shortcut (e.g., `Ctrl+Shift+W` for WebGL)
3. Persist user preference in localStorage
4. Add subtle indicator when WebGL is active
5. Show warning if WebGL not supported

**Files to modify**:
- `MainAnnotator.jsx` - Better toggle UI
- `AnnotationCanvas.jsx` - Add WebGL mode prop

**Result**: Users can opt-in to WebGL rendering while keeping Canvas 2D as fallback

---

### Phase 2: Add Drawing Tools (3-4 hours)

**Goal**: Implement box and brush drawing in WebGL

#### 2.1 Box Drawing Tool

**What's needed**:
- Listen to `currentTool` state from store
- Add mouseDown/mouseMove/mouseUp handlers for box tool
- Draw temporary box outline in overlay layer
- Commit box to store on mouseUp
- Update `currentCharIndex` after adding box

**Implementation**:
```javascript
// In PixiCanvasTest.jsx
const currentTool = useAnnotatorStore(state => state.currentTool);
const currentCharIndex = useAnnotatorStore(state => state.currentCharIndex);
const addBox = useAnnotatorStore(state => state.addBox);

const handleMouseDown = (e) => {
  if (currentTool === 'box') {
    // Start drawing box
    setDrawingBox({ start: imagePos, end: imagePos });
  }
  // ... existing code
};

const handleMouseMove = (e) => {
  if (drawingBox) {
    // Update box preview
    setDrawingBox({ ...drawingBox, end: imagePos });
    // Render to overlay layer
  }
  // ... existing code
};

const handleMouseUp = (e) => {
  if (drawingBox) {
    // Commit box to store
    const box = calculateBox(drawingBox);
    addBox(box);
    setDrawingBox(null);
  }
  // ... existing code
};
```

**Files to modify**:
- `PixiCanvasTest.jsx` - Add box drawing logic
- `PixiRenderer.js` - Add `updateOverlayLayer()` method

**Testing**:
- Can draw boxes with box tool
- Boxes have correct char and variantId
- Character picker updates after drawing
- Boxes persist after drawing

---

#### 2.2 Brush Tool

**What's needed**:
- Track brush strokes in local state
- Render strokes in overlay layer as PIXI.Graphics
- Calculate bounding box from stroke points on confirm
- Add brush mask data to box

**Implementation**:
```javascript
// Brush state
const [currentStroke, setCurrentStroke] = useState([]);
const brushSize = useAnnotatorStore(state => state.brushBoxSize);

const handleMouseMove = (e) => {
  if (isBrushMode && isDrawing) {
    const newStroke = [...currentStroke, imagePos];
    setCurrentStroke(newStroke);

    // Render stroke to overlay
    renderBrushStroke(newStroke);
  }
};

const handleBrushConfirm = () => {
  const boundingBox = calculateBoundingBox(currentStroke);
  const box = {
    ...boundingBox,
    brushMask: currentStroke,
    char: currentChar,
    // ...
  };
  addBox(box);
  setCurrentStroke([]);
};
```

**Files to modify**:
- `PixiCanvasTest.jsx` - Add brush drawing logic
- `PixiRenderer.js` - Add brush stroke rendering to overlay

**Testing**:
- Can paint brush strokes
- Bounding box calculated correctly
- Brush mask stored with box
- Brush size respected

---

### Phase 3: Overlay Elements (2-3 hours)

**Goal**: Render all temporary/interactive elements

**Overlay elements to implement**:
- Current box outline (while drawing)
- Current brush stroke (while painting)
- Rotation line (while rotating)
- Temporary baseline (while adding)
- Drag preview (already done!)
- Selection handles (already done!)

**Implementation approach**:
Create `OverlayRenderer` helper:

```javascript
// In PixiRenderer.js
updateOverlayLayer(overlayData) {
  this.overlayLayer.removeChildren();

  if (overlayData.currentBox) {
    this.renderBoxOutline(overlayData.currentBox);
  }

  if (overlayData.currentStroke) {
    this.renderBrushStroke(overlayData.currentStroke);
  }

  if (overlayData.rotationLine) {
    this.renderRotationLine(overlayData.rotationLine);
  }

  // ... etc
}
```

**Files to modify**:
- `PixiRenderer.js` - Add overlay rendering methods
- `PixiCanvasTest.jsx` - Track overlay state, pass to renderer

---

### Phase 4: Baselines (1-2 hours)

**Goal**: Render horizontal and angled baselines

**What's needed**:
- Get baselines from store
- Render as PIXI.Graphics lines
- Support dashed lines (for visual distinction)
- Handle baseline colors

**Implementation**:
```javascript
// In PixiRenderer.js
updateBaselineLayer() {
  this.baselineLayer.removeChildren();

  // Horizontal baselines
  this.baselines.forEach(baseline => {
    const graphics = new PIXI.Graphics();
    graphics.moveTo(0, baseline.y);
    graphics.lineTo(this.imageWidth, baseline.y);
    graphics.stroke({
      width: 2 / this.app.stage.scale.x,
      color: baseline.color
    });
    this.baselineLayer.addChild(graphics);
  });

  // Angled baselines
  this.angledBaselines.forEach(baseline => {
    const graphics = new PIXI.Graphics();
    graphics.moveTo(baseline.start.x, baseline.start.y);
    graphics.lineTo(baseline.end.x, baseline.end.y);
    graphics.stroke({
      width: 2 / this.app.stage.scale.x,
      color: baseline.color
    });
    this.baselineLayer.addChild(graphics);
  });
}
```

**Files to modify**:
- `PixiRenderer.js` - Add baseline rendering
- `usePixiRenderer.js` - Add `setBaselines()` method
- `PixiCanvasTest.jsx` - Sync baselines from store

---

### Phase 5: Image Rotation (2-3 hours)

**Goal**: Support rotated image rendering

**Approach**:
Apply rotation to the stage or image layer

**Implementation**:
```javascript
// Option 1: Rotate entire stage
stage.rotation = rotationAngle * (Math.PI / 180);

// Option 2: Rotate image layer only
imageLayer.rotation = rotationAngle * (Math.PI / 180);

// Need to adjust:
// - Coordinate transformations
// - Viewport calculations
// - Mouse coordinate conversions
```

**Challenges**:
- Coordinate math gets more complex
- Viewport calculation needs rotation consideration
- May need to regenerate tiles after rotation

**Alternative**: Only allow rotation in 90° increments (easier)

---

### Phase 6: Image Filters (2-3 hours)

**Goal**: Apply brightness, contrast, invert, etc.

**Approach**: Use PIXI.ColorMatrixFilter or custom shaders

**Implementation**:
```javascript
import { ColorMatrixFilter } from 'pixi.js';

// Apply filters to image layer
const filters = [];

if (imageFilters.invert) {
  const invertFilter = new ColorMatrixFilter();
  invertFilter.negative(true);
  filters.push(invertFilter);
}

if (imageFilters.grayscale) {
  const grayFilter = new ColorMatrixFilter();
  grayFilter.greyscale(1, true);
  filters.push(grayFilter);
}

if (imageFilters.brightness !== 1) {
  const brightFilter = new ColorMatrixFilter();
  brightFilter.brightness(imageFilters.brightness, false);
  filters.push(brightFilter);
}

imageLayer.filters = filters;
```

**Files to modify**:
- `PixiRenderer.js` - Add filter application
- `usePixiRenderer.js` - Add `setFilters()` method
- `PixiCanvasTest.jsx` - Sync filters from store

---

### Phase 7: Full Feature Parity (3-5 hours)

**Remaining features**:
- Rotation tool (draw line to rotate)
- Zoom tool (drag to zoom in/out)
- Auto-solve tool (OCR regions)
- Brush masks rendering in boxes
- Handle resize (debouncing already done)

**Testing checklist**:
- [ ] All tools work (pointer, box, brush, rotate, baseline, auto-solve, zoom)
- [ ] All modes work
- [ ] Box operations (add, delete, move, resize)
- [ ] Baselines (add, delete, move)
- [ ] Image filters apply correctly
- [ ] Image rotation works
- [ ] Brush masks render
- [ ] Export works
- [ ] Undo/redo works
- [ ] Keyboard shortcuts work

---

### Phase 8: Polish & Optimization (2-3 hours)

**Tasks**:
- Remove debug logs
- Add loading indicators for tile generation
- Implement Web Worker for tile generation
- Add error boundaries
- Performance testing with various image sizes
- Cross-browser testing
- Mobile/touch support?

---

### Phase 9: Make WebGL Default (30 mins)

**Tasks**:
- Change default `useWebGLRenderer` to `true`
- Keep Canvas 2D as fallback for unsupported browsers
- Add graceful degradation
- Update documentation

**Code**:
```javascript
const [useWebGLRenderer, setUseWebGLRenderer] = useState(() => {
  // Check localStorage preference
  const saved = localStorage.getItem('preferWebGL');
  if (saved !== null) return saved === 'true';

  // Default to WebGL if supported
  return isWebGLSupported();
});
```

---

### Phase 10: Cleanup (1 hour)

**Tasks**:
- Remove old Canvas 2D code (or keep as legacy fallback)
- Remove PixiCanvasTest component
- Merge WebGL logic into main AnnotationCanvas
- Update CLAUDE.md with WebGL info
- Final documentation

---

## 📅 Timeline Estimate

### Conservative (Testing thoroughly)
- **Phase 1**: 2 hours
- **Phase 2**: 7 hours
- **Phase 3**: 3 hours
- **Phase 4**: 2 hours
- **Phase 5**: 3 hours
- **Phase 6**: 3 hours
- **Phase 7**: 5 hours
- **Phase 8**: 3 hours
- **Phase 9**: 0.5 hours
- **Phase 10**: 1 hour

**Total**: ~28-30 hours (3-4 work days)

### Aggressive (MVP approach)
Skip phases 5-6 initially, just focus on drawing tools:
- **Phase 1**: 1 hour
- **Phase 2**: 5 hours
- **Phase 3**: 2 hours
- **Phase 4**: 1 hour
- **Phase 9**: 0.5 hours

**Total**: ~10 hours (1-2 days)

---

## 🎯 Recommended Next Steps

### Option 1: Full Production Integration
Go through all phases to achieve 100% feature parity.

**Best for**: Making WebGL the default renderer

**Timeline**: 3-4 days

### Option 2: MVP + Iterate
Implement drawing tools (Phase 1-2), then use in production while iterating.

**Best for**: Getting value quickly while refining

**Timeline**: 1-2 days for initial release

### Option 3: Keep As Option
Leave the toggle in place, let users opt-in to WebGL.

**Best for**: Low-risk rollout, gradual adoption

**Timeline**: Clean up toggle (Phase 1 only), ~2 hours

---

## 💡 My Recommendation

**Start with Option 2 (MVP + Iterate)**:

1. **Today**: Implement box drawing tool (Phase 2.1)
2. **Tomorrow**: Implement brush tool (Phase 2.2) + baselines (Phase 4)
3. **Day 3**: Polish + make it an opt-in feature

This gives you:
- ✅ All the performance benefits
- ✅ Core annotation features working
- ✅ Low risk (keep Canvas 2D fallback)
- ✅ Can iterate on remaining features
- ✅ Users can try it and give feedback

Then gradually add rotation, filters, etc. based on user feedback and priority.

---

## 🚦 Decision Points

**What do you want to do?**

**A)** Go for full feature parity (Phases 1-10, ~30 hours)
**B)** MVP with drawing tools (Phases 1-4, ~10 hours)
**C)** Just polish the toggle and keep as opt-in (Phase 1, ~2 hours)
**D)** Something else?

Let me know and I can start implementing whichever approach you prefer! 🚀
