"use strict";

import {initCPU, step, dump} from "./cpu";
import buildBus from "./buildBus";
import { ppuTick, ppuBuild } from "./ppu";
import { audioInit } from "./audio";
import {cartBuild} from "./cart";
import {hex16} from "./util";

// http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf
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
  const resp = await fetch("zelda-link-awakening.gb");
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
    while(cycleCount < targetCycles && cpu.pc != 0x0100) {
      const cycles = step(cpu, bus);
      cycleCount += cycles;
      for(let i = 0; i < cycles; i++) {
        ppuTick(ppu, bus);
      }
    }
    screenContext.clearRect(0, 0, 160, 144);
    screenContext.fillText(`PC = 0x${hex16(cpu.pc)}`, 10, 100);
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
