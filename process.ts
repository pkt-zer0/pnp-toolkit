import { INPUT_DIR, OUTPUT_DIR, RENAMED_DIR } from './constants';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { copyNewerSync } from './files';

/** Create the output folders */
export function ensureOutDirs() {
    const outDirs = [OUTPUT_DIR, RENAMED_DIR];
    for (const dir of outDirs) {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }
}

/**
 * Copy the contents of multiple source directories to the target, skipping
 * files that already exist.
 */
export function copyDirs(sourceDirs: string[], targetDir: string) {
    for (const subDir of sourceDirs) {
        const sourceDir = path.join(INPUT_DIR, subDir);
        for (const file of readdirSync(sourceDir)) {
            copyNewerSync(
                path.join(sourceDir, file),
                path.join(targetDir, file),
            );
        }
    }
}

const OUTPUT_EXT = '.png';
export function getOutPath(inPath: string) {
    const ext = path.extname(inPath);
    const base = path.basename(inPath, ext);
    return path.join(OUTPUT_DIR, base + OUTPUT_EXT);
}

export async function preprocessNoop(inPath: string) {
    const outPath = getOutPath(inPath);
    copyNewerSync(inPath, outPath);
}
