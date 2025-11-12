import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function CharacterBoxesPreview() {
  const text = useAnnotatorStore((state) => state.text);
  const currentCharIndex = useAnnotatorStore((state) => state.currentCharIndex);
  const setCurrentCharIndex = useAnnotatorStore((state) => state.setCurrentCharIndex);

  if (!text) return null;

  // Colors for each character position
  const colors = [
    '#2196F3', // blue
    '#4CAF50', // green
    '#FFC107', // yellow/amber
    '#FF9800', // orange
    '#9C27B0', // purple
    '#F44336', // red
    '#00BCD4', // cyan
    '#E91E63', // pink
  ];

  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '6px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      padding: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      {text.split('').map((char, index) => {
        const isCurrent = currentCharIndex === index % (text.split('').filter((c, i, arr) => arr.indexOf(c) === i).length);
        const color = colors[index % colors.length];

        return (
          <div
            key={index}
            onClick={() => setCurrentCharIndex(index)}
            style={{
              width: '50px',
              height: '60px',
              background: 'white',
              border: `3px solid ${color}`,
              borderBottom: `8px solid ${color}`,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 700,
              color: '#333',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              position: 'relative'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {char}
          </div>
        );
      })}
    </div>
  );
}
