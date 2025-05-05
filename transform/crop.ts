import { createCanvas, ImageData } from 'canvas';

/** A rectangle specified by its top left coordinates and width / height */
export interface Region {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Create a region from top left (inclusive) and bottom right (exclusive) coordinates */
export function regionFromBounds(
    xFrom: number, xTo: number,
    yFrom: number, yTo: number,
): Region {
    return {
        x: xFrom,
        y: yFrom,
        w: xTo - xFrom,
        h: yTo - yFrom,
    };
}

/**
 * Creates the regions between the given horizontal and vertical lines, leaving
 * gaps between each subsequent pair of lines.
 *
 * For example, given the lines below:
 *
 * H: [1, 2, 3, 4]; V: [5, 6, 7, 8]
 *
 * The result would be the following regions (horizontal / vertical boundaries):
 *
 * - (1-2, 5-6)
 * - (1-2, 7-8)
 * - (3-4, 5-6)
 * - (3-4, 7-8)
 */
export function regionsBetweenLines(horizontal: number[], vertical: number[]): Region[] {
    if (horizontal.length % 2 !== 0 || vertical.length % 2 !== 0) {
        throw RangeError("Length of both input arrays must be even.");
    }

    const result: Region[] = [];
    for (let h = 0; h < horizontal.length / 2; h += 1) {
        for (let v = 0; v < vertical.length / 2; v += 1) {
            result.push(regionFromBounds(
                vertical  [v * 2], vertical  [v * 2 + 1],
                horizontal[h * 2], horizontal[h * 2 + 1],
            ));
        }
    }

    return result;
}

/**
 * Creates the regions between the given horizontal and vertical lines, where
 * each line is a shared boundary between the two neighboring regions.
 *
 * For example, given the lines below:
 *
 * H: [1, 2, 3]; V: [5, 6, 7]
 *
 * The result would be the following regions (horizontal / vertical boundaries):
 *
 * - (1-2, 5-6)
 * - (1-2, 6-7)
 * - (2-3, 5-6)
 * - (2-3, 6-7)
 */
export function regionsBetweenSharedLines(horizontal: number[], vertical: number[]): Region[] {
    if (horizontal.length <= 2 || vertical.length <= 2) {
        throw RangeError("Both input arrays must contain at least 2 items.");
    }

    const result: Region[] = [];
    for (let h = 0; h < horizontal.length - 1; h += 1) {
        for (let v = 0; v < vertical.length - 1; v += 1) {
            result.push(regionFromBounds(
                vertical[v], vertical[v + 1],
                horizontal[h], horizontal[h + 1],
            ));
        }
    }

    return result;
}

/** Extends the region outwards by an equal amount in each direction */
export function padRegion(original: Region, padding: number): Region {
    return {
        x: original.x - padding,
        y: original.y - padding,
        w: original.w + 2 * padding,
        h: original.h + 2 * padding,
    };
}

/** Returns a region covering the two inputs */
export function mergeRegions(r1: Region, r2: Region): Region {
    const xFrom = Math.min(r1.x, r2.x);
    const yFrom = Math.min(r1.y, r2.y);
    const xEnd  = Math.max(r1.x + r1.w, r2.x + r2.w);
    const yEnd  = Math.max(r1.y + r1.h, r2.y + r2.h);

    return {
        x: xFrom,
        y: yFrom,
        w: xEnd - xFrom,
        h: yEnd - yFrom,
    };
}

/**
 * Generates regions starting from the top left one, and repeated for the number
 * of row / columns, with the given horizontal / vertical gaps in-between each
 * neighboring cell.
 */
export function regionGrid(
    initial: Region,
    gapX: number, gapY: number,
    columns: number, rows: number,
): Region[] {
    const result: Region[] = [];

    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < columns; c += 1) {
            result.push({
                x: initial.x + c * (initial.w + gapX),
                y: initial.y + r * (initial.h + gapY),
                w: initial.w,
                h: initial.h,
            });
        }
    }
    return result;
}

/** Extracts one section of the input image, defined by the given region. */
export function crop(source: ImageData, region: Region): ImageData {
    const { x, y, w, h } = region;
    const canvas = createCanvas(source.width, source.height);

    const ctx = canvas.getContext('2d');
    ctx.putImageData(source, 0, 0);

    return ctx.getImageData(x, y, w, h);
}

/** Extracts many sections of the input image, defined by the given regions. */
export function cropMany(source: ImageData, regions: Region[]): ImageData[] {
    const canvas = createCanvas(source.width, source.height);

    const ctx = canvas.getContext('2d');
    ctx.putImageData(source, 0, 0);

    return regions.map(r => {
        return ctx.getImageData(r.x, r.y, r.w, r.h);
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
    const widthRatio  = targetWidth / srcWidth;
    const heightRatio = targetHeight / srcHeight;
    const scaleFactor = Math.max(widthRatio, heightRatio);

    const newWidth  = Math.ceil(srcWidth * scaleFactor);
    const newHeight = Math.ceil(srcHeight * scaleFactor);

    // Need an extra canvas to pass ImageData to drawImage
    const srcCanvas = createCanvas(source.width, source.height);
    const outCanvas = createCanvas(newWidth, newHeight);
    const srcCtx    = srcCanvas.getContext('2d');
    const outCtx    = outCanvas.getContext('2d');
    outCtx.imageSmoothingEnabled = true;

    srcCtx.putImageData(source, 0, 0);
    outCtx.drawImage(srcCanvas, 0, 0, newWidth, newHeight);
    return outCtx.getImageData(0, 0, newWidth, newHeight);
}
