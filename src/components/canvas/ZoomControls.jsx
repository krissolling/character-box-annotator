import { Maximize2 } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function ZoomControls() {
  const zoomLevel = useAnnotatorStore((state) => state.zoomLevel);
  const zoomIn = useAnnotatorStore((state) => state.zoomIn);
  const zoomOut = useAnnotatorStore((state) => state.zoomOut);
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      alignItems: 'center'
    }}>
      <button
        onClick={handleFitToView}
        className="te-tool-btn"
        title="Fit to view"
      >
        <Maximize2 style={{ width: '14px', height: '14px' }} />
      </button>

      <div className="te-small-caps" style={{
        padding: '4px 0',
        fontSize: '9px',
        textAlign: 'center'
      }}>
        {Math.round(zoomLevel * 100)}%
      </div>
    </div>
  );
}
