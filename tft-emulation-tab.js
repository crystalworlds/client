/* ===========================================================================
 * TFT colour-unit Emulation tab — tftEmulationTabHTML(d)
 *
 * Moved verbatim out of index.html (no edits to the code itself) so that
 * documentation work on this tab is independent of work on the main page.
 * Loaded by a plain <script src> tag — deliberately NOT fetch(), because the
 * site must also open from disk over file://, where fetch is blocked.
 * Defines its builder as a top-level function declaration, exactly as before,
 * so it remains a window global and index.html calls it unchanged.
 * =========================================================================== */

/* ===========================================================================
 * TFT colour-unit Emulation tab — the developer-facing counterpart to the
 * TFT Hardware tab above. This describes OUR emulator of these two units: a
 * hand-rolled ARM Cortex-M7 digital twin that boots the real firmware dump.
 * Kept honest in the same spirit as the Sharp Emulation tabs — confirmed vs
 * inferred is stated, nothing is overclaimed, and known gaps are listed.
 * =========================================================================== */
function tftEmulationTabHTML(d) {
  const unit = TFT_TWIN_UNITS[d.id];
  const u = TFT_HW_INFO[unit];
  return `
    <div class="hw-tab">
      <div class="hw-chip-header">
        <h2>ARM Cortex-M7 Digital Twin</h2>
        <p class="hw-chip-tag">How this project emulates the ${d.model}a hand-written ARM core that boots the real, encrypted firmware, no game-file shortcut</p>
      </div>

      <div class="hw-caveat">
        <strong>Preservation, not a re-implementation.</strong> The colour units
        do not run a game file we can drop into an off-the-shelf NES emulator. What
        ships here is a hand-rolled ARM Cortex-M7 interpreter that boots the
        device's own dumped firmware exactly as the silicon does (HAL init,
        loader, on-the-fly decryption, and the operating system that draws the
        clock) and lets that native code produce the picture. Playing the games
        fast was never the goal; faithfully reproducing what the real chip does,
        down to the decryption, was. This tab is the engineering record of that
        work and is written to be honest about what is confirmed versus inferred.
      </div>

      <section class="sect">
        ${hwSectH('What the twin actually boots')}
        <p class="hw-readable">There is no pure-JavaScript Cortex-M7 interpreter to reuse, so the CPU core was written from scratch (a full integer Thumb-1/Thumb-2 instruction set, the FPv5 double-precision FPU, IT blocks, and M-profile exception entry/return) grown demand-driven from the real boot trace and ported in semantics from reference cores (libthumb2sim, zmu). The ${d.model} resets into its 128 KB internal flash and runs its genuine loader; the operating system, the game emulators and the game files all live on the external ${u.extFlash} flash and are encrypted, so the twin cannot even see them until it reproduces the decryption below. The internal loader draws nothing itself: reaching the ${u.clockName} required driving the firmware's own state machine out of idle (a one-hertz tick flag and the physical Time button, both modelled faithfully) rather than forcing it.</p>
      </section>

      <section class="sect">
        ${hwSectH('OTFDEC: faithful AES-128-CTR decryption')}
        <p class="hw-readable">The single hardest preservation problem was the encrypted external flash. Rather than decrypt it offline and cheat, the twin models the SoC's OTFDEC peripheral and decrypts the memory-mapped flash <em>in place, using the firmware's own key and nonce</em>: the loader programs those values into the emulated peripheral just as it would the real one, and reads from 0x90000000 return plaintext block by block. The construction follows ST's application note AN5281: AES-128 in counter mode, with the counter built from the region's nonce, version and a per-16-byte-block address, and the standard OTFDEC byte-reversal between how flash stores a block and how AES consumes it.</p>
        <p class="hw-readable">It is verified two independent ways. ST's own published OTFDEC example tuple decrypts, through this exact code, to the known Thumb function it should; and the real ${unit === 'mario' ? 'Mario' : 'Zelda'} flash decrypts to valid ARM code: the first word at 0x90000000 becomes a legal <span class="hw-mono-inline">PUSH.W {r4-r10, lr}</span> and the block's entropy drops from 7.95 to 6.81 bits per byte, the signature of noise turning into real code. The AES core itself was checked against FIPS-197 and NIST vectors before being trusted.</p>
      </section>

      <section class="sect">
        ${hwSectH('Modelled peripherals')}
        <div class="factbox factbox-stacked">
          <div class="row"><span class="k">LTDC display</span><span class="v">A two-layer scan-out compositor that reads the live LTDC registers and reproduces the panel pixel for pixel: per-layer pixel format, position, blend factors, and a full RGB888 CLUT for indexed layers. An early single-layer RGB565 reader left the colour sprites invisible; the faithful compositor fixed it.</span></div>
          <div class="row"><span class="k">OctoSPI</span><span class="v">Memory-mapped external-flash reads at 0x90000000, feeding the OTFDEC decryptor; command/status transactions modelled enough for the loader's flash bring-up.</span></div>
          <div class="row"><span class="k">Timers</span><span class="v">SysTick as real exception #15, and a free-running TIM5 the gameplay code polls for timing: both scaled to the confirmed 88 MHz core and TIM5's 22 MHz kernel clock so the firmware runs at true wall-clock tempo.</span></div>
          <div class="row"><span class="k">GPIO &amp; interrupts</span><span class="v">Active-low buttons on their real pins, a real-time RTC fed from the host clock so the on-screen time matches the browser, plus NVIC delivery and DMA2D (Chrom-ART) blitting for the layers that use it.</span></div>
        </div>
        <p class="hw-readable">Memory-mapped I/O traps out of the CPU core to a JavaScript peripheral model; the firmware's HAL brings each block up in its real boot order and the twin clears the status and ready bits it polls for. The RTC is driven from the host system clock, so (exactly like every other device on this site) the ${u.clockName} shows the correct current time.</p>
      </section>

      <section class="sect">
        ${hwSectH('Sound: the firmware\'s own stream, at the rate the firmware sets')}
        <p class="hw-readable">The twin synthesises nothing. The firmware computes every sample itself and hands finished 240-sample buffers to the chip's serial audio interface (SAI1) through a DMA stream in double-buffer mode; the twin reads those buffers as the hardware would play them. Each fact below carries its evidence: <em>confirmed (registers)</em> is a value the firmware writes into a peripheral register, read on the running twin; <em>confirmed (measured)</em> is a measurement on the twin's output; <em>reference manual</em> is ST's RM0455; <em>inferred</em> is a reading of the firmware that was not independently checked.</p>
        <div class="factbox factbox-stacked">
          <div class="row"><span class="k">Output rate</span><span class="v"><strong>48,004 Hz</strong>, confirmed (registers). The firmware clocks SAI1 from PLL2: the 64 MHz internal oscillator divided by 5, multiplied by 24 + 16/8192 (the fractional divider is enabled), divided by 25, which is 12.289 MHz; SAI1 runs with NODIV = 1, MCKDIV = 4 and a 64-bit frame, and with NODIV set the frame rate is the kernel clock divided by MCKDIV times the frame length: 12.289 MHz / (4 x 64) = 48,004 Hz. That is the formula ST's HAL solves for MCKDIV (reference manual, SAI clock generator). The register values on both units: SAI1_ACR1 0x004b1280, SAI1_AFRCR 0x00051f3f, RCC_CDCCIP1R = 1 (SAI1 from pll2_p), RCC_PLLCKSELR 0x00b05040 (HSI, DIVM2 = 5), RCC_PLL2DIVR 0x01013017 (N = 24, P = 25), RCC_PLL2FRACR 0x80 with the fraction enabled, HSIDIV = 0. An emulator must derive the rate from these, not assume one: this twin paced its stream at an assumed 22,050 Hz for months.</span></div>
          <div class="row"><span class="k">Why the exact value matters</span><span class="v">Confirmed (measured). At a rounded 48,000 Hz a 240-sample buffer lasts exactly 5.000 ms, five ticks of the firmware's 1 ms system timer, so every buffer end lands on the same timer phase; at one such phase the twin handed the same buffer over twice (176 duplicate buffers in 15 s, heard as crackle). At 48,004 Hz the phase drifts and every buffer is handed over once, in order.</span></div>
          <div class="row"><span class="k">Sound on demand</span><span class="v">Confirmed (measured). The firmware makes sound per DMA buffer: its transfer-complete handler publishes the next buffer's address 172 instructions after the event, and the main loop keeps a ring of about sixteen 240-sample buffers filled ahead. So a wrong rate does not slow the game: it still runs at 60 frames per second, the tune is still recognisable, but every pitch shifts by the ratio of the rates. At 22,050 Hz every note came out 13.5 semitones low, the noise channel a rumble and the melody buried under the bass. That is the symptom to recognise.</span></div>
          <div class="row"><span class="k">The silence buffer, and the pace</span><span class="v">Confirmed (measured, 1 Nov 2026). When the ring runs dry the firmware's transfer-complete handler points the stream at a separate 240-sample buffer of zeros (at 0x24092e40 on the Zelda unit): a 5 ms hole, and nothing else changes. A twin that gives the firmware too few instructions per second starves the ring exactly that way, and the holes come at a regular rate: with the twin's old pace of 1.44 core cycles per instruction (61.1 million instructions a second) the Zelda unit's NES emulation reached about 58 frames a second on The Legend of Zelda's title and about 55 on Zelda II's, and the silence buffer played 5 times a second on the one and 15 on the other, heard as a helicopter-like chop over the music. The pace is 1.2 cycles per instruction (73.3 million a second) since 1 Nov, and since 2 Nov it is only headroom (next row): the firmware runs 60 game frames a second at any pace that has enough, and its sound stream is byte-identical at 1.3 and 1.2. 1.44 has none: locked to the panel, Zelda's title takes two vblanks a frame and the silence buffer plays every second buffer. The constant is still a fitted one: nothing measured the real chip's instruction rate, and the real Cortex-M7 running from its tightly coupled memory is known to retire close to one instruction a cycle. The symptom to recognise: a regular chop at 5 to 15 a second on one game and not another.</span></div>
          <div class="row"><span class="k">The frame lock</span><span class="v">Confirmed (measured, 2 Nov 2026). The firmware's frame loop waits for the display reload to complete at the panel's vertical blank (the LTDC_SRCR write; the RRIF flag and its interrupt), and the twin now completes it at the next vblank of its 60 Hz grid. Until 2 Nov the shipped twin raised the flag at once, so the frame loop never waited for the panel: it free-ran at whatever the pace allowed, and the pace constant set the game speed, the music tempo and the sound ring's fill. Measured on the site core: at 1.44 Super Mario Bros. ran about 61 game frames a second (the beat of its overworld music 0.443 s) and Zelda's title 57 (the silence buffers above); at 1.2 both ran 20 percent fast (the beat 0.369 s on Mario, 0.580 s instead of 0.698 s on Zelda) and the firmware threw the surplus sound away, one sample at the end of 12 percent (Mario) to 38 percent (Zelda) of its 240-sample buffers, a 200 Hz comb heard as an undertone of crackle. Locked, the game runs 60 frames a second at every pace with headroom, the beat is 0.451 s on Mario and 0.667 s on Zelda, no silence buffer plays, no buffer ends in a step, and the clock screen costs less per frame than free-running (the reason the instant flag had been kept, an older interpreter's wake cost, no longer holds). One consequence worth knowing: the game's note changes, which its NES emulation applies on an 80-sample grid, now fall on buffer joins a third of the time, as the grids are in lock; they are the music's own onsets, not steps. A state saved before 2 Nov loads onto the locked grid.</span></div>
          <div class="row"><span class="k">Reading the buffers</span><span class="v">Confirmed (measured). The DMA stream alternates between two buffer addresses (double-buffer mode, reference manual); the twin reads the buffer the hardware has just drained, chosen by the current-target bit, then toggles that bit so the firmware refills the drained one. Reading buffers in the order the firmware publishes their addresses instead breaks about a fifth of the buffer joins at the real rate (21.6 percent of 240-sample boundaries discontinuous).</span></div>
          <div class="row"><span class="k">Stream level</span><span class="v">Confirmed (measured). 16-bit signed samples with no offset: in play they run from about -1120 to +1389 counts, on the clock screen from 0 to 2,800 (the tick). The level is small because the firmware boots at its quiet volume setting, 10/128 of full scale by its own master-volume table (inferred); the Zelda unit's stream is 3.7 times larger. The stream itself is clean: no speaker or amplifier model is needed to make it sound like the unit, and none is applied.</span></div>
          <div class="row"><span class="k">Playback</span><span class="v">Confirmed (measured). The twin reports its derived rate to the player, which plays the raw counts through a 50 Hz DC blocker, a gain per unit (Mario 21/32768, Zelda 4.5/32768, so 30 s of play peaks near -2 dBFS and sits near -15 dBFS), a 10 kHz band limit and a soft knee above 0.8 of full scale. The audio queue starts at a 50 ms target and raises itself by 20 ms at each underrun (to 150 ms at most; a busy machine settles between 70 and 110), with a drift servo of at most 0.5 percent read on every block (a frozen servo once let the queue grow to 230 ms and empty itself every 20 s) and two frames in flight between the page and the worker that runs the twin. Measured press-to-sound is about a fifth of a second at a desk (the press timestamped against the first sound block carrying it, plus the queue and the browser's reported output latency), of which the firmware's own input scan and ring account for about 110 ms (measured in the twin's own time by comparing a pressed and an unpressed machine); the rest is the worker pipeline, the queue and the browser's output latency, which a phone adds to on its own.</span></div>
        </div>
      </section>

      <section class="sect">
        ${hwSectH('CPU accuracy: bugs found by differential testing')}
        <p class="hw-readable">A billion instructions of correct-looking boot can still hide a single wrong opcode that only a specific data pattern reaches. To flush those out, the twin is run in lockstep against an independent reference decoder (Capstone) instruction by instruction, and the first register that disagrees is the bug. That harness caught real, subtle Thumb-2 decode errors: for example the byte-extend family (<span class="hw-mono-inline">UXTB</span> and friends) was decoding through the wrong sub-field and sign-extending where it should have zero-extended, and <span class="hw-mono-inline">REV.W</span> was misrouted into that same extend group. Both were data-dependent: they only corrupted high-valued bytes, which is why the clock's background rendered perfectly while Mario's red-and-peach sprite came out speckled purple until the decode was fixed. These fixes are broad: they correct the affected instructions everywhere, not just on this device.</p>
      </section>

      <section class="sect">
        ${hwSectH('WebAssembly core, with the JS interpreter as fallback')}
        <p class="hw-readable">Because the twin executes a real 88 MHz processor one instruction at a time, raw JavaScript throughput matters: sub-real-time is fine for a clock, but tight for smooth audio. The JavaScript interpreter was progressively optimised (including a straight-line block JIT via generated functions) up to roughly half of real-device speed, at which point pure-JS levers were measured to be exhausted. The hot integer core was then ported to WebAssembly (built with AssemblyScript, the only toolchain available on the build machine): CPU registers and RAM live in WebAssembly linear memory, while memory-mapped I/O, the FPU and a few rare instructions still trap out to the JavaScript model. In-browser this crosses real-time (around 100–104% of the 88 MHz device on a focused tab) enough to keep the clock ticking to wall time.</p>
        <p class="hw-readable">The WebAssembly core is opt-in and safe: a loader feature-detects WebAssembly and, if it is missing or the memory map does not match, silently falls back to the JavaScript interpreter, which is also kept as the correctness reference. The two were proven bit-identical over tens of millions of instructions against real peripheral state: a discipline that itself caught three integration bugs during the port.</p>
      </section>

      <section class="sect">
        ${hwSectH('Known gaps &amp; honest caveats')}
        <p class="hw-readable">This is a live preservation effort, not a finished product, and a few things are deliberately called out. <strong>Audio</strong> plays at the rate the firmware sets (see the Sound section): what is still open is the press-to-sound time, bounded below by the firmware's own 110 ms, and the exact cause of the duplicate buffers at a rounded 48,000 Hz, which is avoided rather than explained. <strong>The pace</strong> (cycles per instruction, 1.2) is fitted to what the firmware needs, not measured on the chip; since the frame lock of 2 Nov 2026 it is only headroom (about 12 percent over Zelda II's title), and a game heavier than that could still starve the ring, the sign of it being the regular chop described in the Sound section. <strong>Timing</strong> depends on browser throughput: the displayed clock time is always correct, but boot and fade pacing vary with how fast the tab runs. <strong>Button pin assignments</strong> beyond the Time key are best-effort, mapped by observing the firmware rather than from a schematic. And the decryption parameters were captured firsthand for the Mario unit${unit === 'zelda' ? '; Zelda boots through the same generic OTFDEC model with its own key and nonce' : ''}. None of these are papered over here on purpose: the site's tabs state what is proven and what is not.</p>
      </section>

      <section class="sect">
        <h3 class="sect-h">Sources</h3>
        <ul class="hw-sources">
          <li>This project's ARM twin source (CPU core, peripheral model, OTFDEC and LTDC implementations): the primary record; every claim above was observed in its execution of the real ${d.model} dump.</li>
          <li>ST application note AN5281: the OTFDEC AES-128-CTR construction the decryptor implements and was verified against.</li>
          <li>ST reference manual RM0455: LTDC layer/CLUT/blend registers, the OCTOSPI memory-mapped mode, the SAI clock generator (the NODIV and MCKDIV formula) and the DMA double-buffer mode; ST's HAL source (stm32h7xx_hal_sai.c) for the same formula as code.</li>
          <li>FIPS-197 and NIST AES test vectors: used to validate the AES-128 block cipher independently of the firmware.</li>
          <li>libthumb2sim and zmu: reference Cortex-M cores consulted for instruction semantics; Capstone: the independent decoder used for differential lockstep testing.</li>
        </ul>
      </section>
    </div>`;
}
