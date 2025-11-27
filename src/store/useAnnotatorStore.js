import { create } from 'zustand';
import { mergeEraseMasks, scaleEraseMask, serializeEraseMask, brushMaskToEraseMask } from '../utils/maskUtils';
import { migrateBoxes } from '../utils/migrateMasks';

// Load saved text from localStorage on init
const loadSavedText = () => {
  try {
    return localStorage.getItem('annotator-text') || '';
  } catch (error) {
    console.error('Failed to load text from localStorage:', error);
    return '';
  }
};

// Save text to localStorage
const saveText = (text) => {
  try {
    localStorage.setItem('annotator-text', text);
  } catch (error) {
    console.error('Failed to save text to localStorage:', error);
  }
};

const useAnnotatorStore = create((set, get) => {
  const savedText = loadSavedText();
  return {
    // Setup state
    isAnnotating: false,
    image: null,
    imageFile: null,
    text: savedText,
    currentProjectId: null, // ID of the current project in storage (for auto-save)

    // Annotation state
    boxes: [],
    currentCharIndex: 0,
    uniqueChars: savedText ? [...new Set(savedText.split(''))] : [],

  // Canvas state
  scale: 1,
  zoomLevel: 1.0,
  baseScale: 1.0,
  panOffset: { x: 0, y: 0 },
  isPanning: false,

  // Tool state
  currentTool: 'pointer', // 'pointer', 'box', 'brush', 'rotate', 'baseline', 'autosolve', 'zoom'
  selectedBox: null,

  // Zoom tool state
  isZoomMode: false,
  zoomDragStart: null,
  zoomStartLevel: 1.0,

  // Auto-solve state
  isSelectingAutoSolveRegion: false,
  autoSolveRegions: [],
  currentAutoSolveRegion: null,
  isProcessingOCR: false,
  hasRunAutoOCR: false, // Track if auto-OCR has run for this session
  triggerFullOCR: false, // Set to true to trigger full-file OCR with line selection

  // Brush box state
  isBrushBoxMode: false,
  brushBoxSize: 40,
  brushStrokes: [], // Array of stroke paths
  brushSizeDragStart: null, // For shift+drag brush size adjustment
  brushSizeStartValue: 40,

  // Sanitize state (for detecting and masking intruding partial letters)
  pendingSanitizeBox: null, // Box waiting for sanitize confirm/dismiss
  pendingSanitizeAnalysis: null, // Analysis result with intruder mask

  // Rotation state
  imageRotation: 0, // Rotation angle in degrees
  isRotationMode: false,
  rotationLineStart: null,
  rotationLineEnd: null,

  // Baseline state
  baselines: [],
  baselineIdCounter: 0,
  isBaselineMode: false,
  tempBaselineY: null,

  // Angled baseline state
  angledBaselines: [],
  angledBaselineIdCounter: 0,
  isAngledBaselineMode: false,
  angledBaselineLineStart: null,
  angledBaselineLineEnd: null,
  tempAngledBaselinePos: null,

  // Baseline drag state (for performance optimization)
  isDraggingBaseline: false,

  // Character edit state
  editingBoxIndex: null,
  editBrushSize: 40,
  editedCharData: {}, // Store edited image data by box index

  // Drawing state
  isDrawing: false,
  isDraggingBox: false,
  isResizingBox: false,
  resizeCorner: null, // 'nw', 'ne', 'sw', 'se'
  dragStartPos: { x: 0, y: 0 },
  boxStartPos: { x: 0, y: 0, width: 0, height: 0 },

  // Filter state
  imageFilters: {
    invert: false,
    brightness: 100,
    contrast: 100,
    shadows: 0,
    highlights: 0,
    grayscale: 100,
  },

  // Levels adjustment (Photoshop-style)
  levelsAdjustment: null, // { shadowInput, highlightInput, midtones } or null

  // Character editing
  editedChars: {},

  // Baseline system
  baselines: [],

  // Kerning
  kerningAdjustments: {},
  letterSpacing: 0,
  charPadding: 0,
  placeholderOpacity: 1.0, // 1.0 for preview, 0.1 for export
  caseSensitive: true, // If false, uppercase can substitute for lowercase and vice versa in preview

  // Actions
  setIsAnnotating: (value) => set({ isAnnotating: value }),

  setImage: (image, file) => set({ image, imageFile: file }),

  // Centralized function to advance to next unannotated character
  // Returns the next charIndex or -1 if all are annotated
  // If stayInMode is true, keeps current drawing tool; otherwise switches to pointer
  advanceToNextChar: (stayInMode = true) => {
    const state = get();
    const currentTool = state.currentTool;
    const annotatedIndices = new Set(state.boxes.map(b => b.charIndex));

    // Check if all unique characters have been annotated
    const allAnnotated = state.uniqueChars.every((_, idx) => annotatedIndices.has(idx));

    if (allAnnotated) {
      // All characters annotated - switch to pointer mode
      set({
        currentCharIndex: -1,
        currentTool: 'pointer',
        isBrushBoxMode: false,
        isSelectingAutoSolveRegion: false,
      });
      return -1;
    }

    // Find next unannotated character
    // First search forward from current position
    let nextIndex = state.currentCharIndex + 1;
    while (nextIndex < state.uniqueChars.length) {
      if (!annotatedIndices.has(nextIndex)) break;
      nextIndex++;
    }

    // If nothing found forward, search from the beginning
    if (nextIndex >= state.uniqueChars.length) {
      nextIndex = 0;
      while (nextIndex < state.currentCharIndex) {
        if (!annotatedIndices.has(nextIndex)) break;
        nextIndex++;
      }
    }

    // If we still haven't found an unannotated character (shouldn't happen given allAnnotated check)
    if (annotatedIndices.has(nextIndex)) {
      set({
        currentCharIndex: -1,
        currentTool: 'pointer',
        isBrushBoxMode: false,
        isSelectingAutoSolveRegion: false,
      });
      return -1;
    }

    // Update state based on whether to stay in current mode
    if (stayInMode && (currentTool === 'brush' || currentTool === 'box' || currentTool === 'autosolve')) {
      // Stay in current drawing mode
      set({
        currentCharIndex: nextIndex,
        // Ensure mode flags are consistent with tool
        isBrushBoxMode: currentTool === 'brush',
        isSelectingAutoSolveRegion: currentTool === 'autosolve',
      });
    } else {
      set({
        currentCharIndex: nextIndex,
        currentTool: 'pointer',
        isBrushBoxMode: false,
        isSelectingAutoSolveRegion: false,
      });
    }

    return nextIndex;
  },

  // Check if drawing tools are usable (have a valid character selected)
  canDraw: () => {
    const state = get();
    return state.currentCharIndex >= 0 && state.currentCharIndex < state.uniqueChars.length;
  },

  setText: (text) => {
    const uniqueChars = [...new Set(text.split(''))];
    saveText(text); // Save to localStorage
    // DON'T clear boxes - keep all boxes for persistence
    // Boxes will be filtered by rendering logic to show only active ones
    // Remap charIndex for all boxes based on their char property
    set((state) => {
      const updatedBoxes = state.boxes.map(box => {
        const newCharIndex = uniqueChars.indexOf(box.char);
        return {
          ...box,
          charIndex: newCharIndex,
        };
      });
      return {
        text,
        uniqueChars,
        currentCharIndex: 0,
        boxes: updatedBoxes
      };
    });
  },

  // Update text without clearing boxes or other state
  updateTextOnly: (text) => {
    const uniqueChars = [...new Set(text.split(''))];
    saveText(text); // Save to localStorage
    // Remap charIndex for all boxes based on their char property
    set((state) => {
      const updatedBoxes = state.boxes.map(box => {
        const newCharIndex = uniqueChars.indexOf(box.char);
        return {
          ...box,
          charIndex: newCharIndex,
        };
      });
      return {
        text,
        uniqueChars,
        currentCharIndex: 0,
        boxes: updatedBoxes
      };
    });
  },

  addBox: (box) => set((state) => {
    // Find closest baseline and assign to box
    const baselineInfo = get().findClosestBaseline(box.y, box.height, box.x, box.width);
    if (baselineInfo) {
      box.baseline_id = baselineInfo.baseline_id;
      box.baseline_offset = baselineInfo.baseline_offset;
    }

    // Check if a box already exists for this charIndex - if so, replace it
    // BUT: Don't replace orphaned boxes (charIndex: -1) - allow multiple orphaned boxes
    if (box.charIndex !== -1) {
      const existingIndex = state.boxes.findIndex(b => b.charIndex === box.charIndex);

      if (existingIndex !== -1) {
        // Replace existing box for this character
        console.log(`🔄 Replacing existing box for '${box.char}' (charIndex: ${box.charIndex})`);
        const newBoxes = [...state.boxes];
        newBoxes[existingIndex] = box;
        return { boxes: newBoxes };
      }
    }

    // Add new box (either no existing box found, or this is an orphaned box)
    return {
      boxes: [...state.boxes, box]
    };
  }),

  updateBox: (index, updates) => set((state) => {
    const oldBox = state.boxes[index];
    const updatedBox = { ...oldBox, ...updates };

    if (oldBox.eraseMask && (updates.x !== undefined || updates.y !== undefined || updates.width !== undefined || updates.height !== undefined)) {
      console.log(`📦 Updating box "${oldBox.char}":`, {
        oldPos: { x: oldBox.x, y: oldBox.y },
        oldSize: { w: oldBox.width, h: oldBox.height },
        newPos: { x: updatedBox.x, y: updatedBox.y },
        newSize: { w: updatedBox.width, h: updatedBox.height },
        maskPos: { x: oldBox.eraseMask.offsetX, y: oldBox.eraseMask.offsetY },
        maskStaysAtSamePosition: true
      });
    }

    // Reassign baseline if box position/size changed
    if (updates.x !== undefined || updates.y !== undefined || updates.width !== undefined || updates.height !== undefined) {
      const baselineInfo = get().findClosestBaseline(updatedBox.y, updatedBox.height, updatedBox.x, updatedBox.width);
      if (baselineInfo) {
        updatedBox.baseline_id = baselineInfo.baseline_id;
        updatedBox.baseline_offset = baselineInfo.baseline_offset;
      } else {
        delete updatedBox.baseline_id;
        delete updatedBox.baseline_offset;
      }
    }

    // NOTE: Masks use absolute image coordinates and NEVER move or scale.
    // They stay fixed at their absolute position (offsetX, offsetY) in the image.
    // This ensures masks always align with the same image pixels, regardless of
    // box position or size changes. The rendering code clips masks to box bounds.

    return {
      boxes: state.boxes.map((box, i) => i === index ? updatedBox : box)
    };
  }),

  deleteBox: (index) => set((state) => {
    const deletedBox = state.boxes[index];
    const newBoxes = state.boxes.filter((_, i) => i !== index);

    // If currentCharIndex is invalid (-1), set it to the deleted box's charIndex
    // so user can immediately re-draw that character
    let newCurrentCharIndex = state.currentCharIndex;
    if (deletedBox && state.currentCharIndex < 0) {
      newCurrentCharIndex = deletedBox.charIndex;
    }

    return {
      boxes: newBoxes,
      currentCharIndex: newCurrentCharIndex,
      selectedBox: null, // Clear selection since the box is gone
    };
  }),

  // Get the box for a specific charIndex (only one box per char now)
  getBoxForChar: (charIndex) => {
    const state = get();
    return state.boxes.find(box => box.charIndex === charIndex) || null;
  },

  // Get active boxes (characters in current string)
  getActiveBoxes: () => {
    const state = get();
    return state.boxes.filter(box => state.uniqueChars.includes(box.char));
  },

  // Get orphaned boxes (characters NOT in current string)
  getOrphanedBoxes: () => {
    const state = get();
    return state.boxes.filter(box => !state.uniqueChars.includes(box.char));
  },

  setSelectedBox: (index) => set({ selectedBox: index }),

  // Bring a box to the front (render on top) by moving it to the end of the array
  bringBoxToFront: (index) => set((state) => {
    if (index === null || index === undefined || index < 0 || index >= state.boxes.length) {
      return state; // Invalid index, no change
    }

    // If already at the end, no need to move
    if (index === state.boxes.length - 1) {
      return state;
    }

    const newBoxes = [...state.boxes];
    const [movedBox] = newBoxes.splice(index, 1); // Remove from current position
    newBoxes.push(movedBox); // Add to end

    console.log(`📤 Brought box ${index} to front (now at index ${newBoxes.length - 1})`);

    return {
      boxes: newBoxes,
      selectedBox: newBoxes.length - 1 // Update selected index to new position
    };
  }),

  setCurrentCharIndex: (index) => set({ currentCharIndex: index }),

  nextChar: () => set((state) => {
    const nextIndex = state.currentCharIndex + 1;
    if (nextIndex < state.uniqueChars.length) {
      return { currentCharIndex: nextIndex };
    }
    return {};
  }),

  previousChar: () => set((state) => {
    const prevIndex = state.currentCharIndex - 1;
    if (prevIndex >= 0) {
      return { currentCharIndex: prevIndex };
    }
    return {};
  }),

  setCurrentTool: (tool) => set({ currentTool: tool }),

  // Trigger full-file OCR
  runFullFileOCR: () => set({
    triggerFullOCR: true,
    hasRunAutoOCR: false, // Reset to allow re-run
  }),

  resetOCRTrigger: () => set({ triggerFullOCR: false }),

  // Auto-solve actions
  startAutoSolveRegionSelection: () => set({
    isSelectingAutoSolveRegion: true,
    autoSolveRegions: [],
    currentAutoSolveRegion: null,
    currentTool: 'autosolve',
    selectedBox: null,
    // Deactivate other modes
    isBrushBoxMode: false,
    isRotationMode: false,
    isBaselineMode: false,
    isAngledBaselineMode: false,
  }),

  addAutoSolveRegion: (region) => set((state) => ({
    autoSolveRegions: [...state.autoSolveRegions, region],
    currentAutoSolveRegion: null,
  })),

  setCurrentAutoSolveRegion: (region) => set({ currentAutoSolveRegion: region }),

  cancelAutoSolve: () => set({
    isSelectingAutoSolveRegion: false,
    autoSolveRegions: [],
    currentAutoSolveRegion: null,
    currentTool: 'box',
  }),

  setIsProcessingOCR: (value) => set({ isProcessingOCR: value }),

  setHasRunAutoOCR: (value) => set({ hasRunAutoOCR: value }),

  clearAutoSolveRegions: () => set({
    autoSolveRegions: [],
    currentAutoSolveRegion: null,
    // Stay in auto-solve mode so user can continue drawing regions
  }),

  // Brush box actions
  startBrushBoxMode: () => set({
    isBrushBoxMode: true,
    brushStrokes: [],
    currentTool: 'brush',
    selectedBox: null,
    // Deactivate other modes
    isSelectingAutoSolveRegion: false,
    isRotationMode: false,
    isBaselineMode: false,
    isAngledBaselineMode: false,
  }),

  setBrushBoxSize: (size) => set({ brushBoxSize: Math.max(5, Math.min(600, size)) }),

  setBrushSizeDragStart: (x, currentSize) => set({
    brushSizeDragStart: x,
    brushSizeStartValue: currentSize,
  }),

  clearBrushSizeDrag: () => set({
    brushSizeDragStart: null,
  }),

  addBrushStroke: (stroke) => set((state) => ({
    brushStrokes: [...state.brushStrokes, stroke],
  })),

  cancelBrushBox: () => set({
    isBrushBoxMode: false,
    brushStrokes: [],
    currentTool: 'box',
  }),

  // Clear brush strokes but stay in brush mode
  clearBrushStrokes: () => set({
    brushStrokes: [],
  }),

  confirmBrushBox: () => {
    const state = get();
    if (state.brushStrokes.length === 0) return;

    // Guard: ensure currentCharIndex is valid
    if (state.currentCharIndex < 0 || state.currentCharIndex >= state.uniqueChars.length) {
      console.warn('⚠️ Cannot confirm brush box: invalid currentCharIndex', state.currentCharIndex);
      // Clear brush strokes but don't create a box
      set({ brushStrokes: [] });
      return;
    }

    // Calculate bounding box from all strokes
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    state.brushStrokes.forEach((stroke) => {
      // Support both old format (array) and new format (object with points)
      const points = stroke.points || stroke;
      const strokeSize = stroke.size || state.brushBoxSize; // Use stroke's size or current brush size
      points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    // Add padding around the brush strokes
    // Use exact brush radius (half the brush size) for precise bounding
    const brushRadius = state.brushBoxSize / 2;

    const boxWidth = Math.round(maxX - minX + brushRadius * 2);
    const boxHeight = Math.round(maxY - minY + brushRadius * 2);
    const boxX = Math.max(0, minX - brushRadius);
    const boxY = Math.max(0, minY - brushRadius);

    // Convert brush strokes to absolute coordinate format for conversion
    const brushMaskStrokes = state.brushStrokes.map(stroke => ({
      points: stroke.points.map(p => ({
        x: p.x,
        y: p.y
      })),
      size: stroke.size || state.brushBoxSize
    }));

    // Convert brush strokes to eraseMask (inverted - erases OUTSIDE the strokes)
    const eraseMask = brushMaskToEraseMask(brushMaskStrokes, boxWidth, boxHeight, boxX, boxY);

    console.log(`🖌️ Created brush mask:`, {
      boxPosition: { x: boxX, y: boxY },
      boxSize: { w: boxWidth, h: boxHeight },
      maskPosition: { x: eraseMask?.offsetX, y: eraseMask?.offsetY },
      maskSize: { w: eraseMask?.width, h: eraseMask?.height }
    });

    const box = {
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      char: state.uniqueChars[state.currentCharIndex],
      charIndex: state.currentCharIndex,
      eraseMask: eraseMask, // Unified mask format
    };

    // Add the box
    get().addBox(box);

    // Clear brush strokes
    set({ brushStrokes: [] });

    // Advance to next character using centralized logic
    get().advanceToNextChar(true);
  },

  // Sanitize actions (for detecting and masking intruding partial letters)
  setPendingSanitize: (box, analysis) => set({
    pendingSanitizeBox: box,
    pendingSanitizeAnalysis: analysis,
  }),

  clearPendingSanitize: () => set({
    pendingSanitizeBox: null,
    pendingSanitizeAnalysis: null,
  }),

  confirmSanitize: () => {
    const state = get();
    if (!state.pendingSanitizeBox || !state.pendingSanitizeAnalysis) return;

    // Find the box index
    const boxIndex = state.boxes.findIndex(b =>
      b.x === state.pendingSanitizeBox.x &&
      b.y === state.pendingSanitizeBox.y &&
      b.width === state.pendingSanitizeBox.width &&
      b.height === state.pendingSanitizeBox.height
    );

    if (boxIndex !== -1) {
      // Apply the sanitize erase mask to the box
      const eraseMask = state.pendingSanitizeAnalysis.eraseMask;

      set((s) => ({
        boxes: s.boxes.map((b, i) =>
          i === boxIndex
            ? { ...b, eraseMask }
            : b
        ),
        pendingSanitizeBox: null,
        pendingSanitizeAnalysis: null,
      }));
    } else {
      // Clear pending state even if box not found
      set({
        pendingSanitizeBox: null,
        pendingSanitizeAnalysis: null,
      });
    }
  },

  dismissSanitize: () => set({
    pendingSanitizeBox: null,
    pendingSanitizeAnalysis: null,
  }),

  // Set eraseMask on a box (replaces any existing mask)
  setBoxEraseMask: (boxIndex, eraseMask) => set((state) => ({
    boxes: state.boxes.map((b, i) =>
      i === boxIndex
        ? { ...b, eraseMask }
        : b
    ),
  })),

  // Merge new eraseMask with existing mask on a box
  mergeBoxEraseMask: (boxIndex, newEraseMask) => set((state) => ({
    boxes: state.boxes.map((b, i) => {
      if (i !== boxIndex) return b;
      const merged = mergeEraseMasks(b.eraseMask, newEraseMask);
      return { ...b, eraseMask: merged };
    }),
  })),

  // Clear eraseMask from a box
  clearBoxEraseMask: (boxIndex) => set((state) => ({
    boxes: state.boxes.map((b, i) =>
      i === boxIndex
        ? { ...b, eraseMask: null }
        : b
    ),
  })),

  // Rotation actions
  startRotationMode: () => set({
    isRotationMode: true,
    rotationLineStart: null,
    rotationLineEnd: null,
    currentTool: 'rotate',
    selectedBox: null,
    // Deactivate other modes
    isSelectingAutoSolveRegion: false,
    isBrushBoxMode: false,
    isBaselineMode: false,
    isAngledBaselineMode: false,
  }),

  setRotationLineStart: (pos) => set({ rotationLineStart: pos }),

  setRotationLineEnd: (pos) => set({ rotationLineEnd: pos }),

  confirmRotation: () => {
    const state = get();
    if (!state.rotationLineStart || !state.rotationLineEnd) return;

    const dx = state.rotationLineEnd.x - state.rotationLineStart.x;
    const dy = state.rotationLineEnd.y - state.rotationLineStart.y;
    const angleRad = Math.atan2(dy, dx);
    let angleDeg = angleRad * (180 / Math.PI);

    // Normalize angle to -180 to 180 range
    while (angleDeg > 180) angleDeg -= 360;
    while (angleDeg < -180) angleDeg += 360;

    // Calculate distances to horizontal (0°) and vertical (90° or -90°)
    const distToHorizontal = Math.abs(angleDeg);
    const distToVertical = Math.min(Math.abs(angleDeg - 90), Math.abs(angleDeg + 90));

    // Determine which direction is closer and calculate rotation needed
    let rotationAngle;
    if (distToHorizontal < distToVertical) {
      // Closer to horizontal - rotate to make line horizontal (0°)
      rotationAngle = -angleDeg;
    } else {
      // Closer to vertical - rotate to make line vertical
      if (Math.abs(angleDeg - 90) < Math.abs(angleDeg + 90)) {
        rotationAngle = 90 - angleDeg; // Rotate to 90°
      } else {
        rotationAngle = -90 - angleDeg; // Rotate to -90°
      }
    }

    // Add to existing rotation instead of replacing it
    const newRotation = state.imageRotation + rotationAngle;

    set({
      imageRotation: newRotation,
      isRotationMode: false,
      rotationLineStart: null,
      rotationLineEnd: null,
      currentTool: 'pointer',
    });
  },

  cancelRotation: () => set({
    isRotationMode: false,
    rotationLineStart: null,
    rotationLineEnd: null,
    currentTool: 'pointer',
  }),

  resetRotation: () => set({
    imageRotation: 0,
    isRotationMode: false,
    rotationLineStart: null,
    rotationLineEnd: null,
  }),

  // Zoom tool actions
  startZoomMode: () => set({
    isZoomMode: true,
    zoomDragStart: null,
    currentTool: 'zoom',
    selectedBox: null,
    // Deactivate other modes
    isSelectingAutoSolveRegion: false,
    isBrushBoxMode: false,
    isRotationMode: false,
    isBaselineMode: false,
    isAngledBaselineMode: false,
  }),

  cancelZoom: () => set({
    isZoomMode: false,
    zoomDragStart: null,
    currentTool: 'pointer',
  }),

  setZoomDragStart: (pos, level) => set({
    zoomDragStart: pos,
    zoomStartLevel: level,
  }),

  clearZoomDrag: () => set({
    zoomDragStart: null,
  }),

  // Baseline actions
  startBaselineMode: () => set({
    isBaselineMode: true,
    tempBaselineY: null,
    currentTool: 'baseline',
    selectedBox: null,
    // Deactivate other modes
    isSelectingAutoSolveRegion: false,
    isBrushBoxMode: false,
    isRotationMode: false,
    isAngledBaselineMode: false,
  }),

  setTempBaselineY: (y) => set({ tempBaselineY: y }),

  addBaseline: (y) => {
    // Design system colors for baselines
    const baselineColors = ['#FF6B00', '#00B4D8', '#4ADE80', '#FFD60A', '#EF4444'];

    // First, add the baseline to state
    set((state) => ({
      baselines: [...state.baselines, {
        id: state.baselineIdCounter,
        y: y,
        color: baselineColors[state.baselines.length % baselineColors.length],
      }],
      baselineIdCounter: state.baselineIdCounter + 1,
      tempBaselineY: null,
    }));

    // Then re-associate all boxes with baselines (including the new one)
    set((state) => ({
      boxes: state.boxes.map(box => {
        const baselineInfo = get().findClosestBaseline(box.y, box.height, box.x, box.width);
        if (baselineInfo) {
          return { ...box, baseline_id: baselineInfo.baseline_id, baseline_offset: baselineInfo.baseline_offset };
        }
        return box;
      })
    }));
  },

  removeBaseline: (id) => set((state) => ({
    baselines: state.baselines.filter((b) => b.id !== id),
    // Clear baseline association from any boxes that used this baseline
    boxes: state.boxes.map(box => {
      if (box.baseline_id === id) {
        const { baseline_id, baseline_offset, ...boxWithoutBaseline } = box;
        return boxWithoutBaseline;
      }
      return box;
    })
  })),

  cancelBaseline: () => set({
    isBaselineMode: false,
    tempBaselineY: null,
    currentTool: 'box',
  }),

  // Angled baseline actions
  startAngledBaselineMode: () => set({
    isAngledBaselineMode: true,
    angledBaselineLineStart: null,
    angledBaselineLineEnd: null,
    tempAngledBaselinePos: null,
    currentTool: 'angled',
    selectedBox: null,
    // Deactivate other modes
    isBaselineMode: false,
    isRotationMode: false,
    isBrushBoxMode: false,
    isSelectingAutoSolveRegion: false,
  }),

  setAngledBaselineLineStart: (pos) => set({ angledBaselineLineStart: pos }),

  setAngledBaselineLineEnd: (pos) => set({ angledBaselineLineEnd: pos }),

  setTempAngledBaselinePos: (pos) => set({ tempAngledBaselinePos: pos }),

  addAngledBaseline: (start, end, angle) => {
    // Design system colors for baselines
    const baselineColors = ['#FF6B00', '#00B4D8', '#4ADE80', '#FFD60A', '#EF4444'];

    // First, add the angled baseline to state
    set((state) => ({
      angledBaselines: [...state.angledBaselines, {
        id: state.angledBaselineIdCounter,
        start: start,
        end: end,
        angle: angle,
        color: baselineColors[state.angledBaselines.length % baselineColors.length],
      }],
      angledBaselineIdCounter: state.angledBaselineIdCounter + 1,
      angledBaselineLineStart: null,
      angledBaselineLineEnd: null,
      tempAngledBaselinePos: null,
    }));

    // Then re-associate all boxes with baselines (including the new one)
    set((state) => ({
      boxes: state.boxes.map(box => {
        const baselineInfo = get().findClosestBaseline(box.y, box.height, box.x, box.width);
        if (baselineInfo) {
          return { ...box, baseline_id: baselineInfo.baseline_id, baseline_offset: baselineInfo.baseline_offset };
        }
        return box;
      })
    }));
  },

  removeAngledBaseline: (id) => set((state) => ({
    angledBaselines: state.angledBaselines.filter((b) => b.id !== id),
    // Clear baseline association from any boxes that used this baseline
    boxes: state.boxes.map(box => {
      if (box.baseline_id === id) {
        const { baseline_id, baseline_offset, ...boxWithoutBaseline } = box;
        return boxWithoutBaseline;
      }
      return box;
    })
  })),

  cancelAngledBaseline: () => set({
    isAngledBaselineMode: false,
    angledBaselineLineStart: null,
    angledBaselineLineEnd: null,
    tempAngledBaselinePos: null,
    currentTool: 'box',
  }),

  resetAngledBaseline: () => set({
    angledBaselines: [],
    isAngledBaselineMode: false,
    angledBaselineLineStart: null,
    angledBaselineLineEnd: null,
    tempAngledBaselinePos: null,
  }),

  // Character edit actions
  openCharacterEdit: (boxIndex) => set({
    editingBoxIndex: boxIndex,
  }),

  closeCharacterEdit: () => set({
    editingBoxIndex: null,
  }),

  setEditBrushSize: (size) => set({ editBrushSize: Math.max(5, Math.min(100, size)) }),

  saveEditedChar: (boxIndex, imageData) => set((state) => ({
    editedCharData: { ...state.editedCharData, [boxIndex]: imageData },
    editingBoxIndex: null,
  })),

  setZoomLevel: (level) => {
    const clampedLevel = Math.max(0.1, Math.min(4.0, level));
    set({ zoomLevel: clampedLevel });
  },

  zoomIn: () => set((state) => {
    const newLevel = Math.min(4.0, state.zoomLevel + 0.25);
    return { zoomLevel: newLevel };
  }),

  zoomOut: () => set((state) => {
    const newLevel = Math.max(0.1, state.zoomLevel - 0.25);
    return { zoomLevel: newLevel };
  }),

  resetZoom: (imageWidth, imageHeight, containerWidth, containerHeight) => {
    // Calculate centering position at 1.0 zoom
    const scaledWidth = imageWidth * 1.0;
    const scaledHeight = imageHeight * 1.0;
    const centerX = (containerWidth - scaledWidth) / 2;
    const centerY = (containerHeight - scaledHeight) / 2;
    set({ zoomLevel: 1.0, panOffset: { x: centerX, y: centerY } });
  },

  fitToView: (imageWidth, imageHeight, containerWidth, containerHeight) => {
    const zoomToFitWidth = containerWidth / imageWidth;
    const zoomToFitHeight = containerHeight / imageHeight;
    const fitZoom = Math.min(zoomToFitWidth, zoomToFitHeight);

    // Calculate centering position (react-zoom-pan-pinch approach)
    // After scaling, the displayed size is: imageWidth * fitZoom x imageHeight * fitZoom
    const scaledWidth = imageWidth * fitZoom;
    const scaledHeight = imageHeight * fitZoom;
    const centerX = (containerWidth - scaledWidth) / 2;
    const centerY = (containerHeight - scaledHeight) / 2;

    set({ zoomLevel: fitZoom, panOffset: { x: centerX, y: centerY } });
  },

  setPanOffset: (offset) => set({ panOffset: offset }),

  setIsPanning: (isPanning) => set({ isPanning }),

  setIsDraggingBox: (isDragging) => set({ isDraggingBox: isDragging }),

  setIsResizingBox: (isResizing, corner = null) => set({ isResizingBox: isResizing, resizeCorner: corner }),

  setDragStart: (pos, boxPos) => set({ dragStartPos: pos, boxStartPos: boxPos }),

  updateFilter: (key, value) => set((state) => ({
    imageFilters: { ...state.imageFilters, [key]: value }
  })),

  resetFilters: () => set({
    imageFilters: {
      invert: false,
      brightness: 100,
      contrast: 100,
      shadows: 0,
      highlights: 0,
      grayscale: 100,
    },
    levelsAdjustment: null
  }),

  setLevelsAdjustment: (levels) => set({ levelsAdjustment: levels }),

  setLetterSpacing: (value) => set({ letterSpacing: value }),

  setCharPadding: (value) => set({ charPadding: value }),
  setPlaceholderOpacity: (value) => set({ placeholderOpacity: value }),

  setCaseSensitive: (value) => set((state) => {
    // When case sensitivity changes, remap box charIndex values
    const updatedBoxes = state.boxes.map(box => {
      let newCharIndex = state.uniqueChars.indexOf(box.char);

      // If not found and going case-insensitive, try opposite case
      if (newCharIndex === -1 && !value) {
        const oppositeCase = box.char === box.char.toUpperCase()
          ? box.char.toLowerCase()
          : box.char.toUpperCase();
        newCharIndex = state.uniqueChars.indexOf(oppositeCase);
      }

      return {
        ...box,
        charIndex: newCharIndex,
      };
    });

    console.log('🔤 Case sensitivity changed to:', value, '- remapped', updatedBoxes.length, 'boxes');

    return { caseSensitive: value, boxes: updatedBoxes };
  }),

  setBoxes: (boxes) => set({ boxes: migrateBoxes(boxes) }),

  setEditedCharData: (editedCharData) => set({ editedCharData }),

  setKerningAdjustments: (kerningAdjustments) => set({ kerningAdjustments }),

  setBaselines: (baselines) => set({ baselines }),

  updateBaseline: (id, newY) => set((state) => {
    console.log('📏 updateBaseline called:', { id, newY });
    const updatedBaselines = state.baselines.map(b => b.id === id ? { ...b, y: newY } : b);

    // Recalculate box-baseline associations for all boxes
    const updatedBoxes = state.boxes.map(box => {
      const boxBottom = box.y + box.height;

      // Check all baselines (including the updated one)
      const allBaselines = [
        ...updatedBaselines.map(b => ({ ...b, type: 'horizontal' })),
        ...state.angledBaselines.map(b => ({ ...b, type: 'angled' }))
      ];

      for (const baseline of allBaselines) {
        if (baseline.type === 'angled') {
          const angleRad = baseline.angle * (Math.PI / 180);
          const slope = Math.tan(angleRad);
          const baselineYAtBox = baseline.start.y + slope * (box.x - baseline.start.x);
          if (baselineYAtBox >= box.y && baselineYAtBox <= boxBottom) {
            console.log(`  📦 Box "${box.char}" associated with angled baseline ${baseline.id}`);
            return { ...box, baseline_id: baseline.id, baseline_offset: baselineYAtBox - box.y };
          }
        } else {
          if (baseline.y >= box.y && baseline.y <= boxBottom) {
            console.log(`  📦 Box "${box.char}" associated with horizontal baseline ${baseline.id} (y=${baseline.y}, boxY=${box.y}-${boxBottom})`);
            return { ...box, baseline_id: baseline.id, baseline_offset: baseline.y - box.y };
          }
        }
      }
      // No baseline intersects - clear association
      if (box.baseline_id !== undefined) {
        console.log(`  📦 Box "${box.char}" cleared baseline association`);
      }
      return { ...box, baseline_id: undefined, baseline_offset: undefined };
    });

    console.log('📏 updateBaseline result:', {
      baselinesCount: updatedBaselines.length,
      boxesCount: updatedBoxes.length,
      boxesWithBaseline: updatedBoxes.filter(b => b.baseline_id !== undefined).length
    });

    return { baselines: updatedBaselines, boxes: updatedBoxes };
  }),

  setAngledBaselines: (angledBaselines) => set({ angledBaselines }),

  updateAngledBaseline: (id, newStartY, newEndY) => set((state) => {
    const updatedAngledBaselines = state.angledBaselines.map(b => b.id === id ? {
      ...b,
      startY: newStartY,
      endY: newEndY
    } : b);

    // Recalculate box-baseline associations for all boxes
    const updatedBoxes = state.boxes.map(box => {
      const boxBottom = box.y + box.height;

      // Check all baselines (including the updated one)
      const allBaselines = [
        ...state.baselines.map(b => ({ ...b, type: 'horizontal' })),
        ...updatedAngledBaselines.map(b => ({ ...b, type: 'angled' }))
      ];

      for (const baseline of allBaselines) {
        if (baseline.type === 'angled') {
          const angleRad = baseline.angle * (Math.PI / 180);
          const slope = Math.tan(angleRad);
          const baselineYAtBox = baseline.start.y + slope * (box.x - baseline.start.x);
          if (baselineYAtBox >= box.y && baselineYAtBox <= boxBottom) {
            return { ...box, baseline_id: baseline.id, baseline_offset: baselineYAtBox - box.y };
          }
        } else {
          if (baseline.y >= box.y && baseline.y <= boxBottom) {
            return { ...box, baseline_id: baseline.id, baseline_offset: baseline.y - box.y };
          }
        }
      }
      // No baseline intersects - clear association
      return { ...box, baseline_id: undefined, baseline_offset: undefined };
    });

    return { angledBaselines: updatedAngledBaselines, boxes: updatedBoxes };
  }),

  setIsDraggingBaseline: (value) => set({ isDraggingBaseline: value }),

  setImageRotation: (rotation) => set({ imageRotation: rotation }),

  setImageFilters: (filters) => set({ imageFilters: filters }),

  updateKerning: (index, value) => set((state) => ({
    kerningAdjustments: { ...state.kerningAdjustments, [index]: value }
  })),

  // Apply a delta to all existing kerning adjustments (for global kerning adjustment)
  applyGlobalKerningDelta: (delta, textLength) => set((state) => {
    const newKerning = { ...state.kerningAdjustments };
    // Apply delta to all character pairs (0 to textLength-2)
    for (let i = 0; i < textLength - 1; i++) {
      newKerning[i] = (newKerning[i] || 0) + delta;
    }
    return { kerningAdjustments: newKerning };
  }),

  // Find baseline that intersects with a box (only returns if actual overlap)
  findClosestBaseline: (boxY, boxHeight, boxX = 0, boxWidth = 0) => {
    const state = get();
    const boxBottom = boxY + boxHeight;
    const allBaselines = [
      ...state.baselines.map(b => ({ ...b, type: 'horizontal' })),
      ...state.angledBaselines.map(b => ({ ...b, type: 'angled' }))
    ];

    for (const baseline of allBaselines) {
      if (baseline.type === 'angled') {
        // For angled baseline, find where it intersects the box
        // Use the LEFT EDGE of the box as the reference point
        const angleRad = baseline.angle * (Math.PI / 180);

        // Calculate Y coordinate of the baseline at the box's left edge
        const slope = Math.tan(angleRad);
        const baselineYAtBox = baseline.start.y + slope * (boxX - baseline.start.x);

        // Check if baseline intersects the box vertically
        if (baselineYAtBox >= boxY && baselineYAtBox <= boxBottom) {
          return {
            baseline_id: baseline.id,
            baseline_offset: baselineYAtBox - boxY
          };
        }
      } else {
        // Horizontal baseline
        // Check if baseline intersects the box
        if (baseline.y >= boxY && baseline.y <= boxBottom) {
          return {
            baseline_id: baseline.id,
            baseline_offset: baseline.y - boxY
          };
        }
      }
    }

    // No intersection found
    return null;
  },

  setCurrentProjectId: (id) => set({ currentProjectId: id }),

  reset: () => set({
    isAnnotating: false,
    image: null,
    imageFile: null,
    text: '',
    currentProjectId: null,
    boxes: [],
    currentCharIndex: 0,
    uniqueChars: [],
    selectedBox: null,
    editedChars: {},
    baselines: [],
    kerningAdjustments: {},
    zoomLevel: 1.0,
    hasRunAutoOCR: false,
  }),

  // Export functionality
  exportData: () => {
    const state = get();
    return {
      text: state.text,
      boxes: state.boxes,
      baselines: state.baselines,
      kerningAdjustments: state.kerningAdjustments,
      letterSpacing: state.letterSpacing,
      charPadding: state.charPadding,
      imageFile: state.imageFile?.name,
      timestamp: new Date().toISOString(),
    };
  },
};});

export default useAnnotatorStore;
