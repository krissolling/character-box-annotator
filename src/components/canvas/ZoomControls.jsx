import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function ZoomControls() {
  const zoomLevel = useAnnotatorStore((state) => state.zoomLevel);
  const zoomIn = useAnnotatorStore((state) => state.zoomIn);
  const zoomOut = useAnnotatorStore((state) => state.zoomOut);
  const resetZoom = useAnnotatorStore((state) => state.resetZoom);
  const fitToView = useAnnotatorStore((state) => state.fitToView);
  const image = useAnnotatorStore((state) => state.image);

  const handleFitToView = () => {
    if (!image) return;

    // Find the canvas container element
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const containerRect = canvas.parentElement.getBoundingClientRect();
    fitToView(image.width, image.height, containerRect.width, containerRect.height);
  };

  const handleResetZoom = () => {
    if (!image) return;

    // Find the canvas container element
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const containerRect = canvas.parentElement.getBoundingClientRect();
    resetZoom(image.width, image.height, containerRect.width, containerRect.height);
  };

  const buttonStyle = {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 600,
    background: '#f5f5f5',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    minWidth: '32px'
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      zIndex: 10,
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '6px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }}>
      <button
        onClick={zoomOut}
        style={buttonStyle}
        onMouseOver={(e) => e.target.style.background = '#e0e0e0'}
        onMouseOut={(e) => e.target.style.background = '#f5f5f5'}
        title="Zoom Out (-)"
      >
        -
      </button>

      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: '#333',
        padding: '0 8px',
        minWidth: '50px',
        textAlign: 'center'
      }}>
        {Math.round(zoomLevel * 100)}%
      </div>

      <button
        onClick={zoomIn}
        style={buttonStyle}
        onMouseOver={(e) => e.target.style.background = '#e0e0e0'}
        onMouseOut={(e) => e.target.style.background = '#f5f5f5'}
        title="Zoom In (+)"
      >
        +
      </button>

      <button
        onClick={handleFitToView}
        style={buttonStyle}
        onMouseOver={(e) => e.target.style.background = '#e0e0e0'}
        onMouseOut={(e) => e.target.style.background = '#f5f5f5'}
        title="Fit to view"
      >
        Fit
      </button>

      <button
        onClick={handleResetZoom}
        style={buttonStyle}
        onMouseOver={(e) => e.target.style.background = '#e0e0e0'}
        onMouseOut={(e) => e.target.style.background = '#f5f5f5'}
        title="Reset Zoom to 100%"
      >
        Reset
      </button>
    </div>
  );
}
