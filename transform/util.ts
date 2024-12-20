import { ImageData } from 'canvas';

export type PixelData = [number, number, number, number];

const PIXEL_SIZE = 4; // Not sure if alpha channel / bit depth can be detected
export function setPixel(
    image: ImageData,
    x: number, y: number,
    r: number, g: number, b: number, a: number,
) {
    const index = PIXEL_SIZE * (x + y * image.width);

    image.data[index    ] = r;
    image.data[index + 1] = g;
    image.data[index + 2] = b;
    image.data[index + 3] = a;
}

// NOTE: Non-allocating variant saves ~10ms
export function getPixel(pixels: Uint8ClampedArray, width: number, x: number, y: number): PixelData {
    const index = PIXEL_SIZE * (x + y * width);

    return [
        pixels[index    ],
        pixels[index + 1],
        pixels[index + 2],
        pixels[index + 3],
    ];
}
export function hasColor(pixels: Uint8ClampedArray, width: number, x: number, y: number, color: PixelData) {
    const actual = getPixel(pixels, width, x, y);

    return (actual[0] === color[0]
        &&  actual[1] === color[1]
        &&  actual[2] === color[2]
        &&  actual[3] === color[3]
    );
}

