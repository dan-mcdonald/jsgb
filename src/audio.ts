import { hex8 } from "./util";

export interface Audio {
  readIo(addr: IoReg): number;
  writeIo(addr: IoReg, val: number): void;
}

export enum IoReg {
  NR10 = 0x00,
  NR11 = 0x01,
  NR12 = 0x02,
  NR13 = 0x03,
  NR14 = 0x04,

  NR21 = 0x06,
  NR22 = 0x07,
  NR23 = 0x08,
  NR24 = 0x09,
  NR30 = 0x0a,
  NR31 = 0x0b,
  NR32 = 0x0c,
  NR33 = 0x0d,
  NR34 = 0x0e,

  NR41 = 0x10,
  NR42 = 0x11,
  NR43 = 0x12,
  NR44 = 0x13,
  NR50 = 0x14,
  NR51 = 0x15,
  NR52 = 0x16,

  WAVE_0 = 0x20,
  WAVE_1 = 0x21,
  WAVE_2 = 0x22,
  WAVE_3 = 0x23,
  WAVE_4 = 0x24,
  WAVE_5 = 0x25,
  WAVE_6 = 0x26,
  WAVE_7 = 0x27,
  WAVE_8 = 0x28,
  WAVE_9 = 0x29,
  WAVE_A = 0x2a,
  WAVE_B = 0x2b,
  WAVE_C = 0x2c,
  WAVE_D = 0x2d,
  WAVE_E = 0x2e,
  WAVE_F = 0x2f
}

const NR14_TRIGGER = 0x80;
const NR14_LENGTH = 0x40;
// const NR14_PERIOD_HI_MASK = 0x07;

const NR50_VIN_LEFT = 0x80;
const NR50_VIN_RIGHT = 0x08;

const NR52_POWER = 0x80;

export class NullAPU implements Audio {
  readIo(_: IoReg): number {
    return 0;
  }
  writeIo(_: IoReg, __: number): void {
  }
}

export class APU implements Audio {
  private readonly regs = new Uint8Array(0x30);
  readIo(addr: IoReg): number {
    return this.regs[addr];
  }
  writeIo(addr: IoReg, val: number): void {
    switch (addr) {
      case IoReg.NR14:
        if ((val & NR14_TRIGGER) !== 0) {
          throw new Error("audio trigger not supported");
        }
        this.regs[addr] = val | NR14_LENGTH;
        break;
      case IoReg.NR50:
        if ((val & (NR50_VIN_LEFT | NR50_VIN_RIGHT)) !== 0) {
          throw new Error("audio vin not supported");
        }
        this.regs[addr] = val;
        break;
      case IoReg.NR52:
        this.regs[addr] = val | NR52_POWER;
        if ((val & NR52_POWER) === 0) {
          throw new Error("audio power off");
        }
        return;
      case IoReg.NR11:
      case IoReg.NR12:
      case IoReg.NR13:
      case IoReg.NR51:
        this.regs[addr] = val;
        break;
      default:
        throw new Error(`audio write ${IoReg[addr]} 0x${hex8(val)}`);
    }
  }
}
