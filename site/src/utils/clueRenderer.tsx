import React from 'react';
import { Clue, ClueType, ValueLabel, BinaryOperator, OrdinalOperator, SuperlativeOperator, UnaryFilter, CrossOrdinalOperator, CategoryType, BetweenClue, AdjacencyClue, DisjunctionClue, ArithmeticClue } from '../../../src/index';
import { AppCategoryConfig } from '../types';

export const formatValue = (val: ValueLabel, cat?: AppCategoryConfig) => {
    const suffix = cat?.labels?.valueSuffix ? ` ${cat.labels.valueSuffix}` : '';
    if (cat?.displayType === 'date') {
        const num = Number(val);
        if (!isNaN(num)) return <strong>{new Date(num).toLocaleDateString()}{suffix}</strong>;
    }
    return <strong>{String(val)}{suffix}</strong>;
};

export const formatTerm = (cat: AppCategoryConfig | undefined, val: ValueLabel, isSubject: boolean = false, forcePrefix?: string, capitalize: boolean = true) => {
    if (!cat) return <strong>{String(val)}</strong>;

    // If we have a special subject prefix, use it and bypass the standard prefix + groupName logic
    if (isSubject && cat.labels?.subjectPrefix !== undefined && cat.labels?.subjectPrefix !== '') {
        const rawPrefix = cat.labels.subjectPrefix;
        const capitalizedPrefix = capitalize ? rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1) : rawPrefix.toLowerCase();
        const formattedVal = formatValue(val, cat);
        return (
            <>
                <span>{capitalizedPrefix} </span>
                {formattedVal}
            </>
        );
    }

    // If valuePrefix is undefined, default to 'The' for subjects, otherwise ''.
    // If valuePrefix is defined (even as empty string), typically we use it.
    // BUT 'forcePrefix' overrides all.
    let rawPrefix = forcePrefix;
    if (rawPrefix === undefined) {
        if (cat.labels?.valuePrefix !== undefined) {
            rawPrefix = cat.labels.valuePrefix;
        } else {
            rawPrefix = isSubject ? 'The' : '';
        }
    }
    const prefix = capitalize && rawPrefix ? rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1) : rawPrefix;
    const groupName = cat.labels?.groupName || cat.id.toLowerCase();
    const includeGroup = cat.labels?.includeGroupName ?? true;
    const formattedVal = formatValue(val, cat);

    const parts = [];
    if (prefix) parts.push(prefix);
    if (includeGroup) parts.push(groupName);
    parts.push(formattedVal);

    return (
        <>
            {parts.map((p, i) => (
                <span key={i}>
                    {i > 0 && ' '}
                    {p}
                </span>
            ))}
        </>
    );
};

export const renderPlainLanguageClue = (clue: Clue, cats: AppCategoryConfig[]): JSX.Element => {
    switch (clue.type) {
        case ClueType.BINARY: {
            const c1 = cats.find(cat => cat.id === clue.cat1);
            const c2 = cats.find(cat => cat.id === clue.cat2);

            const term1 = formatTerm(c1, clue.val1, true);
            const term2 = formatTerm(c2, clue.val2, false);

            const isOrdinalValue = c2?.type === CategoryType.ORDINAL;
            const verb = c2?.labels?.verb || 'is';
            const suffix = (isOrdinalValue && !c2?.labels?.valueSuffix) ? ` ${c2?.labels?.groupName || c2?.id.toLowerCase()}` : '';

            if (c2?.labels?.isPossessive) {
                const groupName = c2.labels.groupName || c2.id.toLowerCase();
                if (clue.operator === BinaryOperator.IS) {
                    return <>{term1}'s {groupName} {verb} {term2}.</>;
                } else {
                    const verbNeg = c2?.labels?.verbNegated || (verb === 'is' ? 'is not' : `is not ${verb}`);
                    return <>{term1}'s {groupName} {verbNeg} {term2}.</>;
                }
            }

            if (clue.operator === BinaryOperator.IS) {
                return <>{term1} {verb} {term2}{suffix}.</>;
            } else {
                let verbNeg = c2?.labels?.verbNegated;
                if (!verbNeg) {
                    if (verb === 'is') verbNeg = 'is not';
                    else if (verb === 'is in') verbNeg = 'is not in';
                    else if (verb === 'has') verbNeg = 'does not have';
                    else if (verb === 'was') verbNeg = 'was not';
                    else if (verb === 'was in') verbNeg = 'was not in';
                    else verbNeg = `is not ${verb}`;
                }
                return <>{term1} {verbNeg} {term2}{suffix}.</>;
            }
        }
        case ClueType.ORDINAL: {
            const c1 = cats.find(cat => cat.id === clue.item1Cat);
            const c2 = cats.find(cat => cat.id === clue.item2Cat);
            const co = cats.find(cat => cat.id === clue.ordinalCat);

            const term1 = formatTerm(c1, clue.item1Val, true);
            const term2 = formatTerm(c2, clue.item2Val, true, undefined, false);

            // If the ordinal category has a specific verb (e.g. Gold has "has"), use it.
            // Otherwise fall back to the subject's default or "is".
            const coVerb = co?.labels?.verb;
            const verb = coVerb || 'is';
            const coGroupName = co?.labels?.groupName || co?.id.toLowerCase() || '';

            const ordBefore = co?.labels?.ordinalBefore || 'before';
            const ordAfter = co?.labels?.ordinalAfter || 'after';

            // Phrasing logic
            let opLabel = ordAfter; // Default to 'after' / 'greater than'
            let isNegated = false;

            if (clue.operator === OrdinalOperator.LESS_THAN) {
                opLabel = ordBefore;
            } else if (clue.operator === OrdinalOperator.NOT_GREATER_THAN) {
                // NOT >  ==  <=  (Not After)
                opLabel = ordAfter;
                isNegated = true;
            } else if (clue.operator === OrdinalOperator.NOT_LESS_THAN) {
                // NOT <  ==  >=  (Not Before)
                opLabel = ordBefore;
                isNegated = true;
            }

            if (isNegated) {
                let verbNeg = `is not ${verb}`;
                if (coVerb === 'has') verbNeg = 'does not have';
                else if (verb === 'is') verbNeg = 'is not';
                else if (verb === 'was') verbNeg = 'was not';
                if (coVerb) {
                    return <>{term1} {verbNeg} {opLabel} {coGroupName} than {term2}.</>;
                } else {
                    return <>{term1} {verbNeg} {opLabel} {term2}.</>;
                }
            } else {
                if (coVerb) {
                    return <>{term1} {verb} {opLabel} {coGroupName} than {term2}.</>;
                } else {
                    return <>{term1} {verb} {opLabel} {term2}.</>;
                }
            }
        }
        case ClueType.SUPERLATIVE: {
            const c1 = cats.find(cat => cat.id === clue.targetCat);
            const co = cats.find(cat => cat.id === clue.ordinalCat);

            const term1 = formatTerm(c1, clue.targetVal, true);
            const coGroupName = co?.labels?.groupName || co?.id.toLowerCase() || 'item';
            const coVerb = co?.labels?.verb;
            const verb = coVerb || (c1?.labels?.verb === 'is in' ? 'is' : (c1?.labels?.verb || 'is'));

            const supFirst = co?.labels?.superlativeFirst || (coVerb === 'has' ? 'lowest amount of' : 'first');
            const supLast = co?.labels?.superlativeLast || (coVerb === 'has' ? 'highest amount of' : 'last');

            const term = (clue.operator === SuperlativeOperator.MIN || clue.operator === SuperlativeOperator.NOT_MIN) ? supFirst : supLast;

            const isNegated = clue.operator === SuperlativeOperator.NOT_MIN || clue.operator === SuperlativeOperator.NOT_MAX;

            if (isNegated) {
                let verbNeg = `is not ${verb}`;
                if (verb === 'is') verbNeg = 'is not';
                else if (verb === 'was') verbNeg = 'was not';
                else if (verb === 'has') verbNeg = 'does not have';

                return <>{term1} {verbNeg} the {term} {coGroupName}.</>;
            }

            const connector = verb === 'is' ? 'is the' : `has the`;
            return <>{term1} {connector} {term} {coGroupName}.</>;
        }
        case ClueType.UNARY: {
            const c1 = cats.find(cat => cat.id === clue.targetCat);
            const co = cats.find(cat => cat.id === clue.ordinalCat);
            const term1 = formatTerm(c1, clue.targetVal, true);

            const coVerb = co?.labels?.verb;
            const verb = coVerb || 'is';
            const coGroupName = co?.labels?.groupName || co?.id.toLowerCase() || 'item';
            const term = clue.filter === UnaryFilter.IS_ODD ? 'odd' : 'even';

            if (coVerb === 'has') {
                return <>{term1} {verb} an {term} amount of {coGroupName}.</>;
            }
            return <>{term1} {verb} an {term} value in {coGroupName}.</>;
        }
        case ClueType.CROSS_ORDINAL: {
            const c1 = cats.find(cat => cat.id === clue.item1Cat);
            const c2 = cats.find(cat => cat.id === clue.item2Cat);
            const co1 = cats.find(cat => cat.id === clue.ordinal1);
            const co2 = cats.find(cat => cat.id === clue.ordinal2);

            const term1 = formatTerm(c1, clue.item1Val, true);
            const term2 = formatTerm(c2, clue.item2Val, true, undefined, false);

            const group1 = co1?.labels?.groupName || co1?.id.toLowerCase() || 'item';
            const group2 = co2?.labels?.groupName || co2?.id.toLowerCase() || 'item';

            const rel = clue.operator === CrossOrdinalOperator.MATCH ? 'matches' : 'does not match';
            return <>{term1}'s {group1} {rel} {term2}'s {group2} position.</>;
        }
        case ClueType.BETWEEN: {
            const c = clue as BetweenClue;
            const targetCat = cats.find(cat => cat.id === c.targetCat);
            const lowerCat = cats.find(cat => cat.id === c.lowerCat);
            const upperCat = cats.find(cat => cat.id === c.upperCat);
            const co = cats.find(cat => cat.id === c.ordinalCat);

            const termTarget = formatTerm(targetCat, c.targetVal, true);
            const termLower = formatTerm(lowerCat, c.lowerVal, true, undefined, false);
            const termUpper = formatTerm(upperCat, c.upperVal, true, undefined, false);

            const coVerb = co?.labels?.verb;
            const verb = coVerb || 'is';
            const coGroupName = co?.labels?.groupName || co?.id.toLowerCase() || 'item';

            const ordBefore = co?.labels?.ordinalBefore; // e.g. "younger", "lighter" ( < )
            const ordAfter = co?.labels?.ordinalAfter;   // e.g. "older", "heavier" ( > )

            // Resolve indices to ensure logical "Between" phrasing (Min < Target < Max)
            // "Target is More(>) than Min but Less(<) than Max"
            const lowerIdx = co?.values.indexOf(c.lowerVal) ?? -1;
            const upperIdx = co?.values.indexOf(c.upperVal) ?? -1;

            let minTerm = termLower;
            let maxTerm = termUpper;

            // If we can determine order and they are flipped (Lower Index > Upper Index), swap them for the text
            // checking lowerIdx !== -1 && upperIdx !== -1 is safe, if not found we stick to defaults
            if (lowerIdx !== -1 && upperIdx !== -1 && lowerIdx > upperIdx) {
                minTerm = termUpper;
                maxTerm = termLower;
            }

            // Case 1: Possession (e.g. Gold: has more Gold) - Prioritize this for 'has' verbs to avoid "is more than"
            if (coVerb === 'has') {
                return (
                    <>
                        {termTarget} has more {coGroupName} than {minTerm} but less than {maxTerm}.
                    </>
                );
            }

            // Case 2: Custom Adjectives (e.g. Age: Older/Younger)
            if (ordBefore && ordAfter) {
                return (
                    <>
                        {termTarget} is {ordAfter} than {minTerm} but {ordBefore} than {maxTerm}.
                    </>
                );
            }

            // Case 3: Default / Locative / Generic (e.g. Room, Floor: is between)
            // "X is between A and B" - order matters less here, but usually "Between Small and Large" reads better
            return (
                <>
                    {termTarget} is between {minTerm} and {maxTerm} in {coGroupName}.
                </>
            );
        }
        case ClueType.ADJACENCY: {
            const c = clue as AdjacencyClue;
            const item1Cat = cats.find(cat => cat.id === c.item1Cat);
            const item2Cat = cats.find(cat => cat.id === c.item2Cat);
            const ordCat = cats.find(cat => cat.id === c.ordinalCat);

            // "The Norwegian lives next to the Blue house." (House Number)
            // "The Gun is next to the Rope in Age."

            const term1 = formatTerm(item1Cat, c.item1Val, true);
            const term2 = formatTerm(item2Cat, c.item2Val, true, undefined, false);

            const ordGroupName = ordCat?.labels?.groupName || ordCat?.id.toLowerCase() || 'order';
            const contextVerb = (item1Cat?.labels?.verb === 'lives in' || item1Cat?.labels?.verb === 'lives at') ? 'lives' : 'is';

            // If context is simple (Next to house), render simply.
            // If explicit ordinal "Age", say "Adjacency in Age".

            // "Entity1 is next to Entity2." (Implicit rank adjacent)
            // Or "Entity1 is next to Entity2 in Age."

            const suffix = ordCat ? ` in ${ordGroupName}` : '';

            return <>{term1} is next to {term2}{suffix}.</>;
        }
        case ClueType.OR: {
            const or = clue as DisjunctionClue;
            return <>
                Either {renderPlainLanguageClue(or.clue1, cats)} OR {renderPlainLanguageClue(or.clue2, cats)}
            </>;
        }
        case ClueType.ARITHMETIC: {
            const ar = clue as ArithmeticClue;
            const item1Cat = cats.find(cat => cat.id === ar.item1Cat);
            const item2Cat = cats.find(cat => cat.id === ar.item2Cat);
            const item3Cat = cats.find(cat => cat.id === ar.item3Cat);
            const item4Cat = cats.find(cat => cat.id === ar.item4Cat);
            const ordCat = cats.find(cat => cat.id === ar.ordinalCat);

            const t1 = formatTerm(item1Cat, ar.item1Val, true);
            const t2 = formatTerm(item2Cat, ar.item2Val, false);
            const t3 = formatTerm(item3Cat, ar.item3Val, false);
            const t4 = formatTerm(item4Cat, ar.item4Val, false);

            const ordName = ordCat?.labels?.groupName || ordCat?.id.toLowerCase() || 'value';

            return <>
                The difference in {ordName} between {t1} and {t2} is the same as the difference between {t3} and {t4}.
            </>;
        }
    }
    return <>{ClueType[(clue as any).type]} clue</>;
};
