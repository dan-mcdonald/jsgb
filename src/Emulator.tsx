import {} from 'react/canary';
import React from "react";
import { use, useState } from "react";
import * as PPU from "./ppu";
import { audioInit } from "./audio";
import * as CPU from "./cpu";
import buildBus from "./buildBus";

enum RunState {
  Stopped,
  Running,
  Step,
}

export default function Emulator({ bootRomPromise, cartPromise }: { bootRomPromise: Promise<Uint8Array>, cartPromise: Promise<Uint8Array> }) {
  const bootRom = use(bootRomPromise);
  const cart = use(cartPromise);
  const [runState, setRunState] = useState(RunState.Stopped);
  const cpu = CPU.initCPU();
  const ppu = PPU.ppuBuild();
  const audio = audioInit();
  const bus = buildBus(bootRom, cart, ppu, audio);

  const [cycleCount, setCycleCount] = useState(0);

  function doStep() {
    const cycles = CPU.step(cpu, bus);
    setCycleCount(cycleCount + cycles);
    for(let i = 0; i < cycles; i++) {
      PPU.tick(ppu, bus);
    }
    // PPU.renderScreen(screenContext, ppu);
  }

  return (<div>
    <canvas id="screen" width="160" height="144"></canvas>
    <div id="controls">
      <button id="run">▶</button>
      <button id="step" onClick={doStep}>1</button>
      <button id="pause">⏸</button>
      <button id="reset">🔄</button>
    </div>
    <div style={{ whiteSpace: "pre", fontFamily: "monospace" }} id="debug"></div>
    <div style={{ whiteSpace: "pre", fontFamily: "monospace" }} id="disasm"></div>

  </div>);
}