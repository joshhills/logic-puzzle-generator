import React from 'react';
import { CategoryConfig, CategoryType } from '../../../src/index';

interface CategoryEditorProps {
    originalCategories: CategoryConfig[];
    draftCategories: CategoryConfig[];
    onDraftUpdate: (newDraft: CategoryConfig[]) => void;
    onSave: () => void;
    onCancel: () => void;
}

export const CategoryEditor: React.FC<CategoryEditorProps> = ({ originalCategories, draftCategories, onDraftUpdate, onSave, onCancel }) => {
    // No internal state synchronization needed for cats

    const [flashingInput, setFlashingInput] = React.useState<string | null>(null);

    const triggerFlash = (key: string) => {
        setFlashingInput(key);
        setTimeout(() => setFlashingInput(null), 150);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentLength: number, maxLength: number, key: string) => {
        // Allow navigation/deletion keys
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        if (currentLength >= maxLength) {
            triggerFlash(key);
        }
    };

    // Validation Logic
    const nameCounts = draftCategories.reduce((acc, cat) => {
        const id = cat.id.trim();
        if (id) acc[id] = (acc[id] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    let hasAnyError = false;

    // Deep equality check for Dirty State
    const isDirty = JSON.stringify(originalCategories) !== JSON.stringify(draftCategories);

    const handleNameChange = (idx: number, newName: string) => {
        const newCats = [...draftCategories];
        newCats[idx] = { ...newCats[idx], id: newName };
        onDraftUpdate(newCats);
    };

    const handleTypeChange = (idx: number, newType: CategoryType) => {
        const newCats = [...draftCategories];
        const cat = newCats[idx];

        // Smart Convert: If switching to ORDINAL and values look like defaults (e.g. "Role-1", "Role-2"), 
        // convert them to valid numbers ("1", "2") to avoid immediate validation errors.
        if (newType === CategoryType.ORDINAL) {
            const allMatchDefaultPattern = cat.values.every((val, vIdx) => {
                // Check for "Something-Index" pattern
                const match = String(val).match(/.+-(\d+)$/);
                return match && parseInt(match[1]) === (vIdx + 1);
            });

            if (allMatchDefaultPattern) {
                const newValues = cat.values.map((_, i) => String(i + 1));
                newCats[idx] = { ...cat, type: newType, values: newValues };
                onDraftUpdate(newCats);
                return;
            }
        }

        newCats[idx] = { ...newCats[idx], type: newType };
        onDraftUpdate(newCats);
    };

    const handleValueChange = (catIdx: number, valIdx: number, newValue: string) => {
        const newCats = [...draftCategories];
        const newValues = [...newCats[catIdx].values];
        newValues[valIdx] = newValue;
        newCats[catIdx] = { ...newCats[catIdx], values: newValues };
        onDraftUpdate(newCats);
    };

    const handleSort = (idx: number) => {
        const newCats = [...draftCategories];
        const values = [...newCats[idx].values];

        // Try numeric sort first
        const allNumeric = values.every(v => !isNaN(Number(v)) && String(v).trim() !== '');
        if (allNumeric) {
            values.sort((a, b) => Number(a) - Number(b));
        } else {
            // Lexicographical sort
            values.sort((a, b) => String(a).localeCompare(String(b)));
        }

        newCats[idx] = { ...newCats[idx], values };
        onDraftUpdate(newCats);
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#333', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                <h4 style={{ margin: 0, color: '#fff' }}>Edit Categories</h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                {draftCategories.map((cat, i) => {
                    const isOrdinal = cat.type === CategoryType.ORDINAL;
                    const idTrimmed = cat.id.trim();
                    const isDuplicate = idTrimmed.length > 0 && nameCounts[idTrimmed] > 1;
                    const isEmptyName = idTrimmed.length === 0;
                    const hasNonNumeric = isOrdinal && cat.values.some(v => isNaN(Number(v)));

                    if (isDuplicate || isEmptyName || hasNonNumeric) hasAnyError = true;
                    const nameKey = `name-${i}`;

                    return (
                        <div key={i} style={{ border: '1px solid #444', borderRadius: '8px', padding: '15px', backgroundColor: '#2a2a2a' }}>
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <label style={{ display: 'block', fontSize: '0.75em', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Category Name</label>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        value={cat.id}
                                        maxLength={15}
                                        onChange={(e) => handleNameChange(i, e.target.value)}
                                        onKeyDown={(e) => handleInputKeyDown(e, cat.id.length, 15, nameKey)}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            paddingRight: '45px',
                                            borderRadius: '4px',
                                            border: (isDuplicate || isEmptyName) ? '1px solid #ef4444' : '1px solid #555',
                                            backgroundColor: '#222',
                                            color: '#fff',
                                            boxSizing: 'border-box',
                                            transition: 'border-color 0.1s'
                                        }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        fontSize: '0.7em',
                                        color: flashingInput === nameKey ? '#ef4444' : '#666',
                                        transition: 'color 0.1s',
                                        pointerEvents: 'none'
                                    }}>{cat.id.length}/15</span>
                                </div>
                                {isEmptyName && <div style={{ color: '#ef4444', fontSize: '0.7em', marginTop: '2px', marginLeft: '2px' }}>Required</div>}
                                {isDuplicate && <div style={{ color: '#ef4444', fontSize: '0.7em', marginTop: '2px', marginLeft: '2px' }}>Duplicate Name</div>}
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '0.75em', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Type</label>
                                <select
                                    value={cat.type}
                                    onChange={(e) => handleTypeChange(i, Number(e.target.value))}
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                >
                                    <option value={CategoryType.NOMINAL}>Nominal (Unordered)</option>
                                    <option value={CategoryType.ORDINAL}>Ordinal (Ordered)</option>
                                </select>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <label style={{ fontSize: '0.75em', color: '#888', textTransform: 'uppercase' }}>Values</label>
                                    <button
                                        onClick={() => handleSort(i)}
                                        title="Sort values naturally"
                                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.8em', padding: 0 }}
                                    >
                                        Sort
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {cat.values.map((val, vIdx) => {
                                        const isEmptyValue = String(val).trim().length === 0;
                                        if (isEmptyValue) hasAnyError = true;
                                        const isInvalidOrdinal = isOrdinal && isNaN(Number(val));
                                        const valKey = `val-${i}-${vIdx}`;

                                        return (
                                            <div key={vIdx} style={{ position: 'relative' }}>
                                                <input
                                                    type="text"
                                                    value={val}
                                                    maxLength={18}
                                                    onChange={(e) => handleValueChange(i, vIdx, e.target.value)}
                                                    onKeyDown={(e) => handleInputKeyDown(e, String(val).length, 18, valKey)}
                                                    placeholder={`Item ${vIdx + 1}`}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px',
                                                        paddingRight: '45px',
                                                        borderRadius: '4px',
                                                        border: (isInvalidOrdinal || isEmptyValue) ? '1px solid #ef4444' : '1px solid #555',
                                                        backgroundColor: '#222',
                                                        color: '#fff',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                                <span style={{
                                                    position: 'absolute',
                                                    right: '8px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    fontSize: '0.7em',
                                                    color: flashingInput === valKey ? '#ef4444' : '#666',
                                                    transition: 'color 0.1s',
                                                    pointerEvents: 'none'
                                                }}>
                                                    {String(val).length}/18
                                                </span>
                                                {isEmptyValue && <div style={{ color: '#ef4444', fontSize: '0.7em', marginTop: '2px', marginLeft: '2px' }}>Required</div>}
                                            </div>
                                        )
                                    })}
                                </div>
                                {hasNonNumeric && (
                                    <div style={{ color: '#ef4444', fontSize: '0.8em', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>⚠️</span> Ordinal values must be numbers.
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #444', paddingTop: '15px' }}>
                <button
                    onClick={onCancel}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '4px',
                        border: '1px solid #555',
                        background: 'transparent',
                        color: '#ddd',
                        cursor: 'pointer'
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    disabled={hasAnyError || !isDirty}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '4px',
                        border: 'none',
                        background: (hasAnyError || !isDirty) ? '#555' : '#3b82f6',
                        color: (hasAnyError || !isDirty) ? '#aaa' : 'white',
                        fontWeight: 'bold',
                        cursor: (hasAnyError || !isDirty) ? 'not-allowed' : 'pointer',
                        opacity: (hasAnyError || !isDirty) ? 0.7 : 1
                    }}
                >
                    Save Changes
                </button>
            </div>
        </div >
    );
};
