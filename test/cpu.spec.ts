import { Flags, initCPU, step, maskZ, decodeInsn } from "../src/cpu";
import { expect } from 'chai';
import { BusRead, BusWrite } from "../src/bus";
import buildBus from "../src/buildBus";
import { readFile } from "fs/promises";
import { cartBuild } from "../src/cart";
import * as PPU from "../src/ppu";
import { audioInit } from "../src/audio";
import { load as bessLoad } from "../src/bess";
import { hex16, hex8 } from "../src/util";

describe("decodeInsn", (): void => {
  const testCases: { bytes: number[], disasm: string }[] = [
    { bytes: [0x31, 0xfe, 0xff], disasm: "ld   sp,FFFE" },
    { bytes: [0xaf], disasm: "xor  a" },
    { bytes: [0x21, 0xFF, 0x9F], disasm: "ld   hl,9FFF" },
    { bytes: [0x32], disasm: "ldd  (hl),a" },
    { bytes: [0xCB, 0x7C], disasm: "bit  7,h" },
    { bytes: [0x20, 0xFB], disasm: "jr   nz,0007" },
    { bytes: [0x21, 0x26, 0xFF], disasm: "ld   hl,FF26" },
    { bytes: [0x0E, 0x11], disasm: "ld   c,11" },
    { bytes: [0x3E, 0x80], disasm: "ld   a,80" },
    { bytes: [0x32], disasm: "ldd  (hl),a" },
    { bytes: [0xE2], disasm: "ld   (ff00+c),a" },
    { bytes: [0x0C], disasm: "inc  c" },
    { bytes: [0x3E, 0xF3], disasm: "ld   a,F3" },
  ];
  const writeb = () => { };
  let baseAddr = 0x0000;
  for (const testCase of testCases) {
    const byteText = testCase.bytes.map(hex8).join(" ");
    const baseAddrClosure = baseAddr;
    const readb = (addr: number) => {
      if (addr < baseAddrClosure || addr >= baseAddrClosure + testCase.bytes.length) {
        throw Error(`read for address ${hex16(addr)} out of range`);
      }
      return testCase.bytes[addr - baseAddrClosure];
    }
    const bus = { readb, writeb };
    it(hex16(baseAddrClosure) + ": " + byteText + " => " + testCase.disasm, () => {
      expect(decodeInsn(baseAddrClosure, bus).text).to.equal(testCase.disasm)
    })
    baseAddr += testCase.bytes.length;
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
    step(cpu, bus);
    expect(cpu.regs.b).to.equal(3);
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
