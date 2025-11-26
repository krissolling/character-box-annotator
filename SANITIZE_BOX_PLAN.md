# Sanitize Bounding Box Feature Plan

## Problem

When drawing a bounding box around a letter, users often accidentally include parts of neighboring letters. For example, boxing "A" in "CAT" might include:
- Part of the "C" on the left edge
- Part of the "T" on the right edge

Currently users must manually mask these partial letters. We want to auto-detect and mask them.

## Proposed Hybrid Approach

### Step 1: Binary Conversion
- Convert box region to binary (black/white) based on current filter settings
- Respect invert setting (white-on-black vs black-on-white)
- Use adaptive threshold or current brightness/contrast settings

### Step 2: Connected Component Analysis
- Find all connected dark regions using flood fill / blob detection
- For each blob, calculate:
  - Bounding box
  - Centroid (center of mass)
  - Area (pixel count)
  - Which edges it touches (left, right, top, bottom)

### Step 3: Scoring Each Blob
Score each blob to determine if it's the target letter or an intruder:

**Positive signals (keep):**
- Centroid is in the center 60% of the box
- Large area relative to box size
- Spans most of the box height (for most letters)
- Doesn't touch left/right edges OR touches both (spans the box)

**Negative signals (mask):**
- Centroid is in the outer 20% of the box
- Touches only one edge (left OR right) but not both
- Small area relative to the main blob
- Column density shows a "valley" (gap) between this blob and center content

### Step 4: Column Density Validation
For blobs flagged as potential intruders:
1. Calculate vertical pixel density per column
2. Look for valleys (low density columns) between the blob and box center
3. If a clear valley exists, confirm it's a separate letter and mask it

### Step 5: Auto-Mask Generation
- For each blob identified as an intruder:
  - Generate a mask that covers just that blob
  - Store as `brushMask` on the box (same format as manual brush masking)
  - Or store as `autoMask` to differentiate from manual masks

## Key Considerations

### Edge Cases
- Letters like "i", "j" have disconnected components (dot + stem) - need to group nearby blobs
- Tight bounding boxes where target letter touches edge
- Very thin letters vs thick neighboring letters
- Italic/slanted text where letters overlap more

### User Experience
- Should be optional (toggle or button to apply)
- Easy to undo if it masks the wrong thing
- Visual feedback showing what will be masked before confirming
- Could run automatically on box creation with "undo" option

### Performance
- Canvas `getImageData` is synchronous and can be slow for large boxes
- Flood fill on large regions could be expensive
- Consider running in a Web Worker for large images
- Could optimize by downsampling for analysis, then upsampling mask

### Threshold Sensitivity
- Need to determine what counts as "dark" enough
- Could use Otsu's method for automatic threshold
- Or leverage existing levels/contrast settings

## MVP Implementation

Start simple with column density analysis on left/right edges only:

1. Get imageData for the box region
2. Convert to grayscale, apply threshold
3. Sum dark pixels per column to get density profile
4. From left edge: find first column where density drops below threshold (valley)
5. From right edge: same process
6. If valley found within first 20% of width, mask everything from edge to valley
7. Apply mask to box

## Future Enhancements

- Top/bottom edge analysis for ascenders/descenders
- Machine learning model trained on letter segmentation
- Integration with OCR confidence scores
- Batch processing for all boxes
- Preview mode showing proposed masks before applying
