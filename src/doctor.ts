import buildBus from "./buildBus";
import { CPU, Flags, decodeInsn, initCPU } from "./cpu";
import { argv } from "process";
import { LCDC_ENABLED, Register, getLine, ppuBuild, tick } from "./ppu";
import { audioInit } from "./audio";
import { cartBuild } from "./cart";
import { readFileSync as readFile } from "fs";
import { hex16, hex8 } from "./util";
import { Bus } from "./bus";

const args = argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: npx ts-node src/doctor.ts <filename>");
  process.exit(1);
}
const cartBytes = new Uint8Array(readFile(args[0]));

function trace(cpu: CPU, bus: Bus): string {
  const pcmem = [0, 1, 2, 3].map(i => bus.readb(cpu.pc + i));
  return `A:${hex8(cpu.regs.a)} F:${hex8(cpu.f.valueOf())} B:${hex8(cpu.regs.b)} C:${hex8(cpu.regs.c)} D:${hex8(cpu.regs.d)} E:${hex8(cpu.regs.e)} H:${hex8(cpu.regs.h)} L:${hex8(cpu.regs.l)} SP:${hex16(cpu.regs.sp)} PC:${hex16(cpu.pc)} PCMEM:${pcmem.map(hex8).join(",")}`;
}

const cpu = initCPU();
cpu.regs.a = 0x01;
cpu.f = new Flags(0xb0);
cpu.regs.b = 0x00;
cpu.regs.c = 0x13;
cpu.regs.d = 0x00;
cpu.regs.e = 0xd8;
cpu.regs.h = 0x01;
cpu.regs.l = 0x4d;
cpu.regs.sp = 0xfffe;
cpu.pc = 0x100;

const ppu = ppuBuild();
ppu.ioRegs[Register.LCDC] |= LCDC_ENABLED;
const audio = audioInit();
const cart = cartBuild(cartBytes);
const bus = buildBus(null, cart, ppu, audio);

while (getLine(ppu) !== 0x90) {
  tick(ppu, bus);
}

while (true) {
  console.log(trace(cpu, bus));
  const insn = decodeInsn(cpu.pc, bus);
  if (insn.text == "jr   " + hex16(cpu.pc)) {
    break;
  }
  cpu.pc += insn.length;
  insn.exec(cpu, bus);
}
