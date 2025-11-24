import { useState, useRef } from 'react';
import { Package } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import JSZip from 'jszip';
import { Waifu2xUpscaler, getImageData, imageDataToCanvas } from '../../lib/upscaler';

export default function ExportPanel() {
  const [showModal, setShowModal] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const upscalerRef = useRef(null);

  const boxes = useAnnotatorStore((state) => state.boxes);
  const text = useAnnotatorStore((state) => state.text);
  const image = useAnnotatorStore((state) => state.image);
  const imageFile = useAnnotatorStore((state) => state.imageFile);
  const baselines = useAnnotatorStore((state) => state.baselines);
  const angledBaselines = useAnnotatorStore((state) => state.angledBaselines);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const imageFilters = useAnnotatorStore((state) => state.imageFilters);
  const levelsAdjustment = useAnnotatorStore((state) => state.levelsAdjustment);
  const letterSpacing = useAnnotatorStore((state) => state.letterSpacing);
  const charPadding = useAnnotatorStore((state) => state.charPadding);
  const kerningAdjustments = useAnnotatorStore((state) => state.kerningAdjustments);
  const editedCharData = useAnnotatorStore((state) => state.editedCharData);
  const setPlaceholderOpacity = useAnnotatorStore((state) => state.setPlaceholderOpacity);

  // Get the word preview canvas for exports
  const getWordPreviewCanvas = () => {
    return document.getElementById('word-preview-canvas');
  };

  // Export WebP
  const handleDownload = async () => {
    const canvas = getWordPreviewCanvas();
    if (!canvas) return;

    // Set placeholder opacity to 10% for export
    setPlaceholderOpacity(0.1);

    // Wait for next frame to re-render with new opacity
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `word-preview-${Date.now()}.webp`;
      link.click();
      URL.revokeObjectURL(url);

      // Restore placeholder opacity to 100%
      setPlaceholderOpacity(1.0);
    }, 'image/webp', 0.95);
    setShowModal(false);
  };

  // Export 4x WebP with local Waifu2x upscaler
  const handleDownloadUpscaled = async () => {
    const canvas = getWordPreviewCanvas();
    if (!canvas) return;

    setIsUpscaling(true);
    setUpscaleProgress(0);

    // Set placeholder opacity to 10% for export
    setPlaceholderOpacity(0.1);

    // Wait for next frame to re-render with new opacity
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      // Initialize upscaler if needed
      if (!upscalerRef.current) {
        setUpscaleProgress(5);
        upscalerRef.current = new Waifu2xUpscaler();
        await upscalerRef.current.initialize();
      }

      setUpscaleProgress(10);

      // Get image data from canvas
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Upscale with progress callback
      const upscaledImageData = await upscalerRef.current.upscale(imageData, (progress) => {
        setUpscaleProgress(10 + progress * 0.85); // 10-95%
      });

      setUpscaleProgress(95);

      // Convert to canvas and then to blob
      const upscaledCanvas = imageDataToCanvas(upscaledImageData);
      const blob = await new Promise(resolve => upscaledCanvas.toBlob(resolve, 'image/webp', 0.95));

      setUpscaleProgress(100);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `word-preview-4x-${Date.now()}.webp`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Upscale error:', error);
      alert('Failed to upscale image: ' + error.message);
    } finally {
      setIsUpscaling(false);
      setUpscaleProgress(0);
      setShowModal(false);
      // Restore placeholder opacity to 100%
      setPlaceholderOpacity(1.0);
    }
  };

  // Export JSON
  const handleDownloadJSON = () => {
    const jsonData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      imageName: imageFile?.name || 'unknown.png',
      imageWidth: image?.width,
      imageHeight: image?.height,
      text,
      boxes: boxes.map((box, index) => ({
        char: box.char,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        brushMask: box.brushMask || [],
        eraseMask: editedCharData[index]?.eraseMask || null
      })),
      baselines,
      angledBaselines,
      imageRotation,
      imageFilters,
      levelsAdjustment,
      letterSpacing,
      charPadding,
      kerningAdjustments
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `annotations-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShowModal(false);
  };

  // Export ZIP
  const handleDownloadZip = async () => {
    const zip = new JSZip();

    // Add JSON
    const jsonData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      imageName: imageFile?.name || 'image.png',
      imageWidth: image?.width,
      imageHeight: image?.height,
      text,
      boxes: boxes.map((box, index) => ({
        char: box.char,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        brushMask: box.brushMask || [],
        eraseMask: editedCharData[index]?.eraseMask || null
      })),
      baselines,
      angledBaselines,
      imageRotation,
      imageFilters,
      levelsAdjustment,
      letterSpacing,
      charPadding,
      kerningAdjustments
    };
    zip.file('annotations.json', JSON.stringify(jsonData, null, 2));

    // Add original image
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      zip.file(imageFile.name, arrayBuffer);
    }

    // Generate and download
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="te-btn te-btn-primary"
        style={{
          width: '100%',
          gap: '6px'
        }}
        disabled={boxes.length === 0}
      >
        <Package style={{ width: '14px', height: '14px' }} />
        Export
      </button>

      {/* Export Modal */}
      {showModal && (
        <div
          className="te-panel"
          style={{
            position: 'absolute',
            bottom: '44px',
            right: '0',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            width: '100%'
          }}
        >
          <button
            onClick={handleDownload}
            className="te-btn te-btn-secondary"
            style={{ justifyContent: 'flex-start', height: '28px' }}
          >
            WebP
          </button>
          <button
            onClick={handleDownloadUpscaled}
            disabled={isUpscaling}
            className="te-btn te-btn-secondary"
            style={{
              justifyContent: 'flex-start',
              height: '28px',
              opacity: isUpscaling ? 0.6 : 1,
              cursor: isUpscaling ? 'not-allowed' : 'pointer'
            }}
          >
            {isUpscaling ? `4x (${Math.round(upscaleProgress)}%)` : '4x WebP'}
          </button>
          <button
            onClick={handleDownloadJSON}
            className="te-btn te-btn-secondary"
            style={{ justifyContent: 'flex-start', height: '28px' }}
          >
            JSON
          </button>
          <button
            onClick={handleDownloadZip}
            className="te-btn te-btn-secondary"
            style={{ justifyContent: 'flex-start', height: '28px' }}
          >
            ZIP
          </button>
          <div className="te-tool-separator" />
          <button
            onClick={() => setShowModal(false)}
            className="te-btn te-btn-ghost"
            style={{ height: '24px', fontSize: '10px' }}
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
