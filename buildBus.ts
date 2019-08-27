import { BusRead, BusWrite } from "./bus";
import {hex16} from "./util";
import {PPU} from "./ppu";
import {Audio} from "./audio";
import {Cart, cartRead, cartWrite} from "./cart";

export default function buildBus(bootRom: Uint8Array, cart: Cart, ppu: PPU, audio: Audio): [BusWrite, BusRead] {
  let iereg = 0;
  let bootRomDisable = false;
  const hram = new Uint8Array(0x7f);
  const wram = new Uint8Array(0x2000); // C000-DFFF

  const writeb = function(addr: number, val: number): void {
    if (addr >= 0x0000 && addr <= 0x7fff) {
      cartWrite(cart, addr, val);
    } else if (addr >= 0x8000 && addr <= 0x9fff) {
      ppu.vram[0x7fff & addr] = val;
    } else if(addr >= 0xc000 && addr <= 0xdfff) {
      wram[addr - 0xc000] = val;
    } else if(addr >= 0xff10 && addr <= 0xff3f) {
      audio.ioRegs[addr - 0xff10] = val;
    } else if(addr >= 0xff40 && addr <= 0xff4f) {
      ppu.ioRegs[addr & 0x0f] = val;
    } else if (addr == 0xff50) {
      bootRomDisable = true;
    } else if (addr >= 0xff80 && addr <= 0xfffe) {
      hram[addr - 0xff80] = val;
    } else if (addr == 0xffff) {
      iereg = val;
    } else {
      throw new Error(`writeb unsupported addr ${hex16(addr)}`);
    }
  };
  const readb = function(addr: number): number {
    if (addr < 0x0100 && !bootRomDisable) {
      return bootRom[addr];
    } else if (addr <= 0x7fff) {
      return cartRead(cart, addr);
    } else if(addr >= 0xc000 && addr <= 0xdfff) {
      return wram[addr - 0xc000];
    } else if (addr >= 0xff10 && addr <= 0xff3f) {
      return audio.ioRegs[addr - 0xff10];
    } else if (addr >= 0xff40 && addr <= 0xff4f) {
      return ppu.ioRegs[addr & 0xf];
    } else if (addr >= 0xff80 && addr <= 0xfffe) {
      return hram[addr - 0xff80];
    } else if (addr == 0xffff) {
      return iereg;
    } else {
      throw new Error(`readb unsupported addr ${hex16(addr)}`);
    }
  };
  return [writeb, readb];
}
