import { join } from 'node:path';
import { readdirSync } from 'node:fs';

import { GameConfig } from './layout';
import { escapeRegex } from './utils';
import { INPUT_DIR } from './constants';
import { copyNewerSync } from './files';

export function renameExtractedImages(targetDir: string, config: GameConfig) {
    const sourceDir = join(INPUT_DIR, `${config.inPrefix}.pdf`);

    const files = readdirSync(sourceDir);
    const renames = config.renames;
    const targetNameLookup = {};
    for (const rename of renames) {
        targetNameLookup[rename.fromIndex] = rename.toName;
    }

    const regexpStr = `${escapeRegex(config.inPrefix)}-(?<index>\\d+).(?<ext>\\w+)`;
    const filenameRegex = new RegExp(regexpStr);

    for (const filename of files) {
        const matches = filenameRegex.exec(filename);
        if (!matches || !matches.groups) {
            console.error('Failed to parse: ' + filename);
            continue;
        }

        const { index, ext } = matches.groups;
        const numIndex = parseInt(index, 10);
        const renamedIndex = targetNameLookup[numIndex];

        if (renamedIndex) {
            const newName = renamedIndex + '.' + ext;

            copyNewerSync(
                join(sourceDir, filename),
                join(targetDir, newName),
            );
        }
    }
}
