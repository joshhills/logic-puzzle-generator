import { CategoryConfig } from '../../src/types';

export interface AppCategoryConfig extends CategoryConfig {
    displayType?: 'text' | 'date';
}
