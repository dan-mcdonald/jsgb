import * as bus from "./bus";
import {u8tos8, make16, break16, hex8, hex16} from "./util";

interface CPU {
	pc: number;
	sp: number;
	a: number;
	f: number;
	b: number;
	c: number;
	d: number;
	e: number;
	h: number;
	l: number;
}

export function initCPU(): CPU {
  return {
    pc: 0x0000,
    sp: 0x0000,
    a: 0x00,
    f: 0x00,
    b: 0x00,
    c: 0x00,
    d: 0x00,
    e: 0x00,
    h: 0x00,
    l: 0x00,
  };
}

export const maskZ = 0x80;
export const maskN = 0x40;
export const maskH = 0x20;
export const maskC = 0x10;

export function dump(cpu: CPU): string {
  return `pc ${hex16(cpu.pc)} sp ${hex16(cpu.sp)} af ${hex8(cpu.a)}${hex8(cpu.f)} bc ${hex8(cpu.b)}${hex8(cpu.c)} de ${hex8(cpu.d)}${hex8(cpu.e)} hl ${hex8(cpu.h)}${hex8(cpu.l)}`;
}

// https://www.pastraiser.com/cpu/gameboy/gameboy_opcodes.html
export function step(cpu: CPU, writeb: bus.BusWrite, readb: bus.BusRead): number {
  const instAddr = cpu.pc;

  const push16 = function(word: number): void {
    const [hi, lo] = break16(word);    
    cpu.sp -= 2;
    writeb(cpu.sp + 1, lo);
    writeb(cpu.sp, hi);
  };
  const pop16 = function(): number {
    const hi = readb(cpu.sp);
    const lo = readb(cpu.sp + 1);
    cpu.sp += 2;
    return make16(hi, lo);
  };

  const imm8 = function(): number {
    return readb(cpu.pc++);
  };
  const imm16 = function(): number {
    const lo = imm8();
    const hi = imm8();
    return make16(hi, lo);
  };

  const logInst = function(inst: string): void {
    // if (cpu.pc < 0x0027) return;
    // console.log(dump(cpu));
    // console.log(`${hex16(instAddr)} ${inst}`);
  };


  const setZ = function(b: boolean): void {
    cpu.f = (cpu.f & ~maskZ) | (b ? maskZ : 0);
  };
  const getZ = function(): boolean {
    return Boolean(cpu.f & maskZ);
  };
  
  const setN = function(b: boolean): void {
    cpu.f = (cpu.f & ~maskN) | (b ? maskN : 0);
  };
  const getN = function(): boolean {
    return Boolean(cpu.f & maskN);
  };
  
  const setH = function(b: boolean): void {
    cpu.f = (cpu.f & ~maskH) | (b ? maskH : 0);
  };
  const getH = function(): boolean {
    return Boolean(cpu.f & maskH);
  };

  const setC = function(b: boolean): void {
    cpu.f = (cpu.f & ~maskC) | (b ? maskC : 0);
  };
  const getC = function(): boolean {
    return Boolean(cpu.f & maskC);
  };

  const xor = function(reg: keyof CPU): void {
    const res = (cpu.a ^= cpu[reg]);
    setZ(res === 0);
    setN(false);
    setH(false);
    setC(false);
  };

  const or = function(value: number): void {
    cpu.a |= value;
    setZ(cpu.a == 0);
    setN(false);
    setH(false);
    setC(false);
  };

  const and = function(val: number): void {
    cpu.a &= val;
    setZ(cpu.a == 0);
    setN(false);
    setH(true);
    setC(false);
  };

  const rl = function(reg: keyof CPU): void {
    const oldVal = cpu[reg];
    const newVal = (oldVal << 1) | Number(getC());
    cpu[reg] = newVal & 0xff;
    setZ(cpu[reg] === 0);
    setN(false);
    setH(false);
    setC(Boolean(newVal & 0x100));
  };

  const bit = function(mask: number, reg: keyof CPU): void {
    setZ((cpu[reg] & mask) === 0);
    setN(false);
    setH(false);
  };

  const res = function(bit: number, reg: keyof CPU): void {
    cpu[reg] &= 1 << bit;
  };

  const ldAddrReg = function(addr: number, reg: keyof CPU): void {
    writeb(addr, cpu[reg]);
  };

  const ldR16 = function(regHi: keyof CPU, regLo: keyof CPU, value: number): void {
    cpu[regHi] = value >> 8;
    cpu[regLo] = value & 0xff;
  };

  const dec16 = function(regH: keyof CPU, regL: keyof CPU): void {
    const val = (make16(cpu[regH], cpu[regL]) - 1) & 0xffff;
    cpu[regH] = val >> 8;
    cpu[regL] = val & 0xff;
  };

  const inc16 = function(regH: keyof CPU, regL: keyof CPU): void {
    const val = (make16(cpu[regH], cpu[regL]) + 1) & 0xffff;
    cpu[regH] = val >> 8;
    cpu[regL] = val & 0xff;
  };

  const decR8 = function(reg: keyof CPU): void {
    const oldVal = cpu[reg];
    const newVal = (oldVal - 1) & 0xff;
    cpu[reg] = newVal;
    setZ(newVal === 0);
    setN(true);
    // setH(...);
  };

  const incR8 = function(reg: keyof CPU): void {
    const newVal = (cpu[reg] + 1) & 0xff;
    cpu[reg] = newVal;
    setZ(newVal === 0);
    setN(false);
  };

  const cp = function(val: number): void {
    setZ(cpu.a == val);
    setN(true);
    setH(false);
    setC(cpu.a < val);
  };

  const subR8 = function(reg: keyof CPU): void {
    const oldA = cpu.a;
    const newA = cpu.a = ((oldA - cpu[reg]) & 0xff);
    setZ(newA === 0);
    setN(true);
    setH(false);
    setC(cpu.b > oldA);
  };

  const add = function(val: number): void {
    const oldA = cpu.a;
    const result = oldA + val;
    const newA = cpu.a = result & 0xff;
    setZ(newA === 0);
    setN(false);
    setH(false);
    setC(result >= 0x100);
  };

  const addR16R16 = function(dstHi: keyof CPU, dstLo: keyof CPU, srcHi: keyof CPU, srcLo: keyof CPU): void {
    const dstVal = make16(cpu[dstHi], cpu[dstLo]);
    const srcVal = make16(cpu[srcHi], cpu[srcLo]);
    const newVal = (dstVal + srcVal) & 0xffff;
    [cpu[dstHi], cpu[dstLo]] = break16(newVal);
  }

  const execCB = function(): number {
    const inst = imm8();
    switch(inst) {
      case 0x11: // RL C
        logInst("RL C");
        rl("c");
        return 8;
      case 0x7c: // BIT 7,H
        logInst("BIT 7,H");
        bit(0x80, "h");
        return 8;
      case 0x87: // RES 0,A
        logInst("RES 0,A");
        res(0, "a");
        return 8;
      default:
        throw new Error(`unknown opcode cb ${hex8(inst)}`);
    }
  };

  try {
    let nn;
    let i8;
    let jaddr;
    // console.log(dump(cpu));
    const inst = imm8();
    switch(inst) {
      case 0x00: // NOP
        logInst("NOP");
        return 4;
      case 0x01: // LD BC,d16
        nn = imm16();
        logInst(`LD BC,${hex16(nn)}`);
        ldR16("b", "c", nn);
        return 12;
      case 0x04: // INC B
        logInst("INC B");
        incR8("b");
        return 4;
      case 0x05: // DEC B
        logInst("DEC B");
        decR8("b");
        return 4;
      case 0x06: // LD B,d8
        i8 = imm8();
        logInst(`LD B,${hex8(i8)}`);
        cpu.b = i8;
        return 8;
      case 0x0B: // DEC BC
        logInst("DEC BC");
        dec16("b", "c");
        return 8;
      case 0x0C: // INC C
        logInst("INC C");
        incR8("c");
        return 4;
      case 0x0D: // DEC C
        logInst("DEC C");
        decR8("c");
        return 4;
      case 0x0E: // LD C,d8
        i8 = imm8();
        logInst(`LD C,${hex8(i8)}`);
        cpu.c = i8;
        return 8;
      case 0x11: // LD DE,d16
        nn = imm16();
        logInst(`LD DE,${hex16(nn)}`);
        cpu.d = nn >> 8;
        cpu.e = nn & 0xff;
        return 12;
      case 0x12: // LD (DE),A
        logInst("LD (DE),A");
        writeb(make16(cpu.d, cpu.e), cpu.a);
        return 8;
      case 0x13: // INC DE
        logInst("INC DE");
        inc16("d", "e");
        return 8;
      case 0x15: // DEC D
        logInst("DEC D");
        decR8("d");
        return 4;
      case 0x16: // LD D,d8
        i8 = imm8();
        logInst(`LD D,${hex8(i8)}`);
        cpu.d = i8;
        return 8;
      case 0x17: // RLA
        logInst("RLA");
        rl("a");
        return 4;
      case 0x18: // JR r
        i8 = imm8();
        jaddr = cpu.pc + u8tos8(i8);
        logInst(`JR ${hex16(jaddr)}`);
        cpu.pc = jaddr;
        return 12;
      case 0x19: // ADD HL,DE
        logInst("ADD HL,DE");
        addR16R16("h", "l", "d", "e");
        return 8;
      case 0x1A: // LD A,(DE)
        logInst(`LD A,(DE)`);
        cpu.a = readb(make16(cpu.d, cpu.e));
        return 8;
      case 0x1B: // DEC DE
        logInst("DEC DE");
        dec16("d", "e");
        return 8;
      case 0x1D: // DEC E
        logInst("DEC E");
        decR8("e");
        return 4;
      case 0x1E: // LD E,n
        i8 = imm8();
        logInst(`LD E,${hex8(i8)}`);
        cpu.e = i8;
        return 8;
      case 0x20: // JR NZ,r8
        i8 = imm8();
        jaddr = cpu.pc + u8tos8(i8);
        logInst(`JR NZ,${hex16(jaddr)}`);
        if (!getZ()) {
          cpu.pc = jaddr;
          return 12;
        }
        return 8;
      case 0x21: // LD HL,d16
        nn = imm16();
        logInst(`LD HL, ${hex16(nn)}`);
        ldR16("h", "l", nn);
        return 12;
      case 0x22: // LD (HL+),A
        logInst("LD (HL+),A");
        ldAddrReg(make16(cpu.h, cpu.l), "a");
        inc16("h", "l");
        return 8;
      case 0x23: // INC HL
        logInst("INC HL");
        inc16("h", "l");
        return 8;
      case 0x24: // INC H
        logInst("INC H");
        incR8("h");
        return 4;
      case 0x28: // JR Z,r
        i8 = imm8();
        jaddr = cpu.pc + u8tos8(i8);
        logInst(`JR Z,${hex16(jaddr)}`);
        if (getZ()) {
          cpu.pc = jaddr;
          return 12;
        }
        return 8;
      case 0x2A: // LD A,(HL+)
        logInst("LD A,(HL+)");
        cpu.a = readb(make16(cpu.h, cpu.l));
        inc16("h", "l");
        return 8;
      case 0x2E: // LD E,n
        i8 = imm8();
        logInst(`LD E,${hex8(i8)}`);
        cpu.e = i8;
        return 8;
      case 0x31: // LD SP,d16
        nn = imm16();
        logInst(`LD SP, ${hex16(nn)}`);
        cpu.sp = nn;
        return 12;
      case 0x32: // LD (HL-),A
        logInst("LD (HL-),A");
        ldAddrReg(make16(cpu.h, cpu.l), "a");
        dec16("h", "l");
        return 8;
      case 0x36: // LD (HL),d8
        i8 = imm8();
        logInst(`LD (HL),${hex8(i8)}`);
        writeb(make16(cpu.h, cpu.l), i8);
        return 12;
      case 0x38: // JR C,r8
        i8 = imm8();
        jaddr = cpu.pc + u8tos8(i8);
        logInst(`JR C,${hex16(jaddr)}`);
        if (getC()) {
          cpu.pc = jaddr;
          return 12;
        }
        return 8;
      case 0x3C: // INC A
        logInst("INC A");
        incR8("a");
        return 4;
      case 0x3D: // DEC A
        logInst("DEC A");
        decR8("a");
        return 4;
      case 0x3E: // LD A,d8
        i8 = imm8();
        logInst(`LD A,${hex8(i8)}`);
        cpu.a = i8;
        return 8;
      case 0x4F: // LD C,A
        logInst("LD C,A");
        cpu.c = cpu.a;
        return 4;
      case 0x57: // LD D,A
        logInst("LD D,A");
        cpu.d = cpu.a;
        return 4;
      case 0x67: // LD H,A
        logInst("LD H,A");
        cpu.h = cpu.a;
        return 4;
      case 0x77: // LD (HL),A
        logInst("LD (HL),A");
        writeb(make16(cpu.h, cpu.l), cpu.a);
        return 8;
      case 0x78: // LD A,B
        logInst("LD A,B");
        cpu.a = cpu.b;
        return 4;
      case 0x7A: // LD A,D
        logInst("LD A,D");
        cpu.a = cpu.d;
        return 4;
      case 0x7B: // LD A,E
        logInst("LD A,E");
        cpu.a = cpu.e;
        return 4;
      case 0x7C: // LD A,H
        logInst("LD A,H");
        cpu.a = cpu.h;
        return 4;
      case 0x7D: // LD A,L
        logInst("LD A,L");
        cpu.a = cpu.l;
        return 4;
      case 0x86: // ADD A,(HL)
        logInst("ADD A,(HL)");
        add(readb(make16(cpu.h, cpu.l)));
        return 8;
      case 0x90: // SUB B
        logInst("SUB B");
        subR8("b");
        return 4;
      case 0xAF: // XOR A
        logInst("XOR A");
        xor("a");
        return 4;
      case 0xB1: // OR C
        logInst("OR C");
        or(cpu.c);
        return 4;
      case 0xB2: // OR D
        logInst("OR D");
        or(cpu.d);
        return 4;
      case 0xB9: // CP C
        logInst("CP C");
        cp(cpu.c);
        return 4;
      case 0xBE: // CP (HL)
        logInst("CP (HL)");
        cp(readb(make16(cpu.h, cpu.l)));
        return 8;
      case 0xC1: // POP BC
        logInst("POP BC");
        [cpu.b, cpu.c] = break16(pop16());
        return 12;
      case 0xC3: // JP a16
        nn = imm16();
        logInst(`JP ${hex16(nn)}`);
        cpu.pc = nn;
        return 16;
      case 0xC5: // PUSH BC
        logInst("PUSH BC");
        push16(make16(cpu.b, cpu.c));
        return 16;
      case 0xC9: // RET
        logInst("RET");
        cpu.pc = pop16();
        return 16;
      case 0xCB: // CB prefix
        return execCB();
      case 0xCD: // CALL a16
        nn = imm16();
        logInst(`CALL ${hex16(nn)}`);
        push16(cpu.pc);
        cpu.pc = nn;
        return 24;
      case 0xE0: // LDH (a8),A
        nn = 0xff00 + imm8();
        logInst(`LDH (${hex16(nn)}),A`)
        writeb(nn, cpu.a);
        return 12;
      case 0xE1: // POP HL
        logInst("POP HL");
        [cpu.h, cpu.l] = break16(pop16());
        return 12;
      case 0xE2: // LD (C),A
        logInst("LD (C),A");
        writeb(0xff00 + cpu.c, cpu.a);
        return 8;
      case 0xE5: // PUSH HL
        logInst("PUSH HL");
        push16(make16(cpu.h, cpu.l));
        return 16;
      case 0xE6: // AND d8
        i8 = imm8();
        logInst(`AND ${hex8(i8)}`);
        and(i8);
        return 8;
      case 0xEA: // LD (nn),A
        nn = imm16();
        logInst(`LD (${hex16(nn)}),A`);
        writeb(nn, cpu.a);
        return 16;
      case 0xF0: // LDH A,(n)
        i8 = imm8();
        logInst(`LDH A,(ff00+${hex8(i8)})`);
        cpu.a = readb(0xff00 | i8);
        return 12;
      case 0xFA: // LD A,(a16)
        nn = imm16();
        logInst(`LD A,(${hex16(nn)})`);
        cpu.a = readb(nn);
        return 16;
      case 0xFE: // CP i8
        i8 = imm8();
        logInst(`CP ${hex8(i8)}`);
        cp(i8);
        return 8;
      default:
        throw new Error(`unknown opcode ${hex8(inst)}`);
    }
  } catch(err) {
    throw new Error(`Error while executing instruction at at ${hex16(instAddr)}\n${err}\n${err.stack}`);
  }
}
