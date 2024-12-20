import fs from 'node:fs';
import { finished } from 'node:stream/promises';

import { createCanvas, ImageData, loadImage } from 'canvas';

/** Loads an image from a file for furher processing */
export async function loadImageData(path: string): Promise<ImageData> {
    const image = await loadImage(path);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw original, populate control canvas
    ctx.drawImage(image, 0, 0);

    return ctx.getImageData(0, 0, image.width, image.height);
}

/** Saves an image to a file at the end of processing */
export async function saveImageData(path: string, pixels: ImageData): Promise<void> {
    const canvas = createCanvas(pixels.width, pixels.height);
    const ctx = canvas.getContext('2d');

    ctx.putImageData(pixels, 0, 0);

    const out = fs.createWriteStream(path);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    await finished(out);
}