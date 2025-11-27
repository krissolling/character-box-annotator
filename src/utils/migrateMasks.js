/**
 * Migration utilities for converting old mask formats to the new unified eraseMask format
 */

import { brushMaskToEraseMask, mergeEraseMasks, rgbaToEraseMask } from './maskUtils';

/**
 * Migrate a single box from old mask formats to new eraseMask format
 * @param {Object} box - Box object that may have old mask data
 * @returns {Object} Box with migrated eraseMask
 */
export function migrateBox(box) {
  if (!box) return box;

  const migratedBox = { ...box };
  let needsMigration = false;
  let eraseMask = box.eraseMask || null;

  // Convert old brushMask (stroke array) to eraseMask
  if (box.brushMask && box.brushMask.length > 0 && !box.eraseMask) {
    console.log(`📦 Migrating brushMask for "${box.char}" to eraseMask`);
    const brushEraseMask = brushMaskToEraseMask(
      box.brushMask,
      Math.round(box.width),
      Math.round(box.height),
      box.x,
      box.y
    );
    eraseMask = mergeEraseMasks(eraseMask, brushEraseMask);
    delete migratedBox.brushMask;
    needsMigration = true;
  }

  // Convert old eraseMaskData (RGBA format) to eraseMask
  if (box.eraseMaskData && box.eraseMaskData.isEraseMask) {
    console.log(`📦 Migrating eraseMaskData for "${box.char}" to eraseMask`);
    const { pixels, width, height } = box.eraseMaskData;
    // Old format stored RGBA pixels, convert to single-channel
    const newEraseMask = rgbaToEraseMask(pixels, width, height);
    eraseMask = mergeEraseMasks(eraseMask, newEraseMask);
    delete migratedBox.eraseMaskData;
    needsMigration = true;
  }

  if (needsMigration) {
    migratedBox.eraseMask = eraseMask;
  }

  return migratedBox;
}

/**
 * Migrate all boxes in an array
 * @param {Array} boxes - Array of box objects
 * @returns {Array} Array of boxes with migrated masks
 */
export function migrateBoxes(boxes) {
  if (!boxes || !Array.isArray(boxes)) return boxes;

  let migratedCount = 0;
  const migratedBoxes = boxes.map(box => {
    const migrated = migrateBox(box);
    if (migrated !== box) migratedCount++;
    return migrated;
  });

  if (migratedCount > 0) {
    console.log(`✅ Migrated ${migratedCount} boxes to new eraseMask format`);
  }

  return migratedBoxes;
}

/**
 * Check if any boxes need migration
 * @param {Array} boxes - Array of box objects
 * @returns {boolean} True if any boxes have old mask formats
 */
export function needsMigration(boxes) {
  if (!boxes || !Array.isArray(boxes)) return false;

  return boxes.some(box =>
    (box.brushMask && box.brushMask.length > 0) ||
    (box.eraseMaskData && box.eraseMaskData.isEraseMask)
  );
}
