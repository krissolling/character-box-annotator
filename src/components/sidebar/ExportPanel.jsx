import { Download } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function ExportPanel() {
  const exportData = useAnnotatorStore((state) => state.exportData);
  const boxes = useAnnotatorStore((state) => state.boxes);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `character-boxes-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const panelStyle = {
    background: 'white',
    padding: '15px',
    borderRadius: '12px',
    border: '2px solid #ddd',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  };

  const titleStyle = {
    fontWeight: 600,
    marginBottom: '10px',
    color: '#333',
    fontSize: '14px'
  };

  const buttonStyle = {
    width: '100%',
    padding: '12px 24px',
    background: boxes.length === 0 ? '#ccc' : '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: boxes.length === 0 ? 'not-allowed' : 'pointer',
    transition: 'background 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  };

  return (
    <div style={panelStyle}>
      <h3 style={titleStyle}>Export</h3>

      <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
        <p>{boxes.length} boxes annotated</p>
      </div>

      <button
        onClick={handleExport}
        disabled={boxes.length === 0}
        style={buttonStyle}
        onMouseOver={(e) => {
          if (boxes.length > 0) {
            e.target.style.background = '#45a049';
          }
        }}
        onMouseOut={(e) => {
          if (boxes.length > 0) {
            e.target.style.background = '#4CAF50';
          }
        }}
      >
        <Download style={{ width: '16px', height: '16px' }} />
        Export JSON
      </button>

      <p style={{ marginTop: '8px', fontSize: '11px', color: '#999' }}>
        Exports character boxes with coordinates and metadata
      </p>
    </div>
  );
}
