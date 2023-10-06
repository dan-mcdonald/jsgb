import { Bus } from "./bus";
import { hex8, hex16, u8tos8, make16, break16, hexs8 } from "./util";
import { interruptVector, interruptPending, clearInterrupt } from "./interrupt";

type InstructionFunction = (cpu: CPU, bus: Bus) => number;

export class Flags extends Number {
  constructor(f: number) {
    super(f & 0xf0);
  }
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

function stackDump(cpu: CPU, bus: Bus): number[] {
  const elems: number[] = [];
  const initSp = cpu.regs.sp;
  for (let i = 0; i < 10 && cpu.regs.sp < 0xfffe; i++) {
    try {
      elems.push(pop16(cpu, bus));
    } catch (_) {
      break;
    }
  }
  cpu.regs.sp = initSp;
  return elems;
}

export interface Instruction {
  length: number;
  text: string;
  exec(cpu: CPU, bus: Bus): number;
}

function xor(cpu: CPU, val: number): void {
  const res = (cpu.regs.a ^= val);
  cpu.f = cpu.f.setZ(res == 0).setN(false).setH(false).setC(false);
}

function xor_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    xor(cpu, get8(cpu, bus, reg));
    return 4;
  };
}

export enum R16 {
  AF,
  BC,
  DE,
  HL,
  SP,
  PC,
}

export enum OP8 {
  B = -1,
  C = -2,
  D = -3,
  E = -4,
  H = -5,
  L = -6,
  AT_HL = -7,
  A = -8,
}

function isImm(opnd: OP8) {
  return opnd as number >= 0;
}

function decodeOperand(opcode: number) {
  const opndBits = opcode & 0x07;
  return -(opndBits + 1) as OP8;
}

function disasmOpnd(opnd: OP8): string {
  switch (opnd) {
    case OP8.B:
      return "b";
    case OP8.C:
      return "c";
    case OP8.D:
      return "d";
    case OP8.E:
      return "e";
    case OP8.H:
      return "h";
    case OP8.L:
      return "l";
    case OP8.AT_HL:
      return "(hl)";
    case OP8.A:
      return "a";
    default:
      return hex8(opnd as number);
  }
}

function get8(cpu: CPU, bus: Bus, op8: OP8): number {
  switch (op8) {
    case OP8.B:
      return cpu.regs.b;
    case OP8.C:
      return cpu.regs.c;
    case OP8.D:
      return cpu.regs.d;
    case OP8.E:
      return cpu.regs.e;
    case OP8.H:
      return cpu.regs.h;
    case OP8.L:
      return cpu.regs.l;
    case OP8.AT_HL:
      return bus.readb(get16(cpu, R16.HL));
    case OP8.A:
      return cpu.regs.a;
    default:
      return op8 as number;
  }
}

function set8(cpu: CPU, bus: Bus, reg: OP8, val: number): void {
  switch (reg) {
    case OP8.B:
      cpu.regs.b = val;
      break;
    case OP8.C:
      cpu.regs.c = val;
      break;
    case OP8.D:
      cpu.regs.d = val;
      break;
    case OP8.E:
      cpu.regs.e = val;
      break;
    case OP8.H:
      cpu.regs.h = val;
      break;
    case OP8.L:
      cpu.regs.l = val;
      break;
    case OP8.AT_HL:
      bus.writeb(get16(cpu, R16.HL), val);
      break;
    case OP8.A:
      cpu.regs.a = val;
      break;
    default:
      throw new Error("set8 called with immediate operand");
  }
}

function set16(cpu: CPU, target: R16, val: number): void {
  switch (target) {
    case R16.SP:
      cpu.regs.sp = val;
      break;
    case R16.PC:
      cpu.pc = val;
      break;
    case R16.AF:
      cpu.regs.a = val >> 8;
      cpu.f = new Flags(val);
      break;
    case R16.BC:
      cpu.regs.b = val >> 8;
      cpu.regs.c = val & 0xff;
      break;
    case R16.DE:
      cpu.regs.d = val >> 8;
      cpu.regs.e = val & 0xff;
      break;
    case R16.HL:
      cpu.regs.h = val >> 8;
      cpu.regs.l = val & 0xff;
      break;
  }
}

function get16(cpu: CPU, reg: R16): number {
  switch (reg) {
    case R16.AF:
      return cpu.regs.a << 8 | cpu.f.valueOf();
    case R16.BC:
      return cpu.regs.b << 8 | cpu.regs.c;
    case R16.DE:
      return cpu.regs.d << 8 | cpu.regs.e;
    case R16.HL:
      return cpu.regs.h << 8 | cpu.regs.l;
    case R16.SP:
      return cpu.regs.sp;
    case R16.PC:
      return cpu.pc;
  }
}

function ei(cpu: CPU, _: Bus): number {
  cpu.ime = true;
  return 4;
}

function di(cpu: CPU, _: Bus): number {
  cpu.ime = false;
  return 4;
}

function scf(cpu: CPU, _: Bus): number {
  cpu.f = cpu.f.setN(false).setH(false).setC(true);
  return 4;
}

function ccf(cpu: CPU, _: Bus): number {
  cpu.f = cpu.f.setN(false).setH(false).setC(!cpu.f.C());
  return 4;
}

export function daa(cpu: CPU, _: Bus): number {
  const oldA = cpu.regs.a;
  let newA = oldA;
  if (cpu.f.H() || (oldA & 0xf) > 9) {
    newA += cpu.f.N() ? -0x06 : 0x06;
  }
  if (cpu.f.C() || oldA > 0x99) {
    newA += cpu.f.N() ? -0x60 : 0x60;
  }
  newA &= 0xff;
  cpu.regs.a = newA;
  cpu.f = cpu.f.setZ(newA == 0).setH(false).setC(oldA > 0x99);
  return 4;
}

function res_r8(bit: number, reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const val = get8(cpu, bus, reg);
    set8(cpu, bus, reg, val & ~(1 << bit));
    return 8;
  };
}

function set_r8(bit: number, reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const val = get8(cpu, bus, reg);
    set8(cpu, bus, reg, val | (1 << bit));
    return 8;
  };
}

function bit_r8(bit: number, reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const val = get8(cpu, bus, reg);
    cpu.f = cpu.f.setZ((val & (1 << bit)) === 0).setN(false).setH(true);
    return 8;
  };
}

function and(cpu: CPU, val: number): void {
  const res = (cpu.regs.a &= val);
  cpu.f = cpu.f.setZ(res == 0).setN(false).setH(true).setC(false);
}

function and_n8(val: number): InstructionFunction {
  return function (cpu: CPU, _: Bus): number {
    and(cpu, val);
    return 8;
  };
}

function and_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    and(cpu, get8(cpu, bus, reg));
    return reg == OP8.AT_HL ? 8 : 4;
  };
}

function or(cpu: CPU, val: number): void {
  const res = (cpu.regs.a |= val);
  cpu.f = cpu.f.setZ(res == 0).setN(false).setH(false).setC(false);
}

function or_r8(opnd: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus) {
    or(cpu, get8(cpu, bus, opnd));
    return opnd == OP8.AT_HL || isImm(opnd) ? 8 : 4;
  };
}

function ld_r16_n16(target: R16, val: number): InstructionFunction {
  return function (cpu: CPU, _: Bus): number {
    set16(cpu, target, val);
    return 12;
  };
}

function ld_HL_SP_plus_n8(val: number): InstructionFunction {
  return function (cpu: CPU, _: Bus): number {
    const oldVal = get16(cpu, R16.SP);
    const newVal = (oldVal + val) & 0xffff;
    set16(cpu, R16.HL, newVal);
    cpu.f = cpu.f.setZ(false).setN(false).setH((oldVal & 0xf) + (val & 0xf) > 0xf).setC((oldVal & 0xff) + val > 0xff);
    return 12;
  };
}

function ld_SP_HL(cpu: CPU, _: Bus) {
  set16(cpu, R16.SP, get16(cpu, R16.HL));
  return 8;
}

function ld_at_n16_r16(addr: number, reg: R16): InstructionFunction {
  return function(cpu: CPU, bus: Bus) {
    const val = get16(cpu, reg);
    bus.writeb(addr, val >> 8);
    bus.writeb(addr + 1, val & 0xff);
    return 20;
  };
}

function ld_r8_at_r16(targetReg: OP8, addrReg: R16): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const addr = get16(cpu, addrReg);
    const val = bus.readb(addr);
    set8(cpu, bus, targetReg, val);
    return 8;
  };
}

function ld_r8_at_addr(targetReg: OP8, addr: number): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const val = bus.readb(addr);
    set8(cpu, bus, targetReg, val);
    return 8;
  };
}

function ld_at_r16_r8(destAddrReg: R16, valReg: OP8): (cpu: CPU, bus: Bus) => number {
  return function (cpu: CPU, bus: Bus): number {
    const destAddr = get16(cpu, destAddrReg);
    const val = get8(cpu, bus, valReg);
    bus.writeb(destAddr, val);
    return 8;
  };
}

function ld_at_n16_r8(destAddr: number, valReg: OP8): (cpu: CPU, bus: Bus) => number {
  return function (cpu: CPU, bus: Bus): number {
    const val = get8(cpu, bus, valReg);
    bus.writeb(destAddr, val);
    return 8;
  };
}

function dec16(cpu: CPU, reg: R16): void {
  const oldVal = get16(cpu, reg);
  const newVal = (oldVal - 1) & 0xffff;
  set16(cpu, reg, newVal);
}

export function dec_r16(reg: R16): InstructionFunction {
  return function (cpu: CPU, _: Bus): number {
    dec16(cpu, reg);
    return 8;
  };
}

function inc16(cpu: CPU, reg: R16): void {
  const oldVal = get16(cpu, reg);
  const newVal = (oldVal + 1) & 0xffff;
  set16(cpu, reg, newVal);
}

function inc_r16(reg: R16): InstructionFunction {
  return function (cpu: CPU, _: Bus): number {
    inc16(cpu, reg);
    return 8;
  };
}

export function ldd_at_r16_r8(destAddrReg: R16, val: OP8): (cpu: CPU, bus: Bus) => number {
  return function (cpu: CPU, bus: Bus): number {
    ld_at_r16_r8(destAddrReg, val)(cpu, bus);
    dec16(cpu, destAddrReg);
    return 8;
  };
}

export function ldd_r8_at_r16(destAddrReg: OP8, atRegSrc: R16.HL): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    ld_r8_at_r16(destAddrReg, atRegSrc)(cpu, bus);
    dec16(cpu, atRegSrc);
    return 8;
  };
}

export function ldi_at_r16_r8(destAddrReg: R16, val: OP8): (cpu: CPU, bus: Bus) => number {
  return function (cpu: CPU, bus: Bus): number {
    ld_at_r16_r8(destAddrReg, val)(cpu, bus);
    inc16(cpu, destAddrReg);
    return 8;
  };
}

export function ldi_r8_at_r16(destAddrReg: OP8, atRegSrc: R16.HL): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    ld_r8_at_r16(destAddrReg, atRegSrc)(cpu, bus);
    inc16(cpu, atRegSrc);
    return 8;
  };
}

function ld_r8_r8(dest: OP8, src: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const val = get8(cpu, bus, src);
    set8(cpu, bus, dest, val);
    return 4;
  };
}

function ld_at_n8_r8(destAddr: number, fromReg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const val = get8(cpu, bus, fromReg);
    bus.writeb(destAddr, val);
    return 8;
  };
}

function ld_a_at_ff00_plus_c(cpu: CPU, bus: Bus): number {
  const addr = 0xff00 + cpu.regs.c;
  const val = bus.readb(addr);
  cpu.regs.a = val;
  return 8;
}

function inc_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus) {
    const oldVal = get8(cpu, bus, reg);
    const newVal = (oldVal + 1) & 0xff;
    set8(cpu, bus, reg, newVal);
    cpu.f = cpu.f.setZ(newVal === 0).setN(false).setH((oldVal & 0xf) == 0xf);
    return reg == OP8.AT_HL ? 12 : 4;
  };
}

function dec(cpu: CPU, val: number): number {
  const newVal = (val - 1) & 0xff;
  cpu.f = cpu.f.setZ(newVal === 0).setN(true).setH((val & 0xf) == 0);
  return newVal;
}

function dec_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus) {
    const oldVal = get8(cpu, bus, reg);
    const newVal = dec(cpu, oldVal);
    set8(cpu, bus, reg, newVal);
    return reg == OP8.AT_HL ? 12 : 4;
  };
}

function push16(cpu: CPU, bus: Bus, val: number): void {
  const [hi, lo] = break16(val);
  cpu.regs.sp -= 2;
  bus.writeb(cpu.regs.sp + 1, lo);
  bus.writeb(cpu.regs.sp + 2, hi);
}

function pop16(cpu: CPU, bus: Bus): number {
  const hi = bus.readb(cpu.regs.sp + 2);
  const lo = bus.readb(cpu.regs.sp + 1);
  cpu.regs.sp += 2;
  return make16(hi, lo);
}

export function pop_r16(reg: R16): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const val = pop16(cpu, bus);
    set16(cpu, reg, val);
    return 16;
  };
}

export function push_r16(reg: R16): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    push16(cpu, bus, get16(cpu, reg));
    return 16;
  };
}

function call(addr: number): InstructionFunction {
  return function (cpu: CPU, bus: Bus) {
    push16(cpu, bus, cpu.pc);
    cpu.pc = addr;
    return 24;
  };
}

function call_cond(pred: CpuCond, addr: number): InstructionFunction {
  return function (cpu: CPU, bus: Bus) {
    if (pred(cpu)) {
      push16(cpu, bus, cpu.pc);
      cpu.pc = addr;
      return 24;
    }
    return 12;
  };
}

function rst(addr: number): InstructionFunction {
  return function (cpu: CPU, bus: Bus) {
    push16(cpu, bus, cpu.pc);
    cpu.pc = addr;
    return 16;
  };
}

function reti(cpu: CPU, bus: Bus): number {
  cpu.ime = true;
  cpu.pc = pop16(cpu, bus);
  return 16;
}

type CpuCond = (cpu: CPU) => boolean;

function ret_cond(pred: CpuCond): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    if (pred(cpu)) {
      cpu.pc = pop16(cpu, bus);
      return 20;
    }
    return 8;
  };
}

function halt(cpu: CPU, _: Bus): number {
  cpu.halt = true;
  return 4;
}

// functionally STOP is the same as HALT but the screen turns white
const stop = halt;

function cp(cpu: CPU, val: number): void {
  const diff = ((cpu.regs.a - val) & 0xff);
  cpu.f = cpu.f.setZ(diff == 0).setN(true).setH(false).setC(val > cpu.regs.a);
}

function cp_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    cp(cpu, get8(cpu, bus, reg));
    return 4;
  };
}

function sub(cpu: CPU, val: number): void {
  // A = A - val
  const oldA = cpu.regs.a;
  const newA = (oldA - val) & 0xff;
  cpu.regs.a = newA;
  cpu.f = cpu.f.setZ(newA == 0).setN(true).setH((oldA & 0xf) < (val & 0xf)).setC(oldA < val);
}

function sub_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    sub(cpu, get8(cpu, bus, reg));
    return reg == OP8.AT_HL ? 8 : 4;
  };
}

function cpl(cpu: CPU, _: Bus): number {
  cpu.regs.a ^= 0xff;
  cpu.f = cpu.f.setN(true).setH(true);
  return 4;
}

function swap(cpu: CPU, val: number): number {
  cpu.f = cpu.f.setZ(val == 0).setN(false).setH(false).setC(false);
  const lo = val & 0x0f;
  const hi = val & 0xf0;
  return (hi >> 4) | (lo << 4);
}

function swap_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus) {
    const oldVal = get8(cpu, bus, reg);
    const newVal = swap(cpu, oldVal);
    set8(cpu, bus, reg, newVal);
    return reg == OP8.AT_HL ? 16 : 8;
  };
}

function add(cpu: CPU, val: number): void {
  // A = A + val
  const oldA = cpu.regs.a;
  const newA = (oldA + val) & 0xff;
  cpu.regs.a = newA;
  cpu.f = cpu.f.setZ(newA == 0).setN(false).setH((oldA & 0xf) + (val & 0xf) > 0xf).setC(oldA + val > 0xff);
}

function add_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    add(cpu, get8(cpu, bus, reg));
    return reg == OP8.AT_HL || isImm(reg) ? 8 : 4;
  };
}

export function add_r16_r16(dest: R16, addend: R16): InstructionFunction {
  return function (cpu: CPU, _: Bus): number {
    const oldVal = get16(cpu, dest);
    const newVal = (oldVal + get16(cpu, addend)) & 0xffff;
    set16(cpu, dest, newVal);
    cpu.f = cpu.f.setN(false).setH((oldVal & 0xfff) + (newVal & 0xfff) > 0xfff).setC(oldVal + newVal > 0xffff);
    return 8;
  };
}

function add_SP_s8(val: number): InstructionFunction {
  return function (cpu: CPU, _: Bus): number {
    const oldVal = get16(cpu, R16.SP);
    const newVal = (oldVal + val) & 0xffff;
    set16(cpu, R16.SP, newVal);
    cpu.f = cpu.f.setZ(false).setN(false).setH((oldVal & 0xf) + (val & 0xf) > 0xf).setC((oldVal & 0xff) + val > 0xff);
    return 16;
  };
}

function cond_z(cpu: CPU): boolean {
  return cpu.f.Z();
}

function cond_nz(cpu: CPU): boolean {
  return !cpu.f.Z();
}

function cond_c(cpu: CPU): boolean {
  return cpu.f.C();
}

function cond_nc(cpu: CPU): boolean {
  return !cpu.f.C();
}

function jr_cond_addr(cond: CpuCond, addr: number): InstructionFunction {
  return function (cpu: CPU, _: Bus): number {
    if (cond(cpu)) {
      cpu.pc = addr;
      return 12;
    }
    return 8;
  };
}

function jp_cond_addr(cond: CpuCond, addr: number): InstructionFunction {
  return function (cpu: CPU, _: Bus): number {
    if (cond(cpu)) {
      cpu.pc = addr;
      return 16;
    }
    return 12;
  };
}

function jp_addr(addr: number): InstructionFunction {
  return function (cpu: CPU, _: Bus): number {
    cpu.pc = addr;
    return 12;
  };
}

function jp_HL(cpu: CPU, _: Bus): number {
  cpu.pc = (cpu.regs.h << 8) | cpu.regs.l;
  return 4;
}

// Rotate left (not through carry) A
// NB subtly different than rlc because Z is always cleared and timing is faster
function rlca(cpu: CPU, _: Bus): number {
  const oldVal = cpu.regs.a;
  const newVal = ((oldVal << 1) | (oldVal >> 7)) & 0xff;
  cpu.regs.a = newVal;
  cpu.f = cpu.f.setZ(false).setN(false).setH(false).setC((oldVal & 0x80) !== 0);
  return 4;
}

// Rotate left (not through carry)
function rlc(cpu: CPU, val: number): number {
  cpu.f = cpu.f.setZ(val == 0).setN(false).setH(false).setC((val & 0x80) !== 0);
  return ((val << 1) | (val >> 7)) & 0xff;
}

function rlc_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const oldVal = get8(cpu, bus, reg);
    const newVal = rlc(cpu, oldVal);
    set8(cpu, bus, reg, newVal);
    return reg == OP8.AT_HL ? 16 : 8;
  };
}

// Rotate left through carry
function rl_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const oldVal = get8(cpu, bus, reg);
    const newVal = ((oldVal << 1) | (cpu.f.C() ? 1 : 0)) & 0xff;
    set8(cpu, bus, reg, newVal & 0xff);
    cpu.f = cpu.f.setZ(newVal === 0).setN(false).setH(false).setC((oldVal & 0x80) !== 0);
    return reg == OP8.AT_HL ? 16 : 8;
  };
}

function rr(cpu: CPU, val: number): number {
  const newVal = ((val >> 1) | (val << 7)) & 0xff;
  cpu.f = cpu.f.setZ(newVal == 0).setN(false).setH(false).setC((val & 0x01) !== 0);
  return newVal;
}

function rr_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const oldVal = get8(cpu, bus, reg);
    const newVal = rr(cpu, oldVal);
    set8(cpu, bus, reg, newVal);
    return 8;
  };
}

// Rotate right (not through carry) A
// NB subtly different than rrc because Z is always cleared and timing is faster
function rrca(cpu: CPU, _: Bus): number {
  const oldVal = cpu.regs.a;
  const newVal = ((oldVal >> 1) | (oldVal << 7)) & 0xff;
  cpu.regs.a = newVal;
  cpu.f = cpu.f.setZ(false).setN(false).setH(false).setC((oldVal & 0x01) !== 0);
  return 4;
}

function rrc(cpu: CPU, val: number): number {
  cpu.f = cpu.f.setZ(val == 0).setN(false).setH(false).setC((val & 0x01) !== 0);
  return ((val >> 1) | (val << 7)) & 0xff;
}

function rrc_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const oldVal = get8(cpu, bus, reg);
    const newVal = rrc(cpu, oldVal);
    set8(cpu, bus, reg, newVal);
    return 8;
  };
}

function srl(cpu: CPU, val: number): number {
  cpu.f = cpu.f.setZ(val == 0).setN(false).setH(false).setC((val & 0x01) !== 0);
  return val >> 1;
}

function srl_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const oldVal = get8(cpu, bus, reg);
    const newVal = srl(cpu, oldVal);
    set8(cpu, bus, reg, newVal);
    return reg == OP8.AT_HL ? 16 : 8;
  };
}

function adc(cpu: CPU, val: number): void {
  const oldA = cpu.regs.a;
  const newVal = (oldA + val + (cpu.f.C() ? 1 : 0)) & 0xff;
  cpu.regs.a = newVal;
  cpu.f = cpu.f
    .setZ(newVal === 0)
    .setN(false)
    .setH((oldA & 0xf) + (val & 0xf) + (cpu.f.C() ? 1 : 0) > 0xf)
    .setC(oldA + val + (cpu.f.C() ? 1 : 0) > 0xff);
}

function adc_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    adc(cpu, get8(cpu, bus, reg));
    return reg == OP8.AT_HL || isImm(reg) ? 8 : 4;
  };
}

function sbc(cpu: CPU, val: number): void {
  const oldA = cpu.regs.a;
  const newVal = (oldA - val - (cpu.f.C() ? 1 : 0)) & 0xff;
  cpu.regs.a = newVal;
  cpu.f = cpu.f
    .setZ(newVal === 0)
    .setN(true)
    .setH((oldA & 0xf) < (val & 0xf) + (cpu.f.C() ? 1 : 0))
    .setC(oldA < val + (cpu.f.C() ? 1 : 0));
}

function sbc_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    sbc(cpu, get8(cpu, bus, reg));
    return reg == OP8.AT_HL || isImm(reg) ? 8 : 4;
  };
}

function sla(cpu: CPU, val: number): number {
  const newVal = (val << 1) & 0xff;
  cpu.f = cpu.f.setZ(newVal == 0).setN(false).setH(false).setC((val & 0x80) !== 0);
  return newVal;
}

function sla_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const oldVal = get8(cpu, bus, reg);
    const newVal = sla(cpu, oldVal);
    set8(cpu, bus, reg, newVal);
    return reg == OP8.AT_HL ? 16 : 8;
  };
}

function sra(cpu: CPU, val: number): number {
  const newVal = (val >> 1) | (val & 0x80);
  cpu.f = cpu.f.setZ(newVal == 0).setN(false).setH(false).setC((val & 0x01) !== 0);
  return newVal;
}

function sra_r8(reg: OP8): InstructionFunction {
  return function (cpu: CPU, bus: Bus): number {
    const oldVal = get8(cpu, bus, reg);
    const newVal = sra(cpu, oldVal);
    set8(cpu, bus, reg, newVal);
    return reg == OP8.AT_HL ? 16 : 8;
  };
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
  let s8: number;
  let jaddr: number;
  function decodeCbInsn(): Instruction {
    const opcode = bus.readb(addr + length++);
    const opnd = decodeOperand(opcode);
    const opndText = disasmOpnd(opnd);
    const decodeBit = (opcode >> 3) & 0x7;
    const opGroup = opcode >> 3;
    switch (opGroup) {
      case 0x00:
        return {
          length,
          text: "rlc  " + opndText,
          exec: rlc_r8(opnd),
        };
      case 0x01:
        return {
          length,
          text: "rrc  " + opndText,
          exec: rrc_r8(opnd),
        };
      case 0x02:
        return {
          length,
          text: "rl   " + opndText,
          exec: rl_r8(opnd),
        };
      case 0x03:
        return {
          length,
          text: "rr   " + opndText,
          exec: rr_r8(opnd),
        };
      case 0x04:
        return {
          length,
          text: "sla  " + opndText,
          exec: sla_r8(opnd),
        };
      case 0x05:
        return {
          length,
          text: "sra  " + opndText,
          exec: sra_r8(opnd),
        };
      case 0x06:
        return {
          length,
          text: "swap " + opndText,
          exec: swap_r8(opnd),
        };
      case 0x07:
        return {
          length,
          text: "srl  " + opndText,
          exec: srl_r8(opnd),
        };
      case 0x08:
      case 0x09:
      case 0x0A:
      case 0x0B:
      case 0x0C:
      case 0x0D:
      case 0x0E:
      case 0x0F:
        return {
          length,
          text: "bit  " + decodeBit + "," + opndText,
          exec: bit_r8(decodeBit, OP8.B),
        };
      case 0x10:
      case 0x11:
      case 0x12:
      case 0x13:
      case 0x14:
      case 0x15:
      case 0x16:
      case 0x17:
        return {
          length,
          text: "res  " + decodeBit + "," + opndText,
          exec: res_r8(decodeBit, opnd),
        };
      case 0x18:
      case 0x19:
      case 0x1A:
      case 0x1B:
      case 0x1C:
      case 0x1D:
      case 0x1E:
      case 0x1F:
        return {
          length,
          text: "set  " + decodeBit + "," + opndText,
          exec: set_r8(decodeBit, opnd),
        };
      default:
        return {
          length,
          text: "undefined opcode",
          exec: () => {
            const opcodeClosure = opcode;
            const addrClosure = addr;
            throw Error(`unrecognized opcode cb ${hex8(opcodeClosure)} at ${hex16(addrClosure)}`);
          }
        };
    }
  }
  switch (opcode) {
    case 0x00:
      return {
        length,
        text: "nop  ",
        exec: () => 4
      };
    case 0x01:
      n16 = decodeImm16();
      return {
        length,
        text: "ld   bc," + hex16(n16),
        exec: ld_r16_n16(R16.BC, n16),
      };
    case 0x02:
      return {
        length,
        text: "ld   (bc),a",
        exec: ld_at_r16_r8(R16.BC, OP8.A),
      };
    case 0x03:
      return {
        length,
        text: "inc  bc",
        exec: inc_r16(R16.BC),
      };
    case 0x04:
      return {
        length,
        text: "inc  b",
        exec: inc_r8(OP8.B),
      };
    case 0x05:
      return {
        length,
        text: "dec  b",
        exec: dec_r8(OP8.B),
      };
    case 0x06:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   b," + hex8(n8),
        exec: ld_r8_r8(OP8.B, n8 as OP8),
      };
    case 0x07:
      return {
        length,
        text: "rlca ",
        exec: rlca,
      };
    case 0x08:
      n16 = decodeImm16();
      return {
        length,
        text: "ld   (" + hex16(n16) + "),sp",
        exec: ld_at_n16_r16(n16, R16.SP),
      };
    case 0x09:
      return {
        length,
        text: "add  hl,bc",
        exec: add_r16_r16(R16.HL, R16.BC),
      };
    case 0x0A:
      return {
        length,
        text: "ld   a,(bc)",
        exec: ld_r8_at_r16(OP8.A, R16.BC),
      };
    case 0x0B:
      return {
        length,
        text: "dec  bc",
        exec: dec_r16(R16.BC),
      };
    case 0x0C:
      return {
        length,
        text: "inc  c",
        exec: inc_r8(OP8.C),
      };
    case 0x0D:
      return {
        length,
        text: "dec  c",
        exec: dec_r8(OP8.C),
      };
    case 0x0E:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   c," + hex8(n8),
        exec: ld_r8_r8(OP8.C, n8 as OP8),
      };
    case 0x0F:
      return {
        length,
        text: "rrca ",
        exec: rrca,
      };
    case 0x10:
      n8 = decodeImm8();
      return {
        length,
        text: n8 == 0x00 ? "stop" : "<corrupted stop>",
        exec: stop,
      };
    case 0x11:
      n16 = decodeImm16();
      return {
        length,
        text: "ld   de," + hex16(n16),
        exec: ld_r16_n16(R16.DE, n16),
      };
    case 0x12:
      return {
        length,
        text: "ld   (de),a",
        exec: ld_at_r16_r8(R16.DE, OP8.A),
      };
    case 0x13:
      return {
        length,
        text: "inc  de",
        exec: inc_r16(R16.DE)
      };
    case 0x14:
      return {
        length,
        text: "inc  d",
        exec: inc_r8(OP8.D),
      };
    case 0x15:
      return {
        length,
        text: "dec  d",
        exec: dec_r8(OP8.D),
      };
    case 0x16:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   d," + hex8(n8),
        exec: ld_r8_r8(OP8.D, n8 as OP8),
      };
    case 0x17:
      return {
        length,
        text: "rla  ",
        exec: rl_r8(OP8.A),
      };
    case 0x18:
      n8 = decodeImm8();
      jaddr = addr + length + u8tos8(n8);
      return {
        length,
        text: "jr   " + hex16(jaddr),
        exec: jp_addr(jaddr),
      };
    case 0x19:
      return {
        length,
        text: "add  hl,de",
        exec: add_r16_r16(R16.HL, R16.DE),
      };
    case 0x1A:
      return {
        length,
        text: "ld   a,(de)",
        exec: ld_r8_at_r16(OP8.A, R16.DE),
      };
    case 0x1B:
      return {
        length,
        text: "dec  de",
        exec: dec_r16(R16.DE),
      };
    case 0x1C:
      return {
        length,
        text: "inc  e",
        exec: inc_r8(OP8.E),
      };
    case 0x1D:
      return {
        length,
        text: "dec  e",
        exec: dec_r8(OP8.E),
      };
    case 0x1E:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   e," + hex8(n8),
        exec: ld_r8_r8(OP8.E, n8 as OP8),
      };
    case 0x1F:
      return {
        length,
        text: "rra  ",
        exec: rr_r8(OP8.A),
      };
    case 0x20:
      n8 = decodeImm8();
      jaddr = addr + length + u8tos8(n8);
      return {
        length,
        text: "jr   nz," + hex16(jaddr),
        exec: jr_cond_addr(cond_nz, jaddr),
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
        exec: ldi_at_r16_r8(R16.HL, OP8.A),
      };
    case 0x23:
      return {
        length,
        text: "inc  hl",
        exec: inc_r16(R16.HL),
      };
    case 0x24:
      return {
        length,
        text: "inc  h",
        exec: inc_r8(OP8.H),
      };
    case 0x25:
      return {
        length,
        text: "dec  h",
        exec: dec_r8(OP8.H),
      };
    case 0x26:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   h," + hex8(n8),
        exec: ld_r8_r8(OP8.H, n8 as OP8),
      };
    case 0x27:
      return {
        length,
        text: "daa  ",
        exec: daa,
      };
    case 0x28:
      n8 = decodeImm8();
      jaddr = addr + length + u8tos8(n8);
      return {
        length,
        text: "jr   z," + hex16(jaddr),
        exec: jr_cond_addr(cond_z, jaddr),
      };
    case 0x29:
      return {
        length,
        text: "add  hl,hl",
        exec: add_r16_r16(R16.HL, R16.HL),
      };
    case 0x2A:
      return {
        length,
        text: "ldi  a,(hl)",
        exec: ldi_r8_at_r16(OP8.A, R16.HL),
      };
    case 0x2B:
      return {
        length,
        text: "dec  hl",
        exec: dec_r16(R16.HL),
      };
    case 0x2C:
      return {
        length,
        text: "inc  l",
        exec: inc_r8(OP8.L),
      };
    case 0x2D:
      return {
        length,
        text: "dec  l",
        exec: dec_r8(OP8.L),
      };
    case 0x2E:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   l," + hex8(n8),
        exec: ld_r8_r8(OP8.L, n8 as OP8),
      };
    case 0x2F:
      return {
        length,
        text: "cpl  ",
        exec: cpl,
      };
    case 0x30:
      n8 = decodeImm8();
      jaddr = addr + length + u8tos8(n8);
      return {
        length,
        text: "jr   nc," + hex16(jaddr),
        exec: jr_cond_addr(cond_nc, jaddr),
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
        exec: ldd_at_r16_r8(R16.HL, OP8.A),
      };
    case 0x33:
      return {
        length,
        text: "inc  sp",
        exec: inc_r16(R16.SP),
      };
    case 0x34:
      return {
        length,
        text: "inc  (hl)",
        exec: inc_r8(OP8.AT_HL),
      };
    case 0x35:
      return {
        length,
        text: "dec  (hl)",
        exec: dec_r8(OP8.AT_HL),
      };
    case 0x36:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   (hl)," + hex8(n8),
        exec: ld_at_r16_r8(R16.HL, n8 as OP8),
      };
    case 0x37:
      return {
        length,
        text: "scf  ",
        exec: scf,
      };
    case 0x38:
      n8 = decodeImm8();
      jaddr = addr + length + u8tos8(n8);
      return {
        length,
        text: "jr   c," + hex16(jaddr),
        exec: jr_cond_addr(cond_c, jaddr),
      };
    case 0x39:
      return {
        length,
        text: "add  hl,sp",
        exec: add_r16_r16(R16.HL, R16.SP),
      };
    case 0x3A:
      return {
        length,
        text: "ldd  a,(hl)",
        exec: ldd_r8_at_r16(OP8.A, R16.HL),
      };
    case 0x3B:
      return {
        length,
        text: "dec  sp",
        exec: dec_r16(R16.SP),
      };
    case 0x3C:
      return {
        length,
        text: "inc  a",
        exec: inc_r8(OP8.A),
      };
    case 0x3D:
      return {
        length,
        text: "dec  a",
        exec: dec_r8(OP8.A),
      };
    case 0x3E:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   a," + hex8(n8),
        exec: ld_r8_r8(OP8.A, n8 as OP8),
      };
    case 0x3F:
      return {
        length,
        text: "ccf  ",
        exec: ccf,
      };
    case 0x40:
      return {
        length,
        text: "ld   b,b",
        exec: ld_r8_r8(OP8.B, OP8.B),
      };
    case 0x41:
      return {
        length,
        text: "ld   b,c",
        exec: ld_r8_r8(OP8.B, OP8.C),
      };
    case 0x42:
      return {
        length,
        text: "ld   b,d",
        exec: ld_r8_r8(OP8.B, OP8.D),
      };
    case 0x43:
      return {
        length,
        text: "ld   b,e",
        exec: ld_r8_r8(OP8.B, OP8.E),
      };
    case 0x44:
      return {
        length,
        text: "ld   b,h",
        exec: ld_r8_r8(OP8.B, OP8.H),
      };
    case 0x45:
      return {
        length,
        text: "ld   b,l",
        exec: ld_r8_r8(OP8.B, OP8.L),
      };
    case 0x46:
      return {
        length,
        text: "ld   b,(hl)",
        exec: ld_r8_at_r16(OP8.B, R16.HL),
      };
    case 0x47:
      return {
        length,
        text: "ld   b,a",
        exec: ld_r8_r8(OP8.B, OP8.A),
      };
    case 0x48:
      return {
        length,
        text: "ld   c,b",
        exec: ld_r8_r8(OP8.C, OP8.B),
      };
    case 0x49:
      return {
        length,
        text: "ld   c,c",
        exec: ld_r8_r8(OP8.C, OP8.C),
      };
    case 0x4A:
      return {
        length,
        text: "ld   c,d",
        exec: ld_r8_r8(OP8.C, OP8.D),
      };
    case 0x4B:
      return {
        length,
        text: "ld   c,e",
        exec: ld_r8_r8(OP8.C, OP8.E),
      };
    case 0x4C:
      return {
        length,
        text: "ld   c,h",
        exec: ld_r8_r8(OP8.C, OP8.H),
      };
    case 0x4D:
      return {
        length,
        text: "ld   c,l",
        exec: ld_r8_r8(OP8.C, OP8.L),
      };
    case 0x4E:
      return {
        length,
        text: "ld   c,(hl)",
        exec: ld_r8_at_r16(OP8.C, R16.HL),
      };
    case 0x4F:
      return {
        length,
        text: "ld   c,a",
        exec: ld_r8_r8(OP8.C, OP8.A),
      };
    case 0x50:
      return {
        length,
        text: "ld   d,b",
        exec: ld_r8_r8(OP8.D, OP8.B),
      };
    case 0x51:
      return {
        length,
        text: "ld   d,c",
        exec: ld_r8_r8(OP8.D, OP8.C),
      };
    case 0x52:
      return {
        length,
        text: "ld   d,d",
        exec: ld_r8_r8(OP8.D, OP8.D),
      };
    case 0x53:
      return {
        length,
        text: "ld   d,e",
        exec: ld_r8_r8(OP8.D, OP8.E),
      };
    case 0x54:
      return {
        length,
        text: "ld   d,h",
        exec: ld_r8_r8(OP8.D, OP8.H),
      };
    case 0x55:
      return {
        length,
        text: "ld   d,l",
        exec: ld_r8_r8(OP8.D, OP8.L),
      };
    case 0x56:
      return {
        length,
        text: "ld   d,(hl)",
        exec: ld_r8_at_r16(OP8.D, R16.HL),
      };
    case 0x57:
      return {
        length,
        text: "ld   d,a",
        exec: ld_r8_r8(OP8.D, OP8.A),
      };
    case 0x58:
      return {
        length,
        text: "ld   e,b",
        exec: ld_r8_r8(OP8.E, OP8.B),
      };
    case 0x59:
      return {
        length,
        text: "ld   e,c",
        exec: ld_r8_r8(OP8.E, OP8.C),
      };
    case 0x5A:
      return {
        length,
        text: "ld   e,d",
        exec: ld_r8_r8(OP8.E, OP8.D),
      };
    case 0x5B:
      return {
        length,
        text: "ld   e,e",
        exec: ld_r8_r8(OP8.E, OP8.E),
      };
    case 0x5C:
      return {
        length,
        text: "ld   e,h",
        exec: ld_r8_r8(OP8.E, OP8.H),
      };
    case 0x5D:
      return {
        length,
        text: "ld   e,l",
        exec: ld_r8_r8(OP8.E, OP8.L),
      };
    case 0x5E:
      return {
        length,
        text: "ld   e,(hl)",
        exec: ld_r8_at_r16(OP8.E, R16.HL),
      };
    case 0x5F:
      return {
        length,
        text: "ld   e,a",
        exec: ld_r8_r8(OP8.E, OP8.A),
      };
    case 0x60:
      return {
        length,
        text: "ld   h,b",
        exec: ld_r8_r8(OP8.H, OP8.B),
      };
    case 0x61:
      return {
        length,
        text: "ld   h,c",
        exec: ld_r8_r8(OP8.H, OP8.C),
      };
    case 0x62:
      return {
        length,
        text: "ld   h,d",
        exec: ld_r8_r8(OP8.H, OP8.D),
      };
    case 0x63:
      return {
        length,
        text: "ld   h,e",
        exec: ld_r8_r8(OP8.H, OP8.E),
      };
    case 0x64:
      return {
        length,
        text: "ld   h,h",
        exec: ld_r8_r8(OP8.H, OP8.H),
      };
    case 0x65:
      return {
        length,
        text: "ld   h,l",
        exec: ld_r8_r8(OP8.H, OP8.L),
      };
    case 0x66:
      return {
        length,
        text: "ld   h,(hl)",
        exec: ld_r8_at_r16(OP8.H, R16.HL),
      };
    case 0x67:
      return {
        length,
        text: "ld   h,a",
        exec: ld_r8_r8(OP8.H, OP8.A),
      };
    case 0x68:
      return {
        length,
        text: "ld   l,b",
        exec: ld_r8_r8(OP8.L, OP8.B),
      };
    case 0x69:
      return {
        length,
        text: "ld   l,c",
        exec: ld_r8_r8(OP8.L, OP8.C),
      };
    case 0x6A:
      return {
        length,
        text: "ld   l,d",
        exec: ld_r8_r8(OP8.L, OP8.D),
      };
    case 0x6B:
      return {
        length,
        text: "ld   l,e",
        exec: ld_r8_r8(OP8.L, OP8.E),
      };
    case 0x6C:
      return {
        length,
        text: "ld   l,h",
        exec: ld_r8_r8(OP8.L, OP8.H),
      };
    case 0x6D:
      return {
        length,
        text: "ld   l,l",
        exec: ld_r8_r8(OP8.L, OP8.L),
      };
    case 0x6E:
      return {
        length,
        text: "ld   l,(hl)",
        exec: ld_r8_at_r16(OP8.L, R16.HL),
      };
    case 0x6F:
      return {
        length,
        text: "ld   l,a",
        exec: ld_r8_r8(OP8.L, OP8.A),
      };
    case 0x70:
      return {
        length,
        text: "ld   (hl),b",
        exec: ld_at_r16_r8(R16.HL, OP8.B),
      };
    case 0x71:
      return {
        length,
        text: "ld   (hl),c",
        exec: ld_at_r16_r8(R16.HL, OP8.C),
      };
    case 0x72:
      return {
        length,
        text: "ld   (hl),d",
        exec: ld_at_r16_r8(R16.HL, OP8.D),
      };
    case 0x73:
      return {
        length,
        text: "ld   (hl),e",
        exec: ld_at_r16_r8(R16.HL, OP8.E),
      };
    case 0x74:
      return {
        length,
        text: "ld   (hl),h",
        exec: ld_at_r16_r8(R16.HL, OP8.H),
      };
    case 0x75:
      return {
        length,
        text: "ld   (hl),l",
        exec: ld_at_r16_r8(R16.HL, OP8.L),
      };
    case 0x76:
      return {
        length,
        text: "halt ",
        exec: halt,
      };
    case 0x77:
      return {
        length,
        text: "ld   (hl),a",
        exec: ld_at_r16_r8(R16.HL, OP8.A),
      };
    case 0x78:
      return {
        length,
        text: "ld   a,b",
        exec: ld_r8_r8(OP8.A, OP8.B),
      };
    case 0x79:
      return {
        length,
        text: "ld   a,c",
        exec: ld_r8_r8(OP8.A, OP8.C),
      };
    case 0x7A:
      return {
        length,
        text: "ld   a,d",
        exec: ld_r8_r8(OP8.A, OP8.D),
      };
    case 0x7B:
      return {
        length,
        text: "ld   a,e",
        exec: ld_r8_r8(OP8.A, OP8.E)
      };
    case 0x7C:
      return {
        length,
        text: "ld   a,h",
        exec: ld_r8_r8(OP8.A, OP8.H),
      };
    case 0x7D:
      return {
        length,
        text: "ld   a,l",
        exec: ld_r8_r8(OP8.A, OP8.L),
      };
    case 0x7E:
      return {
        length,
        text: "ld   a,(hl)",
        exec: ld_r8_at_r16(OP8.A, R16.HL),
      };
    case 0x7F:
      return {
        length,
        text: "ld   a,a",
        exec: ld_r8_r8(OP8.A, OP8.A),
      };
    case 0x80:
      return {
        length,
        text: "add  b",
        exec: add_r8(OP8.B),
      };
    case 0x81:
      return {
        length,
        text: "add  c",
        exec: add_r8(OP8.C),
      };
    case 0x82:
      return {
        length,
        text: "add  d",
        exec: add_r8(OP8.D),
      };
    case 0x83:
      return {
        length,
        text: "add  e",
        exec: add_r8(OP8.E),
      };
    case 0x84:
      return {
        length,
        text: "add  h",
        exec: add_r8(OP8.H),
      };
    case 0x85:
      return {
        length,
        text: "add  l",
        exec: add_r8(OP8.L),
      };
    case 0x86:
      return {
        length,
        text: "add  (hl)",
        exec: add_r8(OP8.AT_HL),
      };
    case 0x87:
      return {
        length,
        text: "add  a",
        exec: add_r8(OP8.A),
      };
    case 0x88:
      return {
        length,
        text: "adc  b",
        exec: adc_r8(OP8.B),
      };
    case 0x89:
      return {
        length,
        text: "adc  c",
        exec: adc_r8(OP8.C),
      };
    case 0x8A:
      return {
        length,
        text: "adc  d",
        exec: adc_r8(OP8.D),
      };
    case 0x8B:
      return {
        length,
        text: "adc  e",
        exec: adc_r8(OP8.E),
      };
    case 0x8C:
      return {
        length,
        text: "adc  h",
        exec: adc_r8(OP8.H),
      };
    case 0x8D:
      return {
        length,
        text: "adc  l",
        exec: adc_r8(OP8.L),
      };
    case 0x8E:
      return {
        length,
        text: "adc  (hl)",
        exec: adc_r8(OP8.AT_HL),
      };
    case 0x8F:
      return {
        length,
        text: "adc  a",
        exec: adc_r8(OP8.A),
      };
    case 0x90:
      return {
        length,
        text: "sub  b",
        exec: sub_r8(OP8.B),
      };
    case 0x91:
      return {
        length,
        text: "sub  c",
        exec: sub_r8(OP8.C),
      };
    case 0x92:
      return {
        length,
        text: "sub  d",
        exec: sub_r8(OP8.D),
      };
    case 0x93:
      return {
        length,
        text: "sub  e",
        exec: sub_r8(OP8.E),
      };
    case 0x94:
      return {
        length,
        text: "sub  h",
        exec: sub_r8(OP8.H),
      };
    case 0x95:
      return {
        length,
        text: "sub  l",
        exec: sub_r8(OP8.L),
      };
    case 0x96:
      return {
        length,
        text: "sub  (hl)",
        exec: sub_r8(OP8.AT_HL),
      };
    case 0x97:
      return {
        length,
        text: "sub  a",
        exec: sub_r8(OP8.A),
      };
    case 0x98:
      return {
        length,
        text: "sbc  b",
        exec: sbc_r8(OP8.B),
      };
    case 0x99:
      return {
        length,
        text: "sbc  c",
        exec: sbc_r8(OP8.C),
      };
    case 0x9A:
      return {
        length,
        text: "sbc  d",
        exec: sbc_r8(OP8.D),
      };
    case 0x9B:
      return {
        length,
        text: "sbc  e",
        exec: sbc_r8(OP8.E),
      };
    case 0x9C:
      return {
        length,
        text: "sbc  h",
        exec: sbc_r8(OP8.H),
      };
    case 0x9D:
      return {
        length,
        text: "sbc  l",
        exec: sbc_r8(OP8.L),
      };
    case 0x9E:
      return {
        length,
        text: "sbc  (hl)",
        exec: sbc_r8(OP8.AT_HL),
      };
    case 0x9F:
      return {
        length,
        text: "sbc  a",
        exec: sbc_r8(OP8.A),
      };
    case 0xA0:
      return {
        length,
        text: "and  b",
        exec: and_r8(OP8.B),
      };
    case 0xA1:
      return {
        length,
        text: "and  c",
        exec: and_r8(OP8.C),
      };
    case 0xA2:
      return {
        length,
        text: "and  d",
        exec: and_r8(OP8.D),
      };
    case 0xA3:
      return {
        length,
        text: "and  e",
        exec: and_r8(OP8.E),
      };
    case 0xA4:
      return {
        length,
        text: "and  h",
        exec: and_r8(OP8.H),
      };
    case 0xA5:
      return {
        length,
        text: "and  l",
        exec: and_r8(OP8.L),
      };
    case 0xA6:
      return {
        length,
        text: "and  (hl)",
        exec: and_r8(OP8.AT_HL),
      };
    case 0xA7:
      return {
        length,
        text: "and  a",
        exec: and_r8(OP8.A),
      };
    case 0xA8:
      return {
        length,
        text: "xor  b",
        exec: xor_r8(OP8.B),
      };
    case 0xA9:
      return {
        length,
        text: "xor  c",
        exec: xor_r8(OP8.C),
      };
    case 0xAA:
      return {
        length,
        text: "xor  d",
        exec: xor_r8(OP8.D),
      };
    case 0xAB:
      return {
        length,
        text: "xor  e",
        exec: xor_r8(OP8.E),
      };
    case 0xAC:
      return {
        length,
        text: "xor  h",
        exec: xor_r8(OP8.H),
      };
    case 0xAD:
      return {
        length,
        text: "xor  l",
        exec: xor_r8(OP8.L),
      };
    case 0xAE:
      return {
        length,
        text: "xor  (hl)",
        exec: xor_r8(OP8.AT_HL),
      };
    case 0xAF:
      return {
        length,
        text: "xor  a",
        exec: xor_r8(OP8.A),
      };
    case 0xB0:
      return {
        length,
        text: "or   b",
        exec: or_r8(OP8.B),
      };
    case 0xB1:
      return {
        length,
        text: "or   c",
        exec: or_r8(OP8.C),
      };
    case 0xB2:
      return {
        length,
        text: "or   d",
        exec: or_r8(OP8.D),
      };
    case 0xB3:
      return {
        length,
        text: "or   e",
        exec: or_r8(OP8.E),
      };
    case 0xB4:
      return {
        length,
        text: "or   h",
        exec: or_r8(OP8.H),
      };
    case 0xB5:
      return {
        length,
        text: "or   l",
        exec: or_r8(OP8.L),
      };
    case 0xB6:
      return {
        length,
        text: "or   (hl)",
        exec: or_r8(OP8.AT_HL),
      };
    case 0xB7:
      return {
        length,
        text: "or   a",
        exec: or_r8(OP8.A),
      };
    case 0xB8:
      return {
        length,
        text: "cp   b",
        exec: cp_r8(OP8.B),
      };
    case 0xB9:
      return {
        length,
        text: "cp   c",
        exec: cp_r8(OP8.C),
      };
    case 0xBA:
      return {
        length,
        text: "cp   d",
        exec: cp_r8(OP8.D),
      };
    case 0xBB:
      return {
        length,
        text: "cp   e",
        exec: cp_r8(OP8.E),
      };
    case 0xBC:
      return {
        length,
        text: "cp   h",
        exec: cp_r8(OP8.H),
      };
    case 0xBD:
      return {
        length,
        text: "cp   l",
        exec: cp_r8(OP8.L),
      };
    case 0xBE:
      return {
        length,
        text: "cp   (hl)",
        exec: cp_r8(OP8.AT_HL),
      };
    case 0xBF:
      return {
        length,
        text: "cp   a",
        exec: cp_r8(OP8.A),
      };
    case 0xC0:
      return {
        length,
        text: "ret  nz",
        exec: ret_cond(cond_nz),
      };
    case 0xC1:
      return {
        length,
        text: "pop  bc",
        exec: pop_r16(R16.BC),
      };
    case 0xC2:
      n16 = decodeImm16();
      return {
        length,
        text: "jp   nz," + hex16(n16),
        exec: jp_cond_addr(cond_nz, n16),
      };
    case 0xC3:
      n16 = decodeImm16();
      return {
        length,
        text: "jp   " + hex16(n16),
        exec: jp_addr(n16),
      };
    case 0xC4:
      n16 = decodeImm16();
      return {
        length,
        text: "call nz," + hex16(n16),
        exec: call_cond(cond_nz, n16),
      };
    case 0xC5:
      return {
        length,
        text: "push bc",
        exec: push_r16(R16.BC),
      };
    case 0xC6:
      n8 = decodeImm8();
      return {
        length,
        text: "add  a," + hex8(n8),
        exec: add_r8(n8 as OP8),
      };
    case 0xC7:
      return {
        length,
        text: "rst  00",
        exec: rst(0x00),
      };
    case 0xC8:
      return {
        length,
        text: "ret  z",
        exec: ret_cond(cond_z),
      };
    case 0xC9:
      return {
        length,
        text: "ret  ",
        exec: pop_r16(R16.PC),
      };
    case 0xCA:
      n16 = decodeImm16();
      return {
        length,
        text: "jp   z," + hex16(n16),
        exec: jp_cond_addr(cond_z, n16),
      };
    case 0xCB:
      return decodeCbInsn();
    case 0xCC:
      n16 = decodeImm16();
      return {
        length,
        text: "call z," + hex16(n16),
        exec: call_cond(cond_z, n16),
      };
    case 0xCD:
      n16 = decodeImm16();
      return {
        length,
        text: "call " + hex16(n16),
        exec: call(n16),
      };
    case 0xCE:
      n8 = decodeImm8();
      return {
        length,
        text: "adc  a," + hex8(n8),
        exec: adc_r8(n8 as OP8),
      };
    case 0xCF:
      return {
        length,
        text: "rst  08",
        exec: rst(0x08),
      };
    case 0xD0:
      return {
        length,
        text: "ret  nc",
        exec: ret_cond(cond_nc),
      };
    case 0xD1:
      return {
        length,
        text: "pop  de",
        exec: pop_r16(R16.DE),
      };
    case 0xD2:
      n16 = decodeImm16();
      return {
        length,
        text: "jp   nc," + hex16(n16),
        exec: jp_cond_addr(cond_nc, n16),
      };
    // 0xD3 is undefined
    case 0xD4:
      n16 = decodeImm16();
      return {
        length,
        text: "call nc," + hex16(n16),
        exec: call_cond(cond_nc, n16),
      };
    case 0xD5:
      return {
        length,
        text: "push de",
        exec: push_r16(R16.DE),
      };
    case 0xD6:
      n8 = decodeImm8();
      return {
        length,
        text: "sub  a," + hex8(n8),
        exec: sub_r8(n8 as OP8),
      };
    case 0xD7:
      return {
        length,
        text: "rst  10",
        exec: rst(0x10),
      };
    case 0xD8:
      return {
        length,
        text: "ret  c",
        exec: ret_cond(cond_c),
      };
    case 0xD9:
      return {
        length,
        text: "reti ",
        exec: reti,
      };
    case 0xDA:
      n16 = decodeImm16();
      return {
        length,
        text: "jp   c," + hex16(n16),
        exec: jp_cond_addr(cond_c, n16),
      };
    // 0xDB is undefined
    case 0xDC:
      n16 = decodeImm16();
      return {
        length,
        text: "call c," + hex16(n16),
        exec: call_cond(cond_c, n16),
      };
    // 0xDD is undefined
    case 0xDE:
      n8 = decodeImm8();
      return {
        length,
        text: "sbc  a," + hex8(n8),
        exec: sbc_r8(n8 as OP8),
      };
    case 0xDF:
      return {
        length,
        text: "rst  18",
        exec: rst(0x18),
      };
    case 0xE0:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   (ff00+" + hex8(n8) + "),a",
        exec: ld_at_n8_r8(0xff00 + n8, OP8.A),
      };
    case 0xE1:
      return {
        length,
        text: "pop  hl",
        exec: pop_r16(R16.HL),
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
    // 0xE3 is undefined
    // 0xE4 is undeefined
    case 0xE5:
      return {
        length,
        text: "push hl",
        exec: push_r16(R16.HL),
      };
    case 0xE6:
      n8 = decodeImm8();
      return {
        length,
        text: "and  a," + hex8(n8),
        exec: and_n8(n8),
      };
    case 0xE7:
      return {
        length,
        text: "rst  20",
        exec: rst(0x20),
      };
    case 0xE8:
      n8 = decodeImm8();
      s8 = u8tos8(n8);
      return {
        length,
        text: "add  sp," + hexs8(s8),
        exec: add_SP_s8(s8),
      };
    case 0xE9:
      return {
        length,
        text: "jp   hl",
        exec: jp_HL,
      };
    case 0xEA:
      n16 = decodeImm16();
      return {
        length,
        text: "ld   (" + hex16(n16) + "),a",
        exec: ld_at_n16_r8(n16, OP8.A),
      };
    // 0xEB is undefined
    // 0xEC is undefined
    // 0xED is undefined
    case 0xEE:
      n8 = decodeImm8();
      return {
        length,
        text: "xor  a," + hex8(n8),
        exec: xor_r8(n8 as OP8),
      };
    case 0xEF:
      return {
        length,
        text: "rst  28",
        exec: rst(0x28),
      };
    case 0xF0:
      n8 = decodeImm8();
      return {
        length,
        text: "ld   a,(ff00+" + hex8(n8) + ")",
        exec: ld_r8_at_addr(OP8.A, 0xff00 + n8),
      };
    case 0xF1:
      return {
        length,
        text: "pop  af",
        exec: pop_r16(R16.AF),
      };
    case 0xF2:
      return {
        length,
        text: "ld   a,(ff00+c)",
        exec: ld_a_at_ff00_plus_c,
      };
    case 0xF3:
      return {
        length,
        text: "di   ",
        exec: di,
      };
    // 0xF4 is undefined
    case 0xF5:
      return {
        length,
        text: "push af",
        exec: push_r16(R16.AF),
      };
    case 0xF6:
      n8 = decodeImm8();
      return {
        length,
        text: "or   a," + hex8(n8),
        exec: or_r8(n8 as OP8),
      };
    case 0xF7:
      return {
        length,
        text: "rst  30",
        exec: rst(0x30),
      };
    case 0xF8:
      n8 = decodeImm8();
      s8 = u8tos8(n8);
      return {
        length,
        text: "ld   hl,sp" + hexs8(s8),
        exec: ld_HL_SP_plus_n8(s8),
      };
    case 0xF9:
      return {
        length,
        text: "ld   sp,hl",
        exec: ld_SP_HL,
      };
    case 0xFA:
      n16 = decodeImm16();
      return {
        length,
        text: "ld   a,(" + hex16(n16) + ")",
        exec: ld_r8_at_addr(OP8.A, n16),
      };
    case 0xFB:
      return {
        length,
        text: "ei   ",
        exec: ei,
      };
    // 0xFC is undefined
    // 0xFD is undefined
    case 0xFE:
      n8 = decodeImm8();
      return {
        length,
        text: "cp   a," + hex8(n8),
        exec: cp_r8(n8 as OP8),
      };
    case 0xFF:
      return {
        length,
        text: "rst  38",
        exec: rst(0x38),
      };
    default:
      return {
        length,
        text: "undefined opcode",
        exec: () => {
          const opcodeClosure = opcode;
          const addrClosure = addr;
          throw Error(`unrecognized opcode ${hex8(opcodeClosure)} at ${hex16(addrClosure)}`);
        }
      };
  }
}

// https://www.pastraiser.com/cpu/gameboy/gameboy_opcodes.html
export function step(cpu: CPU, bus: Bus): number {
  const instAddr = cpu.pc;

  try {
    const intPending = interruptPending(bus);
    if (cpu.ime && intPending != null) {
      const vector = interruptVector(intPending);
      // console.log(`Servicing interrupt at vector ${hex16(vector)}`);
      cpu.ime = false;
      cpu.halt = false;
      clearInterrupt(bus, intPending);
      return call(vector)(cpu, bus);
    }
    if (cpu.halt) {
      return 4;
    }
    const insn = decodeInsn(cpu.pc, bus);
    cpu.pc += insn.length;
    const cycles = insn.exec(cpu, bus);
    if ((cpu.f.valueOf() & 0x0f) !== 0) {
      throw new Error("flag lower bits set non-zero");
    }
    return cycles;
  } catch (err) {
    const cpuStack = stackDump(cpu, bus).map(hex16).join(" ");
    const cpuDump = dump(cpu);
    throw new Error(`Error while executing instruction at ${hex16(instAddr)}\nCPU dump: ${cpuDump}\nCPU stack: ${cpuStack}\n${String(err)}`);
  }
}
