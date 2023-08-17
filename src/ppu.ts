import { Bus } from "./bus";
import { hex8 } from "./util";
import { Interrupt, setInterrupt } from "./interrupt";

import type { CanvasRenderingContext2D as NodeCanvasRenderingContext2D } from "canvas";
import type { ImageData as NodeImageData } from "canvas";

interface Color { bytes: Uint8Array }
export type Palette = Color[];

export function Palette(white: Color, lightGray: Color, darkGray: Color, black: Color): Palette {
  return [white, lightGray, darkGray, black];
}

export function Color(bytes: Uint8Array): Color {
  return { bytes };
}

export function makeColor(hexColor: string): Color {
  const color = new Uint8Array(4);
  color[0] = parseInt(hexColor.slice(1, 3), 16);
  color[1] = parseInt(hexColor.slice(3, 5), 16);
  color[2] = parseInt(hexColor.slice(5, 7), 16);
  color[3] = 0xFF;
  return Color(color);
}

// High-contrast screen palette
export const screenPalette = Palette(
  makeColor("#FFFFFF"),
  makeColor("#A5A5A5"),
  makeColor("#525252"),
  makeColor("#000000"),
);

export function colorForPaletteIndexBg(screen: Palette, palette: number, index: number): Color {
  return screen[(palette >> (index * 2)) & 0x03];
}

export function colorForPaletteIndexObj(screen: Palette, palette: number, index: number): Color {
  if (index === 0) {
    return Color(Uint8Array.from([0, 0, 0, 0]));
  }
  return colorForPaletteIndexBg(screen, palette, index);
}

export function makeTilePaletteRow(byte1: number, byte2: number): Uint8ClampedArray {
  const row = new Uint8ClampedArray(8);
  for (let i = 0; i < 8; i++) {
    // byte2 holds the high bits of the color, byte1 holds the low bits
    const highBit = (byte2 >> (7 - i)) & 0x01;
    const lowBit = (byte1 >> (7 - i)) & 0x01;
    row[i] = (highBit << 1) | lowBit;
  }
  return row;
}

export interface TileData {
  tileData: Uint8ClampedArray;
}

export function TileData(tileData: Uint8ClampedArray): TileData {
  if (tileData.length !== 16) {
    throw new Error(`Invalid tile data length ${tileData.length}`);
  }
  return { tileData };
}

export interface TilePaletteData {
  tilePaletteData: Uint8ClampedArray;
}

export function TilePaletteData(tilePaletteData: Uint8ClampedArray): TilePaletteData {
  if (tilePaletteData.length !== 64) {
    throw new Error(`Invalid tile data length ${tilePaletteData.length}`);
  }
  return { tilePaletteData };
}

export function makeTilePaletteImage(tile: TileData): TilePaletteData {
  const tileData = tile.tileData;
  const image = new Uint8ClampedArray(8 * 8);
  for (let i = 0; i < 8; i++) {
    const row = makeTilePaletteRow(tileData[i * 2], tileData[i * 2 + 1]);
    image.set(row, i * 8);
  }
  return TilePaletteData(image);
}

export function makeBgTileImage(
  canvasCtx: CanvasRenderingContext2D | NodeCanvasRenderingContext2D,
  tilePalette: TilePaletteData,
  palette: number, screenPalette: Palette): ImageData | NodeImageData {
  const image = canvasCtx.createImageData(8, 8);
  const tilePaletteData = tilePalette.tilePaletteData;
  for (let i = 0; i < 8 * 8; i++) {
    const color = colorForPaletteIndexBg(screenPalette, palette, tilePaletteData[i]);
    image.data[i * 4 + 0] = color.bytes[0];
    image.data[i * 4 + 1] = color.bytes[1];
    image.data[i * 4 + 2] = color.bytes[2];
    image.data[i * 4 + 3] = color.bytes[3];
  }
  return image;
}

enum Register {
  LCDC = 0x0,
  STAT = 0x1,
  SCY = 0x2,
  SCX = 0x3,
  LY = 0x4,
  LYC = 0x5,
  DMA = 0x6,
  BGP = 0x7,
  OBP0 = 0x8,
  OBP1 = 0x9,
  WY = 0xA,
  WX = 0xB,
}

enum Mode {
  ZERO,
  ONE,
  TWO,
  THREE,
}

export interface PPU {
  ioRegs: Uint8Array;
  vram: Uint8Array;
  oam: Uint8Array;
  lineDot: number;
}

export function ppuBuild(): PPU {
  return {
    ioRegs: new Uint8Array(0xB + 1),
    vram: new Uint8Array(0x2000),
    oam: new Uint8Array(0xA0),
    lineDot: 0,
  };
}

const statModeMask = 0x03;

function getMode(ppu: PPU): Mode {
  return (ppu.ioRegs[Register.STAT] & statModeMask) as Mode;
}

function setMode(ppu: PPU, mode: Mode): void {
  ppu.ioRegs[Register.STAT] = (ppu.ioRegs[Register.STAT] & (~statModeMask)) | mode;
}

function getLine(ppu: PPU): number {
  return ppu.ioRegs[Register.LY];
}

function setLine(ppu: PPU, line: number): void {
  ppu.ioRegs[Register.LY] = line;
}

function getDMASrcAddr(ppu: PPU): number | null {
  const regVal = ppu.ioRegs[Register.DMA];
  if (regVal == 0) {
    return null;
  }
  if (regVal >= 0x00 && regVal <= 0xF1) {
    return regVal * 0x0100;
  }
  throw new Error(`Invalid value in DMA register ${hex8(regVal)}`);
}

function clearDMA(ppu: PPU): void {
  ppu.ioRegs[Register.DMA] = 0;
}

const statLYCFlagMask = 0x04;

function setLYCoincidence(ppu: PPU, val: boolean): void {
  if (val) {
    ppu.ioRegs[Register.STAT] |= statLYCFlagMask;
  } else {
    ppu.ioRegs[Register.STAT] &= ~statLYCFlagMask;
  }
}

function getLYCompare(ppu: PPU): number {
  return ppu.ioRegs[Register.LYC];
}

export function ppuTick(ppu: PPU, bus: Bus): void {
  ppu.lineDot++;

  const dmaSrcAddr = getDMASrcAddr(ppu);
  if (dmaSrcAddr != null) {
    for (let i = 0; i < ppu.oam.length; i++) {
      ppu.oam[i] = bus.readb(dmaSrcAddr + i);
    }
    clearDMA(ppu);
  }

  switch (getMode(ppu)) {
    case Mode.ZERO:
      if (ppu.lineDot === 456) {
        ppu.lineDot = 0;
        setLine(ppu, getLine(ppu) + 1);
        if (getLine(ppu) === 144) {
          setMode(ppu, Mode.ONE);
          setInterrupt(bus, Interrupt.VBlank);
        } else {
          setMode(ppu, Mode.TWO);
          // TODO clear vblank interrupt?
        }
      }
      break;
    case Mode.ONE:
      if (ppu.lineDot === 456) {
        ppu.lineDot = 0;
        if (getLine(ppu) === 153) {
          setLine(ppu, 0);
          setMode(ppu, Mode.TWO);
        } else {
          setLine(ppu, getLine(ppu) + 1);
        }
      }
      break;
    case Mode.TWO:
      if (ppu.lineDot === 80) {
        setMode(ppu, Mode.THREE);
      }
      break;
    case Mode.THREE:
      if (ppu.lineDot === 80 + 168) {
        setMode(ppu, Mode.ZERO);
      }
      break;
  }

  setLYCoincidence(ppu, getLine(ppu) === getLYCompare(ppu));
}

// function renderBackground(imageData: ImageData, ppu: PPU): void {
// }

// function renderWindow(imageData: ImageData, ppu: PPU): void {
// }

// function renderBgSprites(imageData: ImageData, ppu: PPU): void {
// }

// function renderFgSprites(imageData: ImageData, ppu: PPU): void {
// }

export function renderScreen(screenContext: CanvasRenderingContext2D, _: PPU): void {
  const imageData = screenContext.createImageData(160, 144);
  // renderBgSprites(imageData, ppu);
  // renderBackground(imageData, ppu);
  // renderWindow(imageData, ppu);
  // renderFgSprites(imageData, ppu);
  screenContext.putImageData(imageData, 0, 0);
}
