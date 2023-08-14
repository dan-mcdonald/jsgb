"use strict";

import type {CPU} from "./cpu";
import type {Bus} from "./bus";

import {initCPU, step} from "./cpu";
import buildBus from "./buildBus";
import { ppuTick, ppuBuild, renderScreen } from "./ppu";
import { audioInit } from "./audio";
import {cartBuild} from "./cart";
import {hex8, hex16} from "./util";

// http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf
// https://gbdev.io/pandocs/
const initScreen = function(): void {
  // const screenCanvas = <HTMLCanvasElement>document.getElementById("screen");
  // const screenWidth = screenCanvas.width;
  // const screenHeight = screenCanvas.height;

  // console.log("Got canvas " + screenWidth + "X" + screenHeight);

  // const setPixel = function(image: ImageData, x: number, y: number, v: number): void {
  //   const idxBase = 4*(160*y+x);
  //   image.data[idxBase + 0] = v;
  //   image.data[idxBase + 1] = v;
  //   image.data[idxBase + 2] = v;
  //   image.data[idxBase + 3] = 0xff;
  // };

  // const screenContext = screenCanvas.getContext("2d");
  // if (screenContext === null) {
  //   throw new Error("Could not get context");
  // }
  // const screenImage = screenContext.getImageData(0, 0, screenWidth, screenHeight);
  // for (let y = 0; y < 144; y++) {
  //   for (let x = 0; x < 160; x++) {
  //     setPixel(screenImage, x, y, x == 0 || x == 159 || y == 0 || y == 143 ? 0x0 : 0xff);
  //   }
  // }
  // screenContext.putImageData(screenImage, 0, 0);
};

const loadBootRom = async function(): Promise<Uint8Array> {
  // https://gbdev.gg8.se/wiki/articles/Gameboy_Bootstrap_ROM
  const resp = await fetch("DMG_ROM.bin")
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
};

const loadCart = async function(): Promise<Uint8Array> {
  const resp = await fetch("game.gb");
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

const getScreenContext = function(): CanvasRenderingContext2D {
  const screenCanvas = document.getElementById("screen") as HTMLCanvasElement;
  const screenContext = screenCanvas.getContext("2d");
  if (screenContext === null) {
    throw new Error("Could not get context");
  }
  screenContext.fillStyle = "black";
  screenContext.font='16px sans-serif';
  return screenContext;
}

const updateDebugInfo = function(cpu: CPU, bus: Bus, cycleCount: number): void {
  const debugDiv = window.document.getElementById("debug");
  debugDiv.innerHTML = `PC = 0x${hex16(cpu.pc)}<br/>` +
    `SP = 0x${hex16(cpu.regs.sp)}<br/>` +
    `A = 0x${hex8(cpu.regs.a)}<br/>` +
    `F = 0x${hex8(cpu.regs.f)}<br/>` +
    `B = 0x${hex8(cpu.regs.b)}<br/>` +
    `C = 0x${hex8(cpu.regs.c)}<br/>` +
    `D = 0x${hex8(cpu.regs.d)}<br/>` +
    `E = 0x${hex8(cpu.regs.e)}<br/>` +
    `H = 0x${hex8(cpu.regs.h)}<br/>` +
    `L = 0x${hex8(cpu.regs.l)}<br/>` +
    `cycle = ${cycleCount}<br/>` +
    "";
    // `LCDC = 0x${hex16(bus.read(0xff40))}<br/>` +
    // `STAT = 0x${hex16(bus.read(0xff41))}<br/>` +
    // `LY = 0x${hex16(bus.read(0xff44))}<br/>` +
    // `LYC = 0x${hex16(bus.read(0xff45))}<br/>` +
    // `SCX = 0x${hex16(bus.read(0xff43))}<br/>` +
    // `SCY = 0x${hex16(bus.read(0xff42))}<br/>` +
    // `WY = 0x${hex16(bus.read(0xff4a))}<br/>` +
    // `WX = 0x${hex16(bus.read(0xff4b))}<br/>` +
    // `IE = 0x${hex16(bus.read(0xffff))}<br/>` +
    // `IF = 0x${hex16(bus.read(0xff0f))}<br/>` +

}

export async function main (): Promise<void> {
  console.log("jsgb initializing");
  initScreen();
  const cpu = initCPU();
  const bootRom = await loadBootRom();
  const cart = cartBuild(await loadCart());
  const ppu = ppuBuild();
  const audio = audioInit();

  const bus = buildBus(bootRom, cart, ppu, audio);

  // let i = 0;

  const screenContext = getScreenContext();
  let cycleCount = 0;

  function frame(ts: DOMHighResTimeStamp) {
    const targetCycles = ts * 4194.304;
    // const targetCycles = cycleCount + 10000;
    while(cycleCount < targetCycles && cpu.pc != 0x0100) {
      const cycles = step(cpu, bus);
      cycleCount += cycles;
      for(let i = 0; i < cycles; i++) {
        ppuTick(ppu, bus);
      }
    }
    renderScreen(screenContext, ppu);
    // screenContext.fillText(`PC = 0x${hex16(cpu.pc)}`, 10, 100);
    updateDebugInfo(cpu, bus, cycleCount);
    if (cpu.pc != 0x0100) {
      window.requestAnimationFrame(frame);
    }
  }
  window.requestAnimationFrame(frame);

  // console.log("starting execution");
  // while (cpu.pc !== 0x0100) {
  //   let cycles = step(cpu, bus);
  //   for (; cycles; cycles--) {
  //     ppuTick(ppu, bus);
  //   }
  // }
  // console.log(dump(cpu));
}

