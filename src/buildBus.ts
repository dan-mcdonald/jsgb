import { Bus } from "./bus";
import { hex8, hex16 } from "./util";
import { PPU } from "./ppu";
import { Audio, IoReg as AudioIoReg } from "./audio";
import { Cart, cartRead, cartWrite } from "./cart";
import { Timer } from "./timer";
import { InterruptManager } from "./interruptManager";

export default function buildBus(interruptManager: InterruptManager, bootRom: Uint8Array | null, cart: Cart, ppu: PPU, audio: Audio, timer: Timer): Bus {
  let intEnable = 0;
  let joyp = 0xff;
  let serialData = 0xff;
  const hram = new Uint8Array(0x7f);
  const wram = new Uint8Array(0x2000); // C000-DFFF

  const writeb = function (addr: number, val: number): void {
    // if (addr == 0xdf7e) {
    //   throw new Error(`writeb ${hex16(addr)} ${hex8(val)}`);
    // }
    if (addr <= 0x7fff || (addr >= 0xa000 && addr <= 0xbfff)) {
      cartWrite(cart, addr, val);
    } else if (addr >= 0x8000 && addr <= 0x9fff) {
      ppu.writeVram(addr - 0x8000, val);
    } else if (addr >= 0xc000 && addr <= 0xdfff) {
      wram[addr - 0xc000] = val;
    } else if (addr == 0xff00) {
      if ((val | 0x30) != 0x30) {
        throw new Error(`Unexpected value ${hex8(val)} write to JOYP`);
      }
      joyp = 0xcf | val;
    } else if (addr == 0xff01) { // Serial transfer data
      serialData = val;
    } else if (addr == 0xff02) { // Serial transfer control
      if (val == 0x81) {
        console.error(String.fromCharCode(serialData));
      } else {
        throw new Error(`Unexpected value ${hex8(val)} write to SB`);
      }
    } else if (addr >= 0xff04 && addr <= 0xff07) {// Timer
      timer.writeRegister(addr - 0xff04, val);
    } else if (addr == 0xff0f) {
      interruptManager.write(val);
    } else if (addr >= 0xff10 && addr <= 0xff3f) {
      const audioReg = addr - 0xff10;
      if (audioReg in AudioIoReg) {
        audio.writeIo(audioReg, val);
      } else {
        throw new Error(`writeb unsupported addr ${hex16(addr)}`);
      }
    } else if (addr >= 0xff40 && addr <= 0xff4f) {
      ppu.writeIo(addr & 0x0f, val);
    } else if (addr == 0xff50) {
      bootRom = null;
    } else if (addr >= 0xff80 && addr <= 0xfffe) {
      hram[addr - 0xff80] = val;
    } else if (addr == 0xffff) {
      intEnable = val;
    } else {
      throw new Error(`writeb unsupported addr ${hex16(addr)}`);
    }
  };
  const readb = function (addr: number): number {
    if (addr >= 0x0000 && addr <= 0x00ff && bootRom != null) {
      return bootRom[addr];
    } else if (addr <= 0x7fff || (addr >= 0xa000 && addr <= 0xbfff)) {
      return cartRead(cart, addr);
    } else if (addr >= 0xc000 && addr <= 0xdfff) {
      return wram[addr - 0xc000];
    } else if (addr == 0xff00) {
      return joyp;
    } else if (addr == 0xff0f) {
      return interruptManager.read();
    } else if (addr >= 0xff10 && addr <= 0xff3f) {
      const audioReg = addr - 0xff10;
      if (audioReg in AudioIoReg) {
        return audio.readIo(audioReg);
      } else {
        throw new Error(`readb unsupported addr ${hex16(addr)}`);
      }
    } else if (addr >= 0xff40 && addr <= 0xff4f) {
      return ppu.readIo(addr - 0xff40);
    } else if (addr >= 0xff80 && addr <= 0xfffe) {
      return hram[addr - 0xff80];
    } else if (addr == 0xffff) {
      return intEnable;
    } else {
      throw new Error(`readb unsupported addr ${hex16(addr)}`);
    }
  };
  return { writeb, readb };
}
