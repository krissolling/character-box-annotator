import { useState } from 'react';
import AnnotationCanvas from './canvas/AnnotationCanvas';
import CharacterPicker from './sidebar/CharacterPicker';
import FilterControls from './sidebar/FilterControls';
import TypographyControls from './sidebar/TypographyControls';
import WordPreview from './sidebar/WordPreview';
import BaselineControls from './sidebar/BaselineControls';
import EditedCharacters from './sidebar/EditedCharacters';
import ExportPanel from './sidebar/ExportPanel';
import CharacterEditModal from './modals/CharacterEditModal';

export default function MainAnnotator() {
  const [canvasHeight, setCanvasHeight] = useState(60); // Percentage of available height
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const container = e.currentTarget.parentElement;
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percentage = (y / rect.height) * 100;

    // Constrain between 20% and 80%
    const constrainedPercentage = Math.min(Math.max(percentage, 20), 80);
    setCanvasHeight(constrainedPercentage);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      style={{ background: '#f5f5f5', height: '100vh', display: 'flex', flexDirection: 'column' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Main content area - 2 column grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 250px',
        gap: '15px',
        padding: '15px',
        overflow: 'hidden',
        minHeight: 0
      }}>
        {/* Left column: Resizable container with canvas and word preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', minHeight: 0, overflow: 'hidden' }}>
          {/* Top: Annotation Canvas */}
          <div style={{ flex: `0 0 ${canvasHeight}%`, minHeight: '200px', overflow: 'hidden' }}>
            <AnnotationCanvas />
          </div>

          {/* Draggable handle */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              height: '8px',
              background: isDragging ? '#2196F3' : '#ddd',
              cursor: 'ns-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: isDragging ? 'none' : 'background 0.2s',
              position: 'relative',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              if (!isDragging) e.currentTarget.style.background = '#bbb';
            }}
            onMouseLeave={(e) => {
              if (!isDragging) e.currentTarget.style.background = '#ddd';
            }}
          >
            <div style={{
              width: '40px',
              height: '3px',
              background: isDragging ? 'white' : '#999',
              borderRadius: '2px'
            }}></div>
          </div>

          {/* Bottom: Word Preview */}
          <div style={{ flex: 1, minHeight: '150px', overflow: 'hidden' }}>
            <WordPreview />
          </div>
        </div>

        {/* Right column: Sidebar with control panels */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <CharacterPicker />
            <BaselineControls />
            <EditedCharacters />
            <FilterControls />
          </div>
        </div>
      </div>

      {/* Character Edit Modal */}
      <CharacterEditModal />
    </div>
  );
}
