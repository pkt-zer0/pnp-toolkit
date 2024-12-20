import { basename, extname, join } from 'node:path';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';

import { groupBy, map, range } from 'lodash';

import { CardImage } from './layout';
import { format, t } from './templating';
import { OUTPUT_ROOT_DIR } from './constants';

const MPC_BRACKETS = [18, 36, 55, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 396, 504, 612];

export interface AutofillEntry {
    name : string;
    ext  : string;
    slots: number[];
}
export interface AutofillData {
    quantity: number;
    fronts  : AutofillEntry[];
    backs   : AutofillEntry[];
}

export function autofillData(cards: CardImage[]): AutofillData {
    const fronts = cards.map(c => c.front);
    const backs = cards.map(c => c.back);
    const quantity = fronts.length;

    function getSlotInfo(mappings: string[]): AutofillEntry[] {
        const withIndexes = mappings.map((name, i) => ({ name, slot: i }));
        const groups = groupBy(withIndexes, m => m.name);
        return map(groups, (items, name) => {
            return {
                name: name,
                ext: '', // This is filled in later with the real extension
                slots: items.map(i => i.slot)
            };
        });
    }

    return {
        quantity,
        fronts: getSlotInfo(fronts),
        backs: getSlotInfo(backs),
    };
}

export function validateAutofillData(data: AutofillData): void {
    const expectedFronts = new Set(range(data.quantity));
    const expectedBacks  = new Set(range(data.quantity));
    // Sanity check that all slots are filled, with fronts and backs

    for (const front of data.fronts) {
        for (let slot of front.slots) {
            expectedFronts.delete(slot);
        }
    }

    for (const back of data.backs) {
        for (let slot of back.slots) {
            expectedBacks.delete(slot);
        }
    }

    if (expectedFronts.size > 0) {
        throw new Error('Missing card front for slots: ' + [...expectedFronts.values()].join(', '));
    }
    if (expectedBacks.size > 0) {
        throw new Error('Missing card back for slots: ' + [...expectedBacks.values()].join(', '));
    }
}

function deduplicate(list: AutofillEntry[]): AutofillEntry[] {
    const result: AutofillEntry[] = [];
    const existingNames: Record<string, AutofillEntry> = {};
    for (let index = 0; index < list.length; index += 1) {
        const current = list[index];
        const name = current.name;
        if (name in existingNames) {
            // Duplicated name, merge into the original
            const original = existingNames[name];
            original.slots.push(...current.slots);
        } else {
            // New item, push to output, track reference for merges
            result.push(current);
            existingNames[name] = current;
        }
    }

    return result;
}

export function mergeAutofillData(configs: AutofillData[]): AutofillData {
    let quantity = 0;
    const fronts: AutofillEntry[] = [];
    const backs: AutofillEntry[] = [];

    function offsetSlots(offset: number, entry: AutofillEntry): AutofillEntry {
        return {
            name:  entry.name,
            ext:   entry.ext,
            slots: entry.slots.map(s => offset + s)
        };
    }

    // Add the individual items to the output sequentially
    for (const config of configs) {
        const slotOffset = quantity;
        quantity += config.quantity;
        fronts.push(...config.fronts.map(c => offsetSlots(slotOffset, c)));
        backs.push(...config.backs.map(c => offsetSlots(slotOffset, c)));
    }

    // Merge any entries with duplicated names
    return {
        quantity,
        fronts: deduplicate(fronts),
        backs: deduplicate(backs),
    };
}

function generateAutofillXml(data: AutofillData): string {
    const { fronts, backs } = data;

    const sizeBracket = MPC_BRACKETS.find(bracket => bracket >= data.quantity);

    function renderCard(card: AutofillEntry) {
        return t`
            <card>
                <id>${card.name}</id>
                <slots>${card.slots.join(',')}</slots>
                <name>${card.name}.${card.ext}</name>
            </card>
        `;
    }

    return format(t`
        <order>
            <details>
                <quantity>${data.quantity}</quantity> <!-- Total card number -->
                <bracket>${sizeBracket}</bracket>  <!-- Batch size -->
                <stock>(S30) Standard Smooth</stock>
                <foil>false</foil>
            </details>
            <fronts>
                ${fronts.map(renderCard)}
            </fronts>
            <backs>
                ${backs.map(renderCard)}
            </backs>
        </order>
    `);
}

export function createAutofillConfig(cardData: AutofillData) {
    const targetDir = OUTPUT_ROOT_DIR;
    const targetFile = join(targetDir, 'cards.xml');

    const cardDir = join(targetDir, 'cards');

    validateAutofillData(cardData); // Sanity check config

    // Validate the required cards are present, and get their extensions
    if (!existsSync(cardDir)) {
        throw Error('Card dir missing!');
    }

    // Construct extension lookup
    const files = readdirSync(cardDir);
    const extLookup: Record<string, string> = {};
    for (const file of files) {
        const ext = extname(file);
        const cardName = basename(file, ext).toLowerCase();
        extLookup[cardName] = ext.slice(1); // Remove the dot from the extension
    }

    // Set extensions for cards, check if everything is present
    for (const card of [...cardData.fronts, ...cardData.backs]) {
        const relatedFileExt = extLookup[card.name.toLowerCase()];
        if (!relatedFileExt) {
            throw Error('Missing card image/extension for ' + card.name);
        }
        card.ext = relatedFileExt;
    }

    const data = generateAutofillXml(cardData);
    writeFileSync(targetFile, data, { encoding: 'utf8' });

    const quantity = cardData.quantity;
    const sizeBracket = MPC_BRACKETS.find(bracket => bracket >= quantity);

    console.log(`Done! Contains ${quantity} cards (${sizeBracket} size batch)`);
}
