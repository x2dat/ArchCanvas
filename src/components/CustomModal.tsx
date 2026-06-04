import React from 'react';
import { AlertCircle, HelpCircle, X } from 'lucide-react';

interface CustomModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm' | 'danger';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  title,
  message,
  type,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const Icon = isDanger ? AlertCircle : (type === 'confirm' ? HelpCircle : AlertCircle);

  return (
    <div className="modal-overlay-backdrop animate-fade-in" style={{ zIndex: 9999 }}>
      <div 
        className="modal-content-panel glass-plate animate-modal-pop"
        style={{
          borderTop: isDanger ? '4px solid var(--accent-red)' : '4px solid var(--accent-purple)',
          boxShadow: isDanger ? '0 10px 30px rgba(239, 68, 68, 0.15)' : '0 10px 30px rgba(139, 92, 246, 0.15)',
          maxWidth: '400px'
        }}
      >
        <div className="modal-header" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon 
              size={18} 
              style={{ color: isDanger ? 'var(--accent-red)' : 'var(--accent-purple)' }} 
            />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
          </div>
          <button 
            type="button" 
            className="close-modal-btn" 
            onClick={onCancel}
            title="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        <div className="modal-body" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '24px' }}>
          {message}
        </div>

        <div className="modal-actions-footer">
          {(type === 'confirm' || type === 'danger') && (
            <button 
              type="button" 
              className="secondary-btn" 
              onClick={onCancel}
              style={{ borderRadius: '16px', height: '32px', padding: '0 16px' }}
            >
              {cancelText}
            </button>
          )}
          <button 
            type="button" 
            className="confirm-btn" 
            onClick={onConfirm}
            style={{ 
              borderRadius: '16px', 
              height: '32px', 
              padding: '0 16px',
              background: isDanger ? 'var(--accent-red)' : 'var(--accent-purple)'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
