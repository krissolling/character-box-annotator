# Character Box Annotator - TODO

## ✅ COMPLETED

### From Latest Session (UI Improvements + Variants)
- [x] Made Baselines panel compact when empty (minimal padding)
- [x] Made Edited Characters panel compact when empty (minimal padding)
- [x] Collapsible Visual Controls sliders with chevron toggle
- [x] Keep Invert checkbox, Auto, and Reset buttons always visible
- [x] Fixed angled baseline click→drag→release behavior for 2nd+ baselines
- [x] Removed confirmation dialog when deleting bounding boxes (Delete/Backspace now instant)
- [x] **Multiple box variants per character** - Full implementation:
  - Data model with variantId support
  - Variant selection state management
  - Thumbnail UI in CharacterPicker (shows when multiple variants exist)
  - Click to select which variant to use
  - WordPreview renders using selected variants

### From Previous Sessions
- [x] Fix 'currently drawn' letter appearing during annotation
- [x] Fix label edge problems (smart label positioning)
- [x] Auto-switch to box tool after OCR/clicking character/clicking box label
- [x] Add edge resize handles for bounding boxes (top/bottom/left/right)
- [x] Ensure entire UI fits in viewport without scrolling
- [x] Fix invert controls to affect word preview (and now also main canvas)
- [x] Fix coordinate discrepancy (cursor position matches box drawing)
- [x] Implement canvas zoom/scale controls with pan
- [x] Wire up brush box confirmation
- [x] Implement auto-solve with Tesseract OCR
- [x] ZIP download/upload with complete state restoration
- [x] Rotation tool
- [x] Baseline tools (horizontal + angled)
- [x] Character edit modal with erase tool
- [x] Visual filter controls (brightness, contrast, shadows, highlights, grayscale, invert)
- [x] Kerning adjustment handles
- [x] Delete mask button in edit modal

---

## 🚧 TODO / NOT YET IMPLEMENTED

### High Priority - Variant System
- [ ] Test variant selection persistence in ZIP export/import
- [ ] Verify variants work correctly with brush/erase mask edits
- [ ] Add visual indicator on main canvas showing selected variant
- [ ] Test variant system with baseline alignment
- [ ] Consider adding delete button for individual variants (not whole character)

### Medium Priority - Features
- [ ] Undo/redo functionality for all operations
- [ ] Keyboard shortcuts documentation panel
- [ ] Export to other formats (SVG, PDF)
- [ ] Bulk operations (delete all boxes, reset all filters, etc.)
- [ ] Copy/paste boxes between characters

### Low Priority - Improvements
- [ ] Performance optimization for large images (>5000px)
- [ ] Better error messages for Tesseract OCR failures
- [ ] Loading indicators for slow operations
- [ ] Tooltips for all buttons
- [ ] Mobile/tablet responsiveness

### Bug Fixes / Edge Cases to Test
- [ ] Behavior when deleting a variant that's currently selected
- [ ] Verify kerning adjustments work correctly with variants
- [ ] Check if rotation works correctly with variant rendering
- [ ] Test filter adjustments with variants
- [ ] Verify mask rendering works with variants

---

## 📝 NOTES

### How the Variant System Works
1. **Drawing multiple boxes:** You can now draw 2+ boxes for the same character (e.g., two different 'L' boxes)
2. **Auto-assigned IDs:** First box gets `variantId: 0`, second gets `variantId: 1`, etc.
3. **Thumbnail UI:** CharacterPicker shows clickable thumbnails when `variants.length > 1`
4. **Selection:** Click a thumbnail to choose which variant to use (blue border = selected)
5. **Rendering:** WordPreview uses `selectedVariants[charIndex]` to pick the right box
6. **Default:** If no variant explicitly selected, uses `variantId: 0`

### Recent Files Modified (Latest Session)
- `src/store/useAnnotatorStore.js` - Added variantId, selectedVariants, setSelectedVariant(), getVariantsForChar()
- `src/components/canvas/AnnotationCanvas.jsx` - Allow multiple boxes per char, fix angled baseline drag
- `src/components/sidebar/CharacterPicker.jsx` - Variant thumbnail UI with VariantThumbnail component
- `src/components/sidebar/WordPreview.jsx` - Render using selected variants
- `src/components/sidebar/BaselineControls.jsx` - Compact empty state (4px padding)
- `src/components/sidebar/EditedCharacters.jsx` - Compact empty state (4px padding)
- `src/components/sidebar/FilterControls.jsx` - Collapsible sliders with ChevronDown/Up toggle
- `src/App.jsx` - Removed delete confirmation dialog

---

## 🎯 RECOMMENDED NEXT STEPS

1. **Test ZIP export/import** with variant selections to ensure persistence
2. **Test variants with edited characters** (brush/erase masks) to verify rendering
3. **Add visual feedback** on main canvas showing which variant is currently selected
4. **Consider UX improvement:** Individual variant delete button instead of deleting all boxes
