import {hex8, hex16} from "./util";

export interface Cart {
  rom: Uint8Array;
  bank1Idx: number;
  ramEnable: boolean;
  ram: Uint8Array;
}

export function cartBuild(rom: Uint8Array): Cart {
  const cartType = rom[0x0147];
  if (cartType != 0x03) {
    throw new Error(`unsupported cart type ${hex8(cartType)}`);
  }
  const romSize = rom[0x0148];
  if (romSize > 0x04) {
    throw new Error(`unsupported cart rom size ${hex8(romSize)}`);
  }
  const ramSize = rom[0x0149];
  if (ramSize != 0x02) {
    throw new Error(`unsupported cart ram size ${hex8(ramSize)}`);
  }
  return {
    rom: rom,
    bank1Idx: 1,
    ramEnable: false,
    ram: new Uint8Array(0x2000),
  };
}

export function cartWrite(cart: Cart, addr: number, val: number): void {
  if (addr >= 0x0000 && addr <= 0x1fff) {
    cart.ramEnable = (val & 0x0f) === 0x0a;
  } else if (addr >= 0x2000 && addr <= 0x3fff) {
    cart.bank1Idx = Math.max(val, 1);
    console.log(`bank 1 selects ${hex8(cart.bank1Idx)}`);
  } else if (addr >= 0xa000 && addr <= 0xbfff && cart.ramEnable) {
    cart.ram[addr - 0xa000] = val;
  } else {
    throw new Error(`unsupported write to cart at ${hex16(addr)} value ${hex8(val)}`);
  }
}

export function cartRead(cart: Cart, addr: number): number {
  if (addr >= 0x0000 && addr <= 0x3fff) {
    return cart.rom[addr];
  } else if (addr >= 0x4000 && addr <= 0x7fff) {
    const bankBase = cart.bank1Idx * 0x4000;
    const bankOffset = addr - 0x4000;
    const romIdx = bankBase + bankOffset;
    if (romIdx >= cart.rom.length) {
      throw new Error(`out of bounds read to cart, addr ${hex16(addr)} with bank1Idx ${cart.bank1Idx} maps to ${hex16(romIdx)}`);
    }
    return cart.rom[romIdx];
  } else if (addr >= 0xa000 && addr <= 0xbfff && cart.ramEnable) {
    return cart.ram[addr - 0xa000];
  } else {
    throw new Error(`unsupported read to cart at ${hex16(addr)}`);
  }
}
