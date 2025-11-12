import { useState } from 'react';
import { Check, X, Loader } from 'lucide-react';
import useAnnotatorStore from '../../store/useAnnotatorStore';
import { processAutoSolveRegions } from '../../utils/autoSolve';

export default function AutoSolveControls() {
  const [isProcessing, setIsProcessing] = useState(false);

  const isSelectingAutoSolveRegion = useAnnotatorStore((state) => state.isSelectingAutoSolveRegion);
  const autoSolveRegions = useAnnotatorStore((state) => state.autoSolveRegions);
  const cancelAutoSolve = useAnnotatorStore((state) => state.cancelAutoSolve);
  const clearAutoSolveRegions = useAnnotatorStore((state) => state.clearAutoSolveRegions);
  const image = useAnnotatorStore((state) => state.image);
  const boxes = useAnnotatorStore((state) => state.boxes);
  const uniqueChars = useAnnotatorStore((state) => state.uniqueChars);
  const text = useAnnotatorStore((state) => state.text);
  const addBox = useAnnotatorStore((state) => state.addBox);
  const setCurrentCharIndex = useAnnotatorStore((state) => state.setCurrentCharIndex);

  const handleConfirm = async () => {
    if (autoSolveRegions.length === 0) {
      alert('Please draw at least one region first.');
      return;
    }

    setIsProcessing(true);

    try {
      const { addedBoxes, skippedCount } = await processAutoSolveRegions(
        image,
        autoSolveRegions,
        boxes,
        uniqueChars,
        text
      );

      // Add all new boxes to the store
      addedBoxes.forEach((box) => addBox(box));

      // Find next unannotated character
      const findNextUnannotatedChar = () => {
        for (let i = 0; i < uniqueChars.length; i++) {
          const char = uniqueChars[i];
          const hasBox = boxes.some((b) => b.char === char) || addedBoxes.some((b) => b.char === char);
          if (!hasBox) return i;
        }
        return 0;
      };

      setCurrentCharIndex(findNextUnannotatedChar());

      // Clear regions and exit auto-solve mode
      clearAutoSolveRegions();

      // Show results
      const totalChars = uniqueChars.length;
      const remaining = totalChars - (addedBoxes.length + skippedCount);
      alert(
        `Auto-Solve Complete!\n\n` +
        `✅ Added: ${addedBoxes.length} character${addedBoxes.length !== 1 ? 's' : ''}\n` +
        `⏭️ Skipped: ${skippedCount} (already annotated)\n` +
        `📝 Remaining: ${remaining} character${remaining !== 1 ? 's' : ''}`
      );
    } catch (error) {
      console.error('❌ Auto-solve error:', error);
      alert(`Auto-solve failed: ${error.message}\n\nYou can continue annotating manually.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    cancelAutoSolve();
  };

  if (!isSelectingAutoSolveRegion || autoSolveRegions.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10
                    bg-white/95 rounded-lg shadow-lg p-3 flex items-center gap-3">
      {/* Region count */}
      <div className="text-sm font-semibold text-gray-700">
        {autoSolveRegions.length} region{autoSolveRegions.length !== 1 ? 's' : ''} selected
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={isProcessing}
          className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium
                     hover:bg-green-600 transition-colors flex items-center gap-2
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Confirm
            </>
          )}
        </button>

        <button
          onClick={handleCancel}
          disabled={isProcessing}
          className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium
                     hover:bg-red-600 transition-colors flex items-center gap-2
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}
