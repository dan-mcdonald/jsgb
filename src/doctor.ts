import buildBus from "./buildBus";
import { CPU, Flags, decodeInsn, initCPU, step } from "./cpu";
import { argv } from "process";
import { LCDC_ENABLED, PPU, Register } from "./ppu";
import { APU } from "./audio";
import { init as timerInit } from "./timer";
import { cartBuild } from "./cart";
import { readFileSync as readFile } from "fs";
import { hex16, hex8 } from "./util";
import { Bus } from "./bus";
import { initInterruptManager } from "./interruptManager";

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

const interruptManager = initInterruptManager();
const ppu = new PPU();
ppu.writeIo(Register.LCDC, ppu.readIo(Register.LCDC) | LCDC_ENABLED);
const audio = new APU();
const cart = cartBuild(cartBytes);
const timer = timerInit(interruptManager.requestTimerInterrupt);
const bus = buildBus(interruptManager, null, cart, ppu, audio, timer);

while (ppu.readIo(Register.LY) !== 0x90) {
  ppu.tick(bus);
}

let haltSteps = 0;

while (true) {
  if (!cpu.halt) {
    if(cpu.pc != 0x0050) { // my emulator treats the interrupt call as its own step, doctor expects this to be skipped
      console.log(trace(cpu, bus));
    }
    haltSteps = 0;
  } else {
    haltSteps++;
    if (haltSteps > 10000) {
      console.error("stuck halted");
      break;
    }
  }
  // if (cpu.pc == 0xc679) {
  //   console.error("0xdf7e = " + hex8(bus.readb(0xdf7e)));
  // }
  const insn = decodeInsn(cpu.pc, bus);
  if (insn.text == "jr   " + hex16(cpu.pc)) {
    break;
  }
  let cycles = step(cpu, bus);
  while (cycles-- > 0) {
    timer.tick();
  }
}
