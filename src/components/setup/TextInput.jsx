import { useState, useEffect } from 'react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function TextInput() {
  const text = useAnnotatorStore((state) => state.text);
  const setText = useAnnotatorStore((state) => state.setText);
  const [isFocused, setIsFocused] = useState(false);
  const [isFromStorage, setIsFromStorage] = useState(false);

  // Check if text was loaded from localStorage on mount
  useEffect(() => {
    const savedText = localStorage.getItem('annotator-text');
    if (savedText && savedText === text && text.length > 0) {
      setIsFromStorage(true);
    } else {
      setIsFromStorage(false);
    }
  }, []); // Only run on mount

  // Clear the "from storage" indicator when user starts editing
  const handleChange = (e) => {
    setText(e.target.value);
    setIsFromStorage(false);
  };

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{
        display: 'block',
        fontSize: '14px',
        color: '#333',
        marginBottom: '5px',
        fontWeight: 500
      }}>
        Text to Annotate
      </label>
      {isFromStorage && (
        <p style={{
          marginBottom: '8px',
          fontSize: '12px',
          color: '#4CAF50',
          fontStyle: 'italic'
        }}>
          ✓ Loaded from previous session
        </p>
      )}
      <input
        type="text"
        value={text}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Enter text to annotate..."
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '16px',
          border: `2px solid ${isFocused ? '#4CAF50' : '#ddd'}`,
          borderRadius: '8px',
          transition: 'border-color 0.2s',
          outline: 'none'
        }}
      />
      {text && (
        <p style={{
          marginTop: '8px',
          fontSize: '13px',
          color: '#666'
        }}>
          {text.length} characters, {new Set(text.split('')).size} unique
        </p>
      )}
    </div>
  );
}
