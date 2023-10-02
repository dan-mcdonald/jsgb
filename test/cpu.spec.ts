import { Flags, initCPU, step, maskZ, decodeInsn, pop_r16, R16, push_r16, ldi_at_r16_r8, OP8, ldd_at_r16_r8, dec_r16 } from "../src/cpu";
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
import { EOL } from "os";
import { globSync as glob } from "glob";
import { basename } from "path";

const readb_error = (_: number): number => {throw new Error("unexpected read");};
const writeb_error = (_: number, __: number): void => {throw new Error("unexpected write");};

interface DisasmTestCase { file: string, addr: number, bytes: number[], disasm: string }

function loadDecodeInsnTestCasesFile(path: string): DisasmTestCase[] {
  const disasmContent = readFileSync(path, {encoding: "utf-8"});
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
  for(const testCase of allCases) {
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
    const writeMap = new Map<number,number>();
    const writeb = (addr: number, val: number): void => {
      writeMap.set(addr, val);
    };
    const bus = {writeb, readb: readb_error};
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
    const writeMap = new Map<number,number>();
    const writeb = (addr: number, val: number): void => {
      writeMap.set(addr, val);
    };
    const bus = {writeb, readb: readb_error};
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
    pop_r16(R16.BC)(cpu, {readb, writeb});
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
    const writeMap = new Map<number,number>();
    const writeb = (addr: number, val: number): void => {
      writeMap.set(addr, val);
    };
    push_r16(R16.BC)(cpu, {readb: readb_error, writeb});
    expect(cpu.regs.sp).to.equal(0xfffa);
    expect(writeMap.get(0xfffc)).to.equal(0x04);
    expect(writeMap.get(0xfffb)).to.equal(0xce);
    expect(writeMap.size).to.equal(2);
  });
});

// describe("swap a", (): void => {
//   const readb = (addr: number): number => [0xcb, 0x37][addr];
//   const writeb = (_: number, __: number): void => { };
//   const bus = { readb, writeb };

//   it("swaps a5 -> 5a", () => {
//     const cpu = initCPU();
//     cpu.regs.a = 0xa5;
//     step(cpu, bus);
//     expect(cpu.regs.a).to.equal(0x5a);
//   });
// });

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
