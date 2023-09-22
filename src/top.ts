"use strict";

import type {CPU} from "./cpu";
import type {Bus} from "./bus";

import {initCPU, step} from "./cpu";
import buildBus from "./buildBus";
import { ppuTick, ppuBuild, renderScreen } from "./ppu";
import { audioInit } from "./audio";
import {Cart, cartBuild} from "./cart";
import {hex8, hex16} from "./util";

// http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf
// https://gbdev.io/pandocs/

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

const updateDebugInfo = function(cpu: CPU, bus: Bus, cycleCount: number, runState: RunState): void {
  const debugDiv = window.document.getElementById("debug");
  if (debugDiv === null) {
    throw new Error("debug div missing");
  }
  debugDiv.innerHTML = "" + 
    `PC = 0x${hex16(cpu.pc)}\n` +
    `SP = 0x${hex16(cpu.regs.sp)}\n` +
    `A = 0x${hex8(cpu.regs.a)}\n` +
    `F = 0x${hex8(cpu.regs.f)}\n` +
    `B = 0x${hex8(cpu.regs.b)}\n` +
    `C = 0x${hex8(cpu.regs.c)}\n` +
    `D = 0x${hex8(cpu.regs.d)}\n` +
    `E = 0x${hex8(cpu.regs.e)}\n` +
    `H = 0x${hex8(cpu.regs.h)}\n` +
    `L = 0x${hex8(cpu.regs.l)}\n` +
    `cycle = ${cycleCount}\n` +
    `state = ${RunState[runState]}\n` +
    "";
    // `LCDC = 0x${hex16(bus.read(0xff40))}\n` +
    // `STAT = 0x${hex16(bus.read(0xff41))}\n` +
    // `LY = 0x${hex16(bus.read(0xff44))}\n` +
    // `LYC = 0x${hex16(bus.read(0xff45))}\n` +
    // `SCX = 0x${hex16(bus.read(0xff43))}\n` +
    // `SCY = 0x${hex16(bus.read(0xff42))}\n` +
    // `WY = 0x${hex16(bus.read(0xff4a))}\n` +
    // `WX = 0x${hex16(bus.read(0xff4b))}\n` +
    // `IE = 0x${hex16(bus.read(0xffff))}\n` +
    // `IF = 0x${hex16(bus.read(0xff0f))}\n` +

}

enum RunState {
  Stopped,
  Running
}

interface EmulatorHandle {
  terminate(): void;
  run(): void;
}

function startEmulator(bootRom: Uint8Array, cart: Cart, screenContext: CanvasRenderingContext2D): EmulatorHandle {
  console.log("emulate()");
  let runState = RunState.Stopped;
  const cpu = initCPU();
  const ppu = ppuBuild();
  const audio = audioInit();
  const bus = buildBus(bootRom, cart, ppu, audio);

  // let i = 0;

  let cycleCount = 0;

  let frameId: number | null = null;
  let lastTs: DOMHighResTimeStamp | null = null;

  function frame(ts: DOMHighResTimeStamp) {
    if (lastTs == null) {
      lastTs = ts;
      window.requestAnimationFrame(frame);
      return;
    }
    const targetCycles = (ts - lastTs) * 4194.304;
    
    let frameCycles = 0;
    while(frameCycles < targetCycles && cpu.pc != 0x0100) {
      const cycles = step(cpu, bus);
      cycleCount += cycles;
      frameCycles += cycles;
      for(let i = 0; i < cycles; i++) {
        ppuTick(ppu, bus);
      }
    }
    renderScreen(screenContext, ppu);
    // screenContext.fillText(`PC = 0x${hex16(cpu.pc)}`, 10, 100);
    updateDebugInfo(cpu, bus, cycleCount, runState);
    if (cpu.pc == 0x0100) {
      console.log("running = false because hit 0x0100");
      runState = RunState.Stopped;
      lastTs = null;
    }
    if (runState == RunState.Running) {
      lastTs = ts;
      frameId = window.requestAnimationFrame(frame);
    } else {
      frameId = null;
    }
  }
  updateDebugInfo(cpu, bus, cycleCount, runState);
  // if (runState == RunState.Running) {
  //   frameId = window.requestAnimationFrame(frame);
  // }

  function terminate() {
    console.log("emulate terminate called");
    if (frameId != null) {
      console.log("canceling frameId ", frameId);
      window.cancelAnimationFrame(frameId);
    }
  }
  function run() {
    console.log("run handle");
    if (runState == RunState.Running) return;
    if (lastTs !== null) {
      console.log("logic bug: was not running yet lastTs was not null!");
    }
    runState = RunState.Running;
    window.requestAnimationFrame(frame);
  }
  return {terminate, run};
}

export async function main (): Promise<void> {
  console.log("jsgb initializing");
  const bootRom = await loadBootRom();
  const cart = cartBuild(await loadCart());
  const screenContext = getScreenContext();
  const resetButton = document.getElementById("reset") as HTMLButtonElement;
  const runButton = document.getElementById("run") as HTMLButtonElement;

  while (true) {
    const handle = startEmulator(bootRom, cart, screenContext);

    runButton.onclick = function() { handle.run(); }
    await new Promise<void>(function(resolve, _) {
      resetButton.onclick = function() { 
        console.log("reset clicked");
        resolve();
      };
    });
    handle.terminate();
  }
}

