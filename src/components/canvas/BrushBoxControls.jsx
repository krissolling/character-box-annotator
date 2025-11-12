import { Check, X } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function BrushBoxControls() {
  const isBrushBoxMode = useAnnotatorStore((state) => state.isBrushBoxMode);
  const brushBoxSize = useAnnotatorStore((state) => state.brushBoxSize);
  const brushStrokes = useAnnotatorStore((state) => state.brushStrokes);
  const setBrushBoxSize = useAnnotatorStore((state) => state.setBrushBoxSize);
  const confirmBrushBox = useAnnotatorStore((state) => state.confirmBrushBox);
  const cancelBrushBox = useAnnotatorStore((state) => state.cancelBrushBox);

  if (!isBrushBoxMode) {
    return null;
  }

  const handleConfirm = () => {
    if (brushStrokes.length === 0) {
      alert('Please draw some brush strokes first.');
      return;
    }
    confirmBrushBox();
  };

  return (
    <>
      {/* Brush size control - top right */}
      <div className="absolute top-4 right-4 z-10 bg-white/95 rounded-lg shadow-lg p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
              Brush Size
            </label>
            <span className="text-xs font-bold text-blue-600 min-w-[40px] text-right">
              {brushBoxSize}px
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={brushBoxSize}
            onChange={(e) => setBrushBoxSize(parseInt(e.target.value))}
            className="w-32 h-2 accent-blue-500"
          />
          <div className="text-xs text-gray-500 text-center">
            [ / ] keys
          </div>
        </div>
      </div>

      {/* Confirm/Cancel buttons - bottom center */}
      {brushStrokes.length > 0 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10
                        bg-white/95 rounded-lg shadow-lg p-3 flex items-center gap-3">
          <div className="text-sm font-semibold text-gray-700">
            {brushStrokes.length} stroke{brushStrokes.length !== 1 ? 's' : ''}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium
                         hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Confirm
            </button>

            <button
              onClick={cancelBrushBox}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium
                         hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
