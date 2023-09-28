import { } from 'react/canary';
import React, { MutableRefObject, useEffect, useRef } from "react";
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

// https://layonez.medium.com/performant-animations-with-requestanimationframe-and-react-hooks-99a32c5c9fbf
function useAnimationFrame(nextAnimationFrameHandler: FrameRequestCallback, shouldAnimate: boolean) {
  const frameReqId = useRef(0);

  const animate = (time: DOMHighResTimeStamp) => {
    if (!shouldAnimate) {
      throw new Error("frame animation function called while shouldAnimate = false");
    }
    nextAnimationFrameHandler(time);
    frameReqId.current = requestAnimationFrame(animate);
  };

  function cleanup() {
    cancelAnimationFrame(frameReqId.current);
  }

  useEffect(() => {
    // start or continue animation in case of shouldAnimate if true
    if (shouldAnimate) {
      frameReqId.current = requestAnimationFrame(animate);
    } else {
      cleanup();
    }

    return cleanup;
  }, [shouldAnimate]);
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
  const screenContextRef: MutableRefObject<null | CanvasRenderingContext2D> = useRef(null);

  const screenRef = useCallback((screenElem: HTMLCanvasElement | null) => {
    if (screenElem) {
      const screenContext = screenElem.getContext("2d");
      if (!screenContext) {
        console.error("Could not get screen context");
      } else {
        screenContextRef.current = screenContext;
      }
    }
  }, []);


  

  const frameTime: MutableRefObject<null | DOMHighResTimeStamp> = useRef(null);
  function runFrame(time: DOMHighResTimeStamp) {
    const lastFrameTime = frameTime.current;
    frameTime.current = time;
    if (lastFrameTime !== null) {
      const elapsed = time - lastFrameTime;
      const targetCycles = elapsed * 4194.304;
      let frameCycles = 0;
      for(let frameDone = false; !frameDone;) {
        const cycles = CPU.step(cpu, bus);
        frameCycles += cycles;
        for(let i = 0; i < cycles; i++) {
          PPU.tick(ppu, bus);
        }
        if (breakPoints.includes(cpu.pc)) {
          frameDone = true;
          console.log("hit breakpoint at " + hex16(cpu.pc));
          setRunState(RunState.Stopped);
        }
        if (frameCycles >= targetCycles) {
          frameDone = true;
        }
      }
      setCycleCount(cycleCount + frameCycles);

      if(screenContextRef.current) {
        PPU.renderScreen(screenContextRef.current, ppu);
      }
    }
  }
  useAnimationFrame(runFrame, runState == RunState.Running);

  function doStep() {
    const cycles = CPU.step(cpu, bus);
    setCycleCount(cycleCount + cycles);
    for (let i = 0; i < cycles; i++) {
      PPU.tick(ppu, bus);
    }
    setCpu(cpu);
    setPpu(ppu);
    setRunState(RunState.Stopped);
  }

  function doRun() {
    setRunState(RunState.Running);
  }

  function doPause() {
    console.log("pause");
  }

  function doReset() {
    console.log("reset");
  }

  function toggleBreakPoint() {
    
  }

  function keyDown(e: KeyboardEvent) {
    if (e.code == "F3") {
      doStep();
      e.preventDefault();
    }
    if (e.code == "F2") {
      toggleBreakPoint();
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
  for (let i = 0; i < 10; i++) {
    const instruction = CPU.decodeInsn(insnAddr, bus);
    const addr = insnAddr;
    const currentInsn = insnAddr == cpu.pc;
    disasmInsns.push({ instruction, addr, currentInsn });
    insnAddr += instruction.length;
  }

  const disasmItems = disasmInsns.map((disasm) => (<option style={{ backgroundColor: disasm.currentInsn ? "blue" : "white", color: disasm.currentInsn ? "white" : "black" }} key={disasm.addr} value={disasm.addr}>{disasm.currentInsn ? "-> " : "   "}{hex16(disasm.addr)}: {disasm.instruction.text}</option>));

  const disasmAddrRef = useRef<null | number>(null);
  function handleDisasmChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const addr = parseInt(e.target.value);
    disasmAddrRef.current = addr;
  }

  return (<div onKeyDown={keyDown}>
    <canvas ref={screenRef} id="screen" width="160" height="144"></canvas>
    <div id="controls">
      <button id="run" onClick={doRun}>▶</button>
      <button id="step" onClick={doStep}>1</button>
      <button id="pause" onClick={doPause}>⏸</button>
      <button id="reset" onClick={doReset}>🔄</button>
    </div>
    <div style={{ whiteSpace: "pre", fontFamily: "monospace" }} id="debug">{debug}</div>
    <select multiple onChange={handleDisasmChange} style={{ listStyleType: "none", listStylePosition: "outside", whiteSpace: "pre", fontFamily: "monospace" }} id="disasm">
      {disasmItems}
    </select>

  </div>);
}
