import { useEffect } from 'react';
import useAnnotatorStore from './store/useAnnotatorStore';
import SetupPanel from './components/setup/SetupPanel';
import MainAnnotator from './components/MainAnnotator';
import './styles/design-system.css';

function App() {
  const isAnnotating = useAnnotatorStore((state) => state.isAnnotating);
  const nextChar = useAnnotatorStore((state) => state.nextChar);
  const previousChar = useAnnotatorStore((state) => state.previousChar);

  const selectedBox = useAnnotatorStore((state) => state.selectedBox);
  const deleteBox = useAnnotatorStore((state) => state.deleteBox);
  const setSelectedBox = useAnnotatorStore((state) => state.setSelectedBox);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Arrow keys for navigation
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextChar();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previousChar();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected box
        if (selectedBox !== null && !e.target.matches('input, textarea')) {
          e.preventDefault();
          deleteBox(selectedBox);
          setSelectedBox(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextChar, previousChar, selectedBox, deleteBox, setSelectedBox]);

  // Prevent browser zoom from trackpad pinch gestures and Cmd/Ctrl+scroll
  useEffect(() => {
    const handleWheel = (e) => {
      // Trackpad pinch gestures send wheel events with ctrlKey set to true
      // We want to prevent the browser from zooming the entire page
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    // Must use { passive: false } to be able to call preventDefault()
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--te-bg)' }}>
      {!isAnnotating ? (
        <SetupPanel />
      ) : (
        <MainAnnotator />
      )}
    </div>
  );
}

export default App
