import React from 'react';

export interface SavedPuzzle {
    id: string; // timestamp
    title: string;
    date: number;
    preview: string; // Short description e.g. "3x4 Grid"
    data: any; // The full JSON state
}

interface SavedGamesModalProps {
    isOpen: boolean;
    onClose: () => void;
    saves: SavedPuzzle[];
    onLoad: (save: SavedPuzzle) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newTitle: string) => void;
}

export const SavedGamesModal: React.FC<SavedGamesModalProps> = ({ isOpen, onClose, saves, onLoad, onDelete, onRename }) => {
    const [isRenaming, setIsRenaming] = React.useState<string | null>(null);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2a2a35',
                padding: '25px',
                borderRadius: '12px',
                width: '500px',
                maxWidth: '90%',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                border: '1px solid #444',
                color: '#fff'
            }} onClick={e => e.stopPropagation()}>
                <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.5rem', borderBottom: '1px solid #444', paddingBottom: '10px' }}>Saved Puzzles</h2>

                {saves.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
                        No saved puzzles found.
                    </div>
                ) : (
                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {saves.map(save => (
                            <div key={save.id} style={{
                                backgroundColor: '#1e1e2e',
                                padding: '15px',
                                borderRadius: '8px',
                                border: '1px solid #333',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    {isRenaming === save.id ? (
                                        <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }} onClick={e => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                defaultValue={save.title}
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        onRename(save.id, e.currentTarget.value);
                                                        setIsRenaming(null);
                                                    } else if (e.key === 'Escape') {
                                                        setIsRenaming(null);
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    onRename(save.id, e.currentTarget.value);
                                                    setIsRenaming(null);
                                                }}
                                                style={{
                                                    background: '#111',
                                                    border: '1px solid #555',
                                                    color: '#fff',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px'
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {save.title || 'Untitled Puzzle'}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                                        {new Date(save.date).toLocaleDateString()} • {save.preview}
                                    </div>
                                    <div style={{ fontSize: '0.8em', color: '#666', marginTop: '2px', fontFamily: 'monospace' }}>
                                        Seed: {save.data.config.seedInput || '(Random)'} • Clues: {save.data.puzzle ? save.data.puzzle.clues.length : '?'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => onLoad(save)}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Load
                                    </button>
                                    <button
                                        onClick={() => setIsRenaming(save.id)}
                                        style={{
                                            padding: '8px',
                                            backgroundColor: 'transparent',
                                            color: '#aaa',
                                            border: '1px solid #444',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                        title="Rename"
                                    >
                                        ✎
                                    </button>
                                    <button
                                        onClick={() => onDelete(save.id)}
                                        style={{
                                            padding: '8px',
                                            backgroundColor: 'transparent',
                                            color: '#ef4444',
                                            border: '1px solid #ef4444',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                        title="Delete"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
