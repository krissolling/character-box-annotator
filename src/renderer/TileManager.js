import * as PIXI from 'pixi.js';
import { calculateLOD, intersectsViewport, expandBounds } from './utils/coordinates';

/**
 * Manages tile loading, caching, and rendering for large images
 */
export class TileManager {
  constructor(options = {}) {
    this.tileSize = options.tileSize || 512;
    this.maxLevels = options.maxLevels || 4;
    this.cacheSize = options.cacheSize || 100;
    this.preloadMargin = options.preloadMargin || 512;

    this.tiles = new Map(); // Map of tile ID -> tile data
    this.tileCache = []; // LRU cache array
    this.sourceImage = null;
    this.imageWidth = 0;
    this.imageHeight = 0;
    this.pyramid = []; // Array of levels, each level has {width, height, tilesX, tilesY}

    // Track loading state
    this.isGenerating = false;
    this.loadingPromise = null;
  }

  /**
   * Load an image and generate tile pyramid
   * @param {HTMLImageElement} image - Source image
   * @returns {Promise<void>}
   */
  async loadImage(image) {
    this.sourceImage = image;
    this.imageWidth = image.width;
    this.imageHeight = image.height;

    // Clear existing tiles
    this.clear();

    // Generate pyramid structure
    this.generatePyramidStructure();

    // Generate tiles (for now, synchronously - we'll add worker later)
    await this.generateTiles();
  }

  /**
   * Generate the pyramid structure (metadata only)
   */
  generatePyramidStructure() {
    this.pyramid = [];

    for (let level = 0; level < this.maxLevels; level++) {
      const scale = 1 / Math.pow(2, level);
      const width = Math.floor(this.imageWidth * scale);
      const height = Math.floor(this.imageHeight * scale);
      const tilesX = Math.ceil(width / this.tileSize);
      const tilesY = Math.ceil(height / this.tileSize);

      this.pyramid.push({
        level,
        scale,
        width,
        height,
        tilesX,
        tilesY
      });
    }
  }

  /**
   * Generate tiles from source image
   * @returns {Promise<void>}
   */
  async generateTiles() {
    if (this.isGenerating) return this.loadingPromise;

    this.isGenerating = true;
    this.loadingPromise = this._generateTilesSync();

    try {
      await this.loadingPromise;
    } finally {
      this.isGenerating = false;
      this.loadingPromise = null;
    }
  }

  /**
   * Synchronously generate tiles (blocking - will be moved to worker)
   */
  async _generateTilesSync() {
    // Create a temporary canvas for image manipulation
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    for (let level = 0; level < this.maxLevels; level++) {
      const pyramidLevel = this.pyramid[level];
      const { scale, width, height, tilesX, tilesY } = pyramidLevel;

      // Scale the entire image for this level
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(this.sourceImage, 0, 0, width, height);

      // Slice into tiles
      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          const tileId = this.getTileId(level, tx, ty);

          // Calculate tile bounds in scaled image
          const sx = tx * this.tileSize;
          const sy = ty * this.tileSize;
          const sw = Math.min(this.tileSize, width - sx);
          const sh = Math.min(this.tileSize, height - sy);

          // Extract tile data
          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = sw;
          tileCanvas.height = sh;
          const tileCtx = tileCanvas.getContext('2d');
          tileCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

          // Calculate bounds in original image coordinates
          const bounds = {
            x: (tx * this.tileSize) / scale,
            y: (ty * this.tileSize) / scale,
            width: (sw) / scale,
            height: (sh) / scale
          };

          // Create tile
          const tile = {
            id: tileId,
            level,
            x: tx,
            y: ty,
            bounds,
            canvas: tileCanvas,
            texture: null,
            status: 'ready',
            lastUsed: Date.now()
          };

          this.tiles.set(tileId, tile);
        }
      }

      // Yield to browser between levels
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  /**
   * Get tile ID string
   */
  getTileId(level, x, y) {
    return `L${level}_x${x}_y${y}`;
  }

  /**
   * Get tiles for a viewport
   * @param {Object} viewport - Viewport bounds {x, y, width, height}
   * @param {number} zoomLevel - Current zoom level
   * @returns {Array} Array of tile objects
   */
  getTilesForViewport(viewport, zoomLevel) {
    const level = calculateLOD(zoomLevel, this.maxLevels);
    const pyramidLevel = this.pyramid[level];

    if (!pyramidLevel) return [];

    const { scale, tilesX, tilesY } = pyramidLevel;

    // Convert viewport to tile coordinates
    const startX = Math.max(0, Math.floor((viewport.x * scale) / this.tileSize));
    const startY = Math.max(0, Math.floor((viewport.y * scale) / this.tileSize));
    const endX = Math.min(tilesX - 1, Math.ceil(((viewport.x + viewport.width) * scale) / this.tileSize));
    const endY = Math.min(tilesY - 1, Math.ceil(((viewport.y + viewport.height) * scale) / this.tileSize));

    const tiles = [];

    for (let ty = startY; ty <= endY; ty++) {
      for (let tx = startX; tx <= endX; tx++) {
        const tileId = this.getTileId(level, tx, ty);
        const tile = this.tiles.get(tileId);

        if (tile) {
          tile.lastUsed = Date.now();
          tiles.push(tile);
        }
      }
    }

    return tiles;
  }

  /**
   * Get or create PIXI texture for a tile
   * @param {Object} tile - Tile object
   * @returns {PIXI.Texture|null}
   */
  getTileTexture(tile) {
    if (!tile || tile.status !== 'ready') return null;

    // Create texture if not exists
    if (!tile.texture && tile.canvas) {
      try {
        tile.texture = PIXI.Texture.from(tile.canvas);
      } catch (error) {
        console.error('Failed to create texture for tile', tile.id, error);
        return null;
      }
    }

    return tile.texture;
  }

  /**
   * Preload tiles adjacent to viewport
   * @param {Object} viewport - Viewport bounds
   * @param {number} zoomLevel - Current zoom level
   */
  preloadAdjacentTiles(viewport, zoomLevel) {
    const expandedViewport = expandBounds(viewport, this.preloadMargin);
    const tiles = this.getTilesForViewport(expandedViewport, zoomLevel);

    // Ensure textures are created
    tiles.forEach(tile => this.getTileTexture(tile));
  }

  /**
   * Clean up old tiles from cache (LRU eviction)
   */
  cleanupCache() {
    if (this.tiles.size <= this.cacheSize) return;

    // Convert to array and sort by last used time
    const tileArray = Array.from(this.tiles.values());
    tileArray.sort((a, b) => a.lastUsed - b.lastUsed);

    // Remove oldest tiles
    const tilesToRemove = tileArray.slice(0, tileArray.length - this.cacheSize);
    tilesToRemove.forEach(tile => {
      if (tile.texture) {
        tile.texture.destroy(true);
      }
      this.tiles.delete(tile.id);
    });
  }

  /**
   * Get tile statistics
   */
  getStats() {
    const totalTiles = Array.from(this.tiles.values()).length;
    const readyTiles = Array.from(this.tiles.values()).filter(t => t.status === 'ready').length;
    const textureCount = Array.from(this.tiles.values()).filter(t => t.texture !== null).length;

    return {
      totalTiles,
      readyTiles,
      textureCount,
      cacheSize: this.cacheSize,
      pyramidLevels: this.pyramid.length
    };
  }

  /**
   * Clear all tiles
   */
  clear() {
    // Destroy all textures
    this.tiles.forEach(tile => {
      if (tile.texture) {
        tile.texture.destroy(true);
      }
    });

    this.tiles.clear();
    this.tileCache = [];
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.clear();
    this.sourceImage = null;
    this.pyramid = [];
  }
}
