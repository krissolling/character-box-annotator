import { useState, useEffect } from 'react';
import { RotateCcw, Edit3 } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import ImageUploader from './ImageUploader';
import TextInput from './TextInput';

export default function SetupPanel() {
  const isAnnotating = useAnnotatorStore((state) => state.isAnnotating);
  const image = useAnnotatorStore((state) => state.image);
  const text = useAnnotatorStore((state) => state.text);
  const setIsAnnotating = useAnnotatorStore((state) => state.setIsAnnotating);
  const reset = useAnnotatorStore((state) => state.reset);
  const [showTextInput, setShowTextInput] = useState(false);

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

      // Warn if there are existing boxes and text is changing
      const boxes = useAnnotatorStore.getState().boxes;
      if (boxes.length > 0) {
        if (!confirm('Changing the string will clear all existing boxes. Continue?')) {
          return;
        }
        // Clear boxes
        useAnnotatorStore.getState().setBoxes([]);
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
        gap: '12px'
      }}>
        <button
          onClick={handleEditString}
          style={{
            padding: '12px 24px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => e.target.style.background = '#1976D2'}
          onMouseOut={(e) => e.target.style.background = '#2196F3'}
        >
          <Edit3 style={{ width: '16px', height: '16px' }} />
          Edit String
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '12px 24px',
            background: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => e.target.style.background = '#F57C00'}
          onMouseOut={(e) => e.target.style.background = '#FF9800'}
        >
          <RotateCcw style={{ width: '16px', height: '16px' }} />
          New Image
        </button>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '100%',
      margin: '0 auto',
      padding: '15px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <header style={{
        background: 'white',
        padding: '15px 20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <h1 style={{
            color: '#333',
            fontSize: '20px',
            marginBottom: '5px'
          }}>
            Character Box Annotator
          </h1>
          <div style={{
            color: '#666',
            fontSize: '14px'
          }}>
            Draw boxes around characters to annotate text
          </div>
        </div>
      </header>

      {/* Setup Panel */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '15px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        <ImageUploader />

        {image && (
          <>
            <div style={{
              margin: '15px 0',
              padding: '12px',
              background: '#E3F2FD',
              border: '1px solid #2196F3',
              borderRadius: '8px'
            }}>
              <p style={{ fontSize: '13px', color: '#1565C0' }}>
                ✓ Image loaded: {image.width} × {image.height}px
              </p>
            </div>

            {/* Show TextInput if text exists OR user clicked "Write String" */}
            {(text || showTextInput) && <TextInput />}

            {/* If no text and haven't shown input yet, show "Write String" button */}
            {!text && !showTextInput && (
              <button
                onClick={() => setShowTextInput(true)}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  marginBottom: '15px'
                }}
                onMouseOver={(e) => e.target.style.background = '#1976D2'}
                onMouseOut={(e) => e.target.style.background = '#2196F3'}
              >
                Write String
              </button>
            )}

            {/* Start button - only enabled if text exists */}
            {text && (
              <button
                onClick={handleStart}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#45a049'}
                onMouseOut={(e) => e.target.style.background = '#4CAF50'}
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
