import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';

interface DeleteConfirmDialogProps {
  isOpen?: boolean;
  locationName: string;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen = true,
  locationName,
  onConfirm,
  onCancel,
  onClose,
}) => {
  if (isOpen === false) return null;

  const handleDismiss = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div className="w-full max-w-sm liquid-glass rounded-3xl border border-red-500/20 p-6 shadow-2xl relative text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-3.5">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-white mb-1">Delete this saved location?</h3>
        <p className="text-xs text-slate-300 mb-5 leading-relaxed">
          Are you sure you want to remove <span className="font-semibold text-white">"{locationName}"</span>?
          You can immediately undo this action if needed.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
