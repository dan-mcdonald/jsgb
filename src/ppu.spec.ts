import { expect } from 'chai';
import { Color, makeColor, makeTileImage, screenPalette } from './ppu';
import {createCanvas} from 'canvas';

describe("ppu", (): void => {
  const canvas = createCanvas(160, 144);
  const canvasCtx = canvas.getContext("2d");

  it("makeColor", (): void => {
    const expected = Color(Uint8Array.from([0x12, 0x34, 0x56, 0xff]));
    expect(makeColor("#123456")).to.deep.equal(expected);
  });

  it("makeTileImage", (): void => {
    const tileData = Uint8Array.from([
      0x3C, 0x7E, // 00 10 11 11 11 11 10 00
      0x42, 0x42, // 00 11 00 00 00 00 11 00
      0x42, 0x42, // 00 11 00 00 00 00 11 00
      0x42, 0x42, // 00 11 00 00 00 00 11 00
      0x7E, 0x5E, // 00 11 01 11 11 11 11 00
      0x7E, 0x0A, // 00 01 01 01 11 01 11 00
      0x7C, 0x56, // 00 11 01 11 01 11 10 00
      0x38, 0x7C, // 00 10 11 11 11 10 00 00
    ]);
    const tilePaletteMap = 0xe4; // 3->3, 2->2, 1->1, 0->0
    const actual = makeTileImage(canvasCtx, tileData, tilePaletteMap, screenPalette);
    const expected = Uint8Array.from([]);
    expect(actual).to.equal(expected);
  });
});
