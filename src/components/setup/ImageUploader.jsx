import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function ImageUploader() {
  const setImage = useAnnotatorStore((state) => state.setImage);
  const setText = useAnnotatorStore((state) => state.setText);
  const setBoxes = useAnnotatorStore((state) => state.setBoxes);
  const setEditedCharData = useAnnotatorStore((state) => state.setEditedCharData);
  const setLetterSpacing = useAnnotatorStore((state) => state.setLetterSpacing);
  const setCharPadding = useAnnotatorStore((state) => state.setCharPadding);
  const setKerningAdjustments = useAnnotatorStore((state) => state.setKerningAdjustments);
  const setBaselines = useAnnotatorStore((state) => state.setBaselines);
  const setAngledBaselines = useAnnotatorStore((state) => state.setAngledBaselines);
  const setImageRotation = useAnnotatorStore((state) => state.setImageRotation);
  const setImageFilters = useAnnotatorStore((state) => state.setImageFilters);
  const setLevelsAdjustment = useAnnotatorStore((state) => state.setLevelsAdjustment);
  const [isHovering, setIsHovering] = useState(false);

  const handleZipUpload = async (file) => {
    try {
      const zip = await JSZip.loadAsync(file);

      // Load JSON data
      const jsonFile = zip.file('annotations.json');
      if (!jsonFile) {
        alert('No annotations.json found in ZIP');
        return;
      }

      const jsonString = await jsonFile.async('string');
      const jsonData = JSON.parse(jsonString);

      // Find and load the image
      const imageName = jsonData.imageName;
      const imageFile = zip.file(imageName);

      if (!imageFile) {
        alert(`Image file "${imageName}" not found in ZIP`);
        return;
      }

      const imageBlob = await imageFile.async('blob');
      const imageUrl = URL.createObjectURL(imageBlob);

      // Load image
      const img = new Image();
      img.onload = () => {
        setImage(img, new File([imageBlob], imageName));

        // Restore all state from JSON
        setText(jsonData.text);

        // Restore boxes with both brushMask and eraseMask
        const restoredBoxes = jsonData.boxes.map(box => ({
          char: box.char,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          brushMask: box.brushMask || []
        }));
        setBoxes(restoredBoxes);

        // Restore editedCharData with eraseMasks
        const restoredEditedCharData = {};
        jsonData.boxes.forEach((box, index) => {
          if (box.eraseMask) {
            restoredEditedCharData[index] = { eraseMask: box.eraseMask };
          }
        });
        setEditedCharData(restoredEditedCharData);

        setLetterSpacing(jsonData.letterSpacing || 0);
        setCharPadding(jsonData.charPadding || 0);
        setKerningAdjustments(jsonData.kerningAdjustments || {});
        setBaselines(jsonData.baselines || []);
        setAngledBaselines(jsonData.angledBaselines || []);
        setImageRotation(jsonData.imageRotation || 0);
        setImageFilters(jsonData.imageFilters || { grayscale: 0, invert: false, brightness: 100, contrast: 100, shadows: 0, highlights: 0 });
        setLevelsAdjustment(jsonData.levelsAdjustment || null);

        URL.revokeObjectURL(imageUrl);
        alert('Project loaded successfully! Click "Start Annotating" to continue.');
      };

      img.onerror = () => {
        alert('Error loading image from ZIP');
        URL.revokeObjectURL(imageUrl);
      };

      img.src = imageUrl;
    } catch (error) {
      console.error('Error loading ZIP:', error);
      alert('Error loading ZIP file: ' + error.message);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];

      // Check if it's a ZIP file
      if (file.name.endsWith('.zip')) {
        handleZipUpload(file);
        return;
      }

      // Otherwise, handle as regular image
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImage(img, file);
        };
        img.src = e.target.result;
      };

      reader.readAsDataURL(file);
    }
  }, [setImage, setText, setBoxes, setEditedCharData, setLetterSpacing, setCharPadding, setKerningAdjustments, setBaselines, setAngledBaselines, setImageRotation, setImageFilters, setLevelsAdjustment]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
      'application/zip': ['.zip']
    },
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        border: '3px dashed #ddd',
        borderColor: isDragActive ? '#4CAF50' : (isHovering ? '#4CAF50' : '#ddd'),
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s',
        background: isDragActive ? '#e8f5e9' : (isHovering ? '#f0f9f0' : '#fafafa'),
        marginBottom: '15px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0
      }}
    >
      <input {...getInputProps()} />
      <div style={{ fontSize: '48px', marginBottom: '10px' }}>
        📷
      </div>
      <div style={{ color: '#666', fontSize: '14px' }}>
        <strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>
          Drop image or ZIP project here
        </strong>
        <span style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
          Images: JPG, PNG, WEBP, GIF
        </span>
        <span style={{ fontSize: '12px', color: '#9C27B0', fontWeight: 600 }}>
          📦 Or drop a ZIP to restore your saved project!
        </span>
      </div>
    </div>
  );
}
