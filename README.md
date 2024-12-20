# Overview

Contains a pipeline of tools that allow you to go from print-and-play PDF files to an MPC project in a single click.

# Process

- Use [pdf24][pdf24]'s "Extract PDF Images" (or equivalent) to dump the images from a PnP PDF file
- Place them in subfolders under `data/in`, along with anything else you'd like to include
- Define the [rename](#renaming) configuration to give files easily identifiable names
- Add image [preprocessing](#preprocessing) steps to split, crop, scale, add bleed, etc. 
- [Setup your batch](#batch-setup) to define what should be included in the project
- [Run](#running) the tool to create the config and images in `data/out`
- Run the MPC [autofill][autofill] desktop tool from that directory

For details, see the headings that follow.

[pdf24]: https://www.pdf24.org/en/
[autofill]: https://github.com/chilli-axe/mpc-autofill

# Renaming

This relies on the image files embedded in PDFs being extracted in a well-defined order, page by page, skipping over
duplicates.

This process is controlled by the `renames` field in GameConfig, a list of `fromIndex` - `toName` pairs specifying the
original index of the extracted file, and the output name for the renamed one.

## Basics

You can specify these directly, but for common cases, there's a shorthand format available. Let's take a simple example:

```typescript
const awesomeGame = config({
    inPrefix: 'Awesome Game',
    outPrefix: 'awsm',
    layout: [`
        123  321
        456  654
    `],
    extractionOrder: [
        ['142536','251436'],
    ],
    startIndex: 2,
});
```

The `in-/outPrefix` fields set up the overall naming scheme: the input files are expected to be in the
`Awesome Game-123` format, with `123` being recognized as the source image index; and these will be converted to
`awsm_F-012` after the rename, with this example being the _front_ side of card number `012`.

The `layout` field indicates what's on a given (printed) page, in two columns of numbers or letters: the first column
being the front side, the second the backside. This should match what you see in a PDF viewer when set to display two
pages side-by-side.

This example shows a game with 6 cards in landscape layout, with the "flip on short edge" setting being used to match up
fronts and backs (thus the mirrored numbers on the right side).

Most of the time, the order images get extracted in is not just a simple row-by-row scheme. This can be explicitly
specified with `extractionOrder`, again having two items per page for the front- and backsides. The numbers used here
should be the same as the one that show up on the page, but can be in any order. In addition, `startIndex` can be used
to change where the extraction starts, e.g. to skip initial rules images.

So with this example configuration, the following renames will happen (only showing the source index and output suffix):

```
 2  ->  F-001   |    8  ->  B-002
 3  ->  F-004   |    9  ->  B-005
 4  ->  F-002   |   10  ->  B-001
 5  ->  F-005   |   11  ->  B-004
 6  ->  F-003   |   12  ->  B-003
 7  ->  F-006   |   13  ->  B-006
```

## Reused images

```typescript
const simpleGame = config({
    inPrefix: 'Simple Game',
    outPrefix: 'smpl',
    layout: [`
        123  BBB
        456  BBB
    `, `
        123  BBB
        456  654
    `],
    extractionOrder: [
        ['142536','B.....'],
        ['142536','.6.5.4'],
    ],
});
```
This config specifies multiple pages: notice how the same 1-6 numbers are reused in both. In the output, they are
shifted accordingly per-page. If this is undesirable, the `shiftNumbers` field can be disabled to treat them like any other letter reference.

In this case, that would be `B`, for a repeating, identical cardback image. Letter references can be reused, even across
pages. In the extracted files, they will only show up the first time they're encountered: the `.` entries there indicate
exactly that. You can also omit them if you want, they're ignored during the processing, it's only useful for visual
alignment.

## Advanced cases

```typescript
const combatGame = config({
    inPrefix: 'Combat Game',
    outPrefix: 'cmbt',
    singleSided: true,
    layout: [`
        AAA
        BBC
        .DD
    `],
    extractionOrder: [
        ['AB-DC'],
    ],
});
```

This example demonstrates the remaining features of the shorthand configuration. The `singleSided` setting indicates
that cardbacks are not present in the file, so `layout` and `extractionOrder` can simply omit information about the back
sides.

There is also an unneeded image in the bottom left corner, that nonetheless gets extracted. To ignore this specific
index for the renames, `extractionOrder` has a `-` at this position. (In the `layout`, this is marked with a `.` and
also ignored)

In complex cases like this one, it might be easier to programmatically create the basic `GameConfig` directly. The
various helper methods implementing the above defaults can be reused independently (e.g. `parseLayout`), and there are
also additional functions specifically for direct use. Here's what the same configuration could look like, without the
shorthand:

```typescript
const c = (letter: string) => card('cmbt-' + letter, 'cmbt-cardback');

const combatGame: GameConfig = {
    inPrefix: 'Combat Game',
    renames: [
        mapping(0, 'cmbt-A'),
        mapping(1, 'cmbt-B'),
        mapping(3, 'cmbt-D'),
        mapping(4, 'cmbt-C'),
    ],
    cards: [
        ...Array(3).fill(c('A')),
        ...Array(2).fill(c('B')),
        ...Array(1).fill(c('C')),
        ...Array(2).fill(c('D')),
    ]
};
```

# Batch setup

Setting up the contents of a project is done through code as well. The simplest example below illustrates the high-level
flow of the process:

```typescript
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
```

The first phase is to rename the raw input files to something easily identifiable. Then, the list of cards to be
included in the MPC project are defined, using the previous names. Finally, the list of card front/back images are used
to generate the config XML for MPC Autofill, and the image files are placed next to it in the `cards` subfolder.

## Advanced example

The code-based nature of the project definition makes it easy to alter in basically whatever way you wish. Suppose you'd
like to add some images as-is, without any of the fancy renaming logic; or you'd want to customize the cardbacks for
some of the cards that _do_ get renamed. The below code shows an example for exactly this. 

```typescript
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
```

# Preprocessing

Several utilities are also included to transform the input images, such as adding bleed, cropping them to a certain
size, or reconstructing corners. The project definition looks a little different in this case:

```typescript
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

```

The key addition is an extra phase in-between the renaming and card list generation: cards are initially copied to the
`RENAMED_DIR`, and only after any additional image processing created in the `OUTPUT_DIR`. This allows caching results
between the stages: any file that already exists in either of these directories does not get overwritten. (Which is
helpful for the relatively time-consuming image transformations!)

The image processing logic is just a function that takes the input filename, and produces one (or multiple) output files
in `OUTPUT_DIR`. It can be parametrized via a wrapper function, in this example to pass a control image defining certain
interesting regions of the inputs.

```typescript
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
```

The various transformation functions provided all take and produce `ImageData` objects, so they are easily chained
together. To start and end the chain by reading/writing files, the `load/saveImageData` are available. For more details,
see the comments on the relevant functions in the `transform` folder.

# Running

This is just a plain TypeScript project. You'll need to have [Node.js][node] installed, then run `npm install` as a
one-time setup. Afterwards you can execute `npm start` to compile and run the code.

[node]: https://nodejs.org/
