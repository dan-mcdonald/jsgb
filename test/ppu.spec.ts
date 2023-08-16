import { expect } from 'chai';
import { Color, Palette, makeColor, makeTileImage } from '../src/ppu';
import {createCanvas, loadImage} from 'canvas';
import type {ImageData as NodeImageData, Image as NodeImage} from 'canvas';

function imageToData(image: NodeImage): NodeImageData {
  const canvas = createCanvas(image.width, image.height);
  const canvasCtx = canvas.getContext("2d");
  canvasCtx.drawImage(image, 0, 0);
  return canvasCtx.getImageData(0, 0, image.width, image.height);
}

describe("ppu", (): void => {
  const canvas = createCanvas(160, 144);
  const canvasCtx = canvas.getContext("2d");

  // High-contrast screen palette
  const screenPalette: Palette = {
    0: makeColor("#FFFFFF"),
    1: makeColor("#A5A5A5"),
    2: makeColor("#525252"),
    3: makeColor("#000000"),
  };

  it("makeColor", (): void => {
    const expected = Color(Uint8Array.from([0x12, 0x34, 0x56, 0xff]));
    expect(makeColor("#123456")).to.deep.equal(expected);
  });

  it("makeTileImage", async (): Promise<void> => {
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
    const expected = imageToData(await loadImage("./test/fixtures/gb-test-tile1.png"));
    expect(actual).to.deep.equal(expected);
  });
});
