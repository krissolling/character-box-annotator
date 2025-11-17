# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Character Box Annotator is a React application for annotating character bounding boxes on images. Users upload an image, enter text to annotate, then draw boxes around each character. The app supports advanced features like brush masking, image rotation, baseline alignment, OCR auto-solve, and typography controls.

## Common Commands

### Development
```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Testing
Playwright tests are located in `tests/` directory:
```bash
npx playwright test                    # Run all tests
npx playwright test --ui               # Run tests in UI mode
npx playwright test full-workflow.spec.js  # Run specific test file
```

## Architecture

### State Management (Zustand)
The entire application state is managed by a single Zustand store in `src/store/useAnnotatorStore.js` (~700 lines). This is the single source of truth for:

- **Setup state**: `image`, `imageFile`, `text`, `isAnnotating`
- **Annotation state**: `boxes`, `currentCharIndex`, `uniqueChars`, `selectedVariants`
- **Canvas state**: `scale`, `zoomLevel`, `panOffset`, `isPanning`
- **Tool state**: `currentTool` (pointer, box, brush, rotate, baseline, autosolve)
- **Mode state**: Flags for each mode (`isBrushBoxMode`, `isRotationMode`, `isBaselineMode`, etc.)
- **Visual state**: `imageFilters`, `imageRotation`, `editedCharData`
- **Typography state**: `baselines`, `angledBaselines`, `kerningAdjustments`, `letterSpacing`

**Key patterns:**
- Text is persisted to localStorage on every change
- Boxes are never cleared when text changes (orphaned boxes are filtered in rendering)
- Each box has `charIndex`, `variantId`, `x`, `y`, `width`, `height`, `char`
- Boxes can have optional `brushMask` (array of stroke paths with points in absolute image coordinates)
- Boxes can have optional `baseline_id` and `baseline_offset` for baseline alignment

### Component Structure

```
App.jsx                          # Root component with keyboard shortcuts
├── SetupPanel (if !isAnnotating)
│   ├── ImageUploader            # Drag-and-drop image upload
│   └── TextInput                # Text entry
└── MainAnnotator (if isAnnotating)
    ├── AnnotationCanvas         # Main canvas (resizable, ~1500 lines)
    │   ├── ToolPalette          # Tool selection UI
    │   ├── ZoomControls         # Zoom in/out/fit/reset
    │   ├── ModeControls         # Mode-specific UIs
    │   ├── FloatingActionButtons
    │   └── [Various controls]
    ├── WordPreview              # Live preview of annotated text (~1000 lines)
    └── Sidebar (right column, 250px)
        ├── CharacterPicker      # Character selection & progress
        ├── BaselineControls     # Baseline management
        ├── EditedCharacters     # Character mask editing
        ├── OrphanedBoxes        # Orphaned box management
        └── FilterControls       # Image filters & levels
```

**AnnotationCanvas** is the most complex component:
- Handles all mouse interactions (drawing, panning, dragging, resizing)
- Renders image with rotation, filters, zoom, and pan transforms
- Renders boxes, baselines, brush strokes, and tool-specific overlays
- Implements pointer, box, brush, rotate, baseline, and autosolve tools
- Uses canvas coordinate transformation for zoom/pan (no longer scales drawings)

**WordPreview** renders the final text:
- Applies all filters, baselines, kerning, letter spacing
- Renders character images from boxes or edited character data
- Shows brush masks with red multiply blend mode overlay
- Supports export to PNG/ZIP

### Coordinate Systems

**Critical**: The app uses multiple coordinate systems:

1. **Image coordinates**: Absolute pixel positions on the source image (e.g., `box.x = 100`)
2. **Canvas coordinates**: Transformed by zoom and pan (`transform: translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`)
3. **Brush mask coordinates**: Stored in absolute image pixel coordinates, NOT relative to box
4. **Normalized coordinates**: Future improvement needed - masks should be stored as 0-1 normalized to box dimensions

**Known issue**: Brush masks are stored in absolute coordinates, so moving/resizing boxes doesn't update masks. See IMPLEMENTATION_PLAN.md for fix.

### Zoom Implementation

The app recently migrated from canvas-based scaling to CSS transform-based zoom (similar to react-zoom-pan-pinch):

- Image and all overlays are transformed via `transform: translate() scale()`
- All drawings (boxes, baselines, etc.) are done in absolute image pixel coordinates
- Mouse events are converted to image coordinates using `getImageCoordinates()`
- Zoom level ranges from 0.1 to 4.0, default 1.0

### Tools & Modes

Each tool is mutually exclusive. Switching tools cancels previous mode state:

- **Pointer**: Select, move, resize boxes
- **Box**: Draw rectangular bounding boxes
- **Brush**: Paint brush strokes, auto-generate bounding box on confirm
- **Rotate**: Draw line to rotate image to horizontal/vertical
- **Baseline**: Click to add horizontal baselines
- **Angled Baseline**: Draw line to add angled baselines
- **Auto-solve**: Draw regions for OCR (uses Tesseract.js)

### Box Variants

Characters can have multiple variants (e.g., different 'a' glyphs):
- First box for character gets `variantId: 0`
- Additional boxes get `variantId: 1, 2, ...`
- User selects active variant via `selectedVariants` map
- WordPreview uses selected variant or falls back to variant 0

### Brush Masking

Brush tool allows precise character shape annotation:
- User paints strokes over character
- On confirm, bounding box calculated from all strokes
- Strokes stored as `brushMask` array in box: `[{points: [{x, y}, ...], size: 40}, ...]`
- Points are in absolute image pixel coordinates
- Mask rendered in WordPreview as red overlay with multiply blend mode

### Baseline System

Two types of baselines:
1. **Horizontal baselines**: Simple Y coordinate
2. **Angled baselines**: Start/end points with angle

Boxes auto-associate with baselines on add/update:
- `findClosestBaseline()` checks if baseline intersects box vertically
- Box stores `baseline_id` and `baseline_offset` (distance from box top to baseline)
- WordPreview aligns characters using baseline offsets

### Image Filters

Available filters (applied during canvas rendering):
- Invert, Grayscale
- Brightness, Contrast
- Shadows, Highlights (Photoshop-style)
- Levels adjustment (shadow input, highlight input, midtones)

Filters applied via canvas `filter` CSS property and custom pixel manipulation.

### Character Editing

Users can edit individual character boxes:
- Opens `CharacterEditModal` with zoomed character view
- Paint with brush to mask unwanted pixels
- Edited data stored as ImageData in `editedCharData[boxIndex]`
- WordPreview uses edited data if available, otherwise renders from original box

### Export

Export via `ExportPanel`:
- JSON export: annotations, boxes, baselines, kerning, metadata
- PNG export: Rendered text as single image
- ZIP export: Individual character PNGs + JSON metadata

## Known Issues & TODOs

See `IMPLEMENTATION_PLAN.md` for detailed bug tracking. High-priority issues:

1. **Brush mask coordinates**: Masks don't follow box when moved/resized (need normalized coordinates)
2. **Filter controls**: Some filters (brightness, contrast) may not apply correctly
3. **Text editing**: Editing text should preserve existing boxes for unchanged characters
4. **Cursor-off-canvas**: Brush strokes don't register properly when cursor leaves canvas

## Code Conventions

- React functional components with hooks
- Zustand for global state (no prop drilling)
- Inline styles (no CSS modules or styled-components)
- TailwindCSS for some utility classes
- ESLint with React hooks plugin
- Vite for build tooling

## File Organization

- `src/components/setup/`: Initial setup UI (image upload, text input)
- `src/components/canvas/`: Main annotation canvas and tool controls
- `src/components/sidebar/`: Right sidebar panels (character picker, filters, etc.)
- `src/components/modals/`: Modal dialogs (character edit)
- `src/store/`: Zustand store
- `src/utils/`: Utilities (autoSolve.js for OCR)
- `tests/`: Playwright e2e tests

## Important Patterns

### Adding a New Tool
1. Add state to `useAnnotatorStore.js`: `isMyToolMode`, `myToolData`, etc.
2. Add tool to `currentTool` enum
3. Create `startMyToolMode()` action that sets mode flag and deactivates other modes
4. Add mouse handlers in `AnnotationCanvas.jsx`
5. Add rendering logic in `AnnotationCanvas.jsx`
6. Add UI controls in `ToolPalette.jsx` or `ModeControls.jsx`

### Working with Canvas Coordinates
Always convert mouse events to image coordinates:
```javascript
const getImageCoordinates = (e) => {
  const rect = canvasRef.current.getBoundingClientRect();
  const x = (e.clientX - rect.left - panOffset.x) / zoomLevel;
  const y = (e.clientY - rect.top - panOffset.y) / zoomLevel;
  return { x, y };
};
```

### Modifying Filters
Filters are applied in two places:
1. `AnnotationCanvas.jsx`: For editing view
2. `WordPreview.jsx`: For final rendering (lines 590-603)

Both must be kept in sync.
