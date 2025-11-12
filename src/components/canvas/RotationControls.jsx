import { Check, X, RotateCcw } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';

export default function RotationControls() {
  const isRotationMode = useAnnotatorStore((state) => state.isRotationMode);
  const imageRotation = useAnnotatorStore((state) => state.imageRotation);
  const rotationLineStart = useAnnotatorStore((state) => state.rotationLineStart);
  const rotationLineEnd = useAnnotatorStore((state) => state.rotationLineEnd);
  const confirmRotation = useAnnotatorStore((state) => state.confirmRotation);
  const cancelRotation = useAnnotatorStore((state) => state.cancelRotation);
  const resetRotation = useAnnotatorStore((state) => state.resetRotation);

  // Calculate current angle from line
  const getCurrentAngle = () => {
    if (!rotationLineStart || !rotationLineEnd) return 0;

    const dx = rotationLineEnd.x - rotationLineStart.x;
    const dy = rotationLineEnd.y - rotationLineStart.y;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = angleRad * (180 / Math.PI);

    return angleDeg;
  };

  if (!isRotationMode && imageRotation === 0) {
    return null;
  }

  const currentAngle = isRotationMode ? getCurrentAngle() : imageRotation;

  return (
    <>
      {/* Current rotation display - top right */}
      <div className="absolute top-4 right-4 z-10 bg-white/95 rounded-lg shadow-lg p-3">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-gray-700 text-center">
            Rotation
          </div>
          <div className="text-2xl font-bold text-purple-600 text-center">
            {currentAngle.toFixed(1)}°
          </div>
          {!isRotationMode && imageRotation !== 0 && (
            <button
              onClick={resetRotation}
              className="px-3 py-1 bg-orange-500 text-white rounded text-xs font-medium
                         hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Confirm/Cancel buttons - bottom center (only in rotation mode) */}
      {isRotationMode && rotationLineStart && rotationLineEnd && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10
                        bg-white/95 rounded-lg shadow-lg p-3 flex items-center gap-3">
          <div className="text-sm font-semibold text-gray-700">
            {currentAngle.toFixed(1)}° rotation
          </div>

          <div className="flex gap-2">
            <button
              onClick={confirmRotation}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium
                         hover:bg-purple-600 transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Apply
            </button>

            <button
              onClick={cancelRotation}
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
