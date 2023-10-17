// System state save/load

import { audioInit } from "./audio";
import { BESSFile } from "./bess";
import buildBus from "./buildBus";
import { Cart } from "./cart";
import { initCPU } from "./cpu";
import { initInterruptManager } from "./interruptManager";
import { PPU, REG_SIZE as PPU_REG_SIZE } from "./ppu";
import { System } from "./system";
import { init as timerInit } from "./timer";

export function loadSystem(cart: Cart, state?: BESSFile): System {
  const cpu = initCPU();

  const interruptManager = initInterruptManager();
  const ppu = new PPU();
  const audio = audioInit();
  const timer = timerInit(interruptManager.requestTimerInterrupt);
  const bus = buildBus(interruptManager, null, cart, ppu, audio, timer);

  if (state !== undefined) {
    state.vram.forEach((v, i) => { ppu.writeVram(i, v); });
    state.ioregs.slice(0x40, 0x40 + PPU_REG_SIZE).forEach((v, i) => { ppu.writeIo(i, v); });
  }
  return { cpu, bus, ppu };
}
