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
    <div style={{ marginBottom: '12px' }}>
      <label className="te-small-caps" style={{
        display: 'block',
        color: 'var(--te-gray-dark)',
        marginBottom: '6px'
      }}>
        Text to Annotate
      </label>
      {isFromStorage && (
        <p className="te-small-caps" style={{
          marginBottom: '8px',
          color: 'var(--te-green)',
          fontStyle: 'italic'
        }}>
          Loaded from previous session
        </p>
      )}
      <input
        type="text"
        value={text}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Enter text to annotate..."
        className="te-input"
        style={{
          width: '100%',
          height: '40px',
          fontSize: '14px',
          borderColor: isFocused ? 'var(--te-blue)' : 'var(--te-gray-mid)'
        }}
      />
      {text && (
        <p className="te-small-caps" style={{
          marginTop: '8px',
          color: 'var(--te-gray-dark)'
        }}>
          {text.length} characters, {new Set(text.split('')).size} unique
        </p>
      )}
    </div>
  );
}
