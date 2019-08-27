"use strict";

import {initCPU, step, dump} from "./cpu";
import buildBus from "./buildBus";
import { ppuTick, ppuBuild } from "./ppu";
import { audioInit } from "./audio";
import {cartBuild} from "./cart";

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

window.onload = async function (): Promise<void> {
  initScreen();
  const cpu = initCPU();
  const bootRom = await loadBootRom();
  const cart = cartBuild(await loadCart());
  const ppu = ppuBuild();
  const audio = audioInit();

  const [writeb, readb] = buildBus(bootRom, cart, ppu, audio);

  // let i = 0;
  while (true) {
    let cycles = step(cpu, writeb, readb);
    for (; cycles; cycles--) {
      ppuTick(ppu, writeb, readb);
    }
  }
};
