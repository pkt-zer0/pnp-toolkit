import { createCanvas, ImageData } from 'canvas';

const COPIES = [
    { scaleX: -1, scaleY: 1, shiftX: 0, shiftY: 0 }, // Left
    { scaleX: -1, scaleY: 1, shiftX: 2, shiftY: 0 }, // Right
    { scaleX: 1, scaleY: -1, shiftX: 0, shiftY: 0 }, // Top
    { scaleX: 1, scaleY: -1, shiftX: 0, shiftY: 2 }, // Bottom

    { scaleX: -1, scaleY: -1, shiftX: 0, shiftY: 0 }, // Top left
    { scaleX: -1, scaleY: -1, shiftX: 2, shiftY: 0 }, // Top right
    { scaleX: -1, scaleY: -1, shiftX: 0, shiftY: 2 }, // Bottom left
    { scaleX: -1, scaleY: -1, shiftX: 2, shiftY: 2 }, // Bottom right
];

/** Adds bleed to an image by creating mirrored duplicates around its edges. */
export function addBleed(source: ImageData, padding: number): ImageData {
    const width = source.width;
    const height = source.height;

    const paddedWidth = width + 2 * padding;
    const paddedHeight = height + 2 * padding;
    const canvas = createCanvas(paddedWidth, paddedHeight);
    const ctx = canvas.getContext('2d');

    // Draw the raw pixels to a canvas, so they can be passed to drawImage() and rotated correctly
    const sourceCanvas = createCanvas(width, height);
    const sourceCtx = sourceCanvas.getContext('2d');
    sourceCtx.putImageData(source, 0, 0);

    // Original image
    ctx.drawImage(sourceCanvas, padding, padding);

    // Mirrored copies around the edge
    for (const { scaleX, scaleY, shiftX, shiftY } of COPIES) {
        ctx.save();
        ctx.translate(shiftX * width + padding, shiftY * height + padding);
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.restore();
    }

    return ctx.getImageData(0, 0, paddedWidth, paddedHeight);
}

/**
 * Adds a solid color area of the given size around the source image.
 * Suitable for generating bleed where a card has a uniformly colored border.
 */
export function addBleedSolid(
    source: ImageData, padding: number, fill: string
): ImageData {
    const width = source.width;
    const height = source.height;

    const paddedWidth = width + 2 * padding;
    const paddedHeight = height + 2 * padding;
    const canvas = createCanvas(paddedWidth, paddedHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, paddedWidth, paddedHeight);

    // Original image
    ctx.putImageData(source, padding, padding);

    return ctx.getImageData(0, 0, paddedWidth, paddedHeight);
}
