/* twin-state.js -- save states for the colour twins' CUSTOM-firmware engine.
 *
 * (2026-10-11.) twin-cfw.js, the engine the worker loads for
 * ?fw=custom, is a separate build that exports no snapshot / restore, so the
 * worker's save stopped at its guard and Save did nothing under custom firmware.
 * These two functions are twin.js's own (the retail engine's, our code), taken
 * unchanged: they touch only the machine object's public fields (cpu, bus,
 * periph), which the custom build shares field for field, so they need nothing
 * from inside either bundle. twin-worker.js uses them only when the engine it
 * loaded has none of its own. A worker script: no DOM.
 */
(function(){
'use strict';
function __snapshot(machine){
  var cpu=machine.cpu, bus=machine.bus, periph=machine.periph;
  var regions=[];
  for(var i=0;i<bus.regions.length;i++){
    var r=bus.regions[i];
    if(r.readonly) continue;                        // IFLASH/QSPI: static / re-derived
    regions.push({ name:r.name, bytes:r.buf.slice() });   // .slice() -> own ArrayBuffer (WASM view or JS buf)
  }
  var cpuS={
    r: Array.prototype.slice.call(cpu.r),
    N:cpu.N, Z:cpu.Z, C:cpu.C, V:cpu.V,
    msp:cpu.msp, psp:cpu.psp, primask:cpu.primask, control:cpu.control,
    instrAddr:cpu.instrAddr, nextPc:cpu.nextPc, itstate:cpu.itstate,
    cycles:cpu.cycles, ipsr:cpu.ipsr, vtor:cpu.vtor,
    systickEnabled:cpu.systickEnabled, systickTickInt:cpu.systickTickInt, systickAccum:cpu.systickAccum,
    ipc:cpu.ipc, systickReload:cpu.systickReload, systickInterval:cpu.systickInterval,
    systickCountFlag:cpu.systickCountFlag, pendSysTick:cpu.pendSysTick,
    dma2dDueCycle:cpu.dma2dDueCycle, dmaDueCycle:cpu.dmaDueCycle, rtcDueCycle:cpu.rtcDueCycle, ltdcDueCycle:cpu.ltdcDueCycle,
    nvicEnabled: Array.prototype.slice.call(cpu.nvicEnabled),
    nvicPending: Array.prototype.slice.call(cpu.nvicPending),
    _nvicActive:cpu._nvicActive,
    fp: new Uint8Array(cpu.fpBuf).slice(), fpscr:cpu.fpscr,
    periphNextTick:cpu.periphNextTick, halted:cpu.halted
  };
  var store=[]; periph.store.forEach(function(v,k){ store.push([k,v]); });
  var timers=[]; periph._timers.forEach(function(v,k){
    timers.push([k,{ cen:v.cen, base:v.base, origin:v.origin, frozen:v.frozen, uif:v.uif, ovfMark:v.ovfMark }]);
  });
  var periphS={
    rtcBaseMs:periph.rtcBaseMs, rtcCPS:periph.rtcCPS, coreClockHz:periph.coreClockHz,
    clut:[ Array.prototype.slice.call(periph.clut[0]), Array.prototype.slice.call(periph.clut[1]) ],
    store:store, timers:timers,
    flashSR:[ periph._flashSR[0], periph._flashSR[1], periph._flashSR[2] ],
    ospiWrIdx:periph._ospiWrIdx,
    audioQ: periph._audioQ ? periph._audioQ.slice() : null,
    rtcWutf:periph._rtcWutf, prevPa0:periph._prevPa0, prevPc5:periph._prevPc5,
    s6Anchor:(periph._s6Anchor==null?null:periph._s6Anchor), s6Period:periph._s6Period||0, s6Event:periph._s6Event||0,
    s6HtCleared:periph._s6HtCleared||0, s6TcCleared:periph._s6TcCleared||0, s6CT:periph._s6CT||0,
    ltdcAnchor:(periph._ltdcAnchor==null?null:periph._ltdcAnchor), lastAudioBuf:periph._lastAudioBuf||0
  };
  return { v:1, cycles:cpu.cycles, regions:regions, cpu:cpuS, periph:periphS };
}

function __restore(machine, snap){
  if(!snap || snap.v!==1) return false;
  var cpu=machine.cpu, bus=machine.bus, periph=machine.periph;
  // --- writable RAM regions ---
  for(var i=0;i<snap.regions.length;i++){
    var rs=snap.regions[i];
    for(var j=0;j<bus.regions.length;j++){
      var r=bus.regions[j];
      if(r.name!==rs.name || r.readonly) continue;
      var src=(rs.bytes instanceof Uint8Array)?rs.bytes:new Uint8Array(rs.bytes);
      r.buf.set(src.subarray(0, Math.min(src.length, r.buf.length)));
      r._u32=null; r._u16=null; r._blk=null;         // drop stale JIT views/blocks (SMC safety)
      break;
    }
  }
  // --- CPU ---
  var c=snap.cpu;
  cpu.r.set(c.r);                                     // element-wise: cpu.r may be a WASM-memory view
  cpu.N=c.N; cpu.Z=c.Z; cpu.C=c.C; cpu.V=c.V;
  cpu.msp=c.msp; cpu.psp=c.psp; cpu.primask=c.primask; cpu.control=c.control;
  cpu.instrAddr=c.instrAddr; cpu.nextPc=c.nextPc; cpu.itstate=c.itstate;
  cpu.cycles=c.cycles; cpu.ipsr=c.ipsr; cpu.vtor=c.vtor;
  cpu.systickEnabled=c.systickEnabled; cpu.systickTickInt=c.systickTickInt; cpu.systickAccum=c.systickAccum;
  cpu.ipc=c.ipc; cpu.systickReload=c.systickReload; cpu.systickInterval=c.systickInterval;
  cpu.systickCountFlag=c.systickCountFlag; cpu.pendSysTick=c.pendSysTick;
  cpu.dmaDueCycle=c.dmaDueCycle; cpu.rtcDueCycle=c.rtcDueCycle; cpu.ltdcDueCycle=c.ltdcDueCycle;
  cpu.dma2dDueCycle=0; cpu.dma2dCallback=null;        // safe boundary: no blit mid-flight
  cpu.nvicEnabled.set(c.nvicEnabled); cpu.nvicPending.set(c.nvicPending);
  cpu._nvicActive=c._nvicActive; cpu._nvicDirty=true; // force a rescan next step
  new Uint8Array(cpu.fpBuf).set(c.fp instanceof Uint8Array?c.fp:new Uint8Array(c.fp)); cpu.fpscr=c.fpscr;
  cpu.periphNextTick=0; cpu.halted=!!c.halted; cpu.stopReason=null;
  cpu._fetchR=null; cpu._cr=null; cpu._tr=null; cpu._dr=null; cpu._dw=null; cpu._itcm=null; cpu._hasItcmBlocks=false;
  // --- peripherals ---
  var p=snap.periph;
  periph.rtcBaseMs=p.rtcBaseMs; periph.rtcCPS=p.rtcCPS; periph.coreClockHz=p.coreClockHz;
  periph.clut[0].set(p.clut[0]); periph.clut[1].set(p.clut[1]);
  periph.store.clear(); for(var k=0;k<p.store.length;k++) periph.store.set(p.store[k][0], p.store[k][1]);
  periph._timers.clear(); for(var t=0;t<p.timers.length;t++) periph._timers.set(p.timers[t][0], p.timers[t][1]);
  periph._flashSR[0]=p.flashSR[0]; periph._flashSR[1]=p.flashSR[1]; periph._flashSR[2]=p.flashSR[2];
  periph._ospiRd=null; periph._ospiWrIdx=p.ospiWrIdx; periph._cryp=null;   // idle at a safe boundary
  periph._audioQ=p.audioQ?p.audioQ.slice():null;
  periph._rtcWutf=p.rtcWutf; periph._prevPa0=p.prevPa0; periph._prevPc5=p.prevPc5;
  periph._s6HtCleared=p.s6HtCleared; periph._s6TcCleared=p.s6TcCleared; periph._s6CT=p.s6CT;
  periph._lastAudioBuf=p.lastAudioBuf;
  // Re-arm the periodic scheduler CLOSURES (lost on serialisation) from the
  // restored register state. Anchors reset to null so each re-anchors to the
  // restored cpu.cycles — the sub-period phase is invisible; the point is the
  // RTC tick / LTDC vblank / audio-DMA keep firing. Each arming fn self-checks
  // its enable bit and bails harmlessly if the peripheral isn't actually on.
  periph._s6Anchor=null; periph._s6Period=0; periph._s6Event=0;
  periph._ltdcAnchor=null;
  cpu.rtcCallback=null; cpu.dmaCallback=null; cpu.ltdcCallback=null;
  try{ periph._armRtcWakeup(); }catch(e){}
  try{ periph._scheduleLtdcVblank(); }catch(e){}
  try{ periph._armDmaStream6(); }catch(e){}
  // Rebuild JIT/WASM caches over the freshly-written memory.
  cpu._jitReady=false; try{ cpu._jitInit(); }catch(e){}
  return true;
}

self.TwinState = { snapshot: __snapshot, restore: __restore };
})();
