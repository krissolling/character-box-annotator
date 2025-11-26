# React Annotator Implementation Plan

## High Priority Bugs (Break Core Functionality)

### 1. Fix Mask Coordinate System ⚠️ **CRITICAL**
**Problem**: Masks stored in absolute image coordinates, but when bounding box moves/resizes, mask doesn't follow.

**Root Cause**: Masks stored as absolute pixel positions, not relative to box.

**Solution**:
- Change mask storage from `{x: 100, y: 200}` to `{x: 0.5, y: 0.3}` (0-1 normalized to box dimensions)
- When rendering: `actualX = box.x + (normalizedX * box.width)`
- When storing: `normalizedX = (mouseX - box.x) / box.width`
- Update all mask rendering/editing code to use normalized coordinates

**Files**: `useAnnotatorStore.js`, `CharacterEditor.jsx`, `WordPreview.jsx`, `EditedCharacters.jsx`

---

### 2. Fix Visual Filter Controls
**Problem**: Brightness, Contrast, Grayscale, Invert not working in sidebar. Only Shadows & Highlights work.

**Investigation Needed**:
- Find `ImageFilters.jsx` or similar component
- Check if filters are calling `updateFilter()` from store
- Verify filter values are being applied to canvas rendering
- WordPreview.jsx applies filters at line 590-603, check if main canvas does same

**Files**: `ImageFilters.jsx`, `AnnotationCanvas.jsx`

---

### 3. Smart Edit String (Preserve Existing Boxes)
**Problem**: Editing "HELLO" to "HELLOWORLD" clears all boxes, even for H, E, L, O that still exist.

**Solution**:
```javascript
const handleEditString = () => {
  const newText = prompt('Edit string:', text);
  if (!newText) return;

  const newChars = [...new Set(newText.split(''))];
  const oldChars = [...new Set(text.split(''))];

  // Find removed characters
  const removedChars = oldChars.filter(c => !newChars.includes(c));

  if (removedChars.length > 0) {
    if (!confirm(`This will remove boxes for: ${removedChars.join(', ')}. Continue?`)) return;
  }

  // Filter boxes to keep only characters in new string
  const newBoxes = boxes.filter(box => newChars.includes(box.char));
  setBoxes(newBoxes);
  setText(newText);
};
```

**Files**: `CharacterPicker.jsx`, `SetupPanel.jsx`

---

### 4. Fix Mask Cursor-Off-Canvas Bug
**Problem**: When cursor leaves character edit canvas during masking, strokes don't register properly.

**Solution**:
- Add `onMouseLeave` handler to finish current stroke when cursor exits
- Add `onMouseEnter` handler to start new stroke when cursor re-enters
- Don't draw while cursor is outside canvas bounds

```javascript
const handleMouseLeave = () => {
  if (isDrawing) {
    setIsDrawing(false);
    // Finish current stroke
  }
};
```

**Files**: `CharacterEditor.jsx`

---

### 5. Fix Rotate → Pointer → Rotate Bug
**Problem**: Tool switching breaks rotation functionality.

**Investigation**: Check if rotation state is being cleared when switching tools.

**Files**: `ToolPalette.jsx`, `useAnnotatorStore.js`

---

## Medium Priority Bugs (UX Issues)

### 6. Smooth Masking Brush Strokes
**Problem**: Fast movements create gaps between circles.

**Solution**: Interpolate points between mouse positions
```javascript
const interpolatePoints = (p1, p2, size) => {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const steps = Math.ceil(dist / (size / 2)); // Overlap circles
  const points = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    });
  }
  return points;
};
```

**Files**: `CharacterEditor.jsx`

---

### 7. Fix Brush Fill Anti-Aliasing
**Problem**: Brush tool fills pixels between strokes in open shapes (half circles).

**Solution**: Make flood fill cruder - only fill if pixel is completely enclosed
- Increase threshold for "same color" detection
- Or: Use stricter boundary detection (only fill if 4-connected, not 8-connected)

**Files**: Wherever brush fill logic exists (likely `AnnotationCanvas.jsx` or store)

---

### 8. Fix Character Edit Modal Size
**Problem**: Modal too large, requires scrolling to see save button.

**Solution**:
- Move character preview to top of modal
- Reduce preview size (max 200px height?)
- Use `max-height: 90vh` and `overflow-y: auto` on modal container
- Ensure save/cancel buttons always visible at bottom

**Files**: `CharacterEditor.jsx`

---

### 9. Fix Baseline Mouse-Leave Bug
**Problem**: Exiting canvas while drawing baseline creates unwanted baseline.

**Solution**:
```javascript
// Track if cursor is over canvas
const [isMouseOver, setIsMouseOver] = useState(true);

const handleMouseUp = () => {
  if (isDrawingBaseline && isMouseOver) {
    createBaseline();
  }
  setIsDrawingBaseline(false);
};
```

**Files**: `AnnotationCanvas.jsx`

---

### 10. Extend Angled Baselines Infinitely
**Problem**: Angled baselines show as points, should extend to canvas edges.

**Solution**: Calculate line intersection with canvas bounds
```javascript
const extendBaselineToEdges = (startX, startY, angle, canvasWidth, canvasHeight) => {
  const slope = Math.tan(angle * Math.PI / 180);

  // Calculate intersections with all 4 edges
  const intersections = [];

  // Left edge (x=0)
  const yAtLeft = startY + slope * (0 - startX);
  if (yAtLeft >= 0 && yAtLeft <= canvasHeight) {
    intersections.push({x: 0, y: yAtLeft});
  }

  // Right edge (x=canvasWidth)
  const yAtRight = startY + slope * (canvasWidth - startX);
  if (yAtRight >= 0 && yAtRight <= canvasHeight) {
    intersections.push({x: canvasWidth, y: yAtRight});
  }

  // Top edge (y=0)
  const xAtTop = startX + (0 - startY) / slope;
  if (xAtTop >= 0 && xAtTop <= canvasWidth) {
    intersections.push({x: xAtTop, y: 0});
  }

  // Bottom edge (y=canvasHeight)
  const xAtBottom = startX + (canvasHeight - startY) / slope;
  if (xAtBottom >= 0 && xAtBottom <= canvasWidth) {
    intersections.push({x: xAtBottom, y: canvasHeight});
  }

  return intersections; // Should have exactly 2 points
};
```

**Files**: `AnnotationCanvas.jsx`, `WordPreview.jsx`

---

### 11. Fix Angled Baseline Hover Movement
**Problem**: Baseline moves when mouse hovers, can't align with anything.

**Investigation**: Baseline likely following mouse instead of being locked after creation.

**Solution**: Lock baseline position after creation, don't update on mousemove.

**Files**: `AnnotationCanvas.jsx`

---

## Missing Features (Restore from Old Version)

### 12. Add Kerning Adjustment UI
**Location**: Word preview panel, below each character (except first)

**UI Design**:
- Small draggable diamond/circle handle between each letter
- Drag left: decrease spacing (negative kerning)
- Drag right: increase spacing (positive kerning)
- Shows current value on hover

**Implementation**:
```javascript
// In WordPreview.jsx rendering
charPositionsRef.current.forEach((pos, index) => {
  if (index > 0) {
    // Draw kerning handle
    const handleX = pos.x - letterSpacing / 2;
    const handleY = canvasHeight / 2;

    // Draw diamond shape
    ctx.fillStyle = '#2196F3';
    ctx.beginPath();
    ctx.moveTo(handleX, handleY - 5);
    ctx.lineTo(handleX + 5, handleY);
    ctx.lineTo(handleX, handleY + 5);
    ctx.lineTo(handleX - 5, handleY);
    ctx.closePath();
    ctx.fill();

    // Store handle position for click detection
    kerningHandlesRef.current.push({
      x: handleX,
      y: handleY,
      index: index - 1 // Kerning between index-1 and index
    });
  }
});

// Handle click + drag on kerning handles
const handleKerningDrag = (handleIndex, deltaX) => {
  const newKerning = {...kerningAdjustments};
  newKerning[handleIndex] = (newKerning[handleIndex] || 0) + deltaX;
  setKerningAdjustments(newKerning);
};
```

**Files**: `WordPreview.jsx`, `useAnnotatorStore.js`

---

### 13. Add Letter-Spacing Control
**Location**: Word preview panel header (with other controls)

**UI Design**: Slider from -50 to +50, default 0

**Implementation**:
```javascript
<div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
  <label>Letter Spacing:</label>
  <input
    type="range"
    min="-50"
    max="50"
    value={letterSpacing}
    onChange={(e) => setLetterSpacing(parseInt(e.target.value))}
  />
  <span>{letterSpacing}px</span>
</div>
```

**Files**: `WordPreview.jsx` (control already exists, just verify it's visible/working)

---

### 14. Add Delete Mask Button
**Location**: Character edit modal

**Functionality**: Delete eraseMask and brushMask, keep bounding box

**Implementation**:
```javascript
const handleDeleteMask = () => {
  if (confirm('Delete mask for this character? The bounding box will remain.')) {
    // Clear brush mask from box
    const updatedBoxes = [...boxes];
    updatedBoxes[editingBoxIndex].brushMask = [];
    setBoxes(updatedBoxes);

    // Clear erase mask from editedCharData
    const updatedEditData = {...editedCharData};
    delete updatedEditData[editingBoxIndex];
    setEditedCharData(updatedEditData);

    closeCharacterEdit();
  }
};
```

**Files**: `CharacterEditor.jsx`

---

## Lower Priority (Nice to Have)

### 15. Add Scroll Zoom (50% minimum)
**Implementation**: Mouse wheel zoom on canvas, zoom toward cursor

**Files**: `AnnotationCanvas.jsx`

---

### 16. Fix Currently Drawn Letter Display
**Problem**: When drawing box, selected letter doesn't show as feedback

**Files**: `AnnotationCanvas.jsx`

---

### 17-24. Other TODO items
See TODO.md for remaining lower priority items.

---

## Recommended Implementation Order

### Phase 1: Critical Bugs (Week 1)
1. Fix mask coordinate system (most important - affects multiple features)
2. Fix visual filter controls
3. Smart edit string
4. Fix mask cursor-off-canvas bug
5. Fix rotate tool bug

### Phase 2: UX Improvements (Week 2)
6. Smooth masking brush strokes
7. Fix brush fill anti-aliasing
8. Fix character edit modal size
9. Fix baseline mouse-leave bug
10. Extend angled baselines
11. Fix angled baseline hover

### Phase 3: Restore Features (Week 3)
12. Add kerning UI
13. Add letter-spacing control (verify existing)
14. Add delete mask button
15. Add scroll zoom

### Phase 4: Polish (Week 4)
16-24. Remaining TODO items

---

## Performance Optimizations

### Baseline Drag Performance
**Problem**: When dragging existing baselines, `updateBaseline`/`updateAngledBaseline` is called on every mouse move, triggering WordPreview recalculation of all character heights.

**Current behavior**:
1. Mouse move → `updateBaseline(id, newY)`
2. Store updates `baselines` array
3. WordPreview's useEffect has `baselines` as dependency
4. Full `renderCanvas()` runs - recalculates all character positions based on baseline alignment
5. This happens 60+ times per second during drag

**Solution** (same pattern as kerning optimization):
1. Add `previewBaseline` state in PixiCanvasTest: `{ id, type, y }` for horizontal or `{ id, type, startY, endY }` for angled
2. Add `previewBaselineRef` to track current value for mouseup handler
3. During drag: update `previewBaseline` state (local), don't call store
4. On mouseup: commit to store with `updateBaseline`/`updateAngledBaseline`
5. Pass `previewBaseline` to WordPreview (or use context/store for preview state)
6. WordPreview uses preview value during drag, falls back to store value otherwise

**Complexity**: Medium - need to pass preview state to WordPreview, or add preview state to store

**Files**: `PixiCanvasTest.jsx`, `WordPreview.jsx`, potentially `useAnnotatorStore.js`

---

### Box Drag Performance (Already Optimized)
Box dragging uses `draggedBoxPreview` local state and only commits on mouseup. ✅

### Kerning Drag Performance (Already Optimized)
Kerning dragging uses `previewKerning` local state and only commits on mouseup. ✅

---

## Testing Checklist

After each fix, test:
- [ ] Does it work with single character?
- [ ] Does it work with duplicate characters (HELLO)?
- [ ] Does it work after rotating image?
- [ ] Does it work after applying filters?
- [ ] Does it work after resizing box?
- [ ] Does it persist in ZIP export/import?
- [ ] Does it work on mobile/touch screens?
