import { cartBuild } from "../src/cart";
import { initCPU } from "../src/cpu";
import { initInterruptManager } from "../src/interruptManager";
import { loadBootRom, loadCart } from "./util";
import { PPU } from "../src/ppu";
import { APU } from "../src/audio";
import { init as timerInit } from "../src/timer";
import buildBus from "../src/buildBus";
import { step } from "../src/cpu";

describe("audio", (): void => {
  it("boots", async (): Promise<void> => {
    const cpu = initCPU();
    const interruptManager = initInterruptManager();
    const bootRom = await loadBootRom();
    const cart = cartBuild(await loadCart());
    const ppu = new PPU();
    const audio = new APU();
    const timer = timerInit(interruptManager.requestTimerInterrupt);

    const bus = buildBus(interruptManager, bootRom, cart, ppu, audio, timer);
    while (cpu.pc !== 0x0100) {
      const cycles = step(cpu, bus);
      for (let i = 0; i < cycles; i++) {
        ppu.tick(bus);
      }
    }
  });
});
