export enum Register {
  DIV,
  TIMA,
  TMA,
  TAC,
}

export interface Timer {
  writeRegister: (reg: Register, val: number) => void;
  readRegister: (reg: Register) => number;
  tick: () => void;
}

const clockMasks = [
  (1 << 10) - 1, // 00 -> CPU / 1024
  (1 << 4) - 1, // 01 -> CPU / 16
  (1 << 6) - 1, // 10 -> CPU / 64
  (1 << 8) - 1, // 11 -> CPU / 256
];

const TAC_ENABLE = 0x04;

export function init(requestInterrupt: () => void): Timer {
  let ticks = 0;
  let div = 0xab;
  let tima = 0xcd;
  let tma = 0xef;
  let tac = 0x00;
  function writeRegister(reg: Register, val: number): void {
    switch(reg) {
    case Register.DIV:
      div = 0x00;
      break;
    case Register.TIMA:
      tima = val;
      break;
    case Register.TMA:
      tma = val;
      break;
    case Register.TAC:
      tac = val;
      break;
    }
  }
  function readRegister(reg: Register): number {
    switch(reg) {
      case Register.DIV:
        return div;
      case Register.TIMA:
        return tima;
      case Register.TMA:
        return tma;
      case Register.TAC:
        return tac;
    }
  }
  function tick(): void {
    if ((tac & TAC_ENABLE) == 0) {
      return;
    }
    ticks = (ticks + 1) % 1024;
    if ((ticks & clockMasks[3]) == 0) {
      div++;
    }
    const clockSelect = tac & 0x03;
    const mask = clockMasks[clockSelect];
    if ((ticks & mask) == 0) {
      if (tima == 0xff) {
        tima = tma;
        requestInterrupt();
      } else {
        tima++;
      }
    }
  }
  return {
    writeRegister,
    readRegister,
    tick,
  };
}
