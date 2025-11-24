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
        border: '2px dashed var(--te-gray-mid)',
        borderColor: isDragActive ? 'var(--te-green)' : (isHovering ? 'var(--te-green)' : 'var(--te-gray-mid)'),
        borderRadius: 'var(--radius-sm)',
        padding: 'var(--padding-lg)',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: isDragActive ? 'rgba(74, 222, 128, 0.1)' : (isHovering ? 'var(--te-gray-light)' : 'transparent'),
        marginBottom: '12px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0
      }}
    >
      <input {...getInputProps()} />
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>
        📷
      </div>
      <div style={{ color: 'var(--te-black)' }}>
        <span style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '12px',
          fontVariationSettings: "'wght' 500"
        }}>
          Drop image or ZIP project here
        </span>
        <span className="te-small-caps" style={{ display: 'block', marginBottom: '4px', color: 'var(--te-gray-dark)' }}>
          Images: JPG, PNG, WEBP, GIF
        </span>
        <span className="te-small-caps" style={{ color: 'var(--te-orange)' }}>
          Or drop a ZIP to restore project
        </span>
      </div>
    </div>
  );
}
