/**
 * Calculate intersection points of a line with a rectangle's edges
 * @param {Object} center - Center point {x, y}
 * @param {number} angleRad - Angle in radians
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @returns {Object} Start and end points {start: {x, y}, end: {x, y}}
 */
export function extendLineToEdges(center, angleRad, width, height) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const intersections = [];

  // Left edge (x = 0)
  if (cos !== 0) {
    const t = -center.x / cos;
    const y = center.y + t * sin;
    if (y >= 0 && y <= height) {
      intersections.push({ x: 0, y, t });
    }
  }

  // Right edge (x = width)
  if (cos !== 0) {
    const t = (width - center.x) / cos;
    const y = center.y + t * sin;
    if (y >= 0 && y <= height) {
      intersections.push({ x: width, y, t });
    }
  }

  // Top edge (y = 0)
  if (sin !== 0) {
    const t = -center.y / sin;
    const x = center.x + t * cos;
    if (x >= 0 && x <= width) {
      intersections.push({ x, y: 0, t });
    }
  }

  // Bottom edge (y = height)
  if (sin !== 0) {
    const t = (height - center.y) / sin;
    const x = center.x + t * cos;
    if (x >= 0 && x <= width) {
      intersections.push({ x, y: height, t });
    }
  }

  // Sort by t value to get start and end
  intersections.sort((a, b) => a.t - b.t);

  // Return the two extreme points (or fallback to extended line)
  if (intersections.length >= 2) {
    return {
      start: { x: intersections[0].x, y: intersections[0].y },
      end: { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y }
    };
  }

  // Fallback: extend line by a large amount
  const extendLength = Math.max(width, height) * 2;
  return {
    start: {
      x: center.x - cos * extendLength,
      y: center.y - sin * extendLength
    },
    end: {
      x: center.x + cos * extendLength,
      y: center.y + sin * extendLength
    }
  };
}
