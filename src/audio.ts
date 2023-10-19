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

export function audioInit(): Audio {
  const regs = new Uint8Array(0x30);
  return {
    readIo(addr: IoReg): number {
      return regs[addr];
    },
    writeIo(addr: IoReg, val: number): void {
      console.error(`audio write ${IoReg[addr]} 0x${hex8(val)}`);
      regs[addr] = val;
    }
  };
}
