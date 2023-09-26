import { Bus } from "./bus";
import { hex8, hex16, u8tos8, break16 } from "./util";
import { interruptVector, interruptPending, clearInterrupt } from "./interrupt";

type InstructionFunction = (cpu: CPU, bus: Bus) => number;

export class Flags extends Number {
  setZ(b: boolean): Flags {
    const n = this.valueOf();
    return new Flags(b ? n | maskZ : n & ~maskZ);
  }
  setN(b: boolean): Flags {
    const n = this.valueOf();
    return new Flags(b ? n | maskN : n & ~maskN);
  }
  setH(b: boolean): Flags {
    const n = this.valueOf();
    return new Flags(b ? n | maskH : n & ~maskH);
  }
  setC(b: boolean): Flags {
    const n = this.valueOf();
    return new Flags(b ? n | maskC : n & ~maskC);
  }
  Z(): boolean {
    const n = this.valueOf();
    return (n & maskZ) !== 0;
  }
  N(): boolean {
    const n = this.valueOf();
    return (n & maskN) !== 0;
  }
  H(): boolean {
    const n = this.valueOf();
    return (n & maskH) !== 0;
  }
  C(): boolean {
    const n = this.valueOf();
    return (n & maskC) !== 0;
  }
}

// export function FlagsFrom(n: number): Flags {
//   return {
//     setZ: (b: boolean): Flags => FlagsFrom(b ? n | maskZ : n & ~maskZ),
//     setN: (b: boolean): Flags => FlagsFrom(b ? n | maskN : n & ~maskN),
//     setH: (b: boolean): Flags => FlagsFrom(b ? n | maskH : n & ~maskH),
//     setC: (b: boolean): Flags => FlagsFrom(b ? n | maskC : n & ~maskC),
//     Z: (): boolean => (n & maskZ) != 0,
//     N: (): boolean => (n & maskN) != 0,
//     H: (): boolean => (n & maskH) != 0,
//     C: (): boolean => (n & maskC) != 0,
//     toFixed: n.toFixed.bind(n),
//     toPrecision: n.toPrecision.bind(n),
//     toExponential: n.toExponential.bind(n),
//     valueOf: n.valueOf.bind(n),
//   }
// }

interface Registers {
  sp: number;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  h: number;
  l: number;
}

export interface CPU {
  pc: number;
  ime: boolean;
  halt: boolean;
  regs: Registers;
  f: Flags;
}

export function initCPU(): CPU {
  return {
    pc: 0x0000,
    ime: false,
    halt: false,
    regs: {
      sp: 0x0000,
      a: 0x00,
      b: 0x00,
      c: 0x00,
      d: 0x00,
      e: 0x00,
      h: 0x00,
      l: 0x00,
    },
    f: new Flags(0x00),
  };
}

export const maskZ = 0x80;
export const maskN = 0x40;
export const maskH = 0x20;
export const maskC = 0x10;

export function dump(cpu: CPU): string {
  return `pc ${hex16(cpu.pc)} sp ${hex16(cpu.regs.sp)} af ${hex8(cpu.regs.a)}${hex8(cpu.f.valueOf())} bc ${hex8(cpu.regs.b)}${hex8(cpu.regs.c)} de ${hex8(cpu.regs.d)}${hex8(cpu.regs.e)} hl ${hex8(cpu.regs.h)}${hex8(cpu.regs.l)}`;
}

interface Instruction {
  length: number;
  text: string;
  exec(cpu: CPU, bus: Bus): number;
}

function xor(cpu: CPU, reg: keyof Registers): number {
  const res = (cpu.regs.a ^= cpu.regs[reg]);
  cpu.f = cpu.f.setZ(res == 0).setN(false).setH(false).setC(false);
  return 4;
}

enum R16 {
  AF,
  BC,
  DE,
  SP,
  HL,
}

enum R8 {
  A,
  B,
  C,
  D,
  E,
  H,
  L,
}

function get8(cpu: CPU, reg: R8): number {
  switch(reg) {
    case R8.A:
      return cpu.regs.a;
    case R8.B:
      return cpu.regs.b;
    case R8.C:
      return cpu.regs.c;
    case R8.D:
      return cpu.regs.d;
    case R8.E:
      return cpu.regs.e;
    case R8.H:
      return cpu.regs.h;
    case R8.L:
      return cpu.regs.l;
  }
}

function set8(cpu: CPU, reg: R8, val: number): void {
  switch(reg) {
    case R8.A:
      cpu.regs.a = val;
      break;
    case R8.B:
      cpu.regs.b = val;
      break;
    case R8.C:
      cpu.regs.c = val;
      break;
    case R8.D:
      cpu.regs.d = val;
      break;
    case R8.E:
      cpu.regs.e = val;
      break;
    case R8.H:
      cpu.regs.h = val;
      break;
    case R8.L:
      cpu.regs.l = val;
      break;
  }
}

function set16(cpu: CPU, target: R16, val: number): void {
  switch (target) {
    case R16.SP:
      cpu.regs.sp = val;
      break;
    case R16.HL:
      cpu.regs.h = val >> 8;
      cpu.regs.l = val & 0xff;
  }
}

function get16(cpu: CPU, reg: R16): number {
  switch(reg) {
    case R16.AF:
      return cpu.regs.a << 8 | cpu.f.valueOf();
    case R16.BC:
      return cpu.regs.b << 8 | cpu.regs.c;
    case R16.DE:
      return cpu.regs.d << 8 | cpu.regs.e;
    case R16.SP:
      return cpu.regs.sp;
    case R16.HL:
      return cpu.regs.h << 8 | cpu.regs.l;
  }
}

function ld_r16_n16(target: R16, val: number): InstructionFunction {
  return function(cpu: CPU, _: Bus): number {
    set16(cpu, target, val);
    return 12;
  }
}

function ld_r8_at_r16(targetReg: R8, addrReg: R16): InstructionFunction {
  return function(cpu: CPU, bus: Bus): number {
    const addr = get16(cpu, addrReg);
    const val = bus.readb(addr);
    set8(cpu, targetReg, val);
    return 8;
  }
}

function ld_at_r16_r8(destAddrReg: R16, valReg: R8): (cpu: CPU, bus: Bus) => number {
  return function(cpu: CPU, bus: Bus): number {
    const destAddr = get16(cpu, destAddrReg);
    const val = get8(cpu, valReg);
    bus.writeb(destAddr, val);  
    return 8;
  }
}

function dec_r16(cpu: CPU, reg: R16): number {
  const oldVal = get16(cpu, reg);
  const newVal = (oldVal - 1) & 0xffff;
  set16(cpu, reg, newVal);
  return 4;
}

function inc_r16(reg: R16): InstructionFunction {
  return function(cpu: CPU, _: Bus): number {
    const oldVal = get16(cpu, reg);
    const newVal = (oldVal + 1) & 0xffff;
    set16(cpu, reg, newVal);
    return 8;
  };
}

function ldd_at_r16_r8(destAddrReg: R16, val: R8): (cpu: CPU, bus: Bus) => number {
  return function(cpu: CPU, bus: Bus): number {
    ld_at_r16_r8(destAddrReg, val)(cpu, bus);
    dec_r16(cpu, destAddrReg);
    return 8;
  };
}

function ldi_at_r16_r8(destAddrReg: R16, val: R8): (cpu: CPU, bus: Bus) => number {
  return function(cpu: CPU, bus: Bus): number {
    ld_at_r16_r8(destAddrReg, val)(cpu, bus);
    inc_r16(destAddrReg);
    return 8;
  };
}


function ld_r8_r8(dest: R8, src: R8): InstructionFunction {
  return function(cpu: CPU, _: Bus): number {
    const val = get8(cpu, src);
    set8(cpu, dest, val);
    return 4;
  };
}

function ld_at_n8_r8(destAddr: number, fromReg: R8): InstructionFunction {
  return function(cpu: CPU, bus: Bus): number {
    const val = get8(cpu, fromReg);
    bus.writeb(destAddr, val);
    return 8;
  };
}

function ld_r8_n8(dest: R8, val: number): InstructionFunction {
  return function(cpu: CPU, _: Bus): number {
    set8(cpu, dest, val);
    return 8;
  };
}

function inc_r8(reg: R8): (cpu: CPU, bus: Bus) => number {
  return function(cpu: CPU, _: Bus) {
    const oldVal = get8(cpu, reg);
    const newVal = (oldVal + 1) & 0xff;
    cpu.regs.a = newVal;
    cpu.f = cpu.f.setZ(newVal === 0).setN(false).setH((oldVal & 0xf) == 0xf);
    return 4;
  }
}

function push16(cpu: CPU, bus: Bus, val: number): void {
  const [hi, lo] = break16(val);
  cpu.regs.sp -= 2;
  bus.writeb(cpu.regs.sp + 1, lo);
  bus.writeb(cpu.regs.sp, hi);
}

function call(addr: number): InstructionFunction {
  return function(cpu: CPU, bus: Bus) {
    push16(cpu, bus, cpu.pc);
    cpu.pc = addr;
    return 12;
  }
}

function cp(val: number): InstructionFunction {
  return function(cpu: CPU, _: Bus): number {
    const diff = ((cpu.regs.a - val) & 0xff);
    cpu.f = cpu.f.setZ(diff == 0).setN(true).setH(false).setC(val > cpu.regs.a);
    return 4;
  }
}

export function decodeInsn(addr: number, bus: Bus): Instruction {
  let length = 0;
  function decodeImm8(): number {
    return bus.readb(addr + length++);
  }
  function decodeImm16(): number {
    const lo = bus.readb(addr + length++);
    const hi = bus.readb(addr + length++);
    return (hi << 8) | lo;
  }
  const opcode = decodeImm8();
  let n16: number;
  let n8: number;
  let jaddr: number;
  function decodeCbInsn(): Instruction {
    const opcode = bus.readb(addr + length++);
    switch (opcode) {
      case 0x7c:
        return {
          length,
          text: "bit  7,h",
          exec: (cpu: CPU) => {
            cpu.f = cpu.f
              .setZ((cpu.regs.h & 0x80) === 0)
              .setN(false)
              .setH(true);
            return 8;
          }
        };
      default:
        throw Error(`unrecognized opcode cb ${hex8(opcode)}`);
    }
  }
  switch (opcode) {
    case 0x00:
      return {
        length,
        text: "NOP",
        exec: () => 4
      };
    case 0x06:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   b," + hex8(n8),
        exec: ld_r8_n8(R8.B, n8),
      };
    case 0x0C:
      return {
        length,
        text: "inc  c",
        exec: inc_r8(R8.C),
      };
    case 0x0E:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   c," + hex8(n8),
        exec: (cpu: CPU) => {
          cpu.regs.c = n8;
          return 8;
        },
      };
    case 0x11:
      n16 = decodeImm16();
      return {
        length,
        text: "ld   de," + hex16(n16),
        exec: ld_r16_n16(R16.DE, n16),
      };
    case 0x13:
      return {
        length,
        text: "inc  de",
        exec: inc_r16(R16.DE)
      };
    case 0x1A:
      return {
        length,
        text: "ld   a,(de)",
        exec: ld_r8_at_r16(R8.A, R16.DE),
      };
    case 0x20:
      n8 = decodeImm8();
      jaddr = addr + length + u8tos8(n8);
      return {
        length,
        text: "jr   nz," + hex16(jaddr),
        exec: (cpu: CPU) => {
          const targetAddr = jaddr; // put address in closure
          if (!cpu.f.Z()) {
            cpu.pc = targetAddr;
            return 12;
          }
          return 8;
        },
      };
    case 0x21:
      n16 = decodeImm16();
      return {
        length,
        text: "ld   hl," + hex16(n16),
        exec: ld_r16_n16(R16.HL, n16),
      };
    case 0x22:
      return {
        length,
        text: "ldi  (hl),a",
        exec: ldi_at_r16_r8(R16.HL, R8.A),
      };
    case 0x31:
      n16 = decodeImm16();
      return {
        length,
        text: "ld   sp," + hex16(n16),
        exec: ld_r16_n16(R16.SP, n16),
      };
    case 0x32:
      return {
        length,
        text: "ldd  (hl),a",
        exec: ldd_at_r16_r8(R16.HL, R8.A),
      }
    case 0x3E:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   a," + hex8(n8),
        exec: (cpu: CPU) => {
          cpu.regs.a = n8;
          return 8;
        },
      };
    case 0x77:
      return {
        length,
        text: "ld   (hl),a",
        exec: ld_at_r16_r8(R16.HL, R8.A),
      };
    case 0x7B:
      return {
        length,
        text: "ld   a,e",
        exec: ld_r8_r8(R8.A, R8.E)
      };
    case 0xAF:
      return {
        length,
        text: "xor  a",
        exec: (cpu: CPU) => xor(cpu, "a"),
      };
    case 0xCB:
      return decodeCbInsn();
    case 0xCD:
      n16 = decodeImm16();
      return {
        length,
        text: "call " + hex16(n16),
        exec: call(n16),
      };
    case 0xE0:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   (ff00+" + hex8(n8) + "),a",
        exec: ld_at_n8_r8(0xff00+n8, R8.A),
      };
    case 0xE2:
      return {
        length,
        text: "ld   (ff00+c),a",
        exec: (cpu: CPU) => {
          const addr = 0xff00 + cpu.regs.c;
          bus.writeb(addr, cpu.regs.a);
          return 8;
        },
      };
    case 0xFE:
      n8 = decodeImm8();
      return {
        length,
        text: "cp   a," + hex8(n8),
        exec: cp(n8),
      };
    default:
      throw Error(`unrecognized opcode ${hex8(opcode)}`);
  }
}

// https://www.pastraiser.com/cpu/gameboy/gameboy_opcodes.html
export function step(cpu: CPU, bus: Bus): number {
  const instAddr = cpu.pc;

  // const push16 = function(word: number): void {
  //   const [hi, lo] = break16(word);    
  //   cpu.regs.sp -= 2;
  //   writeb(cpu.regs.sp + 1, lo);
  //   writeb(cpu.regs.sp, hi);
  // };

  // const pop16 = function(): number {
  //   const hi = readb(cpu.regs.sp);
  //   const lo = readb(cpu.regs.sp + 1);
  //   cpu.regs.sp += 2;
  //   return make16(hi, lo);
  // };

  // const imm8 = function(): number {
  //   return readb(cpu.pc++);
  // };

  // const imm16 = function(): number {
  //   const lo = imm8();
  //   const hi = imm8();
  //   return make16(hi, lo);
  // };

  // const logInst = function(_: string): void {
  //   // WIP I used to want write all instructions to the console for debugging.
  //   // Now I want to programmatically disassemble so I'll need to refactor things
  // };

  // const setZ = function(b: boolean): void {
  //   cpu.regs.f = (cpu.regs.f & ~maskZ) | (b ? maskZ : 0);
  // };
  // const getZ = function(): boolean {
  //   return Boolean(cpu.regs.f & maskZ);
  // };

  // const setN = function(b: boolean): void {
  //   cpu.regs.f = (cpu.regs.f & ~maskN) | (b ? maskN : 0);
  // };

  // const getN = function(): boolean { // eslint-disable-line @typescript-eslint/no-unused-vars
  //   return Boolean(cpu.regs.f & maskN);
  // };

  // const setH = function(b: boolean): void {
  //   cpu.regs.f = (cpu.regs.f & ~maskH) | (b ? maskH : 0);
  // };
  // const getH = function(): boolean { // eslint-disable-line @typescript-eslint/no-unused-vars
  //   return Boolean(cpu.regs.f & maskH);
  // };

  // const setC = function(b: boolean): void {
  //   cpu.regs.f = (cpu.regs.f & ~maskC) | (b ? maskC : 0);
  // };

  // const getC = function(): boolean {
  //   return Boolean(cpu.regs.f & maskC);
  // };

  // const getHL = function(): number {
  //   return make16(cpu.regs.h, cpu.regs.l);
  // };

  // const setAtHL = function(val: number): void {
  //   writeb(getHL(), val);
  // };

  // const or = function(value: number): void {
  //   cpu.regs.a |= value;
  //   setZ(cpu.regs.a == 0);
  //   setN(false);
  //   setH(false);
  //   setC(false);
  // };

  // const and = function(val: number): void {
  //   cpu.regs.a &= val;
  //   setZ(cpu.regs.a == 0);
  //   setN(false);
  //   setH(true);
  //   setC(false);
  // };

  // const rr = function(reg: keyof Registers): void {
  //   const oldVal = cpu.regs[reg];
  //   const newVal = (oldVal >> 1) | (getC() ? 0x80 : 0x00);
  //   cpu.regs[reg] = newVal;
  //   setZ(false);
  //   setN(false);
  //   setH(false);
  //   setC((oldVal & 0x01) !== 0);
  // };

  // const rl = function(reg: keyof Registers): void {
  //   const oldVal = cpu.regs[reg];
  //   const newVal = (oldVal << 1) | Number(getC());
  //   cpu.regs[reg] = newVal & 0xff;
  //   setZ(cpu.regs[reg] === 0);
  //   setN(false);
  //   setH(false);
  //   setC(Boolean(newVal & 0x100));
  // };

  // const sla = function(reg: keyof Registers): void {
  //   const oldVal = cpu.regs[reg];
  //   const newVal = (oldVal << 1) & 0xff;
  //   cpu.regs[reg] = newVal;
  //   setZ(newVal === 0);
  //   setN(false);
  //   setH(false);
  //   setC((newVal & 0x80) !== 0);
  // }

  // const bit = function(mask: number, reg: keyof Registers): void {
  //   setZ((cpu.regs[reg] & mask) === 0);
  //   setN(false);
  //   setH(false);
  // };

  // const res = function(bit: number, reg: keyof Registers): void {
  //   cpu.regs[reg] &= 1 << bit;
  // };

  // const ldAddrReg = function(addr: number, reg: keyof Registers): void {
  //   writeb(addr, cpu.regs[reg]);
  // };

  // const ldR16 = function(regHi: keyof Registers, regLo: keyof Registers, value: number): void {
  //   cpu.regs[regHi] = value >> 8;
  //   cpu.regs[regLo] = value & 0xff;
  // };

  // const dec16 = function(regH: keyof Registers, regL: keyof Registers): void {
  //   const val = (make16(cpu.regs[regH], cpu.regs[regL]) - 1) & 0xffff;
  //   cpu.regs[regH] = val >> 8;
  //   cpu.regs[regL] = val & 0xff;
  // };

  // const inc16 = function(regH: keyof Registers, regL: keyof Registers): void {
  //   const val = (make16(cpu.regs[regH], cpu.regs[regL]) + 1) & 0xffff;
  //   cpu.regs[regH] = val >> 8;
  //   cpu.regs[regL] = val & 0xff;
  // };

  // const decR8 = function(reg: keyof Registers): void {
  //   const oldVal = cpu.regs[reg];
  //   const newVal = (oldVal - 1) & 0xff;
  //   cpu.regs[reg] = newVal;
  //   setZ(newVal === 0);
  //   setN(true);
  //   // setH(...);
  // };

  // const decAddr = function(addr: number): void {
  //   const oldVal = readb(addr);
  //   const newVal = (oldVal - 1) & 0xff;
  //   writeb(addr, newVal);
  //   setZ(newVal == 0);
  //   setN(true);
  //   // TODO setH
  // };

  // const incR8 = function(reg: keyof Registers): void {
  //   const newVal = (cpu.regs[reg] + 1) & 0xff;
  //   cpu.regs[reg] = newVal;
  //   setZ(newVal === 0);
  //   setN(false);
  // };

  // const incAddrHL = function(): void {
  //   const addr = make16(cpu.regs.h, cpu.regs.l);
  //   const newVal = (readb(addr) + 1) & 0xff;
  //   writeb(addr, newVal);
  //   setZ(newVal === 0);
  //   setN(false);
  // };

  // const cp = function(val: number): void {
  //   setZ(cpu.regs.a == val);
  //   setN(true);
  //   setH(false);
  //   setC(cpu.regs.a < val);
  // };

  // const sub = function(val: number): void {
  //   const oldA = cpu.regs.a;
  //   const newA = cpu.regs.a = ((oldA - val) & 0xff);
  //   setZ(newA === 0);
  //   setN(true);
  //   setH(false); // TODO check borrow appropriately
  //   setC(cpu.regs.b > oldA);
  // };

  // const add = function(val: number): void {
  //   const oldA = cpu.regs.a;
  //   const result = oldA + val;
  //   const newA = cpu.regs.a = result & 0xff;
  //   setZ(newA === 0);
  //   setN(false);
  //   setH(false);
  //   setC(result >= 0x100);
  // };

  // const addR16R16 = function(dstHi: keyof Registers, dstLo: keyof Registers, srcHi: keyof Registers, srcLo: keyof Registers): void {
  //   const dstVal = make16(cpu.regs[dstHi], cpu.regs[dstLo]);
  //   const srcVal = make16(cpu.regs[srcHi], cpu.regs[srcLo]);
  //   const newVal = (dstVal + srcVal) & 0xffff;
  //   [cpu.regs[dstHi], cpu.regs[dstLo]] = break16(newVal);
  // };

  // const call = function(addr: number): void {
  //   push16(cpu.pc);
  //   cpu.pc = addr;
  // };

  // const swapR8 = function(reg: keyof Registers): void {
  //   const oldVal = cpu.regs[reg];
  //   const lowNibble = oldVal & 0x0f;
  //   const highNibble = oldVal & 0xf0;
  //   const newVal = (lowNibble << 4) | (highNibble >> 4);
  //   cpu.regs[reg] = newVal;
  //   setZ(oldVal === 0);
  // };

  // const execCB = function(): number {
  //   const inst = imm8();
  //   switch(inst) {
  //     case 0x11: // RL C
  //       logInst("RL C");
  //       rl("c");
  //       return 8;
  //     case 0x12: // RL D
  //       logInst("RL D");
  //       rl("d");
  //       return 8;
  //     case 0x23: // SLA E
  //       logInst("SLA E");
  //       sla("e");
  //       return 8;
  //     case 0x27: // SLA A
  //       logInst("SLA A");
  //       sla("a");
  //       return 8;
  //     case 0x37: // SWAP A
  //       logInst("SWAP A");
  //       swapR8("a");
  //       return 8;
  //     case 0x7c: // BIT 7,H
  //       logInst("BIT 7,H");
  //       bit(0x80, "h");
  //       return 8;
  //     case 0x87: // RES 0,A
  //       logInst("RES 0,A");
  //       res(0, "a");
  //       return 8;
  //     default:
  //       throw new Error(`unknown opcode cb ${hex8(inst)}`);
  //   }
  // };

  try {
    const intPending = interruptPending(bus);
    if (cpu.ime && intPending != null) {
      const vector = interruptVector(intPending);
      // console.log(`Servicing interrupt at vector ${hex16(vector)}`);
      cpu.ime = false;
      cpu.halt = false;
      clearInterrupt(bus, intPending);
      throw Error("TODO execute call to 0x" + hex16(vector));
      return 4;
    }
    if (cpu.halt) {
      return 4;
    }
    const insn = decodeInsn(cpu.pc, bus);
    const cycles = insn.exec(cpu, bus);
    cpu.pc += insn.length;
    return cycles;
    // let nn;
    // let i8;
    // let jaddr;
    // console.log(dump(cpu));
    //   const inst = imm8();
    //   switch(inst) {
    //     case 0x00: // NOP
    //       logInst("NOP");
    //       return 4;
    //     case 0x01: // LD BC,d16
    //       nn = imm16();
    //       logInst(`LD BC,${hex16(nn)}`);
    //       ldR16("b", "c", nn);
    //       return 12;
    //     case 0x02: // LD (BC),A
    //       logInst("LD (BC),A");
    //       writeb(make16(cpu.regs.b, cpu.regs.c), cpu.regs.a);
    //       return 8;
    //     case 0x03: // INC BC
    //       logInst("INC BC");
    //       inc16("b", "c");
    //       return 8;
    //     case 0x04: // INC B
    //       logInst("INC B");
    //       incR8("b");
    //       return 4;
    //     case 0x05: // DEC B
    //       logInst("DEC B");
    //       decR8("b");
    //       return 4;
    //     case 0x06: // LD B,d8
    //       i8 = imm8();
    //       logInst(`LD B,${hex8(i8)}`);
    //       cpu.regs.b = i8;
    //       return 8;
    //     case 0x09: // ADD HL,BC
    //       logInst("ADD HL,BC");
    //       addR16R16("h", "l", "b", "c");
    //       return 8;
    //     case 0x0A: // LD A,(BC)
    //       logInst("LD A,(BC)");
    //       cpu.regs.a = readb(make16(cpu.regs.b, cpu.regs.c));
    //       return 8;
    //     case 0x0B: // DEC BC
    //       logInst("DEC BC");
    //       dec16("b", "c");
    //       return 8;
    //     case 0x0C: // INC C
    //       logInst("INC C");
    //       incR8("c");
    //       return 4;
    //     case 0x0D: // DEC C
    //       logInst("DEC C");
    //       decR8("c");
    //       return 4;
    //     case 0x0E: // LD C,d8
    //       i8 = imm8();
    //       logInst(`LD C,${hex8(i8)}`);
    //       cpu.regs.c = i8;
    //       return 8;
    //     case 0x11: // LD DE,d16
    //       nn = imm16();
    //       logInst(`LD DE,${hex16(nn)}`);
    //       cpu.regs.d = nn >> 8;
    //       cpu.regs.e = nn & 0xff;
    //       return 12;
    //     case 0x12: // LD (DE),A
    //       logInst("LD (DE),A");
    //       writeb(make16(cpu.regs.d, cpu.regs.e), cpu.regs.a);
    //       return 8;
    //     case 0x13: // INC DE
    //       logInst("INC DE");
    //       inc16("d", "e");
    //       return 8;
    //     case 0x15: // DEC D
    //       logInst("DEC D");
    //       decR8("d");
    //       return 4;
    //     case 0x16: // LD D,d8
    //       i8 = imm8();
    //       logInst(`LD D,${hex8(i8)}`);
    //       cpu.regs.d = i8;
    //       return 8;
    //     case 0x17: // RLA
    //       logInst("RLA");
    //       rl("a");
    //       return 4;
    //     case 0x18: // JR r
    //       i8 = imm8();
    //       jaddr = cpu.pc + u8tos8(i8);
    //       logInst(`JR ${hex16(jaddr)}`);
    //       cpu.pc = jaddr;
    //       return 12;
    //     case 0x19: // ADD HL,DE
    //       logInst("ADD HL,DE");
    //       addR16R16("h", "l", "d", "e");
    //       return 8;
    //     case 0x1A: // LD A,(DE)
    //       logInst(`LD A,(DE)`);
    //       cpu.regs.a = readb(make16(cpu.regs.d, cpu.regs.e));
    //       return 8;
    //     case 0x1B: // DEC DE
    //       logInst("DEC DE");
    //       dec16("d", "e");
    //       return 8;
    //     case 0x1C: // INC E
    //       logInst("INC E");
    //       incR8("e");
    //       return 4;
    //     case 0x1D: // DEC E
    //       logInst("DEC E");
    //       decR8("e");
    //       return 4;
    //     case 0x1E: // LD E,n
    //       i8 = imm8();
    //       logInst(`LD E,${hex8(i8)}`);
    //       cpu.regs.e = i8;
    //       return 8;
    //     case 0x1F: // RRA
    //       logInst("RRA");
    //       rr("a");
    //       return 4;
    //     case 0x20: // JR NZ,r8
    //       i8 = imm8();
    //       jaddr = cpu.pc + u8tos8(i8);
    //       logInst(`JR NZ,${hex16(jaddr)}`);
    //       if (!getZ()) {
    //         cpu.pc = jaddr;
    //         return 12;
    //       }
    //       return 8;
    //     case 0x21: // LD HL,d16
    //       nn = imm16();
    //       logInst(`LD HL, ${hex16(nn)}`);
    //       ldR16("h", "l", nn);
    //       return 12;
    //     case 0x22: // LD (HL+),A
    //       logInst("LD (HL+),A");
    //       ldAddrReg(make16(cpu.regs.h, cpu.regs.l), "a");
    //       inc16("h", "l");
    //       return 8;
    //     case 0x23: // INC HL
    //       logInst("INC HL");
    //       inc16("h", "l");
    //       return 8;
    //     case 0x24: // INC H
    //       logInst("INC H");
    //       incR8("h");
    //       return 4;
    //     case 0x28: // JR Z,r
    //       i8 = imm8();
    //       jaddr = cpu.pc + u8tos8(i8);
    //       logInst(`JR Z,${hex16(jaddr)}`);
    //       if (getZ()) {
    //         cpu.pc = jaddr;
    //         return 12;
    //       }
    //       return 8;
    //     case 0x2A: // LD A,(HL+)
    //       logInst("LD A,(HL+)");
    //       cpu.regs.a = readb(make16(cpu.regs.h, cpu.regs.l));
    //       inc16("h", "l");
    //       return 8;
    //     case 0x2B: // DEC HL
    //       logInst("DEC HL");
    //       dec16("h", "l");
    //       return 8;
    //     case 0x2C: // INC L
    //       logInst("INC L");
    //       incR8("l");
    //       return 4;
    //     case 0x2E: // LD L,n
    //       i8 = imm8();
    //       logInst(`LD L,${hex8(i8)}`);
    //       cpu.regs.l = i8;
    //       return 8;
    //     case 0x2F: // CPL
    //       logInst("CPL");
    //       cpu.regs.a = ~cpu.regs.a & 0xff;
    //       setN(true);
    //       setH(true);
    //       return 4;
    //     case 0x30: // JR NC,r8
    //       i8 = imm8();
    //       jaddr = cpu.pc + u8tos8(i8);
    //       logInst(`JR NC,${hex16(jaddr)}`);
    //       if (!getC()) {
    //         cpu.pc = jaddr;
    //         return 12;
    //       }
    //       return 8;
    //     case 0x31: // LD SP,d16
    //       nn = imm16();
    //       logInst(`LD SP, ${hex16(nn)}`);
    //       cpu.regs.sp = nn;
    //       return 12;
    //     case 0x32: // LD (HL-),A
    //       logInst("LD (HL-),A");
    //       ldAddrReg(make16(cpu.regs.h, cpu.regs.l), "a");
    //       dec16("h", "l");
    //       return 8;
    //     case 0x34: // INC (HL)
    //       logInst("INC (HL)");
    //       incAddrHL();
    //       return 12;
    //     case 0x35: // DEC (HL)
    //       logInst("DEC (HL)");
    //       decAddr(make16(cpu.regs.h, cpu.regs.l));
    //       return 12;
    //     case 0x36: // LD (HL),d8
    //       i8 = imm8();
    //       logInst(`LD (HL),${hex8(i8)}`);
    //       writeb(make16(cpu.regs.h, cpu.regs.l), i8);
    //       return 12;
    //     case 0x38: // JR C,r8
    //       i8 = imm8();
    //       jaddr = cpu.pc + u8tos8(i8);
    //       logInst(`JR C,${hex16(jaddr)}`);
    //       if (getC()) {
    //         cpu.pc = jaddr;
    //         return 12;
    //       }
    //       return 8;
    //     case 0x3A: // LD A,(HL-)
    //       logInst("LD A,(HL-)");
    //       cpu.regs.a = readb(make16(cpu.regs.h, cpu.regs.l));
    //       dec16("h", "l");
    //       return 8;
    //     case 0x3C: // INC A
    //       logInst("INC A");
    //       incR8("a");
    //       return 4;
    //     case 0x3D: // DEC A
    //       logInst("DEC A");
    //       decR8("a");
    //       return 4;
    //     case 0x3E: // LD A,d8
    //       i8 = imm8();
    //       logInst(`LD A,${hex8(i8)}`);
    //       cpu.regs.a = i8;
    //       return 8;
    //     case 0x46: // LD B,(HL)
    //       logInst("LD B,(HL)");
    //       cpu.regs.b = readb(make16(cpu.regs.h, cpu.regs.l));
    //       return 8;
    //     case 0x47: // LD B,A
    //       logInst("LD B,A");
    //       cpu.regs.b = cpu.regs.a;
    //       return 4;
    //     case 0x4E: // LD C,(HL)
    //       logInst("LD C,(HL)");
    //       cpu.regs.c = readb(make16(cpu.regs.h, cpu.regs.l));
    //       return 8;
    //     case 0x4F: // LD C,A
    //       logInst("LD C,A");
    //       cpu.regs.c = cpu.regs.a;
    //       return 4;
    //     case 0x56: // LD D,(HL)
    //       logInst("LD D,(HL)");
    //       cpu.regs.d = readb(make16(cpu.regs.h, cpu.regs.l));
    //       return 16;
    //     case 0x57: // LD D,A
    //       logInst("LD D,A");
    //       cpu.regs.d = cpu.regs.a;
    //       return 4;
    //     case 0x5E: // LD E,(HL)
    //       logInst("LD E,(HL)");
    //       cpu.regs.e = readb(make16(cpu.regs.h, cpu.regs.l));
    //       return 16;
    //     case 0x5F: // LD E,A
    //       logInst("LD E,A");
    //       cpu.regs.e = cpu.regs.a;
    //       return 4;
    //     case 0x60: // LD H,B
    //       logInst("LD H,B");
    //       cpu.regs.h = cpu.regs.b;
    //       return 4;
    //     case 0x67: // LD H,A
    //       logInst("LD H,A");
    //       cpu.regs.h = cpu.regs.a;
    //       return 4;
    //     case 0x69: // LD L,C
    //       logInst("LD L,C");
    //       cpu.regs.l = cpu.regs.c;
    //       return 4;
    //     case 0x6F: // LD L,A
    //       logInst("LD L,A");
    //       cpu.regs.l = cpu.regs.a;
    //       return 4;
    //     case 0x71: // LD (HL),C
    //       logInst("LD (HL),C");
    //       setAtHL(cpu.regs.c);
    //       return 8;
    //     case 0x72: // LD (HL),D
    //       logInst("LD (HL),D");
    //       setAtHL(cpu.regs.d);
    //       return 8;
    //     case 0x73: // LD (HL),E
    //       logInst("LD (HL),E");
    //       setAtHL(cpu.regs.e);
    //       return 8;
    //     case 0x76: // HALT
    //       logInst("HALT");
    //       cpu.halt = true;
    //       return 4;
    //     case 0x77: // LD (HL),A
    //       logInst("LD (HL),A");
    //       writeb(make16(cpu.regs.h, cpu.regs.l), cpu.regs.a);
    //       return 8;
    //     case 0x78: // LD A,B
    //       logInst("LD A,B");
    //       cpu.regs.a = cpu.regs.b;
    //       return 4;
    //     case 0x79: // LD A,C
    //       logInst("LD A,C");
    //       cpu.regs.a = cpu.regs.c;
    //       return 4;
    //     case 0x7A: // LD A,D
    //       logInst("LD A,D");
    //       cpu.regs.a = cpu.regs.d;
    //       return 4;
    //     case 0x7B: // LD A,E
    //       logInst("LD A,E");
    //       cpu.regs.a = cpu.regs.e;
    //       return 4;
    //     case 0x7C: // LD A,H
    //       logInst("LD A,H");
    //       cpu.regs.a = cpu.regs.h;
    //       return 4;
    //     case 0x7D: // LD A,L
    //       logInst("LD A,L");
    //       cpu.regs.a = cpu.regs.l;
    //       return 4;
    //     case 0x7E: // LD A,(HL)
    //       logInst("LD A,(HL)");
    //       cpu.regs.a = readb(make16(cpu.regs.h, cpu.regs.l));
    //       return 8;
    //     case 0x85: // ADD A,L
    //       logInst("ADD A,L");
    //       add(cpu.regs.l);
    //       return 4;
    //     case 0x86: // ADD A,(HL)
    //       logInst("ADD A,(HL)");
    //       add(readb(make16(cpu.regs.h, cpu.regs.l)));
    //       return 8;
    //     case 0x90: // SUB B
    //       logInst("SUB B");
    //       sub(cpu.regs.b);
    //       return 4;
    //     case 0xA1: // AND C
    //       logInst("AND C");
    //       and(cpu.regs.c);
    //       return 4;
    //     case 0xA7: // AND A
    //       logInst("AND A");
    //       and(cpu.regs.a);
    //       return 4;
    //     case 0xA9: // XOR C
    //       logInst("XOR C");
    //       xor("c");
    //       return 4;
    //     case 0xAF: // XOR A
    //       logInst("XOR A");
    //       xor("a");
    //       return 4;
    //     case 0xB0: // OR B
    //       logInst("OR B");
    //       or(cpu.regs.b);
    //       return 4;
    //     case 0xB1: // OR C
    //       logInst("OR C");
    //       or(cpu.regs.c);
    //       return 4;
    //     case 0xB2: // OR D
    //       logInst("OR D");
    //       or(cpu.regs.d);
    //       return 4;
    //     case 0xB3: // OR E
    //       logInst("OR E");
    //       or(cpu.regs.e);
    //       return 4;
    //     case 0xB6: // OR (HL)
    //       logInst("OR (HL)");
    //       or(readb(make16(cpu.regs.h, cpu.regs.l)));
    //       return 8;
    //     case 0xB9: // CP C
    //       logInst("CP C");
    //       cp(cpu.regs.c);
    //       return 4;
    //     case 0xBE: // CP (HL)
    //       logInst("CP (HL)");
    //       cp(readb(make16(cpu.regs.h, cpu.regs.l)));
    //       return 8;
    //     case 0xC1: // POP BC
    //       logInst("POP BC");
    //       [cpu.regs.b, cpu.regs.c] = break16(pop16());
    //       return 12;
    //     case 0xC2: // JP NZ,a16
    //       nn = imm16();
    //       logInst(`JP NZ,${hex16(nn)}`);
    //       if (!getZ()) {
    //         cpu.pc = nn;
    //         return 16;
    //       }
    //       return 12;
    //     case 0xC3: // JP a16
    //       nn = imm16();
    //       logInst(`JP ${hex16(nn)}`);
    //       cpu.pc = nn;
    //       return 16;
    //     case 0xC5: // PUSH BC
    //       logInst("PUSH BC");
    //       push16(make16(cpu.regs.b, cpu.regs.c));
    //       return 16;
    //     case 0xC6: // ADD A,d8
    //       i8 = imm8();
    //       logInst(`ADD A,${hex8(i8)}`);
    //       add(i8);
    //       return 8;
    //     case 0xC7: // RST 00H
    //       logInst("RST 00H");
    //       call(0x0000);
    //       return 16;
    //     case 0xC8: // RET Z
    //       logInst("RET Z");
    //       if(getZ()) {
    //         cpu.pc = pop16();
    //         return 20;
    //       }
    //       return 8;
    //     case 0xC9: // RET
    //       logInst("RET");
    //       cpu.pc = pop16();
    //       return 16;
    //     case 0xCA: // JP Z,a16
    //       nn = imm16();
    //       logInst(`JP Z,${hex16(nn)}`);
    //       if (getZ()) {
    //         cpu.pc = nn;
    //         return 16;
    //       }
    //       return 12;
    //     case 0xCB: // CB prefix
    //       return execCB();
    //     case 0xCD: // CALL a16
    //       nn = imm16();
    //       logInst(`CALL ${hex16(nn)}`);
    //       call(nn);
    //       return 24;
    //     case 0xD1: // POP DE
    //       logInst("POP DE");
    //       [cpu.regs.d, cpu.regs.e] = break16(pop16());
    //       return 12;
    //     case 0xD5: // PUSH DE
    //       logInst("PUSH DE");
    //       push16(make16(cpu.regs.d, cpu.regs.e));
    //       return 16;
    //     case 0xD6: // SUB d8
    //       i8 = imm8();
    //       logInst(`SUB ${hex8(i8)}`);
    //       sub(i8);
    //       return 8;
    //     case 0xD9: // RETI
    //       logInst("RETI");
    //       cpu.ime = true;
    //       cpu.pc = pop16();
    //       return 16;
    //     case 0xE0: // LDH (a8),A
    //       nn = 0xff00 + imm8();
    //       logInst(`LDH (${hex16(nn)}),A`)
    //       writeb(nn, cpu.regs.a);
    //       return 12;
    //     case 0xE1: // POP HL
    //       logInst("POP HL");
    //       [cpu.regs.h, cpu.regs.l] = break16(pop16());
    //       return 12;
    //     case 0xE2: // LD (C),A
    //       logInst("LD (C),A");
    //       writeb(0xff00 + cpu.regs.c, cpu.regs.a);
    //       return 8;
    //     case 0xE5: // PUSH HL
    //       logInst("PUSH HL");
    //       push16(make16(cpu.regs.h, cpu.regs.l));
    //       return 16;
    //     case 0xE6: // AND d8
    //       i8 = imm8();
    //       logInst(`AND ${hex8(i8)}`);
    //       and(i8);
    //       return 8;
    //     case 0xE9: // JP HL
    //       logInst("JP HL");
    //       cpu.pc = make16(cpu.regs.h, cpu.regs.l);
    //       return 4;
    //     case 0xEA: // LD (nn),A
    //       nn = imm16();
    //       logInst(`LD (${hex16(nn)}),A`);
    //       writeb(nn, cpu.regs.a);
    //       return 16;
    //     case 0xF0: // LDH A,(n)
    //       i8 = imm8();
    //       logInst(`LDH A,(ff00+${hex8(i8)})`);
    //       cpu.regs.a = readb(0xff00 | i8);
    //       return 12;
    //     case 0xF1: // POP AF
    //       logInst("POP AF");
    //       [cpu.regs.a, cpu.regs.f] = break16(pop16());
    //       return 12;
    //     case 0xF3: // DI
    //       logInst("DI");
    //       cpu.ime = false;
    //       return 4;
    //     case 0xF5: // PUSH AF
    //       logInst("PUSH AF");
    //       push16(make16(cpu.regs.a, cpu.regs.f));
    //       return 16;
    //     case 0xFA: // LD A,(a16)
    //       nn = imm16();
    //       logInst(`LD A,(${hex16(nn)})`);
    //       cpu.regs.a = readb(nn);
    //       return 16;
    //     case 0xFB: // EI
    //       logInst("EI");
    //       cpu.ime = true;
    //       return 4;
    //     case 0xFE: // CP i8
    //       i8 = imm8();
    //       logInst(`CP ${hex8(i8)}`);
    //       cp(i8);
    //       return 8;
    //     default:
    //       throw new Error(`unknown opcode ${hex8(inst)}`);
    //   }
  } catch (err) {
    const stack = (err instanceof Error) ? err.stack : "";
    throw new Error(`Error while executing instruction at at ${hex16(instAddr)}\n${String(err)}\n${stack}`);
  }
}
