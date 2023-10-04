/// <reference lib="dom" />
import { Bus } from "./bus";
import { hex8 } from "./util";
import { Interrupt, setInterrupt } from "./interrupt";

const SCREEN_WIDTH = 160;
const SCREEN_HEIGHT = 144;
const BG_WIDTH = 256;
const BG_HEIGHT = 256;

interface Color { bytes: Uint8Array }
export type Palette = [Color, Color, Color, Color];

enum ScreenColor {
  WHITE,
  LIGHT_GRAY,
  DARK_GRAY,
  BLACK,
}

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

export function makeTilePaletteRow(byte1: number, byte2: number): Uint8Array {
  const row = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    // byte2 holds the high bits of the color, byte1 holds the low bits
    const highBit = (byte2 >> (7 - i)) & 0x01;
    const lowBit = (byte1 >> (7 - i)) & 0x01;
    row[i] = (highBit << 1) | lowBit;
  }
  return row;
}

export interface TileData {
  tileData: Uint8Array;
}

export function TileData(tileData: Uint8Array): TileData {
  if (tileData.length !== 16) {
    throw new Error(`Invalid tile data length ${tileData.length}`);
  }
  return { tileData };
}

export interface TilePaletteData {
  tilePaletteData: Uint8Array;
}

export function TilePaletteData(tilePaletteData: Uint8Array): TilePaletteData {
  if (tilePaletteData.length !== 64) {
    throw new Error(`Invalid tile data length ${tilePaletteData.length}`);
  }
  return { tilePaletteData };
}

export function makeTilePaletteImage(tile: TileData): TilePaletteData {
  const tileData = tile.tileData;
  const image = new Uint8Array(8 * 8);
  for (let i = 0; i < 8; i++) {
    const row = makeTilePaletteRow(tileData[i * 2], tileData[i * 2 + 1]);
    image.set(row, i * 8);
  }
  return TilePaletteData(image);
}

export function makeBgTileImage(
  tilePalette: TilePaletteData,
  palette: number, screenPalette: Palette): ImageData {
  const image = new ImageData(8, 8);
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

export enum Register {
  LCDC,
  STAT,
  SCY,
  SCX,
  LY,
  LYC,
  DMA,
  BGP,
  OBP0,
  OBP1,
  WY,
  WX,
}

export enum Mode {
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
  screenImage: ScreenColor[]
}

export function ppuBuild(): PPU {
  const ioRegs = new Uint8Array(Register.WX + 1);
  ioRegs[Register.STAT] = 0x84 | Mode.TWO;
  ioRegs[Register.DMA] = 0xFF;
  ioRegs[Register.BGP] = 0xFC;
  ioRegs[Register.OBP0] = ioRegs[Register.OBP1] = 0xFF;
  return {
    ioRegs,
    vram: new Uint8Array(0x2000),
    oam: new Uint8Array(0xA0),
    lineDot: 0,
    screenImage: Array<ScreenColor>(SCREEN_WIDTH * SCREEN_HEIGHT).fill(ScreenColor.WHITE),
  };
}

const statModeMask = 0x03;

export function getMode(ppu: PPU): Mode {
  return (ppu.ioRegs[Register.STAT] & statModeMask) as Mode;
}

function setMode(ppu: PPU, mode: Mode): void {
  ppu.ioRegs[Register.STAT] = (ppu.ioRegs[Register.STAT] & (~statModeMask)) | mode;
}

export function getLine(ppu: PPU): number {
  return ppu.ioRegs[Register.LY];
}

function setLine(ppu: PPU, line: number): void {
  ppu.ioRegs[Register.LY] = line;
}

function getDMASrcAddr(ppu: PPU): number | null {
  const regVal = ppu.ioRegs[Register.DMA];
  if (regVal > 0xDF) {
    return null;
  }
  return regVal * 0x0100;
}

function clearDMA(ppu: PPU): void {
  ppu.ioRegs[Register.DMA] = 0xFF;
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

function getY(ppu: PPU): number {
  return ppu.ioRegs[Register.LY];
}

function screenColorForPalette(palette: number, index: number): ScreenColor {
  return (palette >> (index * 2)) & 0x03;
}

function lcdc4(ppu: PPU): boolean {
  return (ppu.ioRegs[Register.LCDC] & (1 << 4)) != 0;
}

const LCDC_ENABLED = 1 << 7;

function calcBgPixel(ppu: PPU, x: number, y: number): ScreenColor {
  const tileIndex = getBgTileIndex(ppu, Math.floor(x / 8), Math.floor(y / 8));
  const tileAddr = bgTileImageVramOffset(lcdc4(ppu), tileIndex);
  const tile = TileData(ppu.vram.slice(tileAddr, tileAddr + 16));
  const tiley = y % 8;
  const tilex = x % 8;
  const [byte1, byte2] = [tile.tileData[tiley * 2], tile.tileData[tiley * 2 + 1]];
  const highBit = (byte2 >> (7 - tilex)) & 0x01;
  const lowBit = (byte1 >> (7 - tilex)) & 0x01;
  const paletteIndex = (highBit << 1) | lowBit;
  return screenColorForPalette(ppu.ioRegs[Register.BGP], paletteIndex);
}

function calcScreenPixel(ppu: PPU, x: number, y: number): ScreenColor {
  if (x < 0 || x > SCREEN_WIDTH || y < 0 || y > SCREEN_HEIGHT) {
    throw new Error(`Invalid pixel coordinates (${x}, ${y})`);
  }
  const bgx = (ppu.ioRegs[Register.SCX] + x) % BG_WIDTH;
  const bgy = (ppu.ioRegs[Register.SCY] + y) % BG_HEIGHT;
  const bgPixel = calcBgPixel(ppu, bgx, bgy);
  // TODO Window
  // TODO OAM
  return bgPixel;
}

function setPixel(ppu: PPU, x: number, y: number, color: ScreenColor): void {
  ppu.screenImage[y * SCREEN_WIDTH + x] = color;
}

function drawPixel(ppu: PPU, x: number): void {
  const y = getY(ppu);
  setPixel(ppu, x, y, calcScreenPixel(ppu, x, y));
}

export function tick(ppu: PPU, bus: Bus): void {
  if ((ppu.ioRegs[Register.LCDC] & LCDC_ENABLED) === 0) {
    return;
  }
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
      } else if (ppu.lineDot < 80 + SCREEN_WIDTH) {
        drawPixel(ppu, ppu.lineDot - 80);
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

export function getBgTileIndex(ppu: PPU, x: number, y: number): number {
  if (x < 0 || x > 31 || y < 0 || y > 31) {
    throw new Error(`Invalid tile coordinates (${x}, ${y})`);
  }
  const bgTileMapBase = (ppu.ioRegs[Register.LCDC] & 0x08) ? 0x1C00 : 0x1800;
  const bgTileMapOffset = (y * 32) + x;
  const bgTileMapAddr = bgTileMapBase + bgTileMapOffset;
  const tileIndex = ppu.vram[bgTileMapAddr];
  return tileIndex;
}

/** Get the offset within the VRAM where the tile data begins for the specified tile index */
export function bgTileImageVramOffset(lcdc4: boolean, index: number): number {
  if (!lcdc4 && index > 127) {
    throw Error("TODO implement signed BG/Win VRAM tile data");
  }
  return (lcdc4 ? 0x0000 : 0x1000) + (index * 16);
}

export function makeBgImage(ppu: PPU): ImageData {
  const canvas = new OffscreenCanvas(256, 256);
  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    throw new Error("Failed to get 2d context");
  }
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const tileIndex = getBgTileIndex(ppu, x, y);
      const tileAddr = bgTileImageVramOffset((ppu.ioRegs[Register.LCDC] & (1 << 4)) != 0, tileIndex);
      const tile = TileData(ppu.vram.slice(tileAddr, tileAddr + 16));
      const tilePalette = makeTilePaletteImage(tile);
      const tileImage = makeBgTileImage(tilePalette, ppu.ioRegs[Register.BGP], screenPalette);
      ctx.putImageData(tileImage, x * 8, y * 8);
    }
  }
  return ctx.getImageData(0, 0, 256, 256);
}

export function makeScreenImage(ppu: PPU): ImageData {
  const screenImage = new ImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const bgPixel = screenPalette[ppu.screenImage[y * SCREEN_WIDTH + x]];
      screenImage.data.set(bgPixel.bytes, 4 * (y * SCREEN_WIDTH + x));
    }
  }
  return screenImage;
}

export function renderScreen(screenContext: CanvasRenderingContext2D, ppu: PPU): void {
  screenContext.putImageData(makeScreenImage(ppu), 0, 0);
}
