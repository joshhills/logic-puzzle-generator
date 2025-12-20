import React from 'react';

interface SidebarProps {
    currentStep: number;
    steps: string[];
    onStepSelect: (index: number) => void;
    maxReachableStep?: number;
    onReset?: () => void;
    canReset?: boolean;
    onExport?: () => void;
    onImport?: () => void;
    onSave?: () => void;
    onManageSaves?: () => void;
    onInfo?: () => void;
    isDirty?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentStep, steps, onStepSelect, maxReachableStep = 99, onReset, canReset = true, onExport, onImport, onSave, onManageSaves, onInfo, isDirty = true }) => {
    return (
        <div className="sidebar">
            <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="./logic-puzzle-generator-logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '4px' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0, lineHeight: '1.2' }}>Logic Puzzle<br />Generator</h2>
            </div>

            {/* Steps Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {steps.map((step, index) => {
                    const isActive = index === currentStep;
                    const isFuture = index > currentStep;
                    const isReachable = index <= maxReachableStep;

                    return (
                        <div
                            key={index}
                            onClick={() => {
                                if (isReachable) onStepSelect(index);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px 15px',
                                borderRadius: '8px',
                                backgroundColor: isActive ? '#3b82f6' : 'transparent',
                                color: isActive ? '#fff' : (isReachable ? '#aaa' : '#444'),
                                cursor: isReachable ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s',
                                fontWeight: isActive ? 'bold' : 'normal',
                                opacity: isReachable ? 1 : 0.5
                            }}
                        >
                            <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: isActive ? '#fff' : (isReachable ? '#2ecc71' : '#333'), // Green if complete/reachable, Dark if not
                                color: isActive ? '#3b82f6' : (isReachable ? '#000' : '#888'),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: '12px',
                                fontSize: '0.8em',
                                fontWeight: 'bold'
                            }}>
                                {index < currentStep ? '✓' : (index + 1)}
                            </div>
                            {step}
                        </div>
                    );
                })}
            </div>

            {/* Actions Footer */}
            <div style={{ marginBottom: '20px', padding: '0 5px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(onExport || onImport) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {onSave && <button
                                onClick={onSave}
                                disabled={!isDirty}
                                title={isDirty ? "Quick Save to Browser" : "No changes to save"}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: isDirty ? '#10b981' : '#1f4c3a',
                                    border: 'none',
                                    color: isDirty ? '#fff' : '#666',
                                    borderRadius: '6px',
                                    cursor: isDirty ? 'pointer' : 'default',
                                    fontSize: '0.9em',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s',
                                    opacity: isDirty ? 1 : 0.7
                                }}
                            >
                                💾 Save
                            </button>}
                            {onManageSaves && <button
                                onClick={onManageSaves}
                                title="Manage Saved Games"
                                style={{ flex: 1, padding: '10px', background: '#333', border: '1px solid #555', color: '#eee', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em' }}
                            >
                                📂 Load
                            </button>}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {onImport && <button
                                onClick={onImport}
                                title="Import JSON File"
                                style={{ flex: 1, padding: '8px', background: '#222', border: '1px solid #444', color: '#ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85em' }}
                            >
                                Import
                            </button>}
                            {onExport && <button
                                onClick={onExport}
                                title="Export JSON File"
                                style={{ flex: 1, padding: '8px', background: '#222', border: '1px solid #444', color: '#ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85em' }}
                            >
                                Export
                            </button>}
                        </div>
                    </div>
                )}

                {onReset && (
                    <button
                        onClick={onReset}
                        disabled={!canReset}
                        style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: 'transparent',
                            border: `1px solid ${canReset ? '#555' : '#333'}`,
                            color: canReset ? '#aaa' : '#444',
                            borderRadius: '6px',
                            cursor: canReset ? 'pointer' : 'not-allowed',
                            fontSize: '0.9em',
                            transition: 'all 0.2s',
                            opacity: canReset ? 1 : 0.5
                        }}
                        onMouseEnter={(e) => {
                            if (canReset) {
                                e.currentTarget.style.borderColor = '#ef4444';
                                e.currentTarget.style.color = '#ef4444';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (canReset) {
                                e.currentTarget.style.borderColor = '#555';
                                e.currentTarget.style.color = '#aaa';
                            }
                        }}
                    >
                        ↺ Reset Puzzle
                    </button>
                )}
            </div>

            <div style={{ padding: '0 5px' }}>
                <a
                    href="https://ko-fi.com/I2I51WSPZ"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'block',
                        width: '100%',
                        marginTop: '10px',
                        marginBottom: '20px',
                        transition: 'opacity 0.2s',
                        textDecoration: 'none'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <img
                        src="./support_me_on_kofi_blue.webp"
                        alt="Support me on Ko-fi"
                        style={{ width: '100%', height: '44px', objectFit: 'contain', display: 'block', border: '0px' }}
                    />
                </a>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #333', fontSize: '0.85em', color: '#666' }}>
                <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        Built by <a href="https://joshhills.dev" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>Josh Hills</a>
                    </div>
                    {onInfo && (
                        <button
                            onClick={onInfo}
                            title="About Logic Puzzle Generator"
                            style={{
                                background: 'transparent',
                                border: '1px solid #444',
                                borderRadius: '50%',
                                color: '#888',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}
                        >
                            ?
                        </button>
                    )}
                </div>
                <div>
                    <a href="https://github.com/joshhills/logic-puzzle-generator" target="_blank" rel="noopener noreferrer" style={{ color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                        </svg>
                        Source Code (v0.2.2)
                    </a>
                </div>
            </div>
        </div>
    );
};
