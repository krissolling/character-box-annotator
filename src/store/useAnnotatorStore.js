import { create } from 'zustand';

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
  currentTool: 'pointer', // 'pointer', 'box', 'brush', 'rotate', 'baseline', 'autosolve'
  selectedBox: null,

  // Auto-solve state
  isSelectingAutoSolveRegion: false,
  autoSolveRegions: [],
  currentAutoSolveRegion: null,
  isProcessingOCR: false,

  // Brush box state
  isBrushBoxMode: false,
  brushBoxSize: 40,
  brushStrokes: [], // Array of stroke paths

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

  // Actions
  setIsAnnotating: (value) => set({ isAnnotating: value }),

  setImage: (image, file) => set({ image, imageFile: file }),

  setText: (text) => {
    const uniqueChars = [...new Set(text.split(''))];
    saveText(text); // Save to localStorage
    set({ text, uniqueChars, currentCharIndex: 0, boxes: [] });
  },

  addBox: (box) => set((state) => {
    // Find closest baseline and assign to box
    const baselineInfo = get().findClosestBaseline(box.y, box.height, box.x, box.width);
    if (baselineInfo) {
      box.baseline_id = baselineInfo.baseline_id;
      box.baseline_offset = baselineInfo.baseline_offset;
    }
    return {
      boxes: [...state.boxes, box]
    };
  }),

  updateBox: (index, updates) => set((state) => {
    const updatedBox = { ...state.boxes[index], ...updates };

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

    return {
      boxes: state.boxes.map((box, i) => i === index ? updatedBox : box)
    };
  }),

  deleteBox: (index) => set((state) => ({
    boxes: state.boxes.filter((_, i) => i !== index)
  })),

  setSelectedBox: (index) => set({ selectedBox: index }),

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

  clearAutoSolveRegions: () => set({
    autoSolveRegions: [],
    currentAutoSolveRegion: null,
    isSelectingAutoSolveRegion: false,
    currentTool: 'box',
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

  setBrushBoxSize: (size) => set({ brushBoxSize: Math.max(10, Math.min(100, size)) }),

  addBrushStroke: (stroke) => set((state) => ({
    brushStrokes: [...state.brushStrokes, stroke],
  })),

  cancelBrushBox: () => set({
    isBrushBoxMode: false,
    brushStrokes: [],
    currentTool: 'box',
  }),

  confirmBrushBox: () => {
    const state = get();
    if (state.brushStrokes.length === 0) return;

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

    const boxWidth = maxX - minX + brushRadius * 2;
    const boxHeight = maxY - minY + brushRadius * 2;
    const boxX = Math.max(0, minX - brushRadius);
    const boxY = Math.max(0, minY - brushRadius);

    const box = {
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      char: state.uniqueChars[state.currentCharIndex],
      charIndex: state.currentCharIndex,
      // Store brush strokes as mask (in ABSOLUTE image pixel coordinates)
      brushMask: state.brushStrokes.map(stroke => ({
        points: stroke.points.map(p => ({
          x: p.x,  // Absolute image coordinates (canvas pixels)
          y: p.y   // Absolute image coordinates (canvas pixels)
        })),
        size: stroke.size || state.brushBoxSize // Absolute pixel size
      }))
    };

    // Find closest baseline and assign to box
    const baselineInfo = get().findClosestBaseline(box.y, box.height, box.x, box.width);
    if (baselineInfo) {
      box.baseline_id = baselineInfo.baseline_id;
      box.baseline_offset = baselineInfo.baseline_offset;
    }

    // Add the box
    set((state) => {
      const newBoxes = [...state.boxes, box];

      // Check if all unique characters have been annotated
      const annotatedChars = new Set(newBoxes.map(b => b.char));
      const allAnnotated = state.uniqueChars.every(char => annotatedChars.has(char));

      if (allAnnotated) {
        // All characters have been annotated - switch to pointer mode
        return {
          boxes: newBoxes,
          isBrushBoxMode: false,
          brushStrokes: [],
          currentTool: 'pointer',
          currentCharIndex: -1,
        };
      } else {
        // Find next character that doesn't have a box yet
        // First search forward from current position
        let nextIndex = state.currentCharIndex + 1;
        while (nextIndex < state.uniqueChars.length) {
          const hasBox = newBoxes.some(b => b.charIndex === nextIndex);
          if (!hasBox) break;
          nextIndex++;
        }

        // If nothing found forward, search from the beginning
        if (nextIndex >= state.uniqueChars.length) {
          nextIndex = 0;
          while (nextIndex < state.currentCharIndex) {
            const hasBox = newBoxes.some(b => b.charIndex === nextIndex);
            if (!hasBox) break;
            nextIndex++;
          }
        }

        // Stay in brush mode for next character
        return {
          boxes: newBoxes,
          isBrushBoxMode: true,
          brushStrokes: [],
          currentTool: 'brush',
          currentCharIndex: nextIndex,
        };
      }
    });
  },

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
    // First, add the baseline to state
    set((state) => ({
      baselines: [...state.baselines, {
        id: state.baselineIdCounter,
        y: y,
        color: ['#FF5252', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4'][state.baselines.length % 6],
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
    // First, add the angled baseline to state
    set((state) => ({
      angledBaselines: [...state.angledBaselines, {
        id: state.angledBaselineIdCounter,
        start: start,
        end: end,
        angle: angle,
        color: ['#FF5252', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4'][state.angledBaselines.length % 6],
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

  resetZoom: () => set({ zoomLevel: 1.0, panOffset: { x: 0, y: 0 } }),

  fitToView: (imageWidth, imageHeight, containerWidth, containerHeight) => {
    const zoomToFitWidth = containerWidth / imageWidth;
    const zoomToFitHeight = containerHeight / imageHeight;
    const fitZoom = Math.min(zoomToFitWidth, zoomToFitHeight);
    set({ zoomLevel: fitZoom, panOffset: { x: 0, y: 0 } });
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

  setBoxes: (boxes) => set({ boxes }),

  setEditedCharData: (editedCharData) => set({ editedCharData }),

  setKerningAdjustments: (kerningAdjustments) => set({ kerningAdjustments }),

  setBaselines: (baselines) => set({ baselines }),

  setAngledBaselines: (angledBaselines) => set({ angledBaselines }),

  setImageRotation: (rotation) => set({ imageRotation: rotation }),

  setImageFilters: (filters) => set({ imageFilters: filters }),

  updateKerning: (index, value) => set((state) => ({
    kerningAdjustments: { ...state.kerningAdjustments, [index]: value }
  })),

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

  reset: () => set({
    isAnnotating: false,
    image: null,
    imageFile: null,
    text: '',
    boxes: [],
    currentCharIndex: 0,
    uniqueChars: [],
    selectedBox: null,
    editedChars: {},
    baselines: [],
    kerningAdjustments: {},
    zoomLevel: 1.0,
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
