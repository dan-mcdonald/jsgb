/// <reference lib="dom" />
import { BESSFile } from "./bess";
import { Bus } from "./bus";
import { Interrupt, setInterrupt } from "./interrupt";
import { hex16, hex8 } from "./util";

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
export const REG_SIZE = Register.WX+1;

export enum Mode {
  ZERO,
  ONE,
  TWO,
  THREE,
}

const STAT_LYC = 0x04;
const STAT_MODE = 0x03;

type ObjectEntry = {
  y: number;
  x: number;
  tileIndex: number;
  flags: number;
}

export class PPU {
  _lineDot = 0;
  _mode = Mode.TWO;
  readonly screenImage = Array<ScreenColor>(SCREEN_WIDTH * SCREEN_HEIGHT).fill(ScreenColor.WHITE);
  readonly _vram = new Uint8Array(0x2000);
  _LCDC = 0x00;
  _STAT = 0x84;
  _SCY = 0x00;
  _SCX = 0x00;
  _LY = 0x00;  
  _LYC = 0x00;
  _DMA = 0xff;
  _BGP = 0xfc;
  _OBP0 = 0xff;
  _OBP1 = 0xff;
  _WY = 0x00;
  _WX = 0x00;
  _dmaSrcAddr: number | null = null;
  _dmaSrcAddrOffset = 0;
  constructor(state?: BESSFile) {
    if (state !== undefined) {
      state.vram.forEach((v, i) => { this.writeVram(i, v); });
      state.ioregs.slice(0x40, 0x40 + REG_SIZE).forEach((v, i) => { this.writeIo(i, v); });
      state.oam.forEach((v, i) => { this.writeOam(i, v); });
      this._clearDMA();
    }
  }
  readIo(reg: Register): number {
    switch(reg) {
      case Register.LCDC: return this._LCDC;
      case Register.STAT: return this._STAT | (this._LY == this._LYC ? STAT_LYC : 0x00) | this._mode;
      case Register.SCY: return this._SCY;
      case Register.SCX: return this._SCX;
      case Register.LY: return this._LY;
      case Register.LYC: return this._LYC;
      case Register.DMA: return this._DMA;
      case Register.BGP: return this._BGP;
      case Register.OBP0: return this._OBP0;
      case Register.OBP1: return this._OBP1;
      case Register.WY: return this._WY;
      case Register.WX: return this._WX;
    }
  }
  writeIo(reg: Register, val: number): void {
    switch(reg) {
      case Register.LCDC: this._LCDC = val; break;
      case Register.STAT: this._STAT = val & ~(STAT_LYC | STAT_MODE); break;
      case Register.SCY: this._SCY = val; break;
      case Register.SCX: this._SCX = val; break;
      case Register.LY: this._LY = val; break;
      case Register.LYC: this._LYC = val; break;
      case Register.DMA:
        if (this._isDMAInProgress()) {
          throw new Error(`DMA already in progress`);
        }
        this._DMA = val;
        this._startDMA();
        break;
      case Register.BGP: this._BGP = val; break;
      case Register.OBP0: this._OBP0 = val; break;
      case Register.OBP1: this._OBP1 = val; break;
      case Register.WY: this._WY = val; break;
      case Register.WX: this._WX = val; break;
    }
  }
  readVram(addr: number): number {
    return this._vram[addr];
  }
  writeVram(addr: number, val: number): void {
    this._vram[addr] = val;
  }

  private readonly _oam: Array<ObjectEntry> = Array.from({length: 40}, () => ({y: 0, x: 0, tileIndex: 0, flags: 0}));
  private _oamCache = new Array<ObjectEntry>();
  private _oamScan(): void {
    const y = this._LY + 16;
    const objHeight = (this._LCDC & LCDC_OBJ_SIZE ? 16 : 8);
    this._oamCache = this._oam.filter((obj) => y >= obj.y && y < (obj.y + objHeight));
  }
  readOam(addr: number): number {
    if (addr < 0 || addr >= 0xA0) {
      throw new Error(`Invalid OAM address ${addr}`);
    }
    const idx = Math.floor(addr/4);
    const entry = this._oam[idx];
    switch (addr % 4) {
      case 0: return entry.y;
      case 1: return entry.x;
      case 2: return entry.tileIndex;
      case 3: return entry.flags;
      default:
        throw new Error(`BUG: readOam can't handle 0x${hex16(addr)}`);
    }
  }
  writeOam(addr: number, val: number): void {
    if (addr < 0 || addr >= 0xA0) {
      throw new Error(`Invalid OAM address ${addr}`);
    }
    const idx = Math.floor(addr/4);
    const entry = this._oam[idx];
    switch (addr % 4) {
      case 0: entry.y = val; break;
      case 1: entry.x = val; break;
      case 2: entry.tileIndex = val; break;
      case 3: entry.flags = val; break;
      default:
        throw new Error(`BUG: writeOam can't handle 0x${hex16(addr)}`);
    }
  }
  _startDMA(): void {
    this._dmaSrcAddr = this._getDMASrcAddr();
    this._dmaSrcAddrOffset = 0;
  }
  _clearDMA(): void {
    this._dmaSrcAddr = null;
    this._dmaSrcAddrOffset = 0;
  }
  _isDMAInProgress(): boolean {
    return this._dmaSrcAddr != null;
  }
  _DMATick(bus: Bus): void {
    if (this._dmaSrcAddr == null) {
      return;
    }
    this.writeOam(this._dmaSrcAddrOffset, bus.readb(this._dmaSrcAddr + this._dmaSrcAddrOffset));
    this._dmaSrcAddrOffset++;
    if (this._dmaSrcAddrOffset === 0xA0) {
      this._clearDMA();
    }
  }
  _getDMASrcAddr(): number | null {
    if (this._DMA > 0xDF) {
      return null;
    }
    return this._DMA * 0x0100;
  }
  _makeBgImage(): ImageData {
    const canvas = new OffscreenCanvas(256, 256);
    const ctx = canvas.getContext("2d");
    if (ctx == null) {
      throw new Error("Failed to get 2d context");
    }
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const tileIndex = this._getBgTileIndex(x, y);
        const tileAddr = bgTileImageVramOffset((this._LCDC & LCDC_BG_TILE_DATA_AREA) != 0, tileIndex);
        const tile = TileData(this._vram.slice(tileAddr, tileAddr + 16));
        const tilePalette = makeTilePaletteImage(tile);
        const tileImage = makeBgTileImage(tilePalette, this._BGP, screenPalette);
        ctx.putImageData(tileImage, x * 8, y * 8);
      }
    }
    return ctx.getImageData(0, 0, 256, 256);
  }
  _getBgTileIndex(x: number, y: number): number {
    if (x < 0 || x > 31 || y < 0 || y > 31) {
      throw new Error(`Invalid tile coordinates (${x}, ${y})`);
    }
    const bgTileMapBase = (this._LCDC & LCDC_BG_TILE_MAP_AREA) ? 0x1C00 : 0x1800;
    const bgTileMapOffset = (y * 32) + x;
    const bgTileMapAddr = bgTileMapBase + bgTileMapOffset;
    const tileIndex = this._vram[bgTileMapAddr];
    return tileIndex;
  }
  _findObjs(x: number): Array<ObjectEntry> {
    return this._oamCache.filter((obj) => x >= (obj.x - 8) && x < obj.x);
  }
  _calcObjPixel(x: number, y: number): ScreenColor | null {
    if ((this._LCDC & LCDC_OBJ_ENABLE) === 0) {
      return null;
    }
    for(const obj of this._findObjs(x)) {
      throw new Error(`_calcObjPixel(x=${x}, y=${y}) should draw on object ${JSON.stringify(obj)}`);
    }
    return null;
  }
  _calcBgPixel(x: number, y: number): ScreenColor {
    const tileIndex = this._getBgTileIndex(Math.floor(x / 8), Math.floor(y / 8));
    const tileAddr = bgTileImageVramOffset((this._LCDC & LCDC_BG_TILE_DATA_AREA) !== 0, tileIndex);
    const tile = TileData(this._vram.slice(tileAddr, tileAddr + 16));
    const tiley = y % 8;
    const tilex = x % 8;
    const [byte1, byte2] = [tile.tileData[tiley * 2], tile.tileData[tiley * 2 + 1]];
    const highBit = (byte2 >> (7 - tilex)) & 0x01;
    const lowBit = (byte1 >> (7 - tilex)) & 0x01;
    const paletteIndex = (highBit << 1) | lowBit;
    return screenColorForPalette(this._BGP, paletteIndex);
  }
  _calcScreenPixel(x: number, y: number): ScreenColor {
    if (x < 0 || x > SCREEN_WIDTH || y < 0 || y > SCREEN_HEIGHT) {
      throw new Error(`Invalid pixel coordinates (${x}, ${y})`);
    }
    const objPixel = this._calcObjPixel(x, y);
    if (objPixel !== null) {
      return objPixel;
    }
    const bgx = (this._SCX + x) % BG_WIDTH;
    const bgy = (this._SCY + y) % BG_HEIGHT;
    const bgPixel = this._calcBgPixel(bgx, bgy);
    // TODO Window
    // TODO OAM
    return bgPixel;
  }
  _setPixel(x: number, y: number, color: ScreenColor): void {
    this.screenImage[y * SCREEN_WIDTH + x] = color;
  }
  _drawPixel(x: number): void {
    const y = this._LY;
    this._setPixel(x, y, this._calcScreenPixel(x, y));
  }
  tick(bus: Bus): void {
    if ((this._LCDC & LCDC_ENABLED) === 0) {
      return;
    }
    this._lineDot++;
  
    if (this._isDMAInProgress()) {
      this._DMATick(bus);
    }
  
    switch (this._mode) {
      case Mode.ZERO:
        if (this._lineDot === 456) {
          this._lineDot = 0;
          this._LY++;
          if (this._LY === 144) {
            this._mode = Mode.ONE;
            setInterrupt(bus, Interrupt.VBlank);
          } else {
            this._mode = Mode.TWO;
          }
        }
        break;
      case Mode.ONE:
        if (this._lineDot === 456) {
          this._lineDot = 0;
          if (this._LY === 153) {
            this._LY = 0;
            this._mode = Mode.TWO;
          } else {
            this._LY++;
          }
        }
        break;
      case Mode.TWO:
        if (this._lineDot === 80) {
          this._oamScan();
          this._mode = Mode.THREE;
        }
        break;
      case Mode.THREE:
        if (this._lineDot === 80 + 168) {
          this._mode = Mode.ZERO;
        } else if (this._lineDot < 80 + SCREEN_WIDTH) {
          this._drawPixel(this._lineDot - 80);
        }
        break;
    }
  }  
}

function screenColorForPalette(palette: number, index: number): ScreenColor {
  return (palette >> (index * 2)) & 0x03;
}

export const LCDC_ENABLED = 1 << 7;
const LCDC_BG_TILE_DATA_AREA = 1 << 4;
const LCDC_BG_TILE_MAP_AREA = 1 << 3;
const LCDC_OBJ_SIZE = 1 << 2;
const LCDC_OBJ_ENABLE = 1 << 1;

// function renderBackground(imageData: ImageData, ppu: PPU): void {
// }

// function renderWindow(imageData: ImageData, ppu: PPU): void {
// }

// function renderBgSprites(imageData: ImageData, ppu: PPU): void {
// }

// function renderFgSprites(imageData: ImageData, ppu: PPU): void {
// }

/** Get the offset within the VRAM where the tile data begins for the specified tile index */
export function bgTileImageVramOffset(lcdc4: boolean, index: number): number {
  if (!lcdc4 && index > 127) {
    index -= 0x100; // adjust signed
  }
  return (lcdc4 ? 0x0000 : 0x1000) + (index * 16);
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
