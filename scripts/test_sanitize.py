#!/usr/bin/env python3
"""
Test various sanitization algorithms on bounding box images.

Algorithms tested:
1. Column Density Valley Detection (current implementation)
2. Connected Component Analysis (blob detection)
3. Vertical Projection Profile with Otsu threshold
4. Edge-aware flood fill from corners
5. Gradient-based edge detection

Run: python3 -u scripts/test_sanitize.py
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import os
from pathlib import Path
from scipy import ndimage
from skimage import filters, measure, morphology, segmentation
from skimage.color import rgb2gray
import warnings
warnings.filterwarnings('ignore')

# Output directory
OUTPUT_DIR = Path("public/sanitize-test/results")
OUTPUT_DIR.mkdir(exist_ok=True)

# Test images
TEST_IMAGES = [
    "public/sanitize-test/Screenshot 2025-11-26 at 19.23.20.png",
    "public/sanitize-test/Screenshot 2025-11-26 at 19.23.25.png",
    "public/sanitize-test/Screenshot 2025-11-26 at 19.23.41.png",
    "public/sanitize-test/Screenshot 2025-11-26 at 19.28.28.png",
    "public/sanitize-test/Screenshot 2025-11-26 at 19.28.47.png",
    "public/sanitize-test/Screenshot 2025-11-26 at 19.29.46.png",
]


def load_image(path):
    """Load image and convert to numpy array"""
    img = Image.open(path).convert('RGB')
    return np.array(img), img


def to_grayscale(img_array):
    """Convert to grayscale using luminance formula"""
    return 0.299 * img_array[:,:,0] + 0.587 * img_array[:,:,1] + 0.114 * img_array[:,:,2]


def detect_text_color(img_array):
    """
    Detect if text is dark-on-light or light-on-dark.
    Returns True if text appears darker than background.
    """
    gray = to_grayscale(img_array)
    # Check corners vs center
    h, w = gray.shape
    corner_avg = (gray[0,0] + gray[0,-1] + gray[-1,0] + gray[-1,-1]) / 4
    center_avg = gray[h//3:2*h//3, w//3:2*w//3].mean()
    return center_avg < corner_avg  # True if center (text) is darker


def get_binary(gray, invert=False):
    """Convert grayscale to binary using Otsu's threshold"""
    threshold = filters.threshold_otsu(gray)
    if invert:
        return gray > threshold  # Light pixels are foreground
    return gray < threshold  # Dark pixels are foreground


# ============================================================================
# Algorithm 1: Column Density Valley Detection (current implementation)
# ============================================================================
def algo_column_density(img_array, edge_search_percent=30, valley_threshold=0.15, min_valley_width=5):
    """
    Detect intruders by finding valleys in column density profile.
    If we see content at edge, then a valley, the edge content is an intruder.
    """
    gray = to_grayscale(img_array)
    is_dark_text = detect_text_color(img_array)
    binary = get_binary(gray, invert=not is_dark_text)

    h, w = binary.shape

    # Calculate column density (count of foreground pixels per column)
    column_density = binary.sum(axis=0)
    max_density = column_density.max()

    if max_density == 0:
        return None, None, {"column_density": column_density, "message": "No content detected"}

    valley_threshold_abs = max_density * valley_threshold
    content_threshold = max_density * 0.3
    edge_search_width = int(w * edge_search_percent / 100)

    # Search from left
    left_mask_end = None
    saw_content = False
    consecutive_low = 0

    for x in range(edge_search_width):
        is_content = column_density[x] > content_threshold
        is_valley = column_density[x] <= valley_threshold_abs

        if is_content:
            saw_content = True
            consecutive_low = 0
        elif is_valley and saw_content:
            consecutive_low += 1
            if consecutive_low >= min_valley_width:
                left_mask_end = x - consecutive_low + 1
                break
        else:
            consecutive_low = 0

    # Search from right
    right_mask_start = None
    saw_content = False
    consecutive_low = 0

    for x in range(w - 1, w - edge_search_width - 1, -1):
        is_content = column_density[x] > content_threshold
        is_valley = column_density[x] <= valley_threshold_abs

        if is_content:
            saw_content = True
            consecutive_low = 0
        elif is_valley and saw_content:
            consecutive_low += 1
            if consecutive_low >= min_valley_width:
                right_mask_start = x + consecutive_low
                break
        else:
            consecutive_low = 0

    return left_mask_end, right_mask_start, {
        "column_density": column_density,
        "max_density": max_density,
        "valley_threshold_abs": valley_threshold_abs,
        "content_threshold": content_threshold,
    }


# ============================================================================
# Algorithm 2: Connected Component Analysis (Shape-based masking)
# ============================================================================
def algo_connected_components(img_array, min_area_ratio=0.005, dilation=0,
                               dilation_percent=None, adaptive_threshold=False,
                               sensitivity='medium'):
    """
    Find connected components (blobs) and identify intruders by their shape.
    Returns actual pixel masks for intruding shapes, not just rectangular regions.

    Parameters:
    - dilation: fixed pixels to expand the mask by (catches anti-aliased edges)
    - dilation_percent: percentage of image size for dilation (overrides dilation if set)
                        e.g., 1.0 = 1% of min(width, height)
    - adaptive_threshold: use adaptive thresholding for better gradient handling
    - sensitivity: 'low', 'medium', 'high' - how aggressively to detect intruders

    Improvements:
    - Morphological closing to connect nearby parts (handles letters with gaps)
    - Better scoring: strongly prefer centered components
    - Only mask components that touch an edge AND are cut off (partial)
    - Handle letter counters (holes) by using filled binary
    """
    gray = to_grayscale(img_array)
    is_dark_text = detect_text_color(img_array)

    # Choose thresholding method
    if adaptive_threshold:
        # Adaptive thresholding - better for images with gradients/shadows
        from skimage.filters import threshold_local
        block_size = max(35, min(gray.shape) // 10)
        if block_size % 2 == 0:
            block_size += 1  # Must be odd
        local_thresh = threshold_local(gray, block_size, offset=10)
        if is_dark_text:
            binary = gray < local_thresh
        else:
            binary = gray > local_thresh
    else:
        binary = get_binary(gray, invert=not is_dark_text)

    h, w = binary.shape

    # Morphological closing to connect nearby parts and fill small gaps
    # This helps with letters that have thin connections or slight gaps
    struct = morphology.disk(3)
    binary_closed = morphology.binary_closing(binary, struct)

    # Fill holes to handle letter counters (like the hole in 'o', 'a', 'e')
    binary_filled = ndimage.binary_fill_holes(binary_closed)

    # Label connected components on the filled/closed binary
    labeled, num_features = ndimage.label(binary_filled)

    total_area = h * w
    center_x = w / 2
    center_y = h / 2

    components = []

    for i in range(1, num_features + 1):
        component_mask = labeled == i

        # Use original binary for the actual mask (not filled)
        # This gives us the true letter shape without filled counters
        actual_mask = binary & component_mask

        area = actual_mask.sum()

        # Skip tiny noise
        if area < total_area * min_area_ratio:
            continue

        # Find bounding box and centroid
        rows, cols = np.where(component_mask)
        if len(rows) == 0:
            continue

        min_row, max_row = rows.min(), rows.max()
        min_col, max_col = cols.min(), cols.max()
        bbox_width = max_col - min_col
        bbox_height = max_row - min_row
        centroid_x = cols.mean()
        centroid_y = rows.mean()

        # Check which edges it touches (within 3 pixels)
        touches_left = min_col <= 3
        touches_right = max_col >= w - 4
        touches_top = min_row <= 3
        touches_bottom = max_row >= h - 4

        # Check if component is "cut off" at the edge (partial letter)
        # A cut-off component has significant density right at the edge
        edge_margin = 5
        cut_off_left = touches_left and actual_mask[:, :edge_margin].sum() > (bbox_height * edge_margin * 0.3)
        cut_off_right = touches_right and actual_mask[:, -edge_margin:].sum() > (bbox_height * edge_margin * 0.3)
        cut_off_top = touches_top and actual_mask[:edge_margin, :].sum() > (bbox_width * edge_margin * 0.3)
        cut_off_bottom = touches_bottom and actual_mask[-edge_margin:, :].sum() > (bbox_width * edge_margin * 0.3)

        is_cut_off = cut_off_left or cut_off_right or cut_off_top or cut_off_bottom

        # Score: higher = more likely to be the main letter (keep)
        score = 0

        # Centroid distance from center (normalized 0-1) - STRONG weight on centering
        dist_from_center_x = abs(centroid_x - center_x) / (w / 2)
        dist_from_center_y = abs(centroid_y - center_y) / (h / 2)

        # Being centered is very important
        score += (1 - dist_from_center_x) * 50
        score += (1 - dist_from_center_y) * 30

        # Large area is good but less important than centering
        area_ratio = area / total_area
        score += area_ratio * 40

        # Bbox coverage of image (main letter usually spans a good portion)
        bbox_coverage_x = bbox_width / w
        bbox_coverage_y = bbox_height / h
        score += bbox_coverage_x * 20
        score += bbox_coverage_y * 20

        # Touching only one edge is suspicious (intruder)
        if touches_left and not touches_right:
            score -= 40
        if touches_right and not touches_left:
            score -= 40
        if touches_top and not touches_bottom:
            score -= 20
        if touches_bottom and not touches_top:
            score -= 20

        # Being cut off at edge is very suspicious
        if is_cut_off:
            score -= 60

        # Touching opposite edges means it spans the box (likely main letter)
        if touches_left and touches_right:
            score += 40
        if touches_top and touches_bottom:
            score += 30

        components.append({
            "id": i,
            "area": area,
            "area_ratio": area_ratio,
            "centroid": (centroid_x, centroid_y),
            "bbox": (min_col, min_row, max_col, max_row),
            "touches": {"left": touches_left, "right": touches_right, "top": touches_top, "bottom": touches_bottom},
            "cut_off": {"left": cut_off_left, "right": cut_off_right, "top": cut_off_top, "bottom": cut_off_bottom},
            "is_cut_off": is_cut_off,
            "score": score,
            "mask": actual_mask,  # Use original binary, not filled
        })

    if not components:
        return None, {"message": "No components found", "components": []}

    # Find the main letter (highest score)
    components.sort(key=lambda c: c["score"], reverse=True)
    main_component = components[0]

    # Sensitivity settings
    sensitivity_settings = {
        'low': {'score_ratio': 0.3, 'require_cut_off': True},
        'medium': {'score_ratio': 0.5, 'require_cut_off': False},
        'high': {'score_ratio': 0.7, 'require_cut_off': False},
    }
    settings = sensitivity_settings.get(sensitivity, sensitivity_settings['medium'])

    # Mark components as intruders if they:
    # 1. Touch an edge AND are cut off (partial letter)
    # 2. Have significantly lower score than main
    intruder_masks = []
    intruder_components = []

    for comp in components[1:]:  # Skip the main component
        is_intruder = False

        # Must touch at least one edge
        touches_any_edge = any(comp["touches"].values())

        if touches_any_edge:
            # If it's cut off at an edge, it's definitely an intruder
            if comp["is_cut_off"]:
                is_intruder = True
            # Or if score is much lower than main (based on sensitivity)
            elif not settings['require_cut_off'] and comp["score"] < main_component["score"] * settings['score_ratio']:
                is_intruder = True

        if is_intruder:
            intruder_masks.append(comp["mask"])
            intruder_components.append(comp)

    # Combine all intruder masks
    if intruder_masks:
        combined_mask = np.logical_or.reduce(intruder_masks)

        # Calculate actual dilation pixels
        if dilation_percent is not None:
            # Use percentage of smaller image dimension
            actual_dilation = int(min(h, w) * dilation_percent / 100)
        else:
            actual_dilation = dilation

        # Apply dilation to catch anti-aliased edges
        if actual_dilation > 0:
            struct = morphology.disk(actual_dilation)
            combined_mask = morphology.binary_dilation(combined_mask, struct)
    else:
        combined_mask = None
        actual_dilation = 0

    return combined_mask, {
        "components": components,
        "main_component": main_component,
        "intruder_components": intruder_components,
        "num_features": num_features,
        "type": "shape_mask",
        "settings": {
            "dilation": dilation,
            "dilation_percent": dilation_percent,
            "actual_dilation_px": actual_dilation if intruder_masks else 0,
            "adaptive_threshold": adaptive_threshold,
            "sensitivity": sensitivity,
        },
    }


# ============================================================================
# Algorithm 3: Vertical Projection Profile with Adaptive Threshold
# ============================================================================
def algo_projection_profile(img_array, smoothing=5, valley_depth_ratio=0.3):
    """
    Similar to column density but with:
    - Smoothing to reduce noise
    - Adaptive valley detection based on local minima
    - Derivative-based valley finding
    """
    gray = to_grayscale(img_array)
    is_dark_text = detect_text_color(img_array)
    binary = get_binary(gray, invert=not is_dark_text)

    h, w = binary.shape

    # Column projection
    projection = binary.sum(axis=0).astype(float)

    # Smooth the projection
    if smoothing > 1:
        kernel = np.ones(smoothing) / smoothing
        projection_smooth = np.convolve(projection, kernel, mode='same')
    else:
        projection_smooth = projection

    # Find local minima (valleys)
    from scipy.signal import find_peaks

    # Invert to find minima as peaks
    inverted = projection_smooth.max() - projection_smooth
    peaks, properties = find_peaks(inverted, prominence=projection_smooth.max() * valley_depth_ratio)

    # Find the deepest valley in left third and right third
    left_third = w // 3
    right_two_thirds = 2 * w // 3

    left_valleys = peaks[peaks < left_third]
    right_valleys = peaks[peaks > right_two_thirds]

    left_mask_end = None
    right_mask_start = None

    # For left valleys, pick the one closest to center (rightmost valley in left region)
    if len(left_valleys) > 0:
        left_mask_end = left_valleys[-1]  # Rightmost valley in left third

    # For right valleys, pick the one closest to center (leftmost valley in right region)
    if len(right_valleys) > 0:
        right_mask_start = right_valleys[0]  # Leftmost valley in right third

    return left_mask_end, right_mask_start, {
        "projection": projection,
        "projection_smooth": projection_smooth,
        "valleys": peaks,
    }


# ============================================================================
# Algorithm 4: Flood Fill from Corners
# ============================================================================
def algo_flood_fill_corners(img_array, tolerance=30):
    """
    Flood fill from corners to find background, then anything connected
    to edges but not to center is an intruder.
    """
    gray = to_grayscale(img_array)
    h, w = gray.shape

    # Use skimage's flood fill from corners
    # Start with a copy
    mask = np.zeros((h, w), dtype=bool)

    # Get corner colors (assumed background)
    corners = [
        (0, 0), (0, w-1), (h-1, 0), (h-1, w-1)
    ]

    # Flood fill from each corner
    for corner in corners:
        try:
            corner_val = gray[corner]
            filled = segmentation.flood(gray, corner, tolerance=tolerance)
            mask |= filled
        except:
            pass

    # Invert to get foreground
    foreground = ~mask

    # Label connected components in foreground
    labeled, num = ndimage.label(foreground)

    # Find which components touch edges vs which are in center
    edge_components = set()
    center_components = set()

    center_region = labeled[h//4:3*h//4, w//4:3*w//4]
    center_labels = set(np.unique(center_region)) - {0}

    # Check edges
    edge_labels = set()
    edge_labels.update(np.unique(labeled[0, :]))  # Top
    edge_labels.update(np.unique(labeled[-1, :]))  # Bottom
    edge_labels.update(np.unique(labeled[:, 0]))  # Left
    edge_labels.update(np.unique(labeled[:, -1]))  # Right
    edge_labels.discard(0)

    # Components that touch edge but not center are intruders
    intruder_labels = edge_labels - center_labels

    # Create intruder mask
    intruder_mask = np.isin(labeled, list(intruder_labels))

    # Find left and right bounds of intruder regions
    if intruder_mask.any():
        cols_with_intruders = np.where(intruder_mask.any(axis=0))[0]

        # Left intruders
        left_intruders = cols_with_intruders[cols_with_intruders < w//3]
        left_mask_end = left_intruders.max() + 1 if len(left_intruders) > 0 else None

        # Right intruders
        right_intruders = cols_with_intruders[cols_with_intruders > 2*w//3]
        right_mask_start = right_intruders.min() if len(right_intruders) > 0 else None
    else:
        left_mask_end = None
        right_mask_start = None

    return left_mask_end, right_mask_start, {
        "foreground": foreground,
        "intruder_mask": intruder_mask,
        "num_components": num,
    }


# ============================================================================
# Algorithm 5: Row Projection Profile (Horizontal valleys for top/bottom intrusion)
# ============================================================================
def algo_row_projection(img_array, smoothing=5, valley_depth_ratio=0.15, edge_search_percent=40):
    """
    Similar to column projection but for ROWS - detects horizontal valleys.
    Finds intrusions from above (ascenders) or below (descenders) that poke
    into the vertical space of the target letter.

    Returns top_mask_end, bottom_mask_start (row indices)
    """
    gray = to_grayscale(img_array)
    is_dark_text = detect_text_color(img_array)
    binary = get_binary(gray, invert=not is_dark_text)

    h, w = binary.shape

    # Row projection (sum of foreground pixels per row)
    row_projection = binary.sum(axis=1).astype(float)

    # Smooth the projection
    if smoothing > 1:
        kernel = np.ones(smoothing) / smoothing
        row_projection_smooth = np.convolve(row_projection, kernel, mode='same')
    else:
        row_projection_smooth = row_projection

    max_density = row_projection_smooth.max()
    if max_density == 0:
        return None, None, {"row_projection": row_projection, "message": "No content"}

    # Find local minima (valleys) in the row projection
    from scipy.signal import find_peaks

    # Lower prominence threshold to catch smaller valleys
    inverted = row_projection_smooth.max() - row_projection_smooth
    peaks, properties = find_peaks(inverted, prominence=max_density * valley_depth_ratio, distance=10)

    edge_search_height = int(h * edge_search_percent / 100)

    # Find valleys in top region
    top_valleys = peaks[peaks < edge_search_height]
    # Find valleys in bottom region
    bottom_valleys = peaks[peaks > h - edge_search_height]

    top_mask_end = None
    bottom_mask_start = None

    print(f"      Row projection: max={max_density:.0f}, valleys found: {len(peaks)}")
    print(f"      Top valleys: {top_valleys.tolist()}, Bottom valleys: {bottom_valleys.tolist()}")

    # For top intrusion: find the deepest valley, mask everything above it
    if len(top_valleys) > 0:
        # Pick the valley with the lowest projection value (deepest valley)
        deepest_top = top_valleys[np.argmin(row_projection_smooth[top_valleys])]
        # Only mask if there's actual content above the valley
        content_above = row_projection_smooth[:deepest_top].max() if deepest_top > 0 else 0
        content_below = row_projection_smooth[deepest_top:].max()
        valley_depth = row_projection_smooth[deepest_top]
        print(f"      Top valley at {deepest_top}: content_above={content_above:.0f}, content_below={content_below:.0f}, valley={valley_depth:.0f}")
        # Mask if: there's content above AND it's less than content below AND valley is deep
        if content_above > max_density * 0.1 and content_below > content_above * 1.5:
            top_mask_end = deepest_top

    # For bottom intrusion: find the deepest valley, mask everything below it
    if len(bottom_valleys) > 0:
        deepest_bottom = bottom_valleys[np.argmin(row_projection_smooth[bottom_valleys])]
        content_above = row_projection_smooth[:deepest_bottom].max()
        content_below = row_projection_smooth[deepest_bottom:].max() if deepest_bottom < h else 0
        valley_depth = row_projection_smooth[deepest_bottom]
        print(f"      Bottom valley at {deepest_bottom}: content_above={content_above:.0f}, content_below={content_below:.0f}, valley={valley_depth:.0f}")
        # Mask if: there's content below AND it's less than content above AND valley is deep
        if content_below > max_density * 0.1 and content_above > content_below * 1.5:
            bottom_mask_start = deepest_bottom

    return top_mask_end, bottom_mask_start, {
        "row_projection": row_projection,
        "row_projection_smooth": row_projection_smooth,
        "valleys": peaks,
        "direction": "horizontal",  # Flag for visualization
    }


# ============================================================================
# Algorithm 6: Combined Column + Row Projection
# ============================================================================
def algo_combined_projection(img_array, smoothing=5, valley_depth_ratio=0.2):
    """
    Combines both column (vertical) and row (horizontal) projection analysis
    to detect intrusions from any edge.
    """
    # Get column analysis (left/right)
    left_mask, right_mask, col_debug = algo_projection_profile(
        img_array, smoothing=smoothing, valley_depth_ratio=valley_depth_ratio
    )

    # Get row analysis (top/bottom)
    top_mask, bottom_mask, row_debug = algo_row_projection(
        img_array, smoothing=smoothing, valley_depth_ratio=valley_depth_ratio
    )

    return {
        "left": left_mask,
        "right": right_mask,
        "top": top_mask,
        "bottom": bottom_mask,
    }, {
        "column_density": col_debug.get("projection_smooth", col_debug.get("projection")),
        "row_projection": row_debug.get("row_projection_smooth", row_debug.get("row_projection")),
        "direction": "both",
    }


# ============================================================================
# Algorithm 7: Gradient-based Edge Detection + Column Analysis
# ============================================================================
def algo_gradient_edges(img_array, edge_threshold=0.1):
    """
    Use Sobel edge detection to find vertical edges (letter boundaries),
    then look for strong vertical edges that could separate letters.
    """
    gray = to_grayscale(img_array) / 255.0
    h, w = gray.shape

    # Sobel edge detection (vertical edges)
    sobel_x = filters.sobel_h(gray)  # Horizontal gradient = vertical edges

    # Sum absolute gradient per column
    edge_strength = np.abs(sobel_x).sum(axis=0)

    # Normalize
    edge_strength = edge_strength / edge_strength.max() if edge_strength.max() > 0 else edge_strength

    # Find peaks in edge strength (potential letter boundaries)
    from scipy.signal import find_peaks
    peaks, _ = find_peaks(edge_strength, height=edge_threshold, distance=10)

    # Look for peaks in left and right thirds
    left_third = w // 3
    right_two_thirds = 2 * w // 3

    left_peaks = peaks[peaks < left_third]
    right_peaks = peaks[peaks > right_two_thirds]

    # Pick the strongest peak in each region
    left_mask_end = None
    right_mask_start = None

    if len(left_peaks) > 0:
        strongest_left = left_peaks[np.argmax(edge_strength[left_peaks])]
        left_mask_end = strongest_left

    if len(right_peaks) > 0:
        strongest_right = right_peaks[np.argmax(edge_strength[right_peaks])]
        right_mask_start = strongest_right

    return left_mask_end, right_mask_start, {
        "edge_strength": edge_strength,
        "peaks": peaks,
    }


# ============================================================================
# Visualization
# ============================================================================
def visualize_result(img_array, left_mask, right_mask, algo_name, debug_data, output_path,
                      top_mask=None, bottom_mask=None, shape_mask=None):
    """Create visualization showing original + mask regions"""
    h, w = img_array.shape[:2]

    # Create output image (original + overlay)
    img = Image.fromarray(img_array)
    overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # If we have a shape mask (from connected components), draw that instead
    if shape_mask is not None:
        # Convert boolean mask to RGBA overlay
        overlay_array = np.zeros((h, w, 4), dtype=np.uint8)
        overlay_array[shape_mask, 0] = 255  # Red
        overlay_array[shape_mask, 1] = 50   # A bit of green
        overlay_array[shape_mask, 2] = 50   # A bit of blue
        overlay_array[shape_mask, 3] = 180  # Alpha
        overlay = Image.fromarray(overlay_array, 'RGBA')
    else:
        # Draw vertical mask regions in red (left/right)
        if left_mask is not None and left_mask > 0:
            draw.rectangle([0, 0, left_mask, h], fill=(255, 0, 0, 100))
            draw.line([(left_mask, 0), (left_mask, h)], fill=(255, 0, 0, 255), width=2)

        if right_mask is not None and right_mask < w:
            draw.rectangle([right_mask, 0, w, h], fill=(255, 0, 0, 100))
            draw.line([(right_mask, 0), (right_mask, h)], fill=(255, 0, 0, 255), width=2)

        # Draw horizontal mask regions in blue (top/bottom)
        if top_mask is not None and top_mask > 0:
            draw.rectangle([0, 0, w, top_mask], fill=(0, 100, 255, 100))
            draw.line([(0, top_mask), (w, top_mask)], fill=(0, 100, 255, 255), width=2)

        if bottom_mask is not None and bottom_mask < h:
            draw.rectangle([0, bottom_mask, w, h], fill=(0, 100, 255, 100))
            draw.line([(0, bottom_mask), (w, bottom_mask)], fill=(0, 100, 255, 255), width=2)

    # Composite
    img = img.convert('RGBA')
    result = Image.alpha_composite(img, overlay)

    # Add charts if available
    direction = debug_data.get("direction", "vertical")

    if direction == "horizontal" and "row_projection" in debug_data:
        # Row projection chart (rotated - vertical bar chart on the side)
        row_proj = debug_data.get("row_projection_smooth", debug_data.get("row_projection"))
        if row_proj is not None:
            chart_width = 100
            chart = Image.new('RGB', (chart_width, h), (240, 240, 240))
            chart_draw = ImageDraw.Draw(chart)

            max_d = row_proj.max() if row_proj.max() > 0 else 1
            for y, d in enumerate(row_proj):
                bar_w = int((d / max_d) * (chart_width - 10))
                color = (100, 100, 255) if (
                    (top_mask is not None and y < top_mask) or
                    (bottom_mask is not None and y >= bottom_mask)
                ) else (100, 200, 100)
                chart_draw.line([(5, y), (5 + bar_w, y)], fill=color)

            # Combine side by side
            combined = Image.new('RGB', (w + chart_width + 10, h), (255, 255, 255))
            combined.paste(result.convert('RGB'), (0, 0))
            combined.paste(chart, (w + 10, 0))
            result = combined

    elif direction == "both":
        # Show both charts
        col_proj = debug_data.get("column_density")
        row_proj = debug_data.get("row_projection")

        chart_size = 80

        # Start with result
        result_rgb = result.convert('RGB')

        # Add column chart below
        if col_proj is not None:
            chart = Image.new('RGB', (w, chart_size), (240, 240, 240))
            chart_draw = ImageDraw.Draw(chart)
            max_d = col_proj.max() if col_proj.max() > 0 else 1
            for x, d in enumerate(col_proj):
                bar_h = int((d / max_d) * (chart_size - 10))
                color = (255, 100, 100) if (
                    (left_mask is not None and x < left_mask) or
                    (right_mask is not None and x >= right_mask)
                ) else (100, 100, 200)
                chart_draw.line([(x, chart_size - 5), (x, chart_size - 5 - bar_h)], fill=color)

            combined = Image.new('RGB', (w, h + chart_size + 5), (255, 255, 255))
            combined.paste(result_rgb, (0, 0))
            combined.paste(chart, (0, h + 5))
            result_rgb = combined
            result = result_rgb

        # Add row chart on right
        if row_proj is not None:
            current_w, current_h = result_rgb.size
            chart = Image.new('RGB', (chart_size, h), (240, 240, 240))
            chart_draw = ImageDraw.Draw(chart)
            max_d = row_proj.max() if row_proj.max() > 0 else 1
            for y, d in enumerate(row_proj):
                bar_w = int((d / max_d) * (chart_size - 10))
                color = (100, 100, 255) if (
                    (top_mask is not None and y < top_mask) or
                    (bottom_mask is not None and y >= bottom_mask)
                ) else (100, 200, 100)
                chart_draw.line([(5, y), (5 + bar_w, y)], fill=color)

            combined = Image.new('RGB', (current_w + chart_size + 5, current_h), (255, 255, 255))
            combined.paste(result_rgb, (0, 0))
            combined.paste(chart, (current_w + 5, 0))
            result = combined

    elif "column_density" in debug_data or "projection" in debug_data:
        density = debug_data.get("column_density", debug_data.get("projection", debug_data.get("projection_smooth")))
        if density is not None:
            chart_height = 100
            chart = Image.new('RGB', (w, chart_height), (240, 240, 240))
            chart_draw = ImageDraw.Draw(chart)

            max_d = density.max() if density.max() > 0 else 1
            for x, d in enumerate(density):
                bar_h = int((d / max_d) * (chart_height - 10))
                color = (255, 100, 100) if (
                    (left_mask is not None and x < left_mask) or
                    (right_mask is not None and x >= right_mask)
                ) else (100, 100, 200)
                chart_draw.line([(x, chart_height - 5), (x, chart_height - 5 - bar_h)], fill=color)

            # Combine
            combined = Image.new('RGB', (w, h + chart_height + 10), (255, 255, 255))
            combined.paste(result.convert('RGB'), (0, 0))
            combined.paste(chart, (0, h + 10))
            result = combined

    # Save
    result_rgb = result.convert('RGB') if result.mode == 'RGBA' else result
    result_rgb.save(output_path)
    print(f"  Saved: {output_path}")

    return result


def create_comparison_image(img_array, results, output_path):
    """Create side-by-side comparison of all algorithms"""
    h, w = img_array.shape[:2]

    num_algos = len(results)
    comparison = Image.new('RGB', (w * (num_algos + 1), h + 50), (255, 255, 255))
    draw = ImageDraw.Draw(comparison)

    # Original
    orig = Image.fromarray(img_array)
    comparison.paste(orig, (0, 40))
    draw.text((5, 5), "Original", fill=(0, 0, 0))

    # Each algorithm result
    for i, result_tuple in enumerate(results):
        algo_name = result_tuple[0]
        left_mask = result_tuple[1]
        right_mask = result_tuple[2]
        debug_data = result_tuple[3] if len(result_tuple) > 3 else {}
        top_mask = result_tuple[4] if len(result_tuple) > 4 else None
        bottom_mask = result_tuple[5] if len(result_tuple) > 5 else None
        shape_mask = result_tuple[6] if len(result_tuple) > 6 else None

        x_offset = (i + 1) * w

        # Create masked version
        img = Image.fromarray(img_array.copy())
        overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)

        # Shape mask (from connected components) - pixel-level mask
        if shape_mask is not None:
            overlay_array = np.zeros((h, w, 4), dtype=np.uint8)
            overlay_array[shape_mask, 0] = 255
            overlay_array[shape_mask, 1] = 50
            overlay_array[shape_mask, 2] = 50
            overlay_array[shape_mask, 3] = 180
            overlay = Image.fromarray(overlay_array, 'RGBA')
        else:
            # Left/right masks in red
            if left_mask is not None and left_mask > 0:
                overlay_draw.rectangle([0, 0, left_mask, h], fill=(255, 0, 0, 120))
            if right_mask is not None and right_mask < w:
                overlay_draw.rectangle([right_mask, 0, w, h], fill=(255, 0, 0, 120))

            # Top/bottom masks in blue
            if top_mask is not None and top_mask > 0:
                overlay_draw.rectangle([0, 0, w, top_mask], fill=(0, 100, 255, 120))
            if bottom_mask is not None and bottom_mask < h:
                overlay_draw.rectangle([0, bottom_mask, w, h], fill=(0, 100, 255, 120))

        img = img.convert('RGBA')
        result = Image.alpha_composite(img, overlay)

        comparison.paste(result.convert('RGB'), (x_offset, 40))

        # Label
        short_name = algo_name.replace("algo_", "").replace("_", " ")[:15]
        draw.text((x_offset + 5, 3), short_name, fill=(0, 0, 0))

        # Mask info
        if shape_mask is not None:
            num_intruders = len(debug_data.get("intruder_components", []))
            draw.text((x_offset + 5, 16), f"Shape: {num_intruders} intruder(s)", fill=(150, 50, 50))
        else:
            lr_info = f"L:{left_mask or '-'} R:{right_mask or '-'}"
            tb_info = f"T:{top_mask or '-'} B:{bottom_mask or '-'}"
            draw.text((x_offset + 5, 16), lr_info, fill=(150, 50, 50))
            draw.text((x_offset + 5, 28), tb_info, fill=(50, 50, 150))

    comparison.save(output_path)
    print(f"  Comparison saved: {output_path}")


# ============================================================================
# Main
# ============================================================================
def main():
    print("=" * 60)
    print("SANITIZE BOX ALGORITHM TEST")
    print("=" * 60)

    # Test connected_components with various settings
    algorithms = [
        # No dilation baseline
        ("cc_none", lambda img: algo_connected_components(img)),
        # Percentage-based dilation (relative to image size)
        ("cc_0.5%", lambda img: algo_connected_components(img, dilation_percent=0.5)),
        ("cc_1%", lambda img: algo_connected_components(img, dilation_percent=1.0)),
        ("cc_1.5%", lambda img: algo_connected_components(img, dilation_percent=1.5)),
        ("cc_2%", lambda img: algo_connected_components(img, dilation_percent=2.0)),
        ("cc_3%", lambda img: algo_connected_components(img, dilation_percent=3.0)),
    ]

    for img_path in TEST_IMAGES:
        if not os.path.exists(img_path):
            print(f"\nSkipping {img_path} - not found")
            continue

        print(f"\n{'=' * 60}")
        print(f"Processing: {img_path}")
        print("=" * 60)

        img_array, img_pil = load_image(img_path)
        h, w = img_array.shape[:2]
        print(f"  Size: {w}x{h}")
        print(f"  Text appears: {'dark on light' if detect_text_color(img_array) else 'light on dark'}")

        img_name = Path(img_path).stem
        results = []

        for algo_name, algo_func in algorithms:
            print(f"\n  Running: {algo_name}")

            try:
                left_mask, right_mask, top_mask, bottom_mask = None, None, None, None
                shape_mask = None

                if algo_name.startswith("cc_"):
                    # Connected components variants - all return shape mask
                    shape_mask, debug = algo_func(img_array)
                    num_intruders = len(debug.get("intruder_components", []))
                    main_comp = debug.get('main_component', {})
                    settings = debug.get('settings', {})
                    dilate_pct = settings.get('dilation_percent')
                    dilate_px = settings.get('actual_dilation_px', 0)
                    if dilate_pct is not None:
                        print(f"    Dilation: {dilate_pct}% = {dilate_px}px")
                    else:
                        print(f"    Dilation: {settings.get('dilation', 0)}px (fixed)")
                    print(f"    Components: {debug.get('num_features', 0)}, Intruders: {num_intruders}")
                elif algo_name == "row_projection":
                    # Returns top/bottom masks
                    top_mask, bottom_mask, debug = algo_func(img_array)
                    print(f"    Top mask end: {top_mask}")
                    print(f"    Bottom mask start: {bottom_mask}")
                elif algo_name == "combined_projection":
                    # Returns dict with all four masks
                    masks, debug = algo_func(img_array)
                    left_mask = masks["left"]
                    right_mask = masks["right"]
                    top_mask = masks["top"]
                    bottom_mask = masks["bottom"]
                    print(f"    Left: {left_mask}, Right: {right_mask}")
                    print(f"    Top: {top_mask}, Bottom: {bottom_mask}")
                elif algo_name == "connected_components":
                    # Returns shape mask (pixel-level)
                    shape_mask, debug = algo_func(img_array)
                    num_intruders = len(debug.get("intruder_components", []))
                    main_comp = debug.get('main_component', {})
                    print(f"    Found {debug.get('num_features', 0)} components (after morphology)")
                    print(f"    Main component: score={main_comp.get('score', 'N/A'):.1f}, area={main_comp.get('area_ratio', 0)*100:.1f}%, cut_off={main_comp.get('is_cut_off', False)}")
                    print(f"    Intruders detected: {num_intruders}")
                    if num_intruders > 0:
                        for ic in debug["intruder_components"]:
                            print(f"      - Score {ic['score']:.1f}, area {ic['area_ratio']*100:.1f}%, cut_off={ic['is_cut_off']}, edges: {ic['touches']}")
                else:
                    # Standard left/right masks
                    left_mask, right_mask, debug = algo_func(img_array)
                    print(f"    Left mask end: {left_mask}")
                    print(f"    Right mask start: {right_mask}")

                # Save individual result
                output_path = OUTPUT_DIR / f"{img_name}_{algo_name}.png"
                visualize_result(img_array, left_mask, right_mask, algo_name, debug, output_path,
                               top_mask=top_mask, bottom_mask=bottom_mask, shape_mask=shape_mask)

                results.append((algo_name, left_mask, right_mask, debug, top_mask, bottom_mask, shape_mask))

            except Exception as e:
                print(f"    ERROR: {e}")
                import traceback
                traceback.print_exc()
                results.append((algo_name, None, None, {"error": str(e)}, None, None, None))

        # Create comparison image
        comparison_path = OUTPUT_DIR / f"{img_name}_comparison.png"
        create_comparison_image(img_array, results, comparison_path)

    print("\n" + "=" * 60)
    print("DONE! Results saved to:", OUTPUT_DIR)
    print("=" * 60)


if __name__ == "__main__":
    main()
