# React Annotator Refactoring Tasks

## Todo List for Annotator UI Improvements

### 1. Fix 'currently drawn' letter not appearing during annotation
**Issue:** When user is actively drawing a box, the letter they selected doesn't show as visual feedback.
**File:** `src/components/canvas/AnnotationCanvas.jsx`
**Action:** Check rendering logic for active letter display

---

### 2. Fix TWO label edge problems
**Issues:**
- (a) Letter labels prevent drawing boxes close to image edges
- (b) Labels themselves get cut off when near edges

**Solution Options:**
- Add padding to physical image canvas, OR
- Implement smart label repositioning that keeps labels inside bounds

**File:** `src/components/canvas/AnnotationCanvas.jsx`

---

### 3. Add support for multiple bounding boxes per letter
**Breaking Change:** Moving from single box per letter to multiple boxes per letter (e.g., two separate 'E' boxes)

**Requirements:**
- Users need to select WHICH box to use in the word preview panel at bottom
- Update data structure in `src/store/useAnnotatorStore.js`
- Add selection UI in `src/components/sidebar/CharacterPicker.jsx`

---

### 4. Auto-switch to box drawing tool in THREE scenarios
**Scenarios:**
1. After auto-OCR completes
2. After clicking a letter in CharacterPicker sidebar
3. After clicking an existing bounding box label on canvas

**File:** `src/components/canvas/ToolPalette.jsx`
**Action:** Set box tool as default in these contexts

---

### 5. Add edge resize handles for bounding boxes
**Current:** Can only resize from corners
**Needed:**
- Drag horizontal edges (left/right) to adjust width
- Drag vertical edges (top/bottom) to adjust height

**File:** `src/components/canvas/AnnotationCanvas.jsx`
**Action:** Implement hit detection for edge handles

---

### 6. Ensure entire UI fits in single viewport without scrolling
**Requirement:** All panels (sidebar, canvas, word preview) must be visible at once without vertical/horizontal scroll

**File:** `src/components/MainAnnotator.jsx`
**Action:** Adjust layout constraints with responsive CSS

---

### 7. Fix invert controls to invert word preview instead of base canvas
**Current:** Invert button inverts the main canvas image
**Needed:** Invert should apply to the word preview panel at bottom

**Action:** Update invert logic to target correct component

---

### 8. Fix coordinate discrepancy between cursor position and box drawing
**Issue:** Boxes are drawn offset from where user clicks on canvas - likely canvas scaling/coordinate transformation problem

**File:** `src/components/canvas/AnnotationCanvas.jsx`
**Action:** Check mouse event handlers and coordinate mapping (account for canvas scale, scroll offset, CSS transforms)

---

### 9. Implement canvas zoom/scale controls
**Requirements:**
- Canvas container should fill all available space
- Image inside should be scalable (zoom in/out)
- Bounding boxes must scale proportionally with image

**File:** `src/components/canvas/AnnotationCanvas.jsx`
**Action:** Add zoom controls (buttons/slider) and update coordinate transformations for both drawing and display

---

### 10. Wire up brush box confirmation (ALREADY IMPLEMENTED IN STORE)
**Current:** Alert placeholder in FloatingActionButtons.jsx:26
**Needed:** Call the existing `confirmBrushBox()` function from the store

**Note:** The logic is FULLY IMPLEMENTED in `useAnnotatorStore.js:199-234`. It calculates bbox from strokes, adds padding, creates box, and clears strokes.

**File:** `src/components/canvas/FloatingActionButtons.jsx:23-28`
**Action:**
- Import `confirmBrushBox` from the store (line ~13)
- Replace alert with `confirmBrushBox()` call (line 26)
- Remove manual `clearBrushStrokes()` call (line 28) as it's handled by confirmBrushBox

---

### 11. Implement auto-solve with Tesseract OCR
**Current:** Alert placeholder in FloatingActionButtons.jsx:35
**Needed:** Run Tesseract OCR on user-drawn regions to automatically detect and annotate text

**File:** `src/components/canvas/FloatingActionButtons.jsx`
**Action:** Implement logic to:
- Extract image regions from autoSolveRegions
- Run Tesseract OCR on each region
- Parse results and create bounding boxes for detected characters
- Match detected text to the input string

---

### 12. Implement string input modal
**Current:** Alert placeholders in ModeControls.jsx:39 and :78
**Needed:** Modal/dialog for users to input the text string they want to annotate

**File:** Create new component (e.g., `src/components/modals/StringInputModal.jsx`)
**Action:**
- Create modal component with text input field
- Wire up to buttons in ModeControls.jsx
- Update store to set text when modal is submitted
- Parse unique characters from input string

---

### 13. Add ZIP download with original image and complete JSON data
**Current Issues:**
- JSON export is missing eraseMask data (only has `hasEditedChar` flag in WordPreview.jsx:55)
- No way to restore complete annotation state with masks

**Needed:**
1. Fix JSON export to include eraseMask data from `editedCharData`
2. Add "Download ZIP" button that creates zip file containing:
   - Original source image
   - Complete JSON with all mask data (brushMask + eraseMask)
3. Add "Upload ZIP" function to restore complete annotation state
4. Parse zip, load image, restore all state including masks

**Files:**
- `src/components/sidebar/WordPreview.jsx` - Add eraseMask to JSON export (line 44-65)
- Add zip library (e.g., JSZip) to package.json
- Create upload handler in SetupPanel or new component

---

## File Reference

**Key files for these tasks:**
- `src/components/canvas/AnnotationCanvas.jsx` - Canvas rendering, drawing, coordinates
- `src/components/canvas/ToolPalette.jsx` - Tool selection logic
- `src/components/sidebar/CharacterPicker.jsx` - Character selection UI
- `src/store/useAnnotatorStore.js` - State management
- `src/components/MainAnnotator.jsx` - Main layout
