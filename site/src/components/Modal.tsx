
import React from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message: string;
    type?: 'confirm' | 'alert'; // Default confirm
    confirmText?: string;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'confirm',
    confirmText = 'Confirm'
}) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000 // Higher than other modals
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2a2a35',
                padding: '25px',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '400px',
                border: '1px solid #444',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                color: '#fff'
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2em' }}>{title}</h3>
                <p style={{ margin: '0 0 25px 0', color: '#ccc', lineHeight: '1.5' }}>{message}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    {type === 'confirm' && (
                        <button
                            onClick={onClose}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: 'transparent',
                                color: '#ccc',
                                border: '1px solid #555',
                                borderRadius: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: type === 'confirm' ? '#ef4444' : '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {type === 'confirm' ? confirmText : 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
};
