import { Clue, ClueType, ValueLabel, BinaryOperator, OrdinalOperator, SuperlativeOperator, UnaryFilter, CrossOrdinalOperator, CategoryType } from '../../../src/index';
import { AppCategoryConfig } from '../types';

export const formatValue = (val: ValueLabel, cat?: AppCategoryConfig) => {
    const suffix = cat?.labels?.valueSuffix ? ` ${cat.labels.valueSuffix}` : '';
    if (cat?.displayType === 'date') {
        const num = Number(val);
        if (!isNaN(num)) return <strong>{new Date(num).toLocaleDateString()}{suffix}</strong>;
    }
    return <strong>{String(val)}{suffix}</strong>;
};

export const formatTerm = (cat: AppCategoryConfig | undefined, val: ValueLabel, isSubject: boolean = false, forcePrefix?: string) => {
    if (!cat) return <strong>{String(val)}</strong>;

    // If we have a special subject prefix, use it and bypass the standard prefix + groupName logic
    if (isSubject && cat.labels?.subjectPrefix !== undefined && cat.labels?.subjectPrefix !== '') {
        const rawPrefix = cat.labels.subjectPrefix;
        const capitalizedPrefix = rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1);
        const formattedVal = formatValue(val, cat);
        return (
            <>
                <span>{capitalizedPrefix} </span>
                {formattedVal}
            </>
        );
    }

    const rawPrefix = cat.labels?.valuePrefix || forcePrefix || (isSubject ? 'The' : '');
    const prefix = isSubject && rawPrefix ? rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1) : rawPrefix;
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

export const renderPlainLanguageClue = (clue: Clue, cats: AppCategoryConfig[]) => {
    switch (clue.type) {
        case ClueType.BINARY: {
            const c1 = cats.find(cat => cat.id === clue.cat1);
            const c2 = cats.find(cat => cat.id === clue.cat2);

            const term1 = formatTerm(c1, clue.val1, true);
            const term2 = formatTerm(c2, clue.val2, false);

            const isOrdinalValue = c2?.type === CategoryType.ORDINAL;
            const verb = c2?.labels?.verb || 'is';
            const suffix = isOrdinalValue ? ` ${c2?.labels?.groupName || c2?.id.toLowerCase()}` : '';

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
                const verbNeg = c2?.labels?.verbNegated || (verb === 'is' ? 'is not' : (verb === 'is in' ? 'is not in' : (verb === 'has' ? 'does not have' : `is not ${verb}`)));
                return <>{term1} {verbNeg} {term2}{suffix}.</>;
            }
        }
        case ClueType.ORDINAL: {
            const c1 = cats.find(cat => cat.id === clue.item1Cat);
            const c2 = cats.find(cat => cat.id === clue.item2Cat);
            const co = cats.find(cat => cat.id === clue.ordinalCat);

            const term1 = formatTerm(c1, clue.item1Val, true);
            const term2 = formatTerm(c2, clue.item2Val, false, 'the');

            // If the ordinal category has a specific verb (e.g. Gold has "has"), use it.
            // Otherwise fall back to the subject's default or "is".
            const coVerb = co?.labels?.verb;
            const verb = coVerb || 'is';
            const coGroupName = co?.labels?.groupName || co?.id.toLowerCase() || '';

            const ordBefore = co?.labels?.ordinalBefore || 'before';
            const ordAfter = co?.labels?.ordinalAfter || 'after';

            // Phrasing: "Alice has fewer gold than the suspect Plum" 
            const opLabel = clue.operator === OrdinalOperator.LESS_THAN ? ordBefore : ordAfter;

            if (coVerb) {
                return <>{term1} {verb} {opLabel} {coGroupName} than {term2}.</>;
            } else {
                return <>{term1} {verb} {opLabel} {term2}.</>;
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

            const term = (clue.operator === SuperlativeOperator.MIN || clue.operator === SuperlativeOperator.NOT_MAX) ? supFirst : supLast;

            const isNegated = clue.operator === SuperlativeOperator.NOT_MIN || clue.operator === SuperlativeOperator.NOT_MAX;

            if (isNegated) {
                const verbNeg = (verb === 'is' ? 'is not' : (verb === 'has' ? 'does not have' : `is not ${verb}`));
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
            const term2 = formatTerm(c2, clue.item2Val, false, 'the');

            const group1 = co1?.labels?.groupName || co1?.id.toLowerCase() || 'item';
            const group2 = co2?.labels?.groupName || co2?.id.toLowerCase() || 'item';

            const rel = clue.operator === CrossOrdinalOperator.MATCH ? 'matches' : 'does not match';
            return <>{term1}'s {group1} {rel} {term2}'s {group2} position.</>;
        }
    }
    return <>{ClueType[(clue as any).type]} clue</>;
};
