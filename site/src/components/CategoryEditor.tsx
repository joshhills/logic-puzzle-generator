import React from 'react';
import { CategoryType } from '../../../src/index';
import { AppCategoryConfig, CategoryLabels } from '../types';
import { Clue, ClueType, BinaryOperator, OrdinalOperator, SuperlativeOperator, UnaryFilter } from '../../../src/index';
import { renderPlainLanguageClue } from '../utils/clueRenderer';

interface CategoryEditorProps {
    originalCategories: AppCategoryConfig[];
    draftCategories: AppCategoryConfig[];
    onDraftUpdate: (newDraft: AppCategoryConfig[]) => void;
    onSave?: () => void;
    onCancel?: () => void;
    hideFooter?: boolean;
}

export const CategoryEditor: React.FC<CategoryEditorProps> = ({ originalCategories, draftCategories, onDraftUpdate, onSave, onCancel, hideFooter }) => {
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

        // Reset Display Type if switching away from Ordinal
        if (newType !== CategoryType.ORDINAL) {
            newCats[idx] = { ...cat, type: newType, displayType: undefined };
        } else {
            newCats[idx] = { ...cat, type: newType };
        }

        onDraftUpdate(newCats);
    };



    const handleLabelChange = (idx: number, field: keyof CategoryLabels, newVal: string | boolean) => {
        const newCats = [...draftCategories];
        newCats[idx] = { ...newCats[idx], labels: { ...newCats[idx].labels, [field]: newVal } };
        onDraftUpdate(newCats);
    };

    const handleValueChange = (catIdx: number, valIdx: number, rawValue: string) => {
        const newCats = [...draftCategories];
        const cat = newCats[catIdx];
        const newValues = [...cat.values];

        if (cat.displayType === 'date') {
            // Input is YYYY-MM-DD
            if (!rawValue) {
                // Empty date input
                newValues[valIdx] = ''; // Will fail numeric check
            } else {
                const date = new Date(rawValue);
                if (!isNaN(date.getTime())) {
                    newValues[valIdx] = date.getTime();
                } else {
                    newValues[valIdx] = '';
                }
            }
        } else {
            newValues[valIdx] = rawValue;
        }

        newCats[catIdx] = { ...cat, values: newValues };
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

    const handleDisplayTypeChange = (catIdx: number, newType: 'text' | 'date') => {
        const newCats = [...draftCategories];
        const cat = newCats[catIdx];
        const newValues = [...cat.values];

        if (newType === 'date') {
            // Smart Conversion: If switching to date, and values are small numbers (IDs),
            // replace them with a default sequence to avoid "1970" duplicates.
            const isSmallNumbers = newValues.every(v => !isNaN(Number(v)) && Number(v) < 100000);

            if (isSmallNumbers) {
                // Initialize with distinct dates starting from Jan 1, 2025
                // using increments of 1 day to ensure uniqueness.
                const baseDate = new Date('2025-01-01T00:00:00Z').getTime();
                const oneDay = 86400000;
                newValues.forEach((_, i) => {
                    newValues[i] = baseDate + (i * oneDay); // Numbers (Timestamps)
                });
            }
        }

        newCats[catIdx] = { ...cat, displayType: newType, values: newValues };
        onDraftUpdate(newCats);
    };

    // Helper to format value for input display
    const getInputValue = (val: string | number, displayType?: 'text' | 'date') => {
        if (displayType === 'date') {
            const num = Number(val);
            if (!isNaN(num) && num > 0) {
                return new Date(num).toISOString().split('T')[0];
            }
            return '';
        }
        return val;
    };

    // Limits
    const MIN_CATS = 2;
    const MAX_CATS = 5;
    const MIN_ITEMS = 3;
    const MAX_ITEMS = 10;

    // State for hover effect on global delete
    const [hoveredDeleteIndex, setHoveredDeleteIndex] = React.useState<number | null>(null);

    // DnD State
    const [draggedItem, setDraggedItem] = React.useState<{ type: 'CAT' | 'VAL', catIdx: number, valIdx?: number } | null>(null);

    // Constants for visual alignment
    const BUTTON_WIDTH = '24px';
    const HANDLE_WIDTH = '24px';
    const GAP = '8px';

    // DND Handlers
    const handleDragStart = (e: React.DragEvent, type: 'CAT' | 'VAL', catIdx: number, valIdx?: number) => {
        e.stopPropagation(); // Critical: Prevent bubbling so child drag doesn't trigger parent drag

        // Prevent drag if touching inputs or buttons
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'BUTTON') {
            e.preventDefault();
            return;
        }

        e.dataTransfer.setData('text/plain', ''); // Required for Firefox
        e.dataTransfer.effectAllowed = 'move';
        setDraggedItem({ type, catIdx, valIdx });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetType: 'CAT' | 'VAL', targetCatIdx: number, targetValIdx?: number) => {
        e.preventDefault();
        e.stopPropagation(); // Critical: Prevent bubbling
        if (!draggedItem) return;

        // 1. Category Reorder
        if (draggedItem.type === 'CAT' && targetType === 'CAT') {
            if (draggedItem.catIdx === targetCatIdx) return;
            const newCats = [...draftCategories];
            const [moved] = newCats.splice(draggedItem.catIdx, 1);
            newCats.splice(targetCatIdx, 0, moved);
            onDraftUpdate(newCats);
            setDraggedItem(null);
        }

        // 2. Value Reorder (Local)
        if (draggedItem.type === 'VAL' && targetType === 'VAL') {
            if (draggedItem.catIdx !== targetCatIdx) return; // Only same category
            if (typeof draggedItem.valIdx !== 'number' || typeof targetValIdx !== 'number') return;
            if (draggedItem.valIdx === targetValIdx) return;

            const newCats = [...draftCategories];
            const cat = newCats[targetCatIdx];
            const newValues = [...cat.values];

            const [moved] = newValues.splice(draggedItem.valIdx, 1);
            newValues.splice(targetValIdx, 0, moved);

            newCats[targetCatIdx] = { ...cat, values: newValues };
            onDraftUpdate(newCats);
            setDraggedItem(null);
        }
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    // --- Actions ---

    // 2. Add Category
    const handleAddCategory = () => {
        if (draftCategories.length >= MAX_CATS) return;
        const newCats = [...draftCategories];
        const nItems = newCats[0]?.values.length || 4;

        // Smart Defaults (Cluedo-esque)
        const defaults = [
            { id: 'Suspect', values: ['Mustard', 'Plum', 'Green', 'Peacock', 'Scarlett', 'White', 'Rose', 'Peach', 'Brunette', 'Grey'], labels: { groupName: 'suspect', verb: 'is', includeGroupName: true, valuePrefix: '' } as CategoryLabels },
            { id: 'Weapon', values: ['Dagger', 'Candlestick', 'Revolver', 'Rope', 'Pipe', 'Wrench', 'Poison', 'Horseshoe', 'Axe', 'Bat'], labels: { groupName: 'weapon', verb: 'has', includeGroupName: false, valuePrefix: 'the', subjectPrefix: 'the person with the' } as CategoryLabels },
            { id: 'Room', values: ['Hall', 'Lounge', 'Dining', 'Kitchen', 'Ballroom', 'Study', 'Library', 'Billiard', 'Conservatory', 'Cellar'], labels: { groupName: 'room', verb: 'is in', includeGroupName: false, valuePrefix: 'the', verbNegated: 'is not in', subjectPrefix: 'the person in the' } as CategoryLabels },
            { id: 'Gold', values: ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100'], type: CategoryType.ORDINAL, labels: { groupName: 'gold', verb: 'has', includeGroupName: false, valuePrefix: '', ordinalBefore: 'fewer', ordinalAfter: 'more', subjectPrefix: 'the person with', valueSuffix: 'gold' } as CategoryLabels },
            { id: 'Motive', values: ['Revenge', 'Greed', 'Jealousy', 'Power', 'Fear', 'Rage', 'Love', 'Blackmail', 'Accident', 'Madness'], labels: { groupName: 'motive', verb: 'is', includeGroupName: false, valuePrefix: '', isPossessive: true, subjectPrefix: 'the person whose motive is' } as CategoryLabels }
        ];

        // Try to find a default that isn't already used (by ID)
        // Or just based on index... index is easier but if user deleted #2 and adds new, they get #3?
        // Let's rely on index for simplicity, or find first unused default?
        // Finding first unused default is better UX.

        const existingIds = new Set(newCats.map(c => c.id));
        const smartDefault = defaults.find(d => !existingIds.has(d.id));

        let newCatConfig: AppCategoryConfig;

        if (smartDefault) {
            // Trim values to current nItems
            const defValues = smartDefault.values.slice(0, nItems);
            // If we need more than default has, pad with Item X
            while (defValues.length < nItems) {
                defValues.push(`Item ${defValues.length + 1}`);
            }

            newCatConfig = {
                id: smartDefault.id,
                values: defValues,
                type: smartDefault.type || CategoryType.NOMINAL,
                labels: { ...smartDefault.labels }
            };
        } else {
            // Generic Fallback
            const newValues = Array(nItems).fill('').map((_, i) => `Item ${i + 1}`);
            const newId = `Category ${newCats.length + 1}`;
            newCatConfig = {
                id: newId,
                type: CategoryType.NOMINAL,
                values: newValues,
                labels: { groupName: newId.toLowerCase(), verb: 'is', includeGroupName: true, valuePrefix: '' }
            };
        }

        newCats.push(newCatConfig);
        onDraftUpdate(newCats);
    };

    // 2. Remove Category
    const handleRemoveCategory = (idx: number) => {
        if (draftCategories.length <= MIN_CATS) return; // Prevent ensuring invalid state
        const newCats = draftCategories.filter((_, i) => i !== idx);
        onDraftUpdate(newCats);
    };

    // 3. Add Item (Global) with Smart Defaults
    const handleAddGlobalItem = () => {
        const currentCount = draftCategories[0]?.values.length || 0;
        if (currentCount >= MAX_ITEMS) return;

        const newCats = draftCategories.map(cat => {
            let newValue: string | number = `Item ${cat.values.length + 1}`;

            if (cat.type === CategoryType.ORDINAL) {
                // Try to deduce next value
                const nums = cat.values.map(v => Number(v)).filter(n => !isNaN(n));
                if (nums.length > 0) {
                    // Simple heuristic: arithmetic progression or just max + step?
                    // Let's just find the max and add the difference of the last two, or default 10.
                    const max = Math.max(...nums);
                    const last = Number(cat.values[cat.values.length - 1]);
                    const secondLast = Number(cat.values[cat.values.length - 2]);

                    let step = 1;
                    if (!isNaN(last) && !isNaN(secondLast)) {
                        step = last - secondLast;
                    } else if (!isNaN(last) && last >= 10) {
                        step = 10; // Default step 10 for 10,20,30
                    }

                    if (cat.displayType === 'date') {
                        // Date Logic
                        // If previous was a date, add 1 day (86400000ms)
                        const lastDate = new Date(last);
                        if (!isNaN(lastDate.getTime())) {
                            newValue = last + 86400000;
                        } else {
                            // Fallback to today
                            newValue = new Date().getTime();
                        }
                    } else {
                        // Number Logic
                        newValue = last + (step > 0 ? step : 1);
                    }
                } else if (cat.displayType === 'date') {
                    // No valid dates yet, start with today
                    newValue = new Date().setHours(0, 0, 0, 0);
                } else {
                    // No valid numbers yet, start with 10
                    newValue = 10;
                }
            }

            return {
                ...cat,
                values: [...cat.values, newValue]
            };
        });

        onDraftUpdate(newCats);
    };

    // 4. Remove Item (Global) - Removes index `idx` from ALL categories
    const handleRemoveGlobalItem = (itemIdx: number) => {
        const currentCount = draftCategories[0]?.values.length || 0;
        if (currentCount <= MIN_ITEMS) return;

        const newCats = draftCategories.map(cat => ({
            ...cat,
            values: cat.values.filter((_, i) => i !== itemIdx)
        }));
        onDraftUpdate(newCats);
    };

    return (
        <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleAddGlobalItem}
                        disabled={draftCategories[0]?.values.length >= MAX_ITEMS}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            background: draftCategories[0]?.values.length >= MAX_ITEMS ? '#555' : '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            cursor: draftCategories[0]?.values.length >= MAX_ITEMS ? 'not-allowed' : 'pointer',
                            fontSize: '0.8em'
                        }}
                    >
                        + Add Value
                    </button>
                    <button
                        onClick={handleAddCategory}
                        disabled={draftCategories.length >= MAX_CATS}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            background: draftCategories.length >= MAX_CATS ? '#555' : '#10b981',
                            color: '#fff',
                            border: 'none',
                            cursor: draftCategories.length >= MAX_CATS ? 'not-allowed' : 'pointer',
                            fontSize: '0.8em'
                        }}
                    >
                        + Add Category
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                {draftCategories.map((cat, i) => {
                    const isOrdinal = cat.type === CategoryType.ORDINAL;
                    const isDate = cat.displayType === 'date';

                    const idTrimmed = cat.id.trim();
                    const isDuplicate = idTrimmed.length > 0 && nameCounts[idTrimmed] > 1;
                    const isEmptyName = idTrimmed.length === 0;
                    const hasNonNumeric = isOrdinal && cat.values.some(v => isNaN(Number(v))); // Dates are numbers (timestamps) so this check passes if valid

                    if (isDuplicate || isEmptyName || hasNonNumeric) hasAnyError = true;
                    const nameKey = `name-${i}`;

                    const canDeleteItems = cat.values.length > MIN_ITEMS;
                    const isDraggingCategory = draggedItem?.type === 'CAT' && draggedItem.catIdx === i;

                    return (
                        <div
                            key={i}
                            draggable
                            onDragStart={(e) => handleDragStart(e, 'CAT', i)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, 'CAT', i)}
                            onDragEnd={handleDragEnd}
                            style={{
                                border: '1px solid #444',
                                borderRadius: '8px',
                                padding: '15px',
                                backgroundColor: isDraggingCategory ? '#2a2a2a80' : '#2a2a2a',
                                position: 'relative',
                                opacity: isDraggingCategory ? 0.3 : 1,
                                transition: 'opacity 0.2s'
                            }}
                        >
                            {/* Remove Category Button */}
                            {draftCategories.length > MIN_CATS && (
                                <button
                                    onClick={() => handleRemoveCategory(i)}
                                    title="Remove Category"
                                    style={{
                                        position: 'absolute',
                                        top: '10px',
                                        right: '10px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#666',
                                        cursor: 'pointer',
                                        fontSize: '1.2em',
                                        lineHeight: 1,
                                        zIndex: 10
                                    }}
                                >
                                    &times;
                                </button>
                            )}

                            {/* Category Name Input */}
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginLeft: `calc(${HANDLE_WIDTH} + ${GAP})` }}>
                                    <label style={{ display: 'block', fontSize: '0.75em', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>Category Name</label>
                                </div>
                                <div style={{ display: 'flex', gap: GAP, alignItems: 'center' }}>
                                    {/* Category Drag Handle Slot */}
                                    <div
                                        style={{
                                            width: HANDLE_WIDTH,
                                            flexShrink: 0,
                                            display: 'flex',
                                            justifyContent: 'center',
                                            cursor: 'grab',
                                            color: '#555',
                                            fontSize: '1.2em'
                                        }}
                                        title="Drag to reorder category"
                                    >
                                        ⋮⋮
                                    </div>

                                    <div style={{ position: 'relative', flex: 1 }}>
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
                                    {/* Alignment Spacer */}
                                    {canDeleteItems && <div style={{ width: BUTTON_WIDTH, flexShrink: 0 }}></div>}
                                </div>
                                {isEmptyName && <div style={{ color: '#ef4444', fontSize: '0.7em', marginTop: '2px', marginLeft: `calc(${HANDLE_WIDTH} + ${GAP})` }}>Required</div>}
                                {isDuplicate && <div style={{ color: '#ef4444', fontSize: '0.7em', marginTop: '2px', marginLeft: `calc(${HANDLE_WIDTH} + ${GAP})` }}>Duplicate Name</div>}
                            </div>

                            {/* Type and Format */}
                            <div style={{ marginBottom: '12px', display: 'flex', gap: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.75em', color: '#888', marginBottom: '4px', textTransform: 'uppercase', marginLeft: `calc(${HANDLE_WIDTH} + ${GAP})` }}>Type</label>
                                    <div style={{ display: 'flex', gap: GAP }}>
                                        {/* Spacer for Handle Column */}
                                        <div style={{ width: HANDLE_WIDTH, flexShrink: 0 }}></div>

                                        <select
                                            value={cat.type}
                                            onChange={(e) => handleTypeChange(i, Number(e.target.value))}
                                            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                        >
                                            <option value={CategoryType.NOMINAL}>Nominal</option>
                                            <option value={CategoryType.ORDINAL}>Ordinal</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Values List */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', marginLeft: `calc(${HANDLE_WIDTH} + ${GAP})` }}>
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

                                        // Duplicate Check
                                        // We check if this value appears elsewhere in the same category
                                        const isDuplicateValue = cat.values.some((otherVal, otherIdx) => otherIdx !== vIdx && String(otherVal).trim() === String(val).trim());

                                        if (isEmptyValue || isDuplicateValue) hasAnyError = true;

                                        const isInvalidOrdinal = isOrdinal && isNaN(Number(val));
                                        const valKey = `val-${i}-${vIdx}`;
                                        const displayVal = getInputValue(val, cat.displayType);
                                        const isHoveredForDelete = hoveredDeleteIndex === vIdx;
                                        const isDraggingValue = draggedItem?.type === 'VAL' && draggedItem.catIdx === i && draggedItem.valIdx === vIdx;

                                        return (
                                            <div
                                                key={vIdx}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, 'VAL', i, vIdx)}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, 'VAL', i, vIdx)}
                                                onDragEnd={handleDragEnd}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: GAP,
                                                    opacity: isDraggingValue ? 0.3 : 1
                                                }}
                                            >
                                                {/* Value Drag Handle */}
                                                <div
                                                    style={{
                                                        width: HANDLE_WIDTH,
                                                        flexShrink: 0,
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        cursor: 'grab',
                                                        color: '#555',
                                                        fontSize: '1.2em'
                                                    }}
                                                    title="Drag to reorder value"
                                                >
                                                    ⋮⋮
                                                </div>

                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <input
                                                        type={isDate ? "date" : "text"}
                                                        value={displayVal}
                                                        maxLength={18}
                                                        onChange={(e) => handleValueChange(i, vIdx, e.target.value)}
                                                        onKeyDown={(e) => !isDate && handleInputKeyDown(e, String(displayVal).length, 18, valKey)}
                                                        placeholder={`Item ${vIdx + 1}`}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px',
                                                            paddingRight: isDate ? '8px' : '45px',
                                                            borderRadius: '4px',
                                                            border: isHoveredForDelete ? '1px solid #ef4444' : (isInvalidOrdinal || isEmptyValue || isDuplicateValue) ? '1px solid #ef4444' : '1px solid #555',
                                                            backgroundColor: isHoveredForDelete ? '#450a0a' : '#222', // Brighter red bg for visibility
                                                            color: '#fff',
                                                            boxSizing: 'border-box',
                                                            fontFamily: isDate ? 'monospace' : 'inherit',
                                                            transition: 'all 0.15s ease-in-out'
                                                        }}
                                                    />
                                                    {!isDate && <span style={{
                                                        position: 'absolute',
                                                        right: '8px',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        fontSize: '0.7em',
                                                        color: flashingInput === valKey ? '#ef4444' : '#666',
                                                        transition: 'color 0.1s',
                                                        pointerEvents: 'none'
                                                    }}>
                                                        {String(val)?.length}/18
                                                    </span>}
                                                    {isEmptyValue && <div style={{ color: '#ef4444', fontSize: '0.7em', marginTop: '2px', marginLeft: '2px' }}>Required</div>}
                                                    {isDuplicateValue && !isEmptyValue && <div style={{ color: '#ef4444', fontSize: '0.7em', marginTop: '2px', marginLeft: '2px' }}>Duplicate Value</div>}
                                                </div>

                                                {canDeleteItems && (
                                                    <button
                                                        onClick={() => handleRemoveGlobalItem(vIdx)}
                                                        title="Remove Value Row (from all categories)"
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#666',
                                                            cursor: 'pointer',
                                                            fontSize: '1.2em',
                                                            padding: '0 4px',
                                                            lineHeight: 1,
                                                            width: BUTTON_WIDTH,
                                                            textAlign: 'center'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.color = '#ef4444';
                                                            setHoveredDeleteIndex(vIdx);
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.color = '#666';
                                                            setHoveredDeleteIndex(null);
                                                        }}
                                                    >
                                                        &times;
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                {hasNonNumeric && (
                                    <div style={{ color: '#ef4444', fontSize: '0.8em', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span>⚠️</span> {isDate ? 'Invalid Date' : 'Ordinal values must be numbers.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {!hideFooter && (
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
            )}
        </div>
    );
};
