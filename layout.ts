import * as assert from 'node:assert/strict';
import { chain, identity, zipWith } from 'lodash';

import { padNum, PageOf, strReverse, toColumns } from './utils';

//region --- Types ---
export type Layout = LayoutPage[];
export type LayoutPage = PageOf<LayoutItem>;

export interface LayoutItem {
    front: string;
    back:  string;
}
export interface ExtractionOrder {
    front: string[];
    back?: string[];
}
export interface RenameEntry {
    fromIndex: number;
    toName: string;
}

/** Returns the full name for a slot with the given reference character, at a specific position, for front/back side. */
export type NameResolver = (ref: string, slotNumber: number, side: Side) => string;
type ExtractionOrderInit = [string, string] | [string];

export enum Side {
    Front,
    Back,
}

/** Shorthand form of game config */
export interface GameConfigInit {
    singleSided?:    boolean;
    shiftNumbers?:   boolean;
    startIndex?:     number;
    inPrefix:        string;
    outPrefix:       string;
    layout:          string[];
    extractionOrder: ExtractionOrderInit[];
}
export interface GameConfig {
    renames:         RenameEntry[];
    cards:           CardImage[];
    inPrefix:        string; // Prefix for extracted images
}

export interface RenameConfig {
    extractionOrder: ExtractionOrder[];
    fullName:        NameResolver;
    startIndex:      number;
}

interface NameConfig {
    outPrefix:    string; // Prefix for all full names
    shiftNumbers: boolean; // If set to false, numbers will also be treated as a letter reference
}

/** Filenames (without extension) for each slot */
export interface CardImage {
    front: string;
    back:  string;
}

//endregion

//region --- Config ---
/** Generates config from a shorthand description */
export function config(init: GameConfigInit): GameConfig {
    const singleSided = init.singleSided ?? false;
    const shiftNumbers = init.shiftNumbers ?? true;
    const startIndex   = init.startIndex ?? 0;

    const layoutParser = singleSided ? parseLayoutOneSided : parseLayout;
    const layout = init.layout.map(layoutParser);
    const extractionOrder = init.extractionOrder.map(parseExtractionOrder);

    verifyConfig(layout, extractionOrder);

    const fullName = defaultName({
        outPrefix: init.outPrefix,
        shiftNumbers,
    });
    const renames = getRenames({
        extractionOrder: extractionOrder,
        startIndex,
        fullName,
    });

    return {
        cards: cardNames(layout, fullName),
        renames: renames,
        inPrefix: init.inPrefix,
    };
}

function verifyConfig(layout: Layout, extractionOrder: ExtractionOrder[]) {
    assert.equal(layout.length, extractionOrder.length, 'Different number of pages for layout and extraction');

    const seenLetters = new Set<string>();
    // Verify that the numbered slots defined in the layout and extracted slots for a page are identical
    for (let pageIndex = 0; pageIndex < layout.length; pageIndex += 1){
        const layoutPage = layout[pageIndex];
        const extractionPage = extractionOrder[pageIndex];

        const allLayoutItems: LayoutItem[] = layoutPage.flat(); // Rows are irrelevant
        const lFronts = allLayoutItems.map(_ => _.front).filter(_ => _ !== '.');
        const lBacks  = allLayoutItems.map(_ => _.back).filter(_ => _ !== '.');

        const xFronts = extractionPage.front;
        const xBacks = extractionPage.back ?? [];

        function numbersOnly(list: string[]) {
            return list.map(_ => parseInt(_, 10)).filter(_ => !isNaN(_));
        }

        function lettersOnly(list: string[]) {
            return list.filter(_ =>  /^[A-Z]$/i.test(_));
        }

        assert.deepEqual(
            new Set(numbersOnly(lFronts)),
            new Set(numbersOnly(xFronts)),
            `Layout and extraction order don't match for numbers, on page ${pageIndex + 1} front`,
        );
        assert.deepEqual(
            new Set(numbersOnly(lBacks)),
            new Set(numbersOnly(xBacks)),
            `Layout and extraction order don't match for numbers, on page ${pageIndex + 1} back`,
        );

        // Check front for new letters to extract
        {
            const newLetters = new Set(lettersOnly(lFronts));
            for (let item of seenLetters) {
                newLetters.delete(item);
            }
            const extractLetters = new Set(lettersOnly(xFronts));
            assert.deepEqual(
                newLetters,
                extractLetters,
                `Layout and extraction order don't match for letters, on page ${pageIndex + 1} front`,
            );

            for (let item of newLetters) {
                seenLetters.add(item);
            }
        }

        // Check back for new letters to extract
        {
            const newLetters = new Set(lettersOnly(lBacks));
            for (let item of seenLetters) {
                newLetters.delete(item);
            }
            const extractLetters = new Set(lettersOnly(xBacks));
            assert.deepEqual(
                newLetters,
                extractLetters,
                `Layout and extraction order don't match for letters, , on page ${pageIndex + 1} back`
            );

            for (let item of newLetters) {
                seenLetters.add(item);
            }
        }
    }
}


/** Layout string parser.

 Visual representation for card fronts and backs. Standard example for "flip on short edge" setup,
 with 6 cards:

 ```
 123  321
 456  654
 ```
 */
export function parseLayout(raw: string): LayoutPage {
    // First column are the card fronts, second are the card backs
    const sides = chain(raw)
        .split('\n')
        // Skip empty lines and whitespace to allow indented template strings
        .map(r => r.trim())
        .filter(identity)
        // Split the columns and reorder by them
        .map(r => r.split(' ').filter(identity))
        .unzip()
        .value();

    const [fronts, flippedBacks] = sides;
    // Flip on short edge means backs are mirrored
    const backs = flippedBacks.map(strReverse);

    const frontSlots = fronts.map(f => f.split(''));
    const backSlots = backs.map(b => b.split(''));
    return zipWith(frontSlots, backSlots, (frontRow, backRow) => {
        return zipWith(frontRow, backRow, (front, back) => {
            return { front, back };
        }).filter(i => i.front !== '.');
    });
}

export function parseLayoutOneSided(raw: string): LayoutPage {
    const fronts = chain(raw)
        .split('\n')
        // Remove whitespace
        .map(r => r.trim())
        .filter(identity)
        .map(r => r.split('').filter(validOnly))
        .value();
    return fronts.map(r => r.map(_ => ({ front: _, back: '.' })));
}

export function defaultName(config: NameConfig): NameResolver {
    return function(ref, slotNumber, side): string {
        const prefix = side === Side.Front ? 'F' : 'B';

        let slotName = side === Side.Back && ref === '.' ? 'cardback' : ref;
        const slot = parseInt(ref);
        const suffix = (config.shiftNumbers && !Number.isNaN(slot))
            ? `${prefix}-${padNum(slotNumber + 1)}`
            : slotName;

        return `${config.outPrefix}-${suffix}`;
    };
}

// For simplicity, back indexes (even if some are skipped) just match the slot.
export function parseExtractionOrder(raw: ExtractionOrderInit): ExtractionOrder {
    const slots = raw.map(p => p
        .split('')
        // Ignore '.'
        .filter(i => i !== '.')
    );
    const [front, back] = slots;
    return { front, back };
}

/** Generates renames from a shorthand config */
export function getRenames(config: RenameConfig): RenameEntry[] {
    const { extractionOrder, fullName } = config;
    const renames: RenameEntry[] = [];
    let currentIndex = config.startIndex;

    let pageStartOffset = 0;
    for (let pageIndex = 0; pageIndex < extractionOrder.length; pageIndex += 1) {
        // Track largest slot number used, bump offset by that each page to avoid collisions
        let largestSlotOnPage = 0;
        const order = extractionOrder[pageIndex];

        const configs: [Side, string[]][] = [
            [Side.Front, order.front]
        ];
        // Card backs are not extracted from single-sided layouts
        if (order.back) {
            configs.push([Side.Back, order.back]);
        }

        for (const [side, order] of configs) {
            for (let targetSlotStr of order) {
                if (targetSlotStr === '-') {
                    // Skip file at this index
                } else {
                    const targetSlot = parseInt(targetSlotStr, 10);
                    if (targetSlot > largestSlotOnPage) {
                        largestSlotOnPage = targetSlot;
                    }

                    const absoluteSlot = pageStartOffset + (targetSlot - 1); // Input uses 1-based indexes
                    const toName = fullName(targetSlotStr, absoluteSlot, side);
                    renames.push({ fromIndex: currentIndex, toName });
                }

                currentIndex += 1;
            }
        }

        pageStartOffset += largestSlotOnPage;
    }

    return renames;
}
//endregion

//region --- Utils ---
export function cardNames(layout: Layout, fullName: NameResolver): CardImage[] {
    const pageSize = layout[0].flat().length;

    const front: string[] = layout.flatMap((pageLayout, pageIndex) => {
        return pageLayout.flat(1).map(((item, itemIndex) => {
            const slotNumber = (pageIndex * pageSize) + itemIndex;
            return fullName(item.front, slotNumber, Side.Front);
        }));
    });
    const back: string[] = layout.flatMap((pageLayout, pageIndex) => {
        return pageLayout.flat(1).map(((row, rowIndex) => {
            const slotNumber = (pageIndex * pageSize) + rowIndex;
            return fullName(row.back, slotNumber, Side.Back);
        }));
    });

    return zipWith(front, back, (f,b) => ({ front: f, back: b }));
}

function validOnly(i: string) { return i !== '.'; }
export function extractByColumns(layout: Layout): ExtractionOrder[] {
    const unfiltered = layout.map(page => {
        const byColumns  = toColumns(page);
        const frontOrder = byColumns.map(col => col.map(item => item.front)).flat();
        const backOrder  = byColumns.map(col => col.map(item => item.back )).flat();

        return {
            front: frontOrder.filter(validOnly),
            back: backOrder.filter(validOnly)
        };
    });

    // Track repeating items, skip them (even cross-page, cross-side)
    const extracted = new Set<string>();
    return unfiltered.map(page => {
        const front: string[] = [];
        const back : string[] = [];

        // For-of loops instead of side-effectful .map() calls
        for (const item of page.front) {
            if (!extracted.has(item)) {
                front.push(item);
                extracted.add(item);
            }
        }
        for (const item of page.back) {
            if (!extracted.has(item)) {
                back.push(item);
                extracted.add(item);
            }
        }

        return { front, back };
    });
}

/** Helper shortcut for CardImage creation */
export function card(front: string, back: string): CardImage {
    return { front, back };
}

/** Helper shortcut for RenameEntry creation */
export function mapping(fromIndex: number, toName: string): RenameEntry {
    return { fromIndex, toName };
}
//endregion
