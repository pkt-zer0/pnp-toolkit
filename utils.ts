import { zip } from 'lodash';

export type PageOf<T> = T[][]; // Rows of items

export function strReverse(original: string): string {
    return original.split('').reverse().join('');
}

export function padNum(raw: number | string): string {
    return ('' + raw).padStart(3, '0');
}

export function escapeRegex(str: string) {
    return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function toColumns<T>(page: PageOf<T>): PageOf<T> {
    // Zip fills out missing items with undefined, remove those
    return zip(...page).map(col => col.filter(i => i !== undefined));
}