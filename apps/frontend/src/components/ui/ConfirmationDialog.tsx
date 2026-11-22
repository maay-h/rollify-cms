import React from 'react';
import { AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  const icons = {
    danger: <AlertTriangle className="w-8 h-8 text-rose-600" />,
    warning: <AlertCircle className="w-8 h-8 text-amber-500" />,
    primary: <HelpCircle className="w-8 h-8 text-rollify-red" />,
  };

  const buttonVariants = {
    danger: 'danger' as const,
    warning: 'gold' as const,
    primary: 'primary' as const,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm" showCloseButton={!isLoading}>
      <div className="text-center pt-2 pb-1">
        <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-stone-100 mb-4">
          {icons[variant]}
        </div>
        <h3 className="text-lg font-bold text-stone-900 mb-2">{title}</h3>
        <div className="text-sm text-stone-600 mb-6 leading-relaxed">
          {message}
        </div>
        <div className="flex items-center gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-1/2"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={buttonVariants[variant]}
            className="w-1/2"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
