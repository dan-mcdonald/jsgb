import { expect } from 'chai';
import { Color, Palette, makeColor, colorForPaletteIndexBg, colorForPaletteIndexObj, makeTilePaletteImage, makeTilePaletteRow, makeBgTileImage, TileData, TilePaletteData, getBgTileIndex, ppuBuild } from '../src/ppu';
import { createCanvas, loadImage, ImageData } from 'canvas';
import type { ImageData as NodeImageData, Image as NodeImage } from 'canvas';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

// use canvas to polyfill ImageData when running tests in node
(global as { [key: string]: any })["ImageData"] = ImageData; // eslint-disable-line @typescript-eslint/no-explicit-any

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
  const screenPalette = Palette(
    makeColor("#FFFFFF"),
    makeColor("#A5A5A5"),
    makeColor("#525252"),
    makeColor("#000000"),
  );

  it("makeColor", (): void => {
    const expected = Color(Uint8Array.from([0x12, 0x34, 0x56, 0xff]));
    expect(makeColor("#123456")).to.deep.equal(expected);
  });

  // palette 3=black 2=dark gray 1=light gray, 0=white 11 10 01 00 0xe4
  const paletteNormal = 0xe4;
  // palette 3=white 2=light gray 1=dark gray, 0=black 00 01 10 11 0x1b
  const paletteInverted = 0x1b;

  it("colorForPaletteIndexBg", (): void => {
    for (let i = 0; i < 4; i++) {
      expect(colorForPaletteIndexBg(screenPalette, paletteNormal, i)).to.deep.equal(screenPalette[i]);
    }
    for (let i = 0; i < 4; i++) {
      expect(colorForPaletteIndexBg(screenPalette, paletteInverted, i)).to.deep.equal(screenPalette[3 - i]);
    }
  });

  it("colorForPaletteIndexObj", (): void => {
    const transparent = Color(Uint8Array.from([0, 0, 0, 0]));
    // palette 3=black 2=dark gray 1=light gray, 0=white 11 10 01 00 0xe4
    for (let i = 0; i < 4; i++) {
      const actual = colorForPaletteIndexObj(screenPalette, paletteNormal, i);
      const expected = i === 0 ? transparent : screenPalette[i];
      expect(actual).to.deep.equal(expected);
    }
    // palette 3=white 2=light gray 1=dark gray, 0=black 00 01 10 11 0x1b
    for (let i = 0; i < 4; i++) {
      const actual = colorForPaletteIndexObj(screenPalette, paletteInverted, i);
      const expected = i === 0 ? transparent : screenPalette[3 - i];
      expect(actual).to.deep.equal(expected);
    }
  });

  it("makeTilePaletteRow", (): void => {
    expect(makeTilePaletteRow(0x7C, 0x56)).to.deep.equal(Uint8ClampedArray.from([0, 3, 1, 3, 1, 3, 2, 0]));
  });

  const tileDataGb = TileData(Uint8ClampedArray.from([
    0x3C, 0x7E, // 00 10 11 11 11 11 10 00
    0x42, 0x42, // 00 11 00 00 00 00 11 00
    0x42, 0x42, // 00 11 00 00 00 00 11 00
    0x42, 0x42, // 00 11 00 00 00 00 11 00
    0x7E, 0x5E, // 00 11 01 11 11 11 11 00
    0x7E, 0x0A, // 00 01 01 01 11 01 11 00
    0x7C, 0x56, // 00 11 01 11 01 11 10 00
    0x38, 0x7C, // 00 10 11 11 11 10 00 00
  ]));

  it("makeTilePaletteImage", (): void => {
    const expected = TilePaletteData(Uint8ClampedArray.from([
      0, 2, 3, 3, 3, 3, 2, 0,
      0, 3, 0, 0, 0, 0, 3, 0,
      0, 3, 0, 0, 0, 0, 3, 0,
      0, 3, 0, 0, 0, 0, 3, 0,
      0, 3, 1, 3, 3, 3, 3, 0,
      0, 1, 1, 1, 3, 1, 3, 0,
      0, 3, 1, 3, 1, 3, 2, 0,
      0, 2, 3, 3, 3, 2, 0, 0,
    ]));
    expect(makeTilePaletteImage(tileDataGb)).to.deep.equal(expected);
  });

  it("makeBgTileImage", async (): Promise<void> => {
    const tilePaletteData = makeTilePaletteImage(tileDataGb);
    const actual = makeBgTileImage(tilePaletteData, paletteNormal, screenPalette);
    canvasCtx.putImageData(actual, 0, 0);
    const out = createWriteStream("./dist/gb-test-tile1.png");
    await pipeline(canvas.createPNGStream(), out);
    const expected = imageToData(await loadImage("./test/fixtures/gb-test-tile1.png"));
    expect(actual).to.deep.equal(expected);
  });

  it("getBgTileIndex", (): void => {
    const ppu = ppuBuild();
    ppu.vram[0x992D-0x8000] = 0x16; 
    expect(getBgTileIndex(ppu, 0x0, 0x0)).to.equal(0x0);
    expect(getBgTileIndex(ppu, 0x0D, 0x09)).to.equal(0x16);
  });
});
