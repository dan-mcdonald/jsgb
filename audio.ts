export interface Audio {
  ioRegs: Uint8Array;
}

export function audioInit(): Audio {
    return {
      ioRegs: new Uint8Array(0x30)
    };
}
