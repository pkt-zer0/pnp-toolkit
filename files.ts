import { copyFileSync, existsSync } from 'node:fs';

export function copyNewerSync(source: string, target: string) {
    if (existsSync(target)) { return; }

    copyFileSync(source, target);
}