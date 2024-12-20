import { createCanvas, ImageData } from 'canvas';
import { getPixel, hasColor, PixelData, setPixel } from './util';
import { sortBy } from 'lodash';

/**
 * Fills out parts of an image by extending pixels targeted by a control image
 * in an orthogonal direction.
 *
 * The color of a pixel at a given position on the control image determines
 * what to do with the same position in the source image.
 *
 * The colour at a given position will be used to fill all pixels until the
 * edge of the image, in the direction given by the corresponding pixel of the
 * control image:
 *
 * - Red   (#F00) -> Left
 * - Green (#0F0) -> Up
 * - Blue  (#00F) -> Right
 * - Black (#000) -> Down
 *
 * - Transparent (zero alpha) -> Do nothing
 */
export function extendSides(source: ImageData, control: ImageData): ImageData {
    const width = source.width;
    const height = source.height;

    for (let x = 0; x < control.width;  x += 1) {
        for (let y = 0; y < control.height; y += 1) {
            const [cr, cg, cb, ca] = getPixel(control.data, width, x, y);
            if (ca === 0) {
                continue;
            }

            // Extend source image to left
            const originalColor = getPixel(source.data, width, x, y);
            const [r,g,b,a] = originalColor;

            // Based on control pixel, select direction
            // Red: LEFT
            if (cr === 255) {
                for (let currentX = 0; currentX < x; currentX += 1) {
                    setPixel(source, currentX, y, r, g, b, a);
                }
            }
            // Green: UP
            else if (cg === 255) {
                // UP: green
                for (let currentY = 0; currentY < y; currentY += 1) {
                    setPixel(source, x, currentY, r, g, b, a);
                }
            }
            // Blue: RIGHT
            else if (cb === 255) {
                for (let currentX = x + 1; currentX < width; currentX += 1) {
                    setPixel(source, currentX, y, r, g, b, a);
                }
            }
            // Black: DOWN (or any non-transparent color)
            else {
                for (let currentY = y + 1; currentY < height; currentY += 1) {
                    setPixel(source, x, currentY, r, g, b, a);
                }
            }
        }
    }

    return source;
}

const TWO_PI = Math.PI * 2;

const CENTER_COLOR : PixelData = [0,   255, 0,   255];
const EDGE_COLOR   : PixelData = [255, 0,   255, 255];
const TARGET_COLOR : PixelData = [0,   0,   0,   255];

interface Sample {
    angle: number;
    color: PixelData;
}

function lerpSamples(before: Sample, after: Sample, angle: number): PixelData {
    if (before === after) {
        return before.color;
    }
    const distance = after.angle - before.angle;
    const beforeInfluence = (after.angle - angle) / distance;
    const afterInfluence =  (angle - before.angle) / distance;

    return [
        beforeInfluence * before.color[0] + afterInfluence * after.color[0],
        beforeInfluence * before.color[1] + afterInfluence * after.color[1],
        beforeInfluence * before.color[2] + afterInfluence * after.color[2],
        beforeInfluence * before.color[3] + afterInfluence * after.color[3],
    ];
}

/** Adjust angle to always be in the positive/negative range for the top/bottom halves */
function adjustedAngle(bottomHalf: boolean, rawAngle: number): number {
    if (bottomHalf) {
        return rawAngle <= 0 ? rawAngle : rawAngle - TWO_PI;
    } else {
        return rawAngle >= 0 ? rawAngle : rawAngle + TWO_PI;
    }
}

function refillCorner(sourcePixels: ImageData, controlPixels: ImageData, bottomHalf: boolean): ImageData {
    const height = controlPixels.height;
    const width = controlPixels.width;
    const result = new ImageData(sourcePixels.data, width, height);

    // Find center
    let centerX: number | undefined;
    let centerY: number | undefined;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (!hasColor(controlPixels.data, width, x, y, CENTER_COLOR)) {
                continue;
            }

            centerX = x;
            centerY = y;
        }
    }
    if (centerX === undefined || centerY === undefined) {
        console.warn('No center defined!');
        process.exit(1);
    }

    // Collect samples
    const unsortedSamples: Sample[] = [];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (!hasColor(controlPixels.data, width, x, y, EDGE_COLOR)) {
                continue;
            }

            const color = getPixel(sourcePixels.data, width, x, y);
            const angle = adjustedAngle(bottomHalf, Math.atan2(centerY - y, x - centerX));
            unsortedSamples.push({ angle, color });
        }
    }

    const samples = sortBy(unsortedSamples, s => s.angle);

    // Refill corners
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (!hasColor(controlPixels.data, width, x, y, TARGET_COLOR)) {
                continue;
            }

            const angle = adjustedAngle(bottomHalf, Math.atan2(centerY - y, x - centerX));
            // Handle fallbacks in case current angle is before/after the sampled range
            const sampleBefore = samples.findLast(s => s.angle <= angle) ?? samples[0];
            const sampleAfter  = samples.find    (s => s.angle >= angle) ?? samples[samples.length -1];
            const color = lerpSamples(sampleBefore, sampleAfter, angle);
            setPixel(result, x, y, ...color);
        }
    }

    return result;
}

/**
 * Fills out parts of an image by extending pixels targeted by a control image
 * radially for each corner.
 *
 * The image is divided into four equal segments (one for each corner), where
 * colours on the control image indicate how the respective pixels in the
 * source image are to be treated:
 *
 * - Green (#0F0) -> CENTER
 * - Pink  (#F0F) -> EDGE
 * - Black (#000) -> TARGET
 * - Transparent (zero alpha) -> Ignored
 *
 * For each pixel marked as a TARGET, the angle of a ray cast from the CENTER is
 * calculated. Then, its color is linearly interpolated from the two EDGE pixels
 * that are nearest to it in angle (one "before", one "after").
 *
 * In this way, whatever color is present in the EDGE pixels is extended to the
 * TARGET ones by drawing a line through the CENTER.
 *
 * */
export function extendCorners(source: ImageData, control: ImageData): ImageData {
    const width = source.width;
    const height = source.height;

    // Setup contexts
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const controlCanvas = createCanvas(control.width, control.height);
    const controlCtx = controlCanvas.getContext('2d');

    // Draw original, populate control canvas
    ctx.putImageData(source, 0, 0);
    controlCtx.putImageData(control, 0, 0);

    const cutoffX = Math.ceil(width / 2);
    const cutoffY = Math.ceil(height / 2);

    const segments = [
        [false, 0      , cutoffX, 0      , cutoffY], // Top left
        [false, cutoffX, width  , 0      , cutoffY], // Top right
        [true , 0      , cutoffX, cutoffY, height ], // Bottom left
        [true , cutoffX, width  , cutoffY, height ], // Bottom right
    ] as const;

    for (let [bottomHalf, fromX, toX, fromY, toY] of segments) {
        const sw = toX - fromX;
        const sh = toY - fromY;

        const sourcePixels  =        ctx.getImageData(fromX, fromY, sw, sh);
        const controlPixels = controlCtx.getImageData(fromX, fromY, sw, sh);

        const fillData = refillCorner(sourcePixels, controlPixels, bottomHalf);
        ctx.putImageData(fillData, fromX, fromY);
    }

    return ctx.getImageData(0,0,width, height);
}
