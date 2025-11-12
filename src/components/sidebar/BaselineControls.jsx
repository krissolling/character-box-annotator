import { Trash2 } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function BaselineControls() {
  const baselines = useAnnotatorStore((state) => state.baselines);
  const removeBaseline = useAnnotatorStore((state) => state.removeBaseline);
  const angledBaselines = useAnnotatorStore((state) => state.angledBaselines);
  const removeAngledBaseline = useAnnotatorStore((state) => state.removeAngledBaseline);

  const panelStyle = {
    background: 'white',
    padding: '10px',
    borderRadius: '12px',
    border: '2px solid #ddd',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  };

  const titleStyle = {
    fontWeight: 600,
    marginBottom: '8px',
    color: '#333',
    fontSize: '13px'
  };

  const hasBaselines = baselines.length > 0 || angledBaselines.length > 0;

  return (
    <div style={panelStyle}>
      <h3 style={titleStyle}>Baselines</h3>

      {!hasBaselines ? (
        <div style={{ textAlign: 'center', color: '#999', fontSize: '11px', fontStyle: 'italic', padding: '4px 0' }}>
          No baselines yet
        </div>
      ) : (
        <>
          {/* Horizontal Baselines */}
          {baselines.map((baseline) => (
            <div
              key={`baseline-${baseline.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px',
                background: '#fafafa',
                borderRadius: '6px',
                border: `2px solid ${baseline.color}`,
                marginBottom: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    backgroundColor: baseline.color
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 500 }}>
                  Baseline {baseline.id} (y={Math.round(baseline.y)})
                </span>
              </div>

              <button
                onClick={() => removeBaseline(baseline.id)}
                style={{
                  padding: '4px',
                  color: '#f44336',
                  background: 'none',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#ffebee'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                title="Remove baseline"
              >
                <Trash2 style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          ))}

          {/* Angled Baselines */}
          {angledBaselines.map((baseline) => (
            <div
              key={`angled-${baseline.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px',
                background: '#fafafa',
                borderRadius: '6px',
                border: `2px solid ${baseline.color}`,
                marginBottom: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    backgroundColor: baseline.color
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 500 }}>
                  Angled {baseline.id} ({baseline.angle.toFixed(1)}°)
                </span>
              </div>

              <button
                onClick={() => removeAngledBaseline(baseline.id)}
                style={{
                  padding: '4px',
                  color: '#f44336',
                  background: 'none',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#ffebee'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                title="Remove angled baseline"
              >
                <Trash2 style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          ))}

          <p style={{ fontSize: '11px', color: '#999', marginTop: '10px' }}>
            Click on a baseline to select/deselect boxes
          </p>
        </>
      )}
    </div>
  );
}
