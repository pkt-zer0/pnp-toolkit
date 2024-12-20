import { createCanvas, ImageData } from 'canvas';

export interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Extracts one section of the input image, defined by the given region. */
export function crop(source: ImageData, region: Region): ImageData {
    const { x, y, width, height } = region;
    const canvas = createCanvas(source.width, source.height);

    const ctx = canvas.getContext('2d');
    ctx.putImageData(source, 0, 0);

    return ctx.getImageData(x, y, width, height);
}

/** Extracts many sections of the input image, defined by the given regions. */
export function cropMany(source: ImageData, regions: Region[]): ImageData[] {
    const canvas = createCanvas(source.width, source.height);

    const ctx = canvas.getContext('2d');
    ctx.putImageData(source, 0, 0);

    return regions.map(r => {
        return ctx.getImageData(r.x, r.y, r.width, r.height);
    });
}

/**
 * Scale up an image to a given size.
 *
 * Keeps aspect ratio by resizing to _at least_ the target size, making sure
 * that area is covered.
 */
export function scaleTo(source: ImageData, targetWidth: number, targetHeight: number): ImageData {
    const { width: srcWidth, height: srcHeight } = source;

    // Keep aspect ratio, fill target size
    const widthRatio = targetWidth / srcWidth;
    const heightRatio = targetHeight / srcHeight;
    const scaleFactor = Math.max(widthRatio, heightRatio);

    const newWidth = Math.ceil(srcWidth * scaleFactor);
    const newHeight = Math.ceil(srcHeight * scaleFactor);

    // Need an extra canvas to pass ImageData to drawImage
    const srcCanvas = createCanvas(source.width, source.height);
    const srcCtx = srcCanvas.getContext('2d');
    const outCanvas = createCanvas(newWidth, newHeight);
    const outCtx = outCanvas.getContext('2d');
    outCtx.imageSmoothingEnabled = true;

    srcCtx.putImageData(source, 0, 0);
    outCtx.drawImage(srcCanvas, 0, 0, newWidth, newHeight);
    return outCtx.getImageData(0, 0, newWidth, newHeight);
}

