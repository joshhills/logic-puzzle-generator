
import React from 'react';
import { AppCategoryConfig, CategoryLabels } from '../types';
import { CategoryType, Clue, ClueType, BinaryOperator, OrdinalOperator, SuperlativeOperator, UnaryFilter, AdjacencyClue, BetweenClue, CrossOrdinalOperator, DisjunctionClue, ArithmeticClue } from '../../../src/index';
import { renderPlainLanguageClue } from '../utils/clueRenderer';

interface StoryEditorProps {
    categories: AppCategoryConfig[];
    onLabelChange: (catIdx: number, field: keyof CategoryLabels, newVal: string | boolean) => void;
}

export const StoryEditor: React.FC<StoryEditorProps> = ({ categories, onLabelChange }) => {
    const HANDLE_WIDTH = '24px';
    const GAP = '8px';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {categories.map((cat, i) => {
                    const isOrdinal = cat.type === CategoryType.ORDINAL;

                    return (
                        <div
                            key={i}
                            style={{
                                border: '1px solid #444',
                                borderRadius: '8px',
                                padding: '15px',
                                backgroundColor: '#2a2a2a',
                                position: 'relative'
                            }}
                        >
                            <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#fff', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
                                {cat.id} <span style={{ fontSize: '0.7em', color: '#666', fontWeight: 'normal', textTransform: 'uppercase' }}>({cat.type === CategoryType.ORDINAL ? 'Ordinal' : 'Nominal'})</span>
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 150px' }}>
                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#888', marginBottom: '4px' }}>Unit name (e.g. suspect)</label>
                                        <input
                                            type="text"
                                            value={cat.labels?.groupName || ''}
                                            placeholder={cat.id.toLowerCase()}
                                            onChange={(e) => onLabelChange(i, 'groupName', e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '0.85em', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 150px' }}>
                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#888', marginBottom: '4px' }}>Verb (e.g. is / has)</label>
                                        <input
                                            type="text"
                                            value={cat.labels?.verb || ''}
                                            placeholder="is"
                                            onChange={(e) => onLabelChange(i, 'verb', e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '0.85em', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                        />
                                    </div>

                                    <div style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={cat.labels?.includeGroupName ?? true}
                                            onChange={(e) => onLabelChange(i, 'includeGroupName', e.target.checked)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <label style={{ fontSize: '0.8em', color: '#ccc', cursor: 'pointer' }}>Include unit name in clues (e.g. "{cat.labels?.groupName || cat.id.toLowerCase()}")</label>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 150px' }}>
                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#888', marginBottom: '4px' }}>Value prefix (e.g. "the", "a")</label>
                                        <input
                                            type="text"
                                            value={cat.labels?.valuePrefix || ''}
                                            placeholder="e.g. the"
                                            onChange={(e) => onLabelChange(i, 'valuePrefix', e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '0.85em', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 150px' }}>
                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#888', marginBottom: '4px' }}>Value suffix (e.g. "gold")</label>
                                        <input
                                            type="text"
                                            value={cat.labels?.valueSuffix || ''}
                                            placeholder="e.g. gold"
                                            onChange={(e) => onLabelChange(i, 'valueSuffix', e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '0.85em', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 150px' }}>
                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#888', marginBottom: '4px' }}>Subject prefix (e.g. "the person with")</label>
                                        <input
                                            type="text"
                                            value={cat.labels?.subjectPrefix || ''}
                                            placeholder="e.g. the suspect with"
                                            onChange={(e) => onLabelChange(i, 'subjectPrefix', e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '0.85em', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 150px' }}>
                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#888', marginBottom: '4px' }}>Negated verb (optional)</label>
                                        <input
                                            type="text"
                                            value={cat.labels?.verbNegated || ''}
                                            placeholder="e.g. is not"
                                            onChange={(e) => onLabelChange(i, 'verbNegated', e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '0.85em', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                        />
                                    </div>

                                    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            id={`possessive - ${i} `}
                                            checked={cat.labels?.isPossessive ?? false}
                                            onChange={(e) => onLabelChange(i, 'isPossessive', e.target.checked)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <label htmlFor={`possessive - ${i} `} style={{ fontSize: '0.8em', color: '#ccc', cursor: 'pointer' }}>
                                            Is possessive
                                            <span style={{ color: '#888', marginLeft: '5px' }}>
                                                {(() => {
                                                    const otherCat = categories.find(c => c.id !== cat.id) || categories[0];
                                                    const subject = otherCat.values[0];
                                                    const unit = cat.labels?.groupName || cat.id.toLowerCase();
                                                    const v = cat.labels?.verb || 'is';
                                                    return `(e.g. "${subject}'s ${unit} ${v}")`;
                                                })()}
                                            </span>
                                        </label>
                                    </div>

                                    {isOrdinal && (
                                        <>
                                            <div style={{ gridColumn: 'span 2', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #444' }}>
                                                <label style={{ display: 'block', fontSize: '0.75em', color: '#aaa', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>Ordinal Comparisons</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#888', marginBottom: '4px' }}>Before (less than)</label>
                                                        <input
                                                            type="text"
                                                            value={cat.labels?.ordinalBefore || ''}
                                                            placeholder="before"
                                                            onChange={(e) => onLabelChange(i, 'ordinalBefore', e.target.value)}
                                                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '0.85em', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#888', marginBottom: '4px' }}>After (greater than)</label>
                                                        <input
                                                            type="text"
                                                            value={cat.labels?.ordinalAfter || ''}
                                                            placeholder="after"
                                                            onChange={(e) => onLabelChange(i, 'ordinalAfter', e.target.value)}
                                                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '0.85em', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#888', marginBottom: '4px' }}>Sup. First (min)</label>
                                                        <input
                                                            type="text"
                                                            value={cat.labels?.superlativeFirst || ''}
                                                            placeholder="first"
                                                            onChange={(e) => onLabelChange(i, 'superlativeFirst', e.target.value)}
                                                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '0.85em', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#888', marginBottom: '4px' }}>Sup. Last (max)</label>
                                                        <input
                                                            type="text"
                                                            value={cat.labels?.superlativeLast || ''}
                                                            placeholder="last"
                                                            onChange={(e) => onLabelChange(i, 'superlativeLast', e.target.value)}
                                                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '0.85em', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Per-Category Preview */}
                                    <div style={{ gridColumn: 'span 2', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #444' }}>
                                        <label style={{ display: 'block', fontSize: '0.7em', color: '#666', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>{cat.id} Appearance</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {(() => {
                                                const otherCat = categories.find(other => other.id !== cat.id) || categories[0];

                                                // As Subject
                                                const subClue: Clue = {
                                                    type: ClueType.BINARY,
                                                    operator: BinaryOperator.IS,
                                                    cat1: cat.id,
                                                    val1: cat.values[0],
                                                    cat2: otherCat.id,
                                                    val2: otherCat.values[1]
                                                };

                                                // As Object
                                                const objClue: Clue = {
                                                    type: ClueType.BINARY,
                                                    operator: BinaryOperator.IS,
                                                    cat1: otherCat.id,
                                                    val1: otherCat.values[0],
                                                    cat2: cat.id,
                                                    val2: cat.values[1]
                                                };

                                                return (
                                                    <>
                                                        <div style={{ fontSize: '0.85em', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', borderLeft: '3px solid #3b82f6' }}>
                                                            <span style={{ fontSize: '0.75em', color: '#555', marginRight: '8px' }}>AS SUBJECT:</span>
                                                            <span style={{ color: '#aaa' }}>{renderPlainLanguageClue(subClue, categories)}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.85em', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', borderLeft: '3px solid #10b981' }}>
                                                            <span style={{ fontSize: '0.75em', color: '#555', marginRight: '8px' }}>AS OBJECT:</span>
                                                            <span style={{ color: '#aaa' }}>{renderPlainLanguageClue(objClue, categories)}</span>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                            {isOrdinal && (() => {
                                                const otherCat = categories.find(other => other.id !== cat.id) || categories[0];
                                                // Ordinal Comparison (Less Than)
                                                const ordClue: Clue = {
                                                    type: ClueType.ORDINAL,
                                                    operator: OrdinalOperator.LESS_THAN,
                                                    item1Cat: otherCat.id,
                                                    item1Val: otherCat.values[0],
                                                    item2Cat: otherCat.id,
                                                    item2Val: otherCat.values[1],
                                                    ordinalCat: cat.id
                                                };

                                                // Superlative (Max)
                                                const supClue: Clue = {
                                                    type: ClueType.SUPERLATIVE,
                                                    operator: SuperlativeOperator.MAX,
                                                    targetCat: otherCat.id,
                                                    targetVal: otherCat.values[0],
                                                    ordinalCat: cat.id
                                                };

                                                return (
                                                    <>
                                                        <div style={{ fontSize: '0.85em', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', borderLeft: '3px solid #f59e0b' }}>
                                                            <span style={{ fontSize: '0.75em', color: '#555', marginRight: '8px' }}>COMPARISON:</span>
                                                            <span style={{ color: '#aaa' }}>{renderPlainLanguageClue(ordClue, categories)}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.85em', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', borderLeft: '3px solid #ef4444' }}>
                                                            <span style={{ fontSize: '0.75em', color: '#555', marginRight: '8px' }}>SUPERLATIVE:</span>
                                                            <span style={{ color: '#aaa' }}>{renderPlainLanguageClue(supClue, categories)}</span>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Live Clue Preview */}
            <div style={{ marginTop: '20px', padding: '20px', border: '1px dashed #555', borderRadius: '12px', backgroundColor: '#1a1a1a' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '0.9em', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Live Clue Preview</h4>
                <div style={{ fontSize: '1rem', color: '#ddd', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                        const previews = [];
                        const cats = categories;

                        // 1. A Binary Clue (IS)
                        if (cats.length >= 2) {
                            const c1 = cats[0];
                            const c2 = cats[1];
                            const fakeClue: Clue = {
                                type: ClueType.BINARY,
                                operator: BinaryOperator.IS,
                                cat1: c1.id,
                                val1: c1.values[0],
                                cat2: c2.id,
                                val2: c2.values[0]
                            };
                            previews.push({ type: 'Binary [IS]', content: renderPlainLanguageClue(fakeClue, cats) });
                        }

                        // 2. A Binary Clue (IS NOT)
                        if (cats.length >= 2) {
                            const c1 = cats[0];
                            const c2 = cats[1];
                            const fakeClue: Clue = {
                                type: ClueType.BINARY,
                                operator: BinaryOperator.IS_NOT,
                                cat1: c1.id,
                                val1: c1.values[0],
                                cat2: c2.id,
                                val2: c2.values[1]
                            };
                            previews.push({ type: 'Binary [IS NOT]', content: renderPlainLanguageClue(fakeClue, cats) });
                        }

                        // 3. An Ordinal Clue
                        const ordCat = cats.find(c => c.type === CategoryType.ORDINAL);
                        if (ordCat && cats.length >= 2) {
                            const otherCat = cats.find(c => c.id !== ordCat.id)!;
                            const fakeClue: Clue = {
                                type: ClueType.ORDINAL,
                                operator: OrdinalOperator.LESS_THAN,
                                item1Cat: otherCat.id,
                                item1Val: otherCat.values[0],
                                item2Cat: otherCat.id,
                                item2Val: otherCat.values[1],
                                ordinalCat: ordCat.id
                            };
                            previews.push({ type: 'Ordinal', content: renderPlainLanguageClue(fakeClue, cats) });
                        }

                        // 4. A Superlative Clue
                        if (ordCat) {
                            const otherCat = cats.find(c => c.id !== ordCat.id)!;
                            const fakeClue: Clue = {
                                type: ClueType.SUPERLATIVE,
                                operator: SuperlativeOperator.MIN,
                                targetCat: otherCat.id,
                                targetVal: otherCat.values[0],
                                ordinalCat: ordCat.id
                            };
                            previews.push({ type: 'Superlative', content: renderPlainLanguageClue(fakeClue, cats) });
                        }

                        // 5. A Unary Clue
                        if (ordCat) {
                            const otherCat = cats.find(c => c.id !== ordCat.id)!;
                            const fakeClue: Clue = {
                                type: ClueType.UNARY,
                                filter: UnaryFilter.IS_ODD,
                                targetCat: otherCat.id,
                                targetVal: otherCat.values[0],
                                ordinalCat: ordCat.id
                            };
                            previews.push({ type: 'Unary', content: renderPlainLanguageClue(fakeClue, cats) });
                        }

                        // 6. Adjacency
                        if (ordCat && cats.length >= 2) {
                            const otherCat = cats.find(c => c.id !== ordCat.id)!;
                            const fakeClue: AdjacencyClue = {
                                type: ClueType.ADJACENCY,
                                item1Cat: otherCat.id,
                                item1Val: otherCat.values[0],
                                item2Cat: otherCat.id,
                                item2Val: otherCat.values[1],
                                ordinalCat: ordCat.id
                            };
                            previews.push({ type: 'Adjacency', content: renderPlainLanguageClue(fakeClue, cats) });
                        }

                        // 7. Between (Requires 3 values)
                        if (ordCat && cats.length >= 2 && ordCat.values.length >= 3) {
                            const otherCat = cats.find(c => c.id !== ordCat.id)!;
                            // Just use same category for items if needed or mix?
                            // Between logic usually: Target between Lower and Upper.
                            const fakeClue: BetweenClue = {
                                type: ClueType.BETWEEN,
                                targetCat: otherCat.id,
                                targetVal: otherCat.values[1],
                                lowerCat: otherCat.id,
                                lowerVal: otherCat.values[0],
                                upperCat: otherCat.id,
                                upperVal: otherCat.values[2], // Assuming 3 values exist
                                ordinalCat: ordCat.id
                            };
                            previews.push({ type: 'Between', content: renderPlainLanguageClue(fakeClue, cats) });
                        }

                        // 8. Disjunction (OR)
                        if (cats.length >= 2) {
                            const c1 = cats[0];
                            const c2 = cats[1];
                            const fakeOr: DisjunctionClue = {
                                type: ClueType.OR,
                                clue1: {
                                    type: ClueType.BINARY,
                                    cat1: c1.id, val1: c1.values[0],
                                    cat2: c2.id, val2: c2.values[0],
                                    operator: BinaryOperator.IS
                                },
                                clue2: {
                                    type: ClueType.BINARY,
                                    cat1: c1.id, val1: c1.values[1],
                                    cat2: c2.id, val2: c2.values[1],
                                    operator: BinaryOperator.IS
                                }
                            };
                            previews.push({ type: 'Either / Or', content: renderPlainLanguageClue(fakeOr, cats) });
                        }

                        // 9. Arithmetic
                        if (ordCat && cats.length >= 2 && ordCat.values.length >= 4) {
                            const itemCat = cats.find(c => c.id !== ordCat.id)!;
                            const fakeAr: ArithmeticClue = {
                                type: ClueType.ARITHMETIC,
                                item1Cat: itemCat.id, item1Val: itemCat.values[0],
                                item2Cat: itemCat.id, item2Val: itemCat.values[1],
                                item3Cat: itemCat.id, item3Val: itemCat.values[2],
                                item4Cat: itemCat.id, item4Val: itemCat.values[3],
                                ordinalCat: ordCat.id
                            };
                            previews.push({ type: 'Arithmetic', content: renderPlainLanguageClue(fakeAr, cats) });
                        }

                        if (previews.length === 0) return <div style={{ color: '#666', fontStyle: 'italic' }}>Define more categories to see previews.</div>;

                        return previews.map((p, idx) => (
                            <div key={idx} style={{ padding: '12px', backgroundColor: '#111', borderRadius: '6px', borderLeft: '4px solid #3b82f6', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                <span style={{ fontSize: '0.75em', color: '#555', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>{p.type}</span>
                                <div style={{ flex: 1, color: '#eee' }}>{p.content}</div>
                            </div>
                        ));
                    })()}
                </div>
            </div>
        </div>
    );
};
