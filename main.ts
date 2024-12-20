import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { ImageData } from 'canvas';
import { times } from 'lodash';

import { renameExtractedImages } from './extract';
import {
    autofillData,
    createAutofillConfig,
    mergeAutofillData,
} from './autofill';
import { card, CardImage, GameConfig } from './layout';
import { INPUT_DIR, OUTPUT_DIR, RENAMED_DIR } from './constants';
import {
    addBleed,
    extendSides,
    loadImageData,
    saveImageData,
} from './transform';
import {
    copyDirs,
    ensureOutDirs,
    getOutPath,
    preprocessNoop,
} from './process';
import { awesomeGame, combatGame, simpleGame } from './configs';

function preprocessCombat(control: ImageData) {
    return async function (inPath: string): Promise<void> {
        const outPath = getOutPath(inPath);
        if (existsSync(outPath)) { return; }

        const sourceImage = await loadImageData(inPath);

        const step1 = extendSides(sourceImage, control);
        const step2 = addBleed(step1, 36);

        await saveImageData(outPath, step2);
    };
}

async function simple() {
    ensureOutDirs();

    const configs: GameConfig[] = [awesomeGame];

    //--- Rename raw input files ---
    for (const config of configs) {
        renameExtractedImages(OUTPUT_DIR, config);
    }

    //--- Generate card list ---
    const images: CardImage[][] = [];
    images.push(...configs.map(c => c.cards));

    //--- Create autofill config ---
    const config = mergeAutofillData([...images.map(autofillData)]);
    createAutofillConfig(config);
}

async function advanced() {
    ensureOutDirs();

    const standard: GameConfig[] = [awesomeGame];
    const customized: GameConfig[] = [simpleGame];

    //--- Rename raw input files ---
    for (const config of [...standard, ...customized]) {
        renameExtractedImages(OUTPUT_DIR, config);
    }

    //--- Add images directly ---
    const RAW_SOURCES = ['custom_game'];
    copyDirs(RAW_SOURCES, OUTPUT_DIR);

    //--- Generate card list ---
    const images: CardImage[][] = [];
    {
        // Standard configs, added as-is
        images.push(...standard.map(c => c.cards));

        // Customize the rest as needed
        const cards = simpleGame.cards;
        for (let card of cards) {
            card.back = 'simple-alternate';
        }
        images.push(cards);

        // Additional cards from the raw sources
        images.push(times(2, () => card('custom-front', 'custom-back')));
    }

    //--- Create autofill config ---
    const config = mergeAutofillData([...images.map(autofillData)]);
    createAutofillConfig(config);
}

async function expert(){
    ensureOutDirs();

    const standard: GameConfig[] = [combatGame];

    //--- Rename raw input files (in -> renamed) ---
    for (const config of standard) {
        renameExtractedImages(RENAMED_DIR, config);
    }

    //--- Preprocess images (renamed -> out) ---
    // Define preprocessing functions
    const control = await loadImageData(path.join(INPUT_DIR, 'cmbt_edges.png'));
    const combatPreprocessor = preprocessCombat(control);

    // Setup which files need to be preprocessed
    const allFiles = readdirSync(RENAMED_DIR).map(file => {
        if (file.startsWith('cmbt_')) {
            return { file, processor: combatPreprocessor };
        }

        // Copy files as-is by default
        return { file, processor: preprocessNoop };
    });

    for (const entry of allFiles) {
        const inPath = path.join(RENAMED_DIR, entry.file);
        await entry.processor(inPath);
    }

    //--- Generate card list ---
    const images: CardImage[][] = [];
    images.push(...standard.map(c => c.cards));

    //--- Create autofill config ---
    const config = mergeAutofillData([...images.map(autofillData)]);
    createAutofillConfig(config);
}

console.time('main');
simple().then(() => console.timeEnd('main'));
