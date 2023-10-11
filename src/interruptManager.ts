export interface InterruptManager {
  requestTimerInterrupt: () => void;
  read: () => number;
  write: (val: number) => void;
}

export function initInterruptManager(): InterruptManager {
  let intRequest = 0;
  return {
    requestTimerInterrupt: () => { 
      console.error("timer interrupt");
      intRequest |= 0x04; 
    },
    read: () => intRequest,
    write: (val: number) => { intRequest = val; },
  };
}
