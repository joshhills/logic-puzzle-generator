import { CategoryType } from '../../src/index';
import { AppCategoryConfig, CategoryLabels } from './types';

export const APP_DEFAULTS = [
    {
        id: 'Suspect',
        values: ['Mustard', 'Plum', 'Green', 'Peacock', 'Scarlett', 'White', 'Rose', 'Peach', 'Brunette', 'Grey'],
        type: CategoryType.NOMINAL,
        labels: { groupName: 'suspect', verb: 'was', includeGroupName: true, valuePrefix: '', subjectPrefix: 'the suspect', verbNegated: 'was not', isPossessive: false } as CategoryLabels
    },
    {
        id: 'Weapon',
        values: ['Dagger', 'Candlestick', 'Revolver', 'Rope', 'Pipe', 'Wrench', 'Poison', 'Horseshoe', 'Axe', 'Bat'],
        type: CategoryType.NOMINAL,
        labels: { groupName: 'weapon', verb: 'was', includeGroupName: false, valuePrefix: 'the', subjectPrefix: 'the suspect with the', verbNegated: 'was not', isPossessive: true } as CategoryLabels
    },
    {
        id: 'Room',
        values: ['Hall', 'Lounge', 'Dining', 'Kitchen', 'Ballroom', 'Study', 'Library', 'Billiard', 'Conservatory', 'Cellar'],
        type: CategoryType.NOMINAL,
        labels: { groupName: 'room', verb: 'was in', includeGroupName: false, valuePrefix: 'the', verbNegated: 'was not in', subjectPrefix: 'the suspect in the', isPossessive: false } as CategoryLabels
    },
    {
        id: 'Gold',
        values: ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
        type: CategoryType.ORDINAL,
        labels: { groupName: 'gold', verb: 'has', includeGroupName: false, valuePrefix: '', ordinalBefore: 'less', ordinalAfter: 'more', superlativeFirst: 'least', superlativeLast: 'most', subjectPrefix: 'the suspect with', valueSuffix: 'gold', verbNegated: 'does not have', isPossessive: false } as CategoryLabels
    },
    {
        id: 'Motive',
        values: ['Revenge', 'Greed', 'Jealousy', 'Power', 'Fear', 'Rage', 'Love', 'Blackmail', 'Accident', 'Madness'],
        type: CategoryType.NOMINAL,
        labels: { groupName: 'motive', verb: 'was', includeGroupName: false, valuePrefix: '', isPossessive: true, subjectPrefix: 'the suspect whose motive was', verbNegated: 'was not' } as CategoryLabels
    }
];
