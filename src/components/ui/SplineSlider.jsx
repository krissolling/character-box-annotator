import { useRef, useState, useEffect } from 'react';

/**
 * Spline-inspired slider with custom track, fill, and thumb
 * Features drag interaction and optional number input
 */
export default function SplineSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  showInput = false,
  inputWidth = '44px'
}) {
  const sliderRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));

  // Calculate percentage for positioning (with padding so thumb doesn't go to edges)
  const rawPercentage = ((value - min) / (max - min)) * 100;
  // Add padding: thumb should stay within edges (half of 14px thumb width = 7px)
  const paddingPercent = 9; // percentage padding on each side
  const percentage = paddingPercent + (rawPercentage * (100 - 2 * paddingPercent) / 100);

  // Update input when value changes (including during drag)
  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    updateValue(e);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    updateValue(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateValue = (e) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    // Calculate value from position (accounting for padding)
    const padPercent = 9;
    let newPercentage = (x / width) * 100;

    // Map from padded range back to 0-100
    newPercentage = (newPercentage - padPercent) * 100 / (100 - 2 * padPercent);
    newPercentage = Math.max(0, Math.min(100, newPercentage));

    let newValue = min + (newPercentage / 100) * (max - min);

    // Round to step
    newValue = Math.round(newValue / step) * step;
    newValue = Math.max(min, Math.min(max, newValue));

    onChange(newValue);
  };

  // Global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      const onMouseMove = (e) => {
        if (!sliderRef.current) return;

        const rect = sliderRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;

        // Calculate value from position (accounting for padding)
        const padPercent = 9;
        let newPercentage = (x / width) * 100;

        // Map from padded range back to 0-100
        newPercentage = (newPercentage - padPercent) * 100 / (100 - 2 * padPercent);
        newPercentage = Math.max(0, Math.min(100, newPercentage));

        let newValue = min + (newPercentage / 100) * (max - min);

        // Round to step
        newValue = Math.round(newValue / step) * step;
        newValue = Math.max(min, Math.min(max, newValue));

        onChange(newValue);
      };

      const onMouseUp = () => {
        setIsDragging(false);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [isDragging, min, max, step, onChange]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    let newValue = parseFloat(inputValue);
    if (isNaN(newValue)) {
      setInputValue(String(value));
      return;
    }
    newValue = Math.max(min, Math.min(max, newValue));
    newValue = Math.round(newValue / step) * step;
    onChange(newValue);
    setInputValue(String(newValue));
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <div className="te-slider-combo">
      {showInput && (
        <input
          type="text"
          className="te-spline-input"
          style={{ width: inputWidth }}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
        />
      )}
      <div
        ref={sliderRef}
        className="te-spline-slider"
        onMouseDown={handleMouseDown}
        style={{ flex: 1 }}
      >
        <div className="te-spline-slider-track">
          <div
            className="te-spline-slider-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className="te-spline-slider-thumb"
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
