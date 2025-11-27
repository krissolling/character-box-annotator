/**
 * Project Storage Utility
 *
 * Uses IndexedDB to store recent projects with their images and annotation data.
 * Designed to be easily replaceable with a database backend later.
 *
 * Storage structure:
 * - projects: Array of project metadata (id, name, createdAt, expiresAt, thumbnailUrl)
 * - Each project stores: image blob, annotation data (boxes, baselines, etc.)
 */

const DB_NAME = 'charboxer-projects';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const EXPIRATION_DAYS = 14;
const WARNING_DAYS = 7;

// Open/create the IndexedDB database
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };
  });
}

// Generate a unique project ID
function generateId() {
  return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Calculate expiration date (14 days from now)
function getExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + EXPIRATION_DAYS);
  return date.toISOString();
}

// Check if a project is expiring soon (within 7 days)
export function isExpiringSoon(expiresAt) {
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= WARNING_DAYS && daysUntilExpiry > 0;
}

// Get days until expiration
export function getDaysUntilExpiry(expiresAt) {
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  return Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
}

// Convert image file to blob URL for display
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Create a thumbnail from the word preview canvas or original image
async function createThumbnail(image, imageFile, boxes) {
  // First try to get the word preview canvas
  const wordPreviewCanvas = document.getElementById('word-preview-canvas');

  let sourceCanvas;

  if (wordPreviewCanvas && boxes && boxes.length > 0) {
    // Use word preview as thumbnail if annotations exist
    sourceCanvas = wordPreviewCanvas;
  } else if (image) {
    // Fall back to original image thumbnail
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    const maxSize = 200;
    const scale = Math.min(maxSize / image.width, maxSize / image.height);
    tempCanvas.width = image.width * scale;
    tempCanvas.height = image.height * scale;
    ctx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);
    sourceCanvas = tempCanvas;
  } else {
    return null;
  }

  // Create thumbnail from source
  const thumbCanvas = document.createElement('canvas');
  const thumbCtx = thumbCanvas.getContext('2d');
  const maxThumbSize = 200;

  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  const scale = Math.min(maxThumbSize / sourceWidth, maxThumbSize / sourceHeight, 1);

  thumbCanvas.width = sourceWidth * scale;
  thumbCanvas.height = sourceHeight * scale;
  thumbCtx.drawImage(sourceCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

  return new Promise((resolve) => {
    thumbCanvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
  });
}

/**
 * Save a project to storage
 * @param {Object} projectData - The project data to save
 * @param {HTMLImageElement} projectData.image - The source image
 * @param {File} projectData.imageFile - The original image file
 * @param {string} projectData.text - The annotation text
 * @param {Array} projectData.boxes - The annotation boxes
 * @param {Object} projectData.settings - Other settings (baselines, filters, etc.)
 * @param {string} [existingId] - Optional existing project ID for updates
 * @returns {Promise<string>} The project ID
 */
export async function saveProject(projectData, existingId = null) {
  const db = await openDB();

  const { image, imageFile, text, boxes, settings } = projectData;

  // Generate or use existing ID
  const id = existingId || generateId();

  // Create thumbnail
  const thumbnailBlob = await createThumbnail(image, imageFile, boxes);

  // Convert image file to array buffer for storage
  let imageData = null;
  if (imageFile) {
    imageData = await imageFile.arrayBuffer();
  }

  const project = {
    id,
    name: imageFile?.name || 'Untitled Project',
    createdAt: existingId ? undefined : new Date().toISOString(), // Keep original creation date on updates
    updatedAt: new Date().toISOString(),
    expiresAt: getExpirationDate(), // Reset expiration on each save

    // Image data
    imageData,
    imageName: imageFile?.name,
    imageType: imageFile?.type,

    // Thumbnail
    thumbnailBlob,

    // Annotation data
    text,
    boxes: boxes.map(box => ({
      ...box,
      // Convert any Uint8Array to regular arrays for storage
      eraseMask: box.eraseMask ? {
        pixels: Array.from(box.eraseMask.pixels),
        width: box.eraseMask.width,
        height: box.eraseMask.height,
        offsetX: box.eraseMask.offsetX,
        offsetY: box.eraseMask.offsetY
      } : null
    })),

    // Settings
    ...settings
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Get existing project to preserve createdAt
    if (existingId) {
      const getRequest = store.get(existingId);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (existing) {
          project.createdAt = existing.createdAt;
        } else {
          project.createdAt = new Date().toISOString();
        }

        const putRequest = store.put(project);
        putRequest.onsuccess = () => resolve(id);
        putRequest.onerror = () => reject(putRequest.error);
      };
    } else {
      project.createdAt = new Date().toISOString();
      const putRequest = store.put(project);
      putRequest.onsuccess = () => resolve(id);
      putRequest.onerror = () => reject(putRequest.error);
    }

    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Get all recent projects (non-expired)
 * @returns {Promise<Array>} Array of project metadata (without full image data)
 */
export async function getRecentProjects() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = async () => {
      const projects = request.result;
      const now = new Date();

      // Filter out expired projects and sort by updatedAt
      const validProjects = projects
        .filter(p => new Date(p.expiresAt) > now)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      // Return metadata with thumbnail URLs
      const projectsWithThumbnails = await Promise.all(
        validProjects.map(async (p) => {
          let thumbnailUrl = null;
          if (p.thumbnailBlob) {
            thumbnailUrl = await blobToDataUrl(p.thumbnailBlob);
          }

          return {
            id: p.id,
            name: p.name,
            text: p.text,
            boxCount: p.boxes?.length || 0,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            expiresAt: p.expiresAt,
            thumbnailUrl,
            isExpiringSoon: isExpiringSoon(p.expiresAt),
            daysUntilExpiry: getDaysUntilExpiry(p.expiresAt)
          };
        })
      );

      resolve(projectsWithThumbnails);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Load a full project by ID
 * @param {string} id - The project ID
 * @returns {Promise<Object>} The full project data
 */
export async function loadProject(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = async () => {
      const project = request.result;
      if (!project) {
        reject(new Error('Project not found'));
        return;
      }

      // Convert stored image data back to File/Blob
      let imageFile = null;
      if (project.imageData) {
        imageFile = new File(
          [project.imageData],
          project.imageName || 'image.png',
          { type: project.imageType || 'image/png' }
        );
      }

      // Convert boxes back (restore Uint8Array from arrays)
      const boxes = project.boxes?.map(box => ({
        ...box,
        eraseMask: box.eraseMask ? {
          pixels: new Uint8Array(box.eraseMask.pixels),
          width: box.eraseMask.width,
          height: box.eraseMask.height,
          offsetX: box.eraseMask.offsetX,
          offsetY: box.eraseMask.offsetY
        } : null
      })) || [];

      resolve({
        id: project.id,
        imageFile,
        text: project.text,
        boxes,
        baselines: project.baselines || [],
        angledBaselines: project.angledBaselines || [],
        imageRotation: project.imageRotation || 0,
        imageFilters: project.imageFilters || {
          invert: false,
          brightness: 100,
          contrast: 100,
          shadows: 0,
          highlights: 0,
          grayscale: 100
        },
        levelsAdjustment: project.levelsAdjustment || null,
        letterSpacing: project.letterSpacing || 0,
        charPadding: project.charPadding || 0,
        kerningAdjustments: project.kerningAdjustments || {}
      });
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a project
 * @param {string} id - The project ID
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clean up expired projects
 * @returns {Promise<number>} Number of deleted projects
 */
export async function cleanupExpiredProjects() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const projects = request.result;
      const now = new Date();
      let deletedCount = 0;

      projects.forEach(p => {
        if (new Date(p.expiresAt) <= now) {
          store.delete(p.id);
          deletedCount++;
        }
      });

      resolve(deletedCount);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Extend a project's expiration by 14 days
 * @param {string} id - The project ID
 * @returns {Promise<void>}
 */
export async function extendProjectExpiration(id) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const project = request.result;
      if (project) {
        project.expiresAt = getExpirationDate();
        store.put(project);
      }
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}
