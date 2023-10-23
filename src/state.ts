// System state save/load

import { APU } from "./audio";
import { BESSFile } from "./bess";
import buildBus from "./buildBus";
import { Cart } from "./cart";
import { initCPU } from "./cpu";
import { initInterruptManager } from "./interruptManager";
import { PPU } from "./ppu";
import { System } from "./system";
import { init as timerInit } from "./timer";

export function loadSystem(cart: Cart, state?: BESSFile): System {
  const cpu = initCPU();

  const interruptManager = initInterruptManager();
  const ppu = new PPU(state);
  const audio = new APU();
  const timer = timerInit(interruptManager.requestTimerInterrupt);
  const bus = buildBus(interruptManager, null, cart, ppu, audio, timer);
  return { cpu, bus, ppu };
}
