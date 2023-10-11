import { } from 'react/canary';
import React, { MutableRefObject, useEffect, useRef } from "react";
import { use, useState, useCallback, KeyboardEvent } from "react";
import * as PPU from "./ppu";
import { audioInit } from "./audio";
import { init as timerInit} from "./timer";
import * as CPU from "./cpu";
import buildBus from "./buildBus";
import { cartBuild } from './cart';
import { hex16, hex8 } from './util';
import { initInterruptManager } from './interruptManager';

enum RunState {
  Stopped,
  Running,
}

interface DisasmInstruction {
  instruction: CPU.Instruction;
  addr: number;
  currentInsn: boolean;
  breakpoint: boolean;
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

// const debugifyBus(bus: Bus): Bus {
//   const readb = function(addr: number): number {
//     const val = bus.readb(addr);
//     if (addr >= 0xff80) {
//       console.log(`readb ${hex16(addr)} => ${hex8(val)}`);
//     }
//     return val;
//   }
//   const writeb = bus.writeb;
//   return {readb, writeb};
// }

export default function Emulator({ bootRomPromise, cartPromise }: { bootRomPromise: Promise<Uint8Array>, cartPromise: Promise<Uint8Array> }) {
  const bootRom = use(bootRomPromise);
  const cart = use(cartPromise);
  const [runState, setRunState] = useState(RunState.Stopped);
  const interruptManager = initInterruptManager();
  const [cpu, setCpu] = useState(CPU.initCPU());
  const [ppu, setPpu] = useState(PPU.ppuBuild());
  const audio = audioInit();
  const timer = timerInit(interruptManager.requestTimerInterrupt);
  const [bus, setBus] = useState(buildBus(interruptManager, bootRom, cartBuild(cart), ppu, audio, timer));
  const [cycleCount, setCycleCount] = useState(0);
  const [breakPoints, setBreakPoints] = useState<number[]>([]);
  const screenContextRef = useRef<CanvasRenderingContext2D | null>(null);

  const screenRef = useCallback((screenElem: HTMLCanvasElement | null) => {
    if (screenElem) {
      if (!screenContextRef.current) {
        screenContextRef.current = screenElem.getContext("2d");
        if (!screenContextRef.current) {
          console.error("Could not get screen context");
          return;
        }
        PPU.renderScreen(screenContextRef.current, ppu);
      }
    } else {
      screenContextRef.current = null;
    }
  }, [ppu]);

  const frameTime: MutableRefObject<null | DOMHighResTimeStamp> = useRef(null);
  function runFrame(time: DOMHighResTimeStamp) {
    const lastFrameTime = frameTime.current;
    frameTime.current = time;
    if (lastFrameTime !== null) {
      const elapsed = time - lastFrameTime;
      const targetCycles = elapsed * 4194.304;
      let frameCycles = 0;
      for (let frameDone = false; !frameDone;) {
        const cycles = CPU.step(cpu, bus);
        frameCycles += cycles;
        for (let i = 0; i < cycles; i++) {
          PPU.tick(ppu, bus);
          timer.tick();
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
      setCpu(cpu);
      setBus(bus);
      if (screenContextRef.current) {
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
    const disasmAddr = disasmAddrRef.current;
    console.log("toggleBreakPoint() while disasmAddrRef.current = ", disasmAddr);
    if (disasmAddr === null) {
      return;
    }
    const index = breakPoints.indexOf(disasmAddr);
    if (index == -1) {
      setBreakPoints([...breakPoints, disasmAddr]);
    } else {
      setBreakPoints(breakPoints.filter((_, i) => i != index));
    }
  }

  function keyDown(e: KeyboardEvent) {
    switch (e.code) {
      case "F7":
        e.preventDefault();
        doStep();
        break;
      case "F2":
        toggleBreakPoint();
        break;
      case "F9":
        doRun();
        break;
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
    const breakpoint = breakPoints.includes(insnAddr);
    disasmInsns.push({ instruction, addr, currentInsn, breakpoint });
    insnAddr += instruction.length;
  }

  const styleBreakpoint = { backgroundColor: "red", color: "white" };
  const styleCurrentInsn = { backgroundColor: "blue", color: "white" };
  const styleDefault = { backgroundColor: "white", color: "black" };
  const disasmItems = disasmInsns.map((disasm) => (<option style={disasm.breakpoint ? styleBreakpoint : disasm.currentInsn ? styleCurrentInsn : styleDefault} key={disasm.addr} value={disasm.addr}>{disasm.breakpoint ? "#" : "\xA0"}{disasm.currentInsn ? ">" : "\xA0"}{hex16(disasm.addr)}: {disasm.instruction.text}</option>));

  const disasmAddrRef = useRef<null | number>(null);
  function handleDisasmChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const addr = parseInt(e.target.value);
    disasmAddrRef.current = Number.isNaN(addr) ? null : addr;
  }

  const stackOptions = [];
  for (let i = 2; i < 0x7e; i += 2) {
    const addr = 0xfffe - i;
    const hi = bus.readb(addr + 1);
    const lo = bus.readb(addr + 2);
    const value = (hi << 8) | lo;
    stackOptions.push(<option key={addr} value={addr}>{cpu.regs.sp == addr ? ">" : "\xA0"}{hex16(addr)}: {hex16(value)}</option>);
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
    <select multiple style={{ whiteSpace: "pre", fontFamily: "monospace" }}>{stackOptions}</select>
  </div>);
}
