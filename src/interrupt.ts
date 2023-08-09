import {Bus} from "./bus";

export const enum Interrupt {
  VBlank,
  LCDStat,
  Timer,
  Serial,
  Joypad
}

export function interruptVector(int: Interrupt): number {
  switch(int) {
  case Interrupt.VBlank:
    return 0x40;
  case Interrupt.LCDStat:
    return 0x48;
  case Interrupt.Timer:
    return 0x50;
  case Interrupt.Serial:
    return 0x58;
  case Interrupt.Joypad:
    return 0x60;
  }
}

function interruptMask(int: Interrupt): number {
  switch(int) {
  case Interrupt.VBlank:
    return 0x01;
  case Interrupt.LCDStat:
    return 0x02;
  case Interrupt.Timer:
    return 0x04;
  case Interrupt.Serial:
    return 0x08;
  case Interrupt.Joypad:
    return 0x10;
  }
}

export const addrIntFlag = 0xFF0F;
export const addrIntEnable = 0xFFFF;

export function clearInterrupt(bus: Bus, int: Interrupt): void {
  bus.writeb(addrIntFlag, bus.readb(addrIntFlag) & ~interruptMask(int));
}

export function setInterrupt(bus: Bus, int: Interrupt): void {
  bus.writeb(addrIntFlag, bus.readb(addrIntFlag) | interruptMask(int));
}

const interruptPriorities = [Interrupt.VBlank, Interrupt.LCDStat, Interrupt.Timer, Interrupt.Serial, Interrupt.Joypad];

export function interruptPending(bus: Bus): Interrupt | null {
  const flags = bus.readb(addrIntFlag) & bus.readb(addrIntEnable);
  for (const intType of interruptPriorities) {
    if (flags & interruptMask(intType)) {
      return intType;
    }
  }
  return null;  
}
