import { useState, useEffect } from 'react';
import { RotateCcw, Edit3 } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import ImageUploader from './ImageUploader';
import TextInput from './TextInput';
import RecentProjects from './RecentProjects';

export default function SetupPanel() {
  const isAnnotating = useAnnotatorStore((state) => state.isAnnotating);
  const image = useAnnotatorStore((state) => state.image);
  const text = useAnnotatorStore((state) => state.text);
  const setIsAnnotating = useAnnotatorStore((state) => state.setIsAnnotating);
  const reset = useAnnotatorStore((state) => state.reset);
  const [showTextInput, setShowTextInput] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);

  // Auto-start annotating when image is uploaded (even without text)
  useEffect(() => {
    if (image && !isAnnotating) {
      setIsAnnotating(true);
    }
  }, [image, isAnnotating, setIsAnnotating]);

  const handleStart = () => {
    if (image && text) {
      setIsAnnotating(true);
    }
  };

  const handleReset = () => {
    if (confirm('Start over with a new image? All annotations will be lost.')) {
      reset();
    }
  };

  const handleEditString = () => {
    const currentText = text || '';
    const newText = prompt('Edit the string to annotate:', currentText);

    if (newText !== null && newText !== currentText) {
      // User confirmed and text changed
      if (newText.trim() === '') {
        alert('String cannot be empty');
        return;
      }

      // Smart box preservation: only remove boxes for characters that no longer exist
      const boxes = useAnnotatorStore.getState().boxes;
      if (boxes.length > 0) {
        const newChars = [...new Set(newText.split(''))];
        const oldChars = [...new Set(currentText.split(''))];
        const removedChars = oldChars.filter(c => !newChars.includes(c));

        if (removedChars.length > 0) {
          const removedList = removedChars.join(', ');
          if (!confirm(`This will remove boxes for: ${removedList}\n\nBoxes for other characters will be preserved. Continue?`)) {
            return;
          }

          // Keep only boxes for characters that still exist in new string
          const preservedBoxes = boxes.filter(box => newChars.includes(box.char));

          // Update editedCharData to match new box indices
          const oldEditedCharData = useAnnotatorStore.getState().editedCharData;
          const newEditedCharData = {};

          preservedBoxes.forEach((box, newIndex) => {
            const oldIndex = boxes.indexOf(box);
            if (oldEditedCharData[oldIndex]) {
              newEditedCharData[newIndex] = oldEditedCharData[oldIndex];
            }
          });

          useAnnotatorStore.getState().setBoxes(preservedBoxes);
          useAnnotatorStore.getState().setEditedCharData(newEditedCharData);
        }
        // If no characters removed, keep all boxes
      }

      // Update text
      useAnnotatorStore.getState().setText(newText);
    }
  };

  if (isAnnotating) {
    return (
      <div style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 50,
        display: 'flex',
        gap: '8px'
      }}>
        <button
          onClick={handleEditString}
          className="te-btn"
          style={{
            background: 'var(--te-blue)',
            borderColor: 'var(--te-blue)',
            color: 'var(--te-white)',
            gap: '6px'
          }}
        >
          <Edit3 style={{ width: '14px', height: '14px' }} />
          Edit String
        </button>
        <button
          onClick={handleReset}
          className="te-btn"
          style={{
            background: 'var(--te-orange)',
            borderColor: 'var(--te-orange)',
            color: 'var(--te-white)',
            gap: '6px'
          }}
        >
          <RotateCcw style={{ width: '14px', height: '14px' }} />
          New Image
        </button>
      </div>
    );
  }

  const handleProjectLoad = (projectId) => {
    setCurrentProjectId(projectId);
    // The project is automatically loaded by RecentProjects component
    // and will trigger the auto-start via the useEffect above
  };

  return (
    <div style={{
      maxWidth: '100%',
      margin: '0 auto',
      padding: 'var(--padding-md)',
      height: '100vh',
      display: 'flex',
      gap: 'var(--padding-md)',
      boxSizing: 'border-box'
    }}>
      {/* Left Panel - Recent Projects */}
      <div className="te-panel" style={{
        padding: 'var(--padding-md)',
        flex: '0 0 320px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '14px',
          fontVariationSettings: "'wght' 600",
          color: 'var(--te-black)'
        }}>
          Recent Files
        </h3>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <RecentProjects onProjectLoad={handleProjectLoad} />
        </div>
      </div>

      {/* Right Panel - Upload & Setup */}
      <div className="te-panel" style={{
        padding: 'var(--padding-md)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        <ImageUploader />

        {image && (
          <>
            <div style={{
              margin: '12px 0',
              padding: 'var(--padding-sm)',
              background: 'var(--te-gray-light)',
              border: '1px solid var(--te-gray-mid)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <p className="te-small-caps" style={{ color: 'var(--te-green)' }}>
                Image loaded: {image.width} × {image.height}px
              </p>
            </div>

            {/* Show TextInput if text exists OR user clicked "Write String" */}
            {(text || showTextInput) && <TextInput />}

            {/* If no text and haven't shown input yet, show "Write String" button */}
            {!text && !showTextInput && (
              <button
                onClick={() => setShowTextInput(true)}
                className="te-btn"
                style={{
                  width: '100%',
                  background: 'var(--te-blue)',
                  borderColor: 'var(--te-blue)',
                  color: 'var(--te-white)',
                  marginBottom: '12px'
                }}
              >
                Write String
              </button>
            )}

            {/* Start button - only enabled if text exists */}
            {text && (
              <button
                onClick={handleStart}
                className="te-btn"
                style={{
                  width: '100%',
                  background: 'var(--te-green)',
                  borderColor: 'var(--te-green)',
                  color: 'var(--te-black)'
                }}
              >
                Start Annotating
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
