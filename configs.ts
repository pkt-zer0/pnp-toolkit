import { config } from './layout';

export const awesomeGame = config({
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

export const simpleGame = config({
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

export const combatGame = config({
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