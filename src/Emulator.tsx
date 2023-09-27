import {} from 'react/canary';
import React from "react";
import { use, useState, useCallback, KeyboardEvent } from "react";
import * as PPU from "./ppu";
import { audioInit } from "./audio";
import * as CPU from "./cpu";
import buildBus from "./buildBus";
import { cartBuild } from './cart';
import { hex16, hex8 } from './util';

enum RunState {
  Stopped,
  Running,
}

interface DisasmInstruction {
  instruction: CPU.Instruction;
  addr: number;
  currentInsn: boolean;
  // breakpoint: boolean;
}

export default function Emulator({ bootRomPromise, cartPromise }: { bootRomPromise: Promise<Uint8Array>, cartPromise: Promise<Uint8Array> }) {
  const bootRom = use(bootRomPromise);
  const cart = use(cartPromise);
  const [runState, setRunState] = useState(RunState.Stopped);
  const [cpu, setCpu] = useState(CPU.initCPU());
  const [ppu, setPpu] = useState(PPU.ppuBuild());
  const audio = audioInit();
  const bus = buildBus(bootRom, cartBuild(cart), ppu, audio);
  const [cycleCount, setCycleCount] = useState(0);
  const [breakPoints, setBreakPoints] = useState<number[]>([0x0100]);

  const screenRef = useCallback((screenElem: HTMLCanvasElement | null) => {
    if (screenElem) {
      const screenContext = screenElem.getContext("2d");
      if (!screenContext) {
        throw new Error("Could not get screen context");
      }
      PPU.renderScreen(screenContext, ppu);
    }
  }, [ppu]);

  function doStep() {
    const cycles = CPU.step(cpu, bus);
    setCycleCount(cycleCount + cycles);
    for(let i = 0; i < cycles; i++) {
      PPU.tick(ppu, bus);
    }
    setCpu(cpu);
    setPpu(ppu);
    setRunState(RunState.Stopped);
  }

  function doRun() {
    setRunState(RunState.Running);
  }

  function keyDown(e: KeyboardEvent) {
    if (e.code == "F3") {
      doStep();
      e.preventDefault();
    }
  }

  const debug = "" + 
  `PC = 0x${hex16(cpu.pc)}\n` +
  `SP = 0x${hex16(cpu.regs.sp)}\n` +
  `A = 0x${hex8(cpu.regs.a)}\n` +
  `F = 0x${hex8(cpu.f.valueOf())}\n` +
  `B = 0x${hex8(cpu.regs.b)}\n` +
  `C = 0x${hex8(cpu.regs.c)}\n` +
  `D = 0x${hex8(cpu.regs.d)}\n` +
  `E = 0x${hex8(cpu.regs.e)}\n` +
  `H = 0x${hex8(cpu.regs.h)}\n` +
  `L = 0x${hex8(cpu.regs.l)}\n` +
  `cycle = ${cycleCount}\n` +
  `state = ${RunState[runState]}\n` +
  "";

  const disasmInsns: DisasmInstruction[] = [];
  let insnAddr = cpu.pc;
  for(let i = 0; i < 10; i++) {
    const instruction = CPU.decodeInsn(insnAddr, bus);
    const addr = insnAddr;
    const currentInsn = insnAddr == cpu.pc;
    disasmInsns.push({ instruction, addr, currentInsn });
    insnAddr += instruction.length;
  }

  const disasmItems = disasmInsns.map((disasm) => (<option style={{backgroundColor: disasm.currentInsn ? "blue" : "white", color: disasm.currentInsn ? "white" : "black"}} key={disasm.addr}>{disasm.currentInsn ? "-> " : "   "}{hex16(disasm.addr)}: {disasm.instruction.text}</option>));

return (<div onKeyDown={keyDown}>
    <canvas ref={screenRef} id="screen" width="160" height="144"></canvas>
    <div id="controls">
      <button id="run" onClick={doRun}>▶</button>
      <button id="step" onClick={doStep}>1</button>
      <button id="pause">⏸</button>
      <button id="reset">🔄</button>
    </div>
    <div style={{ whiteSpace: "pre", fontFamily: "monospace" }} id="debug">{debug}</div>
    <select multiple style={{ listStyleType: "none", listStylePosition: "outside", whiteSpace: "pre", fontFamily: "monospace" }} id="disasm">
      {disasmItems}
    </select>

  </div>);
}