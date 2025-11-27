import { Trash2, AlignCenter } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function BaselineControls() {
  const baselines = useAnnotatorStore((state) => state.baselines);
  const removeBaseline = useAnnotatorStore((state) => state.removeBaseline);
  const angledBaselines = useAnnotatorStore((state) => state.angledBaselines);
  const removeAngledBaseline = useAnnotatorStore((state) => state.removeAngledBaseline);

  const hasBaselines = baselines.length > 0 || angledBaselines.length > 0;

  if (!hasBaselines) {
    return null;
  }

  return (
    <>
      <style>{`
        .baselines-container:hover .baseline-delete-btn {
          opacity: 1 !important;
        }
      `}</style>
      <div className="te-panel baselines-container">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '6px'
      }}>
        <AlignCenter style={{ width: '14px', height: '14px', color: 'var(--te-black)' }} />
        <span className="te-small-caps">
          <strong>{baselines.length + angledBaselines.length}</strong> baseline{baselines.length + angledBaselines.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Horizontal Baselines */}
        {baselines.map((baseline) => (
          <div
            key={`baseline-${baseline.id}`}
            className="baseline-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px',
              background: baseline.color,
              borderRadius: 'var(--radius-sm)',
              color: 'white'
            }}
          >
            <span className="te-small-caps">
              #{baseline.id} y={Math.round(baseline.y)}
            </span>

            <button
              onClick={() => removeBaseline(baseline.id)}
              className="baseline-delete-btn"
              style={{
                padding: '2px',
                color: 'white',
                background: 'rgba(0, 0, 0, 0.2)',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                opacity: 0,
                transition: 'opacity 0.2s'
              }}
              title="Remove baseline"
            >
              <Trash2 style={{ width: '12px', height: '12px' }} />
            </button>
          </div>
        ))}

        {/* Angled Baselines */}
        {angledBaselines.map((baseline) => (
          <div
            key={`angled-${baseline.id}`}
            className="baseline-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px',
              background: baseline.color,
              borderRadius: 'var(--radius-sm)',
              color: 'white'
            }}
          >
            <span className="te-small-caps">
              #{baseline.id} {baseline.angle.toFixed(1)}°
            </span>

            <button
              onClick={() => removeAngledBaseline(baseline.id)}
              className="baseline-delete-btn"
              style={{
                padding: '2px',
                color: 'white',
                background: 'rgba(0, 0, 0, 0.2)',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                opacity: 0,
                transition: 'opacity 0.2s'
              }}
              title="Remove angled baseline"
            >
              <Trash2 style={{ width: '12px', height: '12px' }} />
            </button>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
