import { expect } from 'chai';
import * as PPU from '../src/ppu';
import { load } from "../src/bess";
import { createCanvas, loadImage, ImageData } from 'canvas';
import type { ImageData as NodeImageData, Image as NodeImage } from 'canvas';
// import { pipeline } from 'node:stream/promises';
// import { createWriteStream } from 'node:fs';
import { readFile } from "node:fs/promises";
import { hex16 } from '../src/util';

// use canvas to polyfill ImageData when running tests in node
(global as { [key: string]: any })["ImageData"] = ImageData; // eslint-disable-line @typescript-eslint/no-explicit-any
(global as { [key: string]: any })["OffscreenCanvas"] = createCanvas; // eslint-disable-line @typescript-eslint/no-explicit-any

function imageToData(image: NodeImage): NodeImageData {
  const canvas = createCanvas(image.width, image.height);
  const canvasCtx = canvas.getContext("2d");
  canvasCtx.drawImage(image, 0, 0);
  return canvasCtx.getImageData(0, 0, image.width, image.height);
}

async function postBootPPU(): Promise<PPU.PPU> {
  const ppu = new PPU.PPU();
  const bess = load(await readFile("test/fixtures/bootend.sna"));
  bess.vram.forEach((v, i) => {ppu.writeVram(i, v);});
  bess.ioregs.slice(0x40, 0x40 + PPU.REG_SIZE).forEach((v, i) => {ppu.writeIo(i, v);});
  return ppu;
}

describe("ppu", (): void => {
  // High-contrast screen palette
  const screenPalette = PPU.Palette(
    PPU.makeColor("#FFFFFF"),
    PPU.makeColor("#A5A5A5"),
    PPU.makeColor("#525252"),
    PPU.makeColor("#000000"),
  );

  it("makeColor", (): void => {
    const expected = PPU.Color(Uint8Array.from([0x12, 0x34, 0x56, 0xff]));
    expect(PPU.makeColor("#123456")).to.deep.equal(expected);
  });

  // palette 3=black 2=dark gray 1=light gray, 0=white 11 10 01 00 0xe4
  const paletteNormal = 0xe4;
  // palette 3=white 2=light gray 1=dark gray, 0=black 00 01 10 11 0x1b
  const paletteInverted = 0x1b;

  it("colorForPaletteIndexBg", (): void => {
    for (let i = 0; i < 4; i++) {
      expect(PPU.colorForPaletteIndexBg(screenPalette, paletteNormal, i)).to.deep.equal(screenPalette[i]);
    }
    for (let i = 0; i < 4; i++) {
      expect(PPU.colorForPaletteIndexBg(screenPalette, paletteInverted, i)).to.deep.equal(screenPalette[3 - i]);
    }
  });

  it("colorForPaletteIndexObj", (): void => {
    const transparent = PPU.Color(Uint8Array.from([0, 0, 0, 0]));
    // palette 3=black 2=dark gray 1=light gray, 0=white 11 10 01 00 0xe4
    for (let i = 0; i < 4; i++) {
      const actual = PPU.colorForPaletteIndexObj(screenPalette, paletteNormal, i);
      const expected = i === 0 ? transparent : screenPalette[i];
      expect(actual).to.deep.equal(expected);
    }
    // palette 3=white 2=light gray 1=dark gray, 0=black 00 01 10 11 0x1b
    for (let i = 0; i < 4; i++) {
      const actual = PPU.colorForPaletteIndexObj(screenPalette, paletteInverted, i);
      const expected = i === 0 ? transparent : screenPalette[3 - i];
      expect(actual).to.deep.equal(expected);
    }
  });

  it("makeTilePaletteRow", (): void => {
    expect(PPU.makeTilePaletteRow(0x7C, 0x56)).to.deep.equal(Uint8Array.from([0, 3, 1, 3, 1, 3, 2, 0]));
  });

  const tileDataGb = PPU.TileData(Uint8Array.from([
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
    const expected = PPU.TilePaletteData(Uint8Array.from([
      0, 2, 3, 3, 3, 3, 2, 0,
      0, 3, 0, 0, 0, 0, 3, 0,
      0, 3, 0, 0, 0, 0, 3, 0,
      0, 3, 0, 0, 0, 0, 3, 0,
      0, 3, 1, 3, 3, 3, 3, 0,
      0, 1, 1, 1, 3, 1, 3, 0,
      0, 3, 1, 3, 1, 3, 2, 0,
      0, 2, 3, 3, 3, 2, 0, 0,
    ]));
    expect(PPU.makeTilePaletteImage(tileDataGb)).to.deep.equal(expected);
  });

  it("makeBgTileImage", async (): Promise<void> => {
    const tilePaletteData = PPU.makeTilePaletteImage(tileDataGb);
    const actual = PPU.makeBgTileImage(tilePaletteData, paletteNormal, screenPalette);
    // const tileCanvas = createCanvas(160, 144);
    // const tileCtx = tileCanvas.getContext("2d");
    // tileCtx.putImageData(actual, 0, 0);
    // const out = createWriteStream("./dist/gb-test-tile1.png");
    // await pipeline(tileCanvas.createPNGStream(), out);
    const expected = imageToData(await loadImage("./test/fixtures/gb-test-tile1.png"));
    expect(actual).to.deep.equal(expected);
  });

  it("getBgTileIndex", async (): Promise<void> => {
    const ppu = await postBootPPU();
    expect(ppu._getBgTileIndex(0x0, 0x0)).to.equal(0x0);
    expect(ppu._getBgTileIndex(0x0D, 0x09)).to.equal(0x16);
  });

  it("bgTileImageVramOffset", (): void => {
    expect(PPU.bgTileImageVramOffset(true, 0)).to.equal(0);
    expect(PPU.bgTileImageVramOffset(true, 1)).to.equal(16 * 1);
    expect(PPU.bgTileImageVramOffset(true, 128)).to.equal(16 * 128);
    expect(PPU.bgTileImageVramOffset(true, 129)).to.equal(16 * 129);

    expect(PPU.bgTileImageVramOffset(false, 0)).to.equal(0x1000 + 0 * 0);
    expect(PPU.bgTileImageVramOffset(false, 1)).to.equal(0x1000 + 16 * 1);
    expect(PPU.bgTileImageVramOffset(false, 0xff)).to.equal(0x1000 - 16);
    expect(PPU.bgTileImageVramOffset(false, 0xfe)).to.equal(0x1000 - 16*2);

    for(let i = 0; i < 256; i++) {
      if (i < 128) {
        expect(PPU.bgTileImageVramOffset(false, i) - 0x1000).to.equal(PPU.bgTileImageVramOffset(true, i));
      }
      // else {
      //   expect(bgTileImageVramOffset(true, i)).to.equal(bgTileImageVramOffset(false, i));
      // }
    }
  });

  it("makeBgImage", async (): Promise<void> => {
    const ppu = await postBootPPU();
    const actualImage = ppu._makeBgImage();
    // await pipeline(bgCanvas.createPNGStream(), createWriteStream("./dist/bootend-bg.png"));
    const expectedBootBg = imageToData(await loadImage("./test/fixtures/bootend-bg.png"));
    expect(actualImage).to.deep.equal(expectedBootBg);
  });

  it("ly timing", () => {
    const ppu = new PPU.PPU();
    const bus = {
      readb: (addr: number): number => { throw new Error("unhandled read to addr " + hex16(addr)); },
      writeb: (_: number, __: number): void => { },
    };
    expect(ppu._LY).to.equal(0);
    expect(ppu._lineDot).to.equal(0);
    expect(ppu._mode).to.equal(PPU.Mode.TWO);
    // LCD is initially disabled so expect no change
    ppu.tick(bus);
    expect(ppu._LY).to.equal(0);
    expect(ppu._lineDot).to.equal(0);
    expect(ppu._mode).to.equal(PPU.Mode.TWO);
    ppu._LCDC = 0x91;
    
    // Tick through a line
    for(let i = 0; i < 456; i++) {
      ppu.tick(bus);
      expect(ppu._lineDot).to.equal((i+1) % 456);
    }
    expect(ppu._LY).to.equal(1);
  });
});
