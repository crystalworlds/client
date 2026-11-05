/* apu.h — DMG sound controller, state and seam.
 *
 * Stage 4. Clean-room: written from Pan Docs (Audio, Audio Registers, Audio
 * Details) and TCAGBD. SameBoy is used as an OUTPUT oracle only — see
 * the audio design §1 for the exact record of what was and was not read.
 *
 * This header is included by src/gb.c BEFORE `struct GB` so that `struct APU`
 * can be one of its members; src/apu.c is included AFTER it. apu.c never sees
 * `struct GB` — the two files stay independently attributable, which is the
 * whole point of the ownership split.
 *
 * Types are spelled out rather than borrowed from gb.c's u8/u16 so this header
 * is self-contained and can be read on its own.
 */
#ifndef GB_APU_H
#define GB_APU_H

/* One APU tick is 2 T-cycles. Everything below counts in T-cycles so that the
 * wave channel's (2048-f)*2 period and the square channels' (2048-f)*4 are the
 * same kind of number. */
#define APU_TICK_T 2

/* DC-blocking high-pass -- the DMG's output capacitor. DEFAULT OFF, and off
 * means COMPILED OUT: no state, no arithmetic, `struct APU` unchanged byte for
 * byte, so every existing number is untouched. Build -DAPU_HIGHPASS=1 to enable.
 *
 * A knob rather than a shipped change because it moves the DC content of every
 * render and therefore every track's spectral score -- it needs a baseline to
 * move from, and the audio baseline is frozen while the boot-chime regression
 * is unexplained. See the audio design sect. 21.
 *
 * The charge factor is per APU TICK, not per output sample: the capacitor sees
 * the DAC's continuous output rather than the host's sampling of it, so the
 * constant is independent of the output rate and needs no pow() in freestanding
 * code. 0.999958 per T-cycle (TCAGBD), squared for the 2 T tick. */
#ifndef APU_HIGHPASS
#define APU_HIGHPASS 0
#endif
#define APU_HP_CHARGE 0.999916001764

/* APU_HOST_DCBLOCK -- THE HOST OUTPUT IS CAPACITOR-COUPLED (2026-10-14).
 * MECHANISM: the console's audio output passes a coupling capacitor, so no DC
 * reaches the jack. The DAC sum here is not centred (a powered, quiet DAC sits
 * at its rail: silence was -0.75 FS, Link's Awakening's output sat AT the -1.0
 * rail 15.7 % of the time, measured by test/audio-dc/au.c), so the host heard a
 * large offset that every gain step turned into a click. This applies the same
 * one-pole block APU_HIGHPASS describes, with the same per-tick charge, to the
 * HOST ring only (apu_out). The instrument's capture (apu_capture, GB_NATIVE)
 * and every scored audio number keep reading the raw DAC sum, so no audio
 * baseline moves; only what the shell plays changes. 1 = on (shipped).
 * Off arm: -DAPU_HOST_DCBLOCK=0 restores the raw host output. */
#ifndef APU_HOST_DCBLOCK
#define APU_HOST_DCBLOCK 1
#endif

/* APU_HOST_HEADROOM -- THE HOST SCALE LEAVES ROOM FOR THE CAPACITOR'S SWING
 * (2026-10-14).
 * MECHANISM (a derived bound, not a measured one). The capacitor update is
 * c' = (1-k) x + k c, so the charge c is always a convex combination of past
 * inputs and stays inside the input's own range, +-480 per side (apu_mix). The
 * host output x - c is therefore bounded by +-960, and it reaches that bound
 * exactly when the input steps rail to rail after resting long enough on the
 * opposite rail. Mapping 960 (not 480) to 32767 makes clipping impossible by
 * construction, for every game, model, rate and register setting; the shape
 * of the output is unchanged, the level is 6.02 dB lower (exactly half).
 * Reference levels, for scale: SameBoy's per-channel amplitude is 0xFF0
 * (MAX_CH_AMP, Core/apu.h), four channels 0x3FC0 = 0.498 FS rail to rail, so
 * it is 6 dB quieter again than this scale.
 * Off arm: -DAPU_HOST_HEADROOM=0 restores 480 = full scale (the 2026-10-14
 * round's output, saturated). Only meaningful with APU_HOST_DCBLOCK. */
#ifndef APU_HOST_HEADROOM
#define APU_HOST_HEADROOM 1
#endif
#define APU_HOST_FS ((APU_HOST_DCBLOCK && APU_HOST_HEADROOM) ? 960LL : 480LL)

/* APU_HOST_HP_PER_MODEL -- THE CGB'S STRONGER CAPACITOR. BUILT, MEASURED, NOT
 * DEFAULT: A DECISION (our notes sect. 3).
 * Pan Docs (Audio Details, the HPF) gives 0.999958 per 4194304 Hz step for the
 * DMG and "0.998943 for MGB&CGB", and says the HPF is more aggressive on GBC
 * than on DMG. Squared for the 2 T tick: 0.997887117249. That is a first-order
 * corner of about 706 Hz against the DMG's 28 Hz, an audible thinning of
 * every CGB title's bass. The value's provenance is not traceable past Pan
 * Docs, and neither open reference splits by model (SameBoy: one 0.999958 for
 * every model; mGBA: one per-sample constant 65368/65536 for every model), so
 * there is no reference that adjudicates it. 1 = the CGB device uses the CGB
 * factor on the host ring; 0 (default) = the DMG factor on every device. */
#ifndef APU_HOST_HP_PER_MODEL
#define APU_HOST_HP_PER_MODEL 0
#endif
#define APU_HP_CHARGE_CGB 0.997887117249

/* Host output ring, in stereo frames. Must exceed one emulated frame at any
 * rate a host will ask for: 96000 Hz gives 1607 frames per DMG frame, so 2048
 * covers a shell that drains once per frame with headroom, and 2048 * 2 * 2 B
 * is 8 KB inside a context that already carries 128 KB of cartridge RAM.
 * Power of two: the wrap is a mask, not a modulo. */
#define APU_RING 2048

/* SQ_TRIG_PHASE / SQ_TRIG_RESTART_SHORTER -- THE SQUARE CHANNELS' START DELAY.
 * DERIVED FROM THE CARTRIDGES' OWN PROSE, AND THE UNIT IS DERIVED TOO.
 *
 * One additive constant cannot serve both stimuli, because the corpus declares
 * they are ONE TICK APART, and it states both quantities in words:
 *
 *   samesuite apu/channel_1/channel_1_delay.asm
 *     "It takes (sample length + 2) ticks from the moment channel 1 is enabled
 *      until PCM12 is affected. (The read operation itself takes 2 cycles)"
 *
 *   samesuite apu/channel_1/channel_1_restart.asm
 *     "after restarting, the start delay from the 'delay' test is actually
 *      1 tick shorter. The countdown for the next sample is reset, but the new
 *      pulse's first sample will be the next sample the old pulse would have
 *      played (i.e. the current sample index or phase does not reset)"
 *
 * THE UNIT IS NOT ASSUMED. samesuite apu/channel_1/channel_1_align_cpu.asm
 * fixes it -- "Since we're running in a 1MHz world now" -- so a SameSuite tick
 * is one 1 MHz machine cycle = 4 T. The `+ 4` beside this in apu_trigger is a
 * separate quantity, the seam's write lead, so the physical delay is
 * `period + SQ_TRIG_PHASE`:
 *
 *     cold trigger   = period + 2 ticks = period + 8 T   -> SQ_TRIG_PHASE 8
 *     restart        = one tick shorter = period + 4 T   -> SHORTER      4
 *
 * NOT FITTED, and the distinction matters: these were read off sentences and
 * the declared tables then confirmed them. The knob's observable resolution is
 * 4 T -- SHORTER 0 and 2 produce byte-identical output on all 43 measured
 * samesuite rows, as do 4 and 6 -- so a 2 T reading of "1 tick" is not merely
 * wrong, it is unobservable at PCM12, which the CPU samples at machine-cycle
 * granularity.
 *
 * The third element of the path is in apu_trigger itself and is derived from
 * the second sentence of the restart declaration above. Seven rival readings of
 * it were registered as code in our hardware-session prediction BEFORE
 * being measured; exactly one reproduces the declared 144-cell table. */
/* APU_BOOT_CH1_ON -- THE NO-BOOT START LEAVES CHANNEL 1 ON, SO FF26 READS F1
 * (2026-10-17).  Both boot programs play their start-up
 * sound on channel 1 and never stop it: the envelope decays to volume 0 but the
 * channel stays enabled, so NR52 reads $F1 at the hand-over (Pan Docs, Power Up
 * Sequence: NR52 = $F1 on the original; Mooneye acceptance/boot_hwio-dmgABCmgb,
 * whose expected values its author measured on hardware, asserts it).  The
 * no-boot table already powered channel 1's DAC (NR12 = $F3) but left the
 * channel stopped, so FF26 read $F0 and boot_hwio-dmgABCmgb failed without a boot
 * program.  LABEL: FF26 bit 0 and "the channel was triggered" are MECHANISM; the
 * channel's volume at the hand-over is set to 0 (the decayed state, so the
 * no-boot start stays silent) and that magnitude is NOT ESTABLISHED by us: the
 * envelope's position when the boot program hands over was not measured.
 * Booted runs never reach this (apu_reset's post_boot arm is the no-boot table).
 * Off arm: 0 restores the stopped channel (FF26 = $F0). */
#ifndef APU_BOOT_CH1_ON
#define APU_BOOT_CH1_ON 1
#endif
#ifndef SQ_TRIG_PHASE
#define SQ_TRIG_PHASE 8
#endif
#ifndef SQ_TRIG_RESTART_SHORTER
#define SQ_TRIG_RESTART_SHORTER 4
#endif

/* SWEEP_KILL_DELAY_T -- THE SWEEP'S POST-UPDATE OVERFLOW CHECK IS LATE.
 *
 * samesuite apu/channel_1/channel_1_sweep.asm declares it in its own words,
 * beside the group of SubTests that measures it:
 *
 *     ; 8 cycles after trigger, the APU checks if the NEXT trigger overflows
 *     ; the frequency. If it does, stop the channel.
 *     SubTest $3006, $27, $f0
 *
 * THE UNIT IS THE FILE'S OWN, not assumed. The same file writes, of round two,
 * "Frequency is $7ff, sample length is 1, the 'high' phase is 4 cycles long" --
 * at freq $7ff the period is (2048-2047)*4 = 4 T, so one "sample length" of 1
 * is one machine cycle, and a "cycle" here is 4 T. Round three's "Frequency is
 * $7f0, sample length is $10, the 'high' phase is $40 cycles long" agrees:
 * (2048-$7f0)*4 = 64 T = 16 machine cycles = $10, and 50% duty puts 4 samples
 * in the high phase = $40. So 8 cycles = 32 T.
 *
 * WHICH CALCULATION IS LATE IS FIXED BY THE TABLE, not chosen. Round two
 * (NR10=$1f: pace 1, DECREASE, shift 7) sweeps $7ff -> $7f0 at the DIV-APU
 * tick at $0ffe, and the declared row for $0ffe..$1005 is all $00 -- the long
 * low phase of the NEW period, already in force at the tick itself. Had the
 * whole sweep event been 8 cycles late, those eight cells would still carry
 * the old $7ff oscillation (0,0,0,0,8,8,8,8) that the preceding row shows.
 * The frequency WRITE is on time; only the second, overflow-only calculation
 * is late. That is exactly the sentence above.
 *
 * PRICED AND RULED. our sb4run tool, board machine, CGB boot program, 264 of 264:
 * 238 -> 240 PASS, +2 fixed / 0 broken, and a row-for-row join shows EXACTLY
 * two rows change verdict -- channel_1_sweep and channel_1_sweep_restart, both
 * byte-exact against their declared tables. All 70 samesuite rows that carry a
 * CorrectResults table were also compared byte for byte with the arm on and
 * off: 43 -> 45 exact, nothing else moves a single cell. MECHANISM.
 *
 * 0 = the check stops the channel at the sweep step, as before. */
#ifndef SWEEP_KILL_DELAY_T
#define SWEEP_KILL_DELAY_T 32
#endif

/* SWEEP_TRIG_VOID_T / SWEEP_STEP_STOP_T -- THE SWEEP STEP'S OWN STOP, VOIDED BY
 * A RECENT TRIGGER AND OTHERWISE LATE.  ***FITTED-TO-REFERENCE.***  The two
 * NUMBERS below are fitted; the PLACEMENT is derived, and the placement is what
 * makes them landable.  Labelled under the derived-placement exception:
 * a fitted value is permitted only where the site is derived and the measured
 * cost to protected ground is ZERO.  Both conditions were met and measured.
 *
 * THE SITE, AND WHERE ITS CLAUSE IS ALREADY SHIPPED.
 * channel_1_sweep_restart rounds 3-5 establish, in the cartridge's own table,
 * that a sweep overflow check is performed WHEN IT LANDS AND NOT WHEN IT WAS
 * ARMED, and that a register write arriving before it lands can VOID it (round
 * 3: NR10 with shift 0 written before the check lands, and the channel never
 * stops).  SWEEP_KILL_DELAY_T already carries that clause for the trigger check
 * and the post-step check.  What it did NOT carry is the sweep STEP's own
 * overflow stop -- the one inside apu_sweep_tick, which fires immediately.
 * channel_1_sweep_restart_2 is the only row in the corpus that scans that stop
 * at one-nop resolution, and it reads the same two facts about it:
 *
 *   VOID  -- a trigger landing within SWEEP_TRIG_VOID_T before a sweep step
 *            voids THAT step's stop.  The already-shipped voiding clause, with
 *            a trigger in place of the NR10 write.
 *   LATE  -- when not voided, the stop lands SWEEP_STEP_STOP_T later, counted
 *            in apu_chan_tick beside sw_kill: the same stage, the same
 *            countdown, the same T units the file's own "8 cycles" fixes at
 *            4 T per cycle.
 *
 * THE WINDOW IS ONE MACHINE CYCLE WIDE, which is the signature of a placement
 * rather than a search result.  Measured on channel_1_sweep_restart_2's 128
 * declared cells, in a clone of main (GameBoy9), and re-measured from scratch
 * at 1c65279 after OUT_PIPE_CGB changed src/gb.c under it rather than carried
 * forward:
 *
 *      SWEEP_TRIG_VOID_T      8 T -> 17 bad    9..12 T -> 1 bad    13 T -> 14 bad
 *      SWEEP_STEP_STOP_T (with void at 12 T)   6 or 8 T -> 0 bad   others -> 1..2
 *
 * A value that works across a wide plateau is a search result; this does not.
 *
 * THE SITES THAT LOST, kept as measurement and NOT as code, because a dead knob
 * in shipped source is something a later change will try to turn:
 *
 *   the step's stop held, with no void      49 -> 36 bad at best (32 T).  Never
 *                                           wins: it moves the immediate-kill
 *                                           cell and cannot move the seam.
 *   trigger reloads sw_timer to pace+1      49 -> 14, but BREAKS channel_1_sweep
 *                                           (0 -> 15) and channel_1_sweep_restart
 *                                           (0 -> 63).  A free-looking site that
 *                                           is not free.
 *   CPU-side placement                      REFUSED ON MEASUREMENT, not opinion:
 *                                           our NR14 write lands at DIV-reset
 *                                           +4093 machine cycles (4090 nops plus
 *                                           a correctly placed 3-cycle ldh) and
 *                                           the natural DIV-APU rollover at
 *                                           +4097, both textbook.  There is no
 *                                           gb.c error to find.
 *
 * PRICE, measured not argued, control proved behaviourally identical to a
 * pristine build from `git show HEAD:src/` BEFORE the armed figure was read:
 * all 68 declared SameSuite tables 146 -> 97 bad of 4592 compared, +49 fixed
 * / 0 broken, nothing else moving a single cell; board 254 -> 255 with one row
 * changing verdict and it is this one; and every rendered failure frame
 * compared by sha256 against the control, 6 of 6 identical -- which is what
 * carries the zero-protected-cost claim at PIXEL level, since a board PASS is a
 * tolerance verdict and cannot establish it.
 *
 * 0 for either = the previous behaviour exactly, which is how the price above
 * was taken. */
#ifndef SWEEP_TRIG_VOID_T
#define SWEEP_TRIG_VOID_T 12
#endif
#ifndef SWEEP_STEP_STOP_T
#define SWEEP_STEP_STOP_T 8
#endif

/* DUTY_WRITE_DELAYED -- A NEW DUTY DOES NOT TAKE EFFECT MID-SAMPLE.
 *
 * samesuite apu/channel_1/channel_1_duty_delay.asm states it as the whole
 * point of the cartridge, in its own header line:
 *
 *     ; Changing the duty becomes effective only after the current sample
 *     ; finishes.
 *
 * channel_2_duty_delay.asm carries the same sentence for channel 2. No number
 * is chosen here: the boundary is the duty unit's own reload, which is already
 * the one place this core advances duty_pos.
 *
 * THE WRITE ALSO LANDS AT THE END OF ITS MACHINE CYCLE, which is a second,
 * separate fact and is measured separately. The cartridge runs at freq $7f8,
 * a sample of exactly 8 machine cycles, and sweeps the write across 64 of
 * them; with the write applied at the START of its cycle every subtest whose
 * delay is a MULTIPLE OF 8 -- and only those -- reads one sample early. Seven
 * cells, all of them at a sample boundary. Staging the duty to the end of the
 * cycle is the identical treatment NOISE_NR43_DEFER already gives NR43, and
 * for the identical reason.
 *
 * PRICED AND RULED. our sb4run tool, board machine, CGB boot program, 264 of 264:
 * 240 -> 242 PASS, +2 fixed / 0 broken, and a row-for-row join shows EXACTLY
 * two rows change verdict -- channel_1_duty_delay and channel_2_duty_delay,
 * both byte-exact (0 bad of 128) against their declared tables. All 68
 * samesuite rows carrying a CorrectResults table compared byte for byte with
 * the arm on and off: 45 -> 47 exact, nothing else moves a single cell. The
 * mealybug (24), acid, blargg and mooneye columns are identical in both runs.
 * MECHANISM.
 *
 * SHARED PATH: NR11 and NR21 are the same code shape and this flag governs
 * both squares. It is NOT apu_write_nrx2, but it is not channel_1-only either
 * -- one of the two rows it wins belongs to the channel_2 work, so it
 * must be serialised with that work rather than landed twice.
 * 0 = a duty write is in force immediately, as before.
 */
#ifndef DUTY_WRITE_DELAYED
#define DUTY_WRITE_DELAYED 1
#endif

/* SQ_ENABLE_GRID -- THE SQUARE CHANNELS' SAMPLE CLOCK FREE-RUNS FROM APU
 * POWER-ON, AND A TRIGGER DOES NOT MOVE THE GRID.
 *
 * THE CARTRIDGE STATES THE FACT IN ITS OWN TITLE LINE.  samesuite
 * apu/channel_1/channel_1_align_cpu.asm:
 *
 *     "Channel 1 is aligned to the APU's enable time, not the CPU's start
 *      time."
 *
 * and apu/channel_1/channel_1_align.asm, which is the same stimulus with the
 * delay moved to the other side of the enable:
 *
 *     "This test verifies that channel 1 ticks at 1MHz"
 *
 * TWO SENTENCES, ONE OBJECT: a 1 MHz -- 4 T -- divider whose phase is set when
 * NR52 bit 7 goes high.  A trigger reloads the period COUNTER; it does not
 * re-phase the divider the counter is clocked by, so the first sample's expiry
 * is the first grid edge at or after the reload.  Same shape, and the same
 * `ns_t` phase, as NOISE_FREE_RUNNING_DIVISOR on channel 4.
 *
 * NO CONSTANT IS INTRODUCED AND NOTHING IS SWEPT.  The grid is 4 T because a
 * SameSuite tick is 4 T (the unit chain in SQ_TRIG_PHASE above), and the one
 * offset in the expression is the seam lead already added by the reload beside
 * it.  A PHASE CONSTANT CANNOT REPRODUCE THESE TWO TABLES AND THAT IS THE
 * POINT: channel_1_align's own table is NOT LINEAR in its pre-trigger delay.
 * Delays of 1 and 3 machine cycles agree with each other and DISAGREE with a
 * delay of 0 -- which is a MODULUS, not an offset.  Measured in this core the
 * enable->trigger distance is ns_t = 6, 0, 4 T for those three blocks, and a
 * constant 6 for ALL THREE of channel_1_align_cpu's.  Those are exactly the
 * cells the two declared tables disagree with us on, and the only ones that
 * move.
 *
 * WHY IT IS INVISIBLE EVERYWHERE ELSE: in single speed a machine cycle IS the
 * 4 T grid, so every trigger already lands on an edge and the adjustment is
 * identically zero.  channel_1_align and channel_2_align set KEY1 and `stop`
 * before they measure -- they are double-speed cartridges, and this is the
 * speed-dependent error they exist to find.
 *
 * 0 = the reload expires wherever the trigger's own phase puts it, as before.
 */
#ifndef SQ_ENABLE_GRID
#define SQ_ENABLE_GRID 1
#endif

/* One pulse/noise/wave channel's common state. Not every field is used by
 * every channel; the shared shape is what keeps the length and envelope
 * clocks one piece of code instead of three. */
struct APUChan {
    int enabled;        /* the NR52 status bit: channel is producing         */
    int dac;            /* DAC powered (NRx2 & 0xF8, or NR30 bit 7 for wave) */
    int length;         /* length counter, counts down to 0                  */
    int len_enable;     /* NRx4 bit 6                                        */
    int freq;           /* 11-bit frequency register (channels 1, 2, 3)      */
    int timer;          /* frequency timer, T-cycles remaining               */
    int duty;           /* NRx1 bits 7-6 (channels 1, 2)                     */
    int duty_pending;   /* DUTY_WRITE_DELAYED: NRx1 as written, not yet in   *
                         * force; see the flag's note                       */
    int duty_stage;     /* 0x100 | NRx1 bits 7-6, staged to the END of the *
                         * machine cycle, where the bus leaves a write      */
    int duty_pos;       /* 0..7 position in the duty pattern                 */
    int vol;            /* current envelope volume 0..15                     */
    int vol_init;       /* NRx2 bits 7-4                                     */
    int env_dir;        /* NRx2 bit 3: 1 = increase                          */
    int env_pace;       /* NRx2 bits 2-0, 0 = envelope off                   */
    int env_timer;      /* envelope period counter                           */
    int out;            /* current digital output, 0..15                     */
    int duty_clocking;  /* has this channel been triggered since power-on?    */
    int duty_zero_1st;  /* the first step after that trigger reads as 0       */
    int env_bug;        /* ENV_ENABLE_EVEN_TICK: one-shot, armed when an NRx2 write
                         * turns the envelope on (pace 0 -> non-zero)          */
};

struct APU {
    int power;              /* NR52 bit 7                                    */
    unsigned char reg[0x17];/* readback shadow for $FF10..$FF26              */
    unsigned char wave[16]; /* wave RAM $FF30..$FF3F, 32 nibbles, high first */

    /* Frame sequencer. Clocked by the FALLING EDGE of DIV bit 4 (bit 12 of the
     * core's 16-bit divider), not by a divider of its own — that is what makes
     * the DIV-write quirk fall out instead of being a special case. */
    int seq_step;           /* 0..7                                          */
    int div_bit;            /* last sampled DIV bit 12                       */
    int div_skip;           /* APU_POWER_SKIPS_DIV_EVENT: one-shot, armed at
                             * power-on when DIV bit 4 is already set       */

    /* NOISE_FREE_RUNNING_DIVISOR -- channel 4's divisor stage is NOT reset by
     * a trigger.  ns_t is its phase: T-cycles elapsed on the APU's own clock
     * since NR52 bit 7 went high, taken mod 8 because that is the longest
     * grid the corpus resolves.  See NOISE_GRID_PHASE in apu.c. */
    int ns_t;
    int ns_pending;         /* NOISE_NR43_DEFER: 0x100 | value, applied at
                             * the end of the machine cycle                 */

    struct APUChan ch[4];

    /* Channel 1's frequency sweep. */
    int sw_pace, sw_dir, sw_shift;
    int sw_shadow, sw_timer, sw_on, sw_neg_used;
    int sw_stop;            /* SWEEP_STEP_STOP_T: T remaining before the sweep
                             * STEP's own stop lands (0 = none pending). */
    int sw_trigvoid;        /* SWEEP_TRIG_VOID_T: T remaining in which a step's
                             * stop is voided by the trigger that set it. */
    int sw_kill;            /* SWEEP_KILL_DELAY_T: T remaining before the
                             * post-update overflow check stops the channel */

    /* Channel 3. */
    int wave_pos;           /* 0..31                                         */
    int wave_level;         /* NR32 bits 6-5: 0 mute, 1 100%, 2 50%, 3 25%   */
    int wave_last;          /* last nibble read, for the DMG read-back quirk */
    /* DMG wave-RAM conflict. The channel owns wave RAM while it plays; a CPU
     * access only lands if it falls in the SAME APU TICK as the channel's own
     * byte read, and is then redirected to the byte the channel is reading.
     * The window is one tick (2 T) -- measured, not assumed: at wave periods of
     * 6 T and 14 T the oracle lands 81/256 and 34/256 CPU reads, against 2/P
     * predictions of 0.333 and 0.143. */
    int wave_read_2nd;      /* the byte read fell in this M-cycle's 2nd tick */

    /* Channel 4. */
    int lfsr, lfsr_w7, ns_shift, ns_div;
    /* NOISE_COUNTER_MODEL (see apu.c): the three cascaded free-running stages.
     * ns_clk  -- the mod-4 clock, +1 every APU tick (2 T), zeroed ONLY by APU
     *            power-on.  ns_down -- the 4-bit divisor down-counter, examined
     *            at one phase of ns_clk (and a second phase while the latched
     *            divisor is 0).  ns_up -- the 14-bit up-counter whose bit
     *            `ns_shift` drives the LFSR on its RISING edge.  ns_trig is the
     *            trigger's start delay, counted down in T. */
    int ns_clk, ns_down, ns_up, ns_trig;

    /* Master mixer. */
    int vol_l, vol_r;       /* NR50 bits 6-4 / 2-0                           */
    int route;              /* NR51                                          */

    /* Mixer-only channel mute, for the per-channel diff tracks. Never touches
     * channel state, so the emulated machine is bit-identical across the five
     * passes the instrument renders. Bit n mutes channel n+1. */
    int mute;

    /* WHICH MACHINE THE APU IS IN.  Plumbing for WAVE_CGB_RULE, ported with it
     * from GameBoy2; main had no device flag in the APU at all.  Set in
     * gb_reset BEFORE the boot-program early return, and preserved across
     * apu_reset, so it is live whether or not a boot program runs. */
    int dev_cgb;
    /* Double speed, mirrored from gb->double_speed at the tick.  The APU has
     * no pointer to the machine, so the speed has to be pushed in rather than
     * read out; see APU_DIV_BIT_SPEED in apu.c. */
    int dev_speed;

    /* ---- Host audio output -------------------------------------------------
     * The shell pulls from here. Everything is fixed-size and pointer-free, so
     * a save state can carry it without a relocation step (see the note below).
     *
     * out_step is T-cycles per output sample in 16.16 FIXED POINT, not an
     * integer. An integer would be wrong by a measurable amount at every rate
     * a host actually uses: 4194304 / 48000 = 87.38, and truncating to 87 runs
     * the stream 0.44 % fast -- about 210 extra samples every second, which is
     * a ring overrun every few seconds and an audible resync each time. The
     * fraction makes the long-term rate exact for any rate. */
    unsigned out_rate;          /* the rate the shell last asked for, 0 = idle */
    unsigned out_step;          /* T per output sample, 16.16                  */
    unsigned out_acc;           /* T accumulated toward the next sample, 16.16 */
    int  out_l, out_r, out_n;   /* box-average accumulator over one sample     */

    short ring[APU_RING * 2];   /* interleaved L,R                             */
    int ring_head, ring_tail;   /* in frames; head == tail means empty         */
    unsigned ring_dropped;      /* frames lost to overflow, saturating         */

#if APU_HIGHPASS
    double hp_l, hp_r;          /* capacitor charge, one per side               */
    int    an_l, an_r;          /* the filtered pair both consumers read        */
#endif
#if APU_HOST_DCBLOCK
    double hb_l, hb_r;          /* host output: capacitor charge, one per side  */
#endif
};

/* NOTHING ELSE GOES IN HERE, and in particular no pointer does.
 *
 * `struct APU` is a member of `struct GB`, which is the whole emulator context:
 * caller-allocated, copied wholesale by the UI's save states and restored
 * with only its published pointers (cart, BIOS) re-patched through the ABI.
 * Putting APU state inside it is what makes a save state capture a channel
 * mid-envelope, a sweep mid-ramp and the frame sequencer's phase for free, and
 * it keeps the multi-instance property the core has had since Stage 1.
 *
 * The corollary is that a HOST pointer in here would be poison: restored from a
 * saved state it would be a dangling pointer into another process's heap. So
 * the sample sink is not here. It lives in file-scope storage in apu.c under
 * GB_NATIVE, next to the harness that owns it — audio transport is not machine
 * state and must not survive a save. */

#endif /* GB_APU_H */
