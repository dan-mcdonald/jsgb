import { Flags, initCPU, step, maskZ, decodeInsn, pop_r16, R16, push_r16, ldi_at_r16_r8, OP8, ldd_at_r16_r8, dec_r16, add_r16_r16, daa, cp, rr, srl, rra, ld_at_n16_r16, add_r16_r16_imm } from "../src/cpu";
import { expect } from 'chai';
import { BusRead, BusWrite } from "../src/bus";
import buildBus from "../src/buildBus";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";
import { cartBuild } from "../src/cart";
import * as PPU from "../src/ppu";
import { audioInit } from "../src/audio";
import { load as bessLoad } from "../src/bess";
import { hex16, hex8 } from "../src/util";
import { globSync as glob } from "glob";
import { basename } from "path";
import { EOL } from "os";

const readb_error = (_: number): number => { throw new Error("unexpected read"); };
const writeb_error = (_: number, __: number): void => { throw new Error("unexpected write"); };

interface DisasmTestCase { file: string, addr: number, bytes: number[], disasm: string }

function loadDecodeInsnTestCasesFile(path: string): DisasmTestCase[] {
  const disasmContent = readFileSync(path, { encoding: "utf-8" });
  const file = basename(path);
  function lineToTestCase(line: string): DisasmTestCase {
    const addr = parseInt(line.slice(5, 9), 16);
    const bytes = line.slice(10, 26).split(" ").filter((s) => s.length > 0).map((b) => parseInt(b, 16));
    const disasm = line.slice(27);
    return { file, addr, bytes, disasm };
  }
  return disasmContent.split(EOL).filter((line) => line.length > 0).map(lineToTestCase).filter((tc) => !tc.disasm.startsWith("db "));
}

function loadDecodeInsnTestCases(): DisasmTestCase[] {
  const files: string[] = glob("test/fixtures/*.S");
  const allCases = files.flatMap(loadDecodeInsnTestCasesFile);
  const uniqueCases: DisasmTestCase[] = [];
  const disasmSet = new Set<string>();
  for (const testCase of allCases) {
    if (!disasmSet.has(testCase.disasm)) {
      uniqueCases.push(testCase);
      disasmSet.add(testCase.disasm);
    }
  }
  return uniqueCases;
}

describe("decodeInsn", (): void => {
  const testCases = loadDecodeInsnTestCases();
  const writeb = () => { };
  for (const testCase of testCases) {
    const byteText = testCase.bytes.map(hex8).join(" ");
    const readb = (addr: number) => {
      if (addr < testCase.addr || addr >= testCase.addr + testCase.bytes.length) {
        throw Error(`read for address ${hex16(addr)} out of range`);
      }
      return testCase.bytes[addr - testCase.addr];
    };
    const bus = { readb, writeb };
    it(`[${testCase.file}] ${hex16(testCase.addr)}: ${byteText} => ${testCase.disasm}`, () => {
      expect(decodeInsn(testCase.addr, bus).text).to.equal(testCase.disasm);
    });
  }
});

describe("0x2e ld l, imm", (): void => {
  const readb: BusRead = (_: number): number => 0x2e;
  const writeb: BusWrite = (_: number, __: number): void => { };
  const bus = { readb, writeb };

  it("loads 0x2e into l", () => {
    const cpu = initCPU();
    step(cpu, bus);
    expect(cpu.regs.l).to.equal(0x2e);
  });
});

describe("dec b", (): void => {
  const readb: BusRead = (_: number): number => 0x05;
  const writeb: BusWrite = (_: number, __: number): void => { };
  const bus = { readb, writeb };

  it("decrements 4 to 3", () => {
    const cpu = initCPU();
    cpu.regs.b = 4;
    expect(cpu.f.N()).to.equal(false);
    step(cpu, bus);
    expect(cpu.regs.b).to.equal(3);
    expect(cpu.f.N()).to.equal(true);
  });

  it("decrements 0 to 255", () => {
    const cpu = initCPU();
    cpu.regs.b = 0;
    step(cpu, bus);
    expect(cpu.regs.b).to.equal(255);
  });

  it("clears Z flag when previously set", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 4;
    cpu.f = new Flags(maskZ);
    expect(step(cpu, bus)).to.equal(4);
    expect(cpu.f.valueOf() & maskZ).to.equal(0);
  });

  it("clears Z flag when previously clear", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 4;
    expect(step(cpu, bus)).to.equal(4);
    expect(cpu.f.valueOf() & maskZ).to.equal(0);
  });

  it("sets Z flag when previously set", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 1;
    cpu.f = new Flags(maskZ);
    expect(step(cpu, bus)).to.equal(4);
    expect(cpu.f.valueOf() & maskZ).to.equal(maskZ);
  });

  it("sets Z flag when previously clear", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 1;
    expect(step(cpu, bus)).to.equal(4);
    expect(cpu.f.valueOf() & maskZ).to.equal(maskZ);
  });
});

describe("ldi_at_r16_r8", () => {
  it("works right", () => {
    const cpu = initCPU();
    cpu.regs.h = 0x80;
    cpu.regs.l = 0x10;
    cpu.regs.a = 0x41;
    const writeMap = new Map<number, number>();
    const writeb = (addr: number, val: number): void => {
      writeMap.set(addr, val);
    };
    const bus = { writeb, readb: readb_error };
    ldi_at_r16_r8(R16.HL, OP8.A)(cpu, bus);
    expect(writeMap.size).to.equal(1);
    expect(writeMap.get(0x8010)).to.equal(0x41);
    expect(cpu.regs.h).to.equal(0x80);
    expect(cpu.regs.l).to.equal(0x11);
  });
});

describe("ldd_at_r16_r8", () => {
  it("works right", () => {
    const cpu = initCPU();
    cpu.regs.h = 0x80;
    cpu.regs.l = 0x10;
    cpu.regs.a = 0x41;
    const writeMap = new Map<number, number>();
    const writeb = (addr: number, val: number): void => {
      writeMap.set(addr, val);
    };
    const bus = { writeb, readb: readb_error };
    ldd_at_r16_r8(R16.HL, OP8.A)(cpu, bus);
    expect(writeMap.size).to.equal(1);
    expect(writeMap.get(0x8010)).to.equal(0x41);
    expect(cpu.regs.h).to.equal(0x80);
    expect(cpu.regs.l).to.equal(0x0F);
  });
});

describe("dec_r16", () => {
  it("works", () => {
    const cpu = initCPU();
    cpu.regs.h = 0x01;
    const bus = { readb: readb_error, writeb: writeb_error };
    dec_r16(R16.HL)(cpu, bus);
  });
});

describe("pop bc", (): void => {
  it("pops 0x04CE", (): void => {
    const cpu = initCPU();
    cpu.regs.sp = 0xfffa;
    function readb(addr: number): number {
      switch (addr) {
        case 0xfffb: return 0xce;
        case 0xfffc: return 0x04;
        default: throw Error("unexpected readb addr: " + hex16(addr));
      }
    }
    const writeb = (_: number, __: number): void => { };
    pop_r16(R16.BC)(cpu, { readb, writeb });
    expect(cpu.regs.b).to.equal(0x04);
    expect(cpu.regs.c).to.equal(0xce);
    expect(cpu.regs.sp).to.equal(0xfffc);
  });
});

describe("push bc", (): void => {
  it("pushes 0x04CE", (): void => {
    const cpu = initCPU();
    cpu.regs.sp = 0xfffc;
    cpu.regs.b = 0x04;
    cpu.regs.c = 0xce;
    const writeMap = new Map<number, number>();
    const writeb = (addr: number, val: number): void => {
      writeMap.set(addr, val);
    };
    push_r16(R16.BC)(cpu, { readb: readb_error, writeb });
    expect(cpu.regs.sp).to.equal(0xfffa);
    expect(writeMap.get(0xfffc)).to.equal(0x04);
    expect(writeMap.get(0xfffb)).to.equal(0xce);
    expect(writeMap.size).to.equal(2);
  });
});

describe("pop af", (): void => {
  it("keeps low bits zero", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 0xc3;
    cpu.regs.c = 0x0f;
    cpu.regs.sp = 0xfffd;
    const memory = new Uint8Array(0x10000);
    const readb = (addr: number): number => memory[addr];
    const writeb = (addr: number, val: number): void => { memory[addr] = val; };
    const bus = { readb, writeb };
    push_r16(R16.BC)(cpu, bus);
    pop_r16(R16.AF)(cpu, bus);
    expect(cpu.regs.a).to.equal(0xc3);
    expect(cpu.f.valueOf()).to.equal(0x00);
  });
});

type DaaTestCase = {
  initA: number,
  initZ: boolean,
  initN: boolean,
  initH: boolean,
  initC: boolean,
  expectedA: number,
  expectedZ: boolean,
  expectedN: boolean,
  expectedH: boolean,
  expectedC: boolean,
}

function loadDaaTestCases(): DaaTestCase[] {
  // function parseBool(s: string): boolean {
  //   if (s === "1") {
  //     return true;
  //   }
  //   if (s === "0") {
  //     return false;
  //   }
  //   throw new Error("unexpected bool: " + s);
  // }
  // function makeCase(line: string): DaaTestCase {
  //   const initN = parseBool(line[2]);
  //   const initC = parseBool(line[6]);
  //   const initH = parseBool(line[10]);
  //   const initA = parseInt(line.slice(12, 14), 16);
  //   const initZ = false;
  //   const expectedN = parseBool(line[17]);
  //   const expectedC = parseBool(line[21]);
  //   const expectedH = parseBool(line[25]);
  //   const expectedA = parseInt(line.slice(27, 29), 16);
  //   const expectedZ = expectedA === 0;
  //   return { initN, initC, initH, initA, initZ, expectedN, expectedC, expectedH, expectedA, expectedZ };
  // }
  // const lines = readFileSync("test/fixtures/daaoutput.txt", { encoding: "utf-8" }).split(EOL);
  // return lines.map(makeCase);
  return [
    { initA: 0x0A, initZ: false, initN: false, initH: false, initC: false, expectedA: 0x10, expectedZ: false, expectedN: false, expectedH: false, expectedC: false },
    { initA: 0x0A, initZ: false, initN: true, initH: false, initC: false, expectedA: 0x0A, expectedZ: false, expectedN: true, expectedH: false, expectedC: false },
  ];
}

describe("daa", (): void => {
  // test fixture courtesy ruyrybeyro https://github.com/ruyrybeyro/daatable/blob/master/daaoutput.txt
  for (const testCase of loadDaaTestCases()) {
    it(`0x${testCase.initA.toString(16)} ${testCase.initZ ? "Z" : "z"}${testCase.initN ? "N" : "n"}${testCase.initH ? "H" : "h"}${testCase.initC ? "C" : "c"} => 0x${testCase.expectedA.toString(16)} ${testCase.expectedZ ? "Z" : "z"}${testCase.expectedN ? "N" : "n"}${testCase.expectedH ? "H" : "h"}${testCase.expectedC ? "C" : "c"}`, (): void => {
      const cpu = initCPU();
      cpu.regs.a = testCase.initA;
      cpu.f = cpu.f.setZ(testCase.initZ).setN(testCase.initN).setH(testCase.initH).setC(testCase.initC);
      daa(cpu, { readb: readb_error, writeb: writeb_error });
      expect(cpu.regs.a, "A").to.equal(testCase.expectedA);
      expect(cpu.f.Z(), "Z").to.equal(testCase.expectedZ);
      expect(cpu.f.N(), "N").to.equal(testCase.expectedN);
      expect(cpu.f.H(), "H").to.equal(testCase.expectedH);
      expect(cpu.f.C(), "C").to.equal(testCase.expectedC);
    });
  }
});

describe("cp", (): void => {
  it("A=0x30, cp 0x0a => zNHc", (): void => {
    const cpu = initCPU();
    cpu.regs.a = 0x30;
    cp(cpu, 0x0a);
    expect(cpu.f.Z(), "Z").to.be.false;
    expect(cpu.f.N(), "N").to.be.true;
    expect(cpu.f.H(), "H").to.be.true;
    expect(cpu.f.C(), "C").to.be.false;
  });
  it("A=0x90, cp 0x90 => ZNhc", (): void => {
    const cpu = initCPU();
    cpu.regs.a = 0x90;
    cp(cpu, 0x90);
    expect(cpu.f.Z(), "Z").to.be.true;
    expect(cpu.f.N(), "N").to.be.true;
    expect(cpu.f.H(), "H").to.be.false;
    expect(cpu.f.C(), "C").to.be.false;
  });
});

describe("rr", (): void => {
  it("rr 0x47 znhc -> 0x23 znhC", (): void => {
    const cpu = initCPU();
    expect(rr(cpu, 0x47)).to.equal(0x23);
    expect(cpu.f.Z(), "Z").to.be.false;
    expect(cpu.f.N(), "N").to.be.false;
    expect(cpu.f.H(), "H").to.be.false;
    expect(cpu.f.C(), "C").to.be.true;
  });
});

describe("swap a", (): void => {
  const readb = (addr: number): number => [0xcb, 0x37][addr];
  const writeb = (_: number, __: number): void => { };
  const bus = { readb, writeb };

  it("swaps a5 -> 5a", () => {
    const cpu = initCPU();
    cpu.regs.a = 0xa5;
    step(cpu, bus);
    expect(cpu.regs.a).to.equal(0x5a);
  });
});

describe("add_r16_r16", (): void => {
  it("add hl,hl", (): void => {
    const cpu = initCPU();
    cpu.regs.h = 0x26;
    cpu.regs.l = 0x00;
    add_r16_r16(R16.HL, R16.HL)(cpu, { readb: readb_error, writeb: writeb_error });
    expect(cpu.regs.h).to.equal(0x4c);
    expect(cpu.regs.l).to.equal(0x00);
    expect(cpu.f.H()).to.be.false;
  });
  it("add hl,sp", (): void => {
    const cpu = initCPU();
    cpu.regs.h = 0x00;
    cpu.regs.l = 0x01;
    cpu.regs.sp = 0xffff;
    add_r16_r16(R16.HL, R16.SP)(cpu, { readb: readb_error, writeb: writeb_error });
    expect(cpu.regs.h).to.equal(0x00);
    expect(cpu.regs.l).to.equal(0x00);
    expect(cpu.f.Z(), "Z").to.be.false;
    expect(cpu.f.N(), "N").to.be.false;
    expect(cpu.f.H(), "H").to.be.true;
    expect(cpu.f.C(), "C").to.be.true;
  });
});

describe("srl", (): void => {
  it("srl 0x01 znhc => 0x00 Znhc", (): void => {
    const cpu = initCPU();
    expect(srl(cpu, 0x01)).to.equal(0x00);
    expect(cpu.f.Z(), "Z").to.be.true;
    expect(cpu.f.N(), "N").to.be.false;
    expect(cpu.f.H(), "H").to.be.false;
    expect(cpu.f.C(), "C").to.be.true;
  });
});

describe("rra", (): void => {
  it("rra 0x01 znhc => 0x00 znhC", (): void => {
    const cpu = initCPU();
    cpu.regs.a = 0x01;
    rra(cpu, { readb: readb_error, writeb: writeb_error });
    expect(cpu.regs.a).to.equal(0x00);
    expect(cpu.f.Z(), "Z").to.be.false;
    expect(cpu.f.N(), "N").to.be.false;
    expect(cpu.f.H(), "H").to.be.false;
    expect(cpu.f.C(), "C").to.be.true;
  });
});

describe("ld_at_n16_r16", (): void => {
  it("ld (dd02), sp", (): void => {
    const cpu = initCPU();
    cpu.regs.sp = 0x0001;
    const writeMap = new Map<number, number>();
    const writeb = (addr: number, val: number): void => {
      writeMap.set(addr, val);
    };
    const bus = { readb: readb_error, writeb };
    ld_at_n16_r16(0xdd02, R16.SP)(cpu, bus);
    expect(writeMap.size).to.equal(2);
    expect(writeMap.get(0xdd02)).to.equal(0x01);
    expect(writeMap.get(0xdd03)).to.equal(0x00);
  });
});

describe("add_r16_r16_imm", (): void => {
  it("sp=0x00FF add sp, 1", (): void => {
    const cpu = initCPU();
    cpu.regs.sp = 0x00ff;
    add_r16_r16_imm(16, R16.SP, R16.SP, 1)(cpu, { readb: readb_error, writeb: writeb_error });
    expect(cpu.regs.sp).to.equal(0x0100);
    expect(cpu.f.Z(), "Z").to.be.false;
    expect(cpu.f.N(), "N").to.be.false;
    expect(cpu.f.H(), "H").to.be.true;
    expect(cpu.f.C(), "C").to.be.true;
  });
  it("sp=0x0001 add sp, -1", (): void => {
    const cpu = initCPU();
    cpu.regs.sp = 0x0001;
    add_r16_r16_imm(16, R16.SP, R16.SP, -1)(cpu, { readb: readb_error, writeb: writeb_error });
    expect(cpu.regs.sp).to.equal(0x0000);
    expect(cpu.f.Z(), "Z").to.be.false;
    expect(cpu.f.N(), "N").to.be.false;
    expect(cpu.f.H(), "H").to.be.true;
    expect(cpu.f.C(), "C").to.be.true;
  });
  it("hl=0x0000 sp=0x0001 ld hl, sp-1 => hl=0x0000 znHC", (): void => {
    const cpu = initCPU();
    cpu.regs.sp = 0x0001;
    add_r16_r16_imm(12, R16.HL, R16.SP, -1)(cpu, { readb: readb_error, writeb: writeb_error });
    expect(cpu.regs.h).to.equal(0x00);
    expect(cpu.regs.l).to.equal(0x00);
    expect(cpu.f.Z(), "Z").to.be.false;
    expect(cpu.f.N(), "N").to.be.false;
    expect(cpu.f.H(), "H").to.be.true;
    expect(cpu.f.C(), "C").to.be.true;
  });
});

function loadBootRom(): Promise<Uint8Array> {
  return readFile("dist/DMG_ROM.bin");
}

function loadCart(): Promise<Uint8Array> {
  return readFile("test/fixtures/cpu_instrs.gb");
}

describe("bootrom", (): void => {
  it("vram matches", async (): Promise<void> => {
    const cpu = initCPU();
    const bootRom = await loadBootRom();
    const cart = cartBuild(await loadCart());
    const ppu = PPU.ppuBuild();
    const audio = audioInit();

    const bus = buildBus(bootRom, cart, ppu, audio);
    while (cpu.pc !== 0x0100) {
      const cycles = step(cpu, bus);
      for (let i = 0; i < cycles; i++) {
        PPU.tick(ppu, bus);
      }
    }
    const bess = bessLoad(await readFile("test/fixtures/bootend.sna"));

    for (let i = 0; i < 0x20; i++) {
      const baseAddr = i * 0x100;
      const endAddr = baseAddr + 0x100;
      expect(ppu.vram.slice(baseAddr, endAddr), "vram 0x" + baseAddr.toString(16)).to.deep.equal(bess.vram.slice(baseAddr, endAddr));
    }
  });
});
