import {BusRead, BusWrite} from "./bus";
import {hex8} from "./util";

enum Register {
  LCDC = 0x0,
  STAT = 0x1,
  SCY = 0x2,
  SCX = 0x3,
  LY = 0x4,
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
  if(regVal == 0) {
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

export function ppuTick(ppu: PPU, writeb: BusWrite, readb: BusRead): void {
  ppu.lineDot++;
  
  const dmaSrcAddr = getDMASrcAddr(ppu);
  if (dmaSrcAddr != null) {
    for(let i = 0; i < ppu.oam.length; i++) {
      ppu.oam[i] = readb(dmaSrcAddr + i);
    }
    clearDMA(ppu);
  }

  switch(getMode(ppu)) {
    case Mode.ZERO:
      if (ppu.lineDot === 456) {
        ppu.lineDot = 0;
        setLine(ppu, getLine(ppu) + 1);
        setMode(ppu, getLine(ppu) === 144 ? Mode.ONE : Mode.TWO);
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
}
