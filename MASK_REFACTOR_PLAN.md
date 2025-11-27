# Mask System Refactor Plan

## Goal

Standardize all mask types into a single, efficient format stored directly on each box.

## Current State (Before)

| Source | Storage | Format | Semantics |
|--------|---------|--------|-----------|
| Brush tool | `box.brushMask` | `[{points: [{x,y}...], size}]` | Keep painted area |
| Sanitize | `box.eraseMaskData` | `{pixels, width, height}` | Erase marked pixels |
| Manual edit | `editedCharData[idx].eraseMask` | `[{points: [{x,y}...], size}]` | Erase painted area |

**Problems:**
- 3 different storage locations
- 2 different formats (strokes vs pixels)
- 2 different semantics (keep vs erase)
- Stroke format is slow for large masks (hundreds of arc() calls)
- Coordinates stored as absolute image pixels (breaks on move/resize)

## Target State (After)

```javascript
box.eraseMask = {
  pixels: Uint8Array,  // Single channel, 0 = keep, 255 = erase
  width: number,
  height: number
} | null
```

**Benefits:**
- Single storage location (`box.eraseMask`)
- Single format (pixel array)
- Single semantic (erase)
- Fast rendering (one putImageData + drawImage)
- Coordinates relative to box (0,0 to width,height)
- Masks survive move/resize operations

## Coordinate System

All mask coordinates are **relative to the box**, not absolute image coordinates:
- `(0, 0)` = top-left corner of box
- `(width-1, height-1)` = bottom-right corner of box
- Mask dimensions match box dimensions

When box moves or resizes:
- Move: mask stays the same (it's relative)
- Resize: mask needs to be scaled (bilinear interpolation)

## Migration Steps

### Phase 1: Create Utility Functions

**File: `src/utils/maskUtils.js`**

```javascript
// Convert stroke array to eraseMask pixel data
export function strokesToEraseMask(strokes, width, height, boxX, boxY, invert = false)

// Merge two eraseMasks (OR operation)
export function mergeEraseMasks(mask1, mask2)

// Scale eraseMask when box is resized
export function scaleEraseMask(mask, newWidth, newHeight)

// Convert old brushMask format to eraseMask (with inversion)
export function brushMaskToEraseMask(brushMask, boxWidth, boxHeight, boxX, boxY)

// Render eraseMask to canvas for display (returns ImageData with RGBA)
export function eraseMaskToImageData(eraseMask)
```

### Phase 2: Update Store

**File: `src/store/useAnnotatorStore.js`**

Changes:
1. Remove `editedCharData` (or repurpose for non-mask data)
2. Rename action `applySanitizeEraseMask` → `setEraseMask`
3. Add action `mergeEraseMask(boxIndex, newMaskData)` for combining masks
4. Update `confirmSanitize` to use new format
5. Remove `saveEditedChar` or change to only save non-mask edits

### Phase 3: Update Brush Tool

**File: `src/components/canvas/AnnotationCanvas.jsx`**

When brush strokes are confirmed:
1. Calculate bounding box from strokes (existing logic)
2. Create new box with dimensions
3. Render strokes to offscreen canvas (box dimensions)
4. Invert the result (strokes = keep, so invert = erase outside)
5. Extract pixel data as `eraseMask`
6. Store `box.eraseMask = { pixels, width, height }`

No more `box.brushMask` array - converted immediately to `eraseMask`.

### Phase 4: Update Sanitize

**File: `src/utils/sanitizeBox.js`**

Changes:
1. `generateEraseMaskData` already returns correct format
2. Rename to just `generateEraseMask` for consistency
3. Ensure output is single-channel (not RGBA) for storage efficiency
4. Update callers to use `box.eraseMask` instead of `box.eraseMaskData`

**Files to update:**
- `src/components/MainAnnotator.jsx`
- `src/components/canvas/AnnotationCanvas.jsx`
- `src/components/canvas/BoxActionsPanel.jsx`
- `src/store/useAnnotatorStore.js`

### Phase 5: Update CharacterEditModal

**File: `src/components/modals/CharacterEditModal.jsx`**

Changes:
1. Load existing `box.eraseMask` on open
2. Convert to display canvas for editing
3. User paints erase strokes (red = will be erased)
4. On save: merge new strokes into existing eraseMask
5. Store back to `box.eraseMask`
6. Remove all `editedCharData` references

The modal becomes a direct editor for `box.eraseMask`.

### Phase 6: Update WordPreview

**File: `src/components/sidebar/WordPreview.jsx`**

Simplify rendering:
1. Remove all `brushMask` stroke rendering code
2. Remove `eraseMaskData` handling (now just `eraseMask`)
3. Remove `editedCharData.eraseMask` handling
4. Single code path: if `box.eraseMask` exists, apply it with `destination-out`

```javascript
if (box.eraseMask) {
  // Create ImageData from eraseMask
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = box.eraseMask.width;
  maskCanvas.height = box.eraseMask.height;
  const maskCtx = maskCanvas.getContext('2d');

  const imageData = maskCtx.createImageData(width, height);
  // Convert single-channel to RGBA (white where erase)
  for (let i = 0; i < box.eraseMask.pixels.length; i++) {
    const rgba = i * 4;
    const val = box.eraseMask.pixels[i];
    imageData.data[rgba] = val;
    imageData.data[rgba + 1] = val;
    imageData.data[rgba + 2] = val;
    imageData.data[rgba + 3] = val;
  }
  maskCtx.putImageData(imageData, 0, 0);

  // Apply as erase
  tempCtx.globalCompositeOperation = 'destination-out';
  tempCtx.drawImage(maskCanvas, 0, 0, width, height,
                    charPadding, charPadding, box.width, box.height);
  tempCtx.globalCompositeOperation = 'source-over';
}
```

### Phase 7: Update Box Move/Resize

**File: `src/store/useAnnotatorStore.js`** (or wherever box updates happen)

When box is resized:
1. Check if `box.eraseMask` exists
2. Scale mask to new dimensions using `scaleEraseMask()`
3. Update box with new mask

When box is moved:
- No mask changes needed (coordinates are relative)

### Phase 8: Update Export

**File: Export functionality**

Ensure JSON export includes `eraseMask` in a serializable format:
```javascript
{
  boxes: [
    {
      x, y, width, height, char, charIndex,
      eraseMask: {
        width: 100,
        height: 80,
        pixels: [0, 0, 255, 255, ...] // or base64 encoded
      }
    }
  ]
}
```

### Phase 9: Migration/Backward Compatibility

For existing saved data with old format:

```javascript
function migrateBox(box) {
  // Convert old brushMask to eraseMask
  if (box.brushMask && !box.eraseMask) {
    box.eraseMask = brushMaskToEraseMask(box.brushMask, box.width, box.height, box.x, box.y);
    delete box.brushMask;
  }

  // Rename eraseMaskData to eraseMask
  if (box.eraseMaskData && !box.eraseMask) {
    box.eraseMask = {
      pixels: new Uint8Array(box.eraseMaskData.pixels.map(p => p > 0 ? 255 : 0)),
      width: box.eraseMaskData.width,
      height: box.eraseMaskData.height
    };
    delete box.eraseMaskData;
  }

  return box;
}
```

Run migration on load/import.

### Phase 10: Cleanup

Remove deprecated code:
- [ ] Remove `brushMask` handling from all files
- [ ] Remove `eraseMaskData` handling (replaced by `eraseMask`)
- [ ] Remove `editedCharData` from store (or repurpose)
- [ ] Remove stroke rendering loops in WordPreview
- [ ] Remove `generateMaskStrokes` function
- [ ] Update CLAUDE.md documentation

## File Change Summary

| File | Changes |
|------|---------|
| `src/utils/maskUtils.js` | **NEW** - Mask utility functions |
| `src/utils/sanitizeBox.js` | Rename output, use single-channel |
| `src/store/useAnnotatorStore.js` | Remove editedCharData, rename actions |
| `src/components/canvas/AnnotationCanvas.jsx` | Convert brush strokes to eraseMask |
| `src/components/canvas/BoxActionsPanel.jsx` | Use new mask format |
| `src/components/modals/CharacterEditModal.jsx` | Edit eraseMask directly |
| `src/components/sidebar/WordPreview.jsx` | Simplify to single mask path |
| `src/components/MainAnnotator.jsx` | Update sanitize calls |

## Testing Checklist

- [x] Brush tool creates box with eraseMask (areas outside strokes erased)
- [x] Sanitize adds eraseMask (intruder pixels erased)
- [x] CharacterEditModal shows existing eraseMask as red overlay
- [x] CharacterEditModal allows painting additional erase areas
- [x] CharacterEditModal save merges new strokes into eraseMask
- [x] CharacterEditModal delete clears eraseMask
- [x] WordPreview renders eraseMask correctly (erased areas transparent)
- [x] Box move preserves eraseMask
- [x] Box resize scales eraseMask
- [x] Export includes eraseMask data
- [x] Import/load migrates old formats

## COMPLETED - 2025-11-26

## Implementation Order

1. **maskUtils.js** - Foundation utilities
2. **sanitizeBox.js** - Update to new format
3. **Store** - Add/rename actions
4. **WordPreview** - Render new format
5. **CharacterEditModal** - Edit new format
6. **AnnotationCanvas** - Brush tool conversion
7. **Migration** - Handle old data
8. **Cleanup** - Remove old code

Estimated effort: Medium refactor, ~2-3 hours of focused work.
