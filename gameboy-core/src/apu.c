#ifndef SPSW_APU
#define SPSW_APU 1
#endif
/* apu.c — DMG sound controller.
 *
 * Stage 4, clean-room. Behaviour derived from Pan Docs (Audio, Audio
 * Registers, Audio Details) and TCAGBD. SameBoy is used as an OUTPUT oracle
 * only; the audio design §1 records exactly which three facts were read
 * out of its headers (all of them unit conversions or "how to drive it"), and
 * that nothing in this file came from its implementation.
 *
 * Included by src/gb.c after `struct GB`. This file never sees `struct GB`.
 * The seam it needs is specified in the audio design §6.
 *
 * Everything counts in T-cycles. One APU tick is 2 T; the wave channel's
 * (2048-f)*2 period is the reason the tick is 2 T and not 4 — it is the only
 * timer on the machine that can be shorter than a machine cycle.
 */

/* Read-OR masks for $FF10..$FF3F: the bits that read as 1 regardless of what
 * was written (Pan Docs, Audio Registers). This reproduces the corresponding
 * rows of the core's existing `read_or` table, which is what makes Mooneye
 * acceptance/bits/unused_hwio-GS pass; that test is a hard invariant and this
 * table is the reason it survives the seam. */
static const unsigned char APU_READ_OR[0x30] = {
    /* FF10 NR10..NR14 */ 0x80, 0x3F, 0x00, 0xFF, 0xBF,
    /* FF15 ....NR24   */ 0xFF, 0x3F, 0x00, 0xFF, 0xBF,
    /* FF1A NR30..NR34 */ 0x7F, 0xFF, 0x9F, 0xFF, 0xBF,
    /* FF1F ....NR44   */ 0xFF, 0xFF, 0x00, 0x00, 0xBF,
    /* FF24 NR50..NR52 */ 0x00, 0x00, 0x70,
    /* FF27..FF2F      */ 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    /* FF30..FF3F wave */ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
};

/* The four duty patterns, 12.5 / 25 / 50 / 75 % (Pan Docs). */
static const unsigned char APU_DUTY[4][8] = {
    { 0, 0, 0, 0, 0, 0, 0, 1 },
    { 1, 0, 0, 0, 0, 0, 0, 1 },
    { 1, 0, 0, 0, 0, 1, 1, 1 },
    { 0, 1, 1, 1, 1, 1, 1, 0 },
};

/* Noise divisor codes 0..7. Code 0 is HALF of code 1, which is the one entry a
 * regular formula does not produce (Pan Docs). */
static const int APU_NOISE_DIV[8] = { 8, 16, 32, 48, 64, 80, 96, 112 };

#define APU_LEN_MAX(i) ((i) == 2 ? 256 : 64)

#ifndef WAVE_TRIGGER_CORRUPT_DMG_ONLY
#define WAVE_TRIGGER_CORRUPT_DMG_ONLY 1
#endif

/* WAVE_CGB_WRITE_LOOKAHEAD -- the colour locked-write must target the byte the
 * channel is ABOUT TO read, exactly as the monochrome path eight lines below it
 * already does.
 *
 * THE RULE IS DOCUMENTED.  Pan Docs, FF30-FF3F: on consoles other than the AGB
 * and the monochrome models, "the byte accessed will be the one CH3 is currently
 * reading ... regardless of the address being used".
 *
 * THE +1 IS NOT A TUNING CONSTANT.  It is the seam's write lead, and this file
 * already states why on the monochrome branch: write8 reaches apu_write BEFORE
 * apu_tick4, so wave_pos still points at the PREVIOUS nibble and the target has
 * to look ahead with the window.  The colour branch was added later and did not
 * inherit it.  The read path at apu_read is deliberately NOT changed: read8
 * ticks the APU BEFORE the bus access, so it needs no lead -- that asymmetry is
 * the core's bus, and it is why only one of the two paths carries a +1.
 *
 * MEASURED before this existed, main 643be89: channel_3_wave_ram_locked_write
 * writes $2A one byte EARLY in all nine trials, trial 0 identical.
 *
 *   0 = shipped behaviour, AND THE DEFAULT HERE.   1 = look ahead. */
/* APU_DIV_BIT_SPEED -- WHICH DIV BIT CLOCKS THE FRAME SEQUENCER.
 *
 * The sequencer is clocked by the falling edge of DIV bit 4 -- bit 12 of the
 * core's 16-bit counter -- at 512 Hz.  IN DOUBLE SPEED THE COUNTER RUNS TWICE
 * AS FAST, so bit 12 delivers 1024 Hz and every length, envelope and sweep
 * step arrives at double rate.  Taking bit 13 there restores 512 Hz.
 *
 * PORTED from GameBoy2 (their apu.c:762), where it is expressed as
 * GB_DEV_SPLIT3(owner, GB_A9, 12, 12, 13) -- DMG 12, CGB single speed 12, CGB
 * double speed 13.  This tree's APU carries no pointer to the machine and no
 * fence row registry, so the split is written directly against dev_cgb and
 * dev_speed.  THE FENCE BOOKKEEPING IS NOT PORTED and that is deliberate:
 * every device split already in this file (WAVE_CGB_RULE,
 * APU_POWER_CGB_CLEARS_LEN, WAVE_TRIGGER_CORRUPT_DMG_ONLY) is written the same
 * way, so wiring a fence for this one arm alone would misreport coverage as
 * though the others had one.  The BEHAVIOUR is identical; only their
 * colour-board breach accounting is absent here.
 *
 * 1 = model the split.  0 = bit 12 everywhere, the previous speed-blind rate. */
#ifndef APU_DIV_BIT_SPEED
#define APU_DIV_BIT_SPEED 1
#endif

/* APU_SPEED_TICKS -- THE CHANNEL TIMERS ARE NOT CLOCKED BY THE CPU.
 *
 * DERIVED, not fitted.  Pan Docs Audio.md:59, verbatim:
 *
 *     "The length of APU ticks is not affected by CGB double speed, so the
 *      APU works just the same regardless of CPU speed."
 *
 * This file's own header says one APU tick is 2 T of the 4 MHz clock, and
 * apu_tick4 is called once per MACHINE cycle.  At single speed a machine cycle
 * is 4 T, hence two ticks.  IN DOUBLE SPEED A MACHINE CYCLE IS ONLY 2 T OF THE
 * SAME 4 MHz CLOCK, so two ticks per call ran every frequency timer, every
 * wave read and every LFSR step at TWICE its rate -- an octave up in every
 * colour title, and every SameSuite delay/alignment row (they all run under
 * `stop` at KEY1) measured against half the period the cartridge declares.
 *
 * The frame sequencer was already compensated (APU_DIV_BIT_SPEED, bit 13); the
 * CHANNELS were not.  This is the other half of the same fact.
 *
 * ***THE SAME ARM EXISTS IN A SIBLING TREE AS `APU_CHAN_SPEED`, WHERE IT WAS
 * DECLINED.***  The names are different and neither record cited the other, so
 * a decline and its overturning never linked and the trail was lost for weeks.
 * Anyone searching for one of these two names should find both: they are one
 * fact.
 *
 * Why it converts here and did not there is section 9 of
 * our notes, ***WHICH IS
 * NOW IN THIS REPOSITORY*** (2026-09-19).  The companion account is
 * our notes, also brought in that day.
 *
 * ***TWO WRONG VERSIONS STAND BELOW.  NEITHER IS DELETED*** --
 * our notes section 3, and the second one is mine, from this
 * morning.
 *
 * ***WRONG VERSION 1 -- the citation as it shipped, from de27ca9 until today:***
 *
 *     Why it converts here and did not there is recorded under "combination
 *     pricing" in our notes 9.
 *
 * A bare relative path, and the file was in no tree on this machine, so it read
 * as a local file and resolved nowhere.  The phrase "combination pricing" is
 * this comment's paraphrase; the page itself does not use those two words.
 *
 * ***WRONG VERSION 2 -- what I replaced it with earlier on 2026-09-19, and it
 * was a WORSE error than the one it fixed:***
 *
 *     ***THAT FILE HAS NEVER EXISTED.***  Measured three ways: `find` over the
 *     whole estate matches no such name in any tree; `git log --all
 *     --diff-filter=A` in this repository returns nothing; and the only commit
 *     whose diff contains that string is de27ca9, the commit that added this
 *     comment.  The citation was written for a page that was then never written.
 *
 * ***ALL THREE MEASUREMENTS WERE TRUE AND THE CONCLUSION WAS FALSE.***  The
 * file is in no working tree, so `find` could not see it; it was never added to
 * THIS repository, so main's `git log --all` could not see it.  Both searches
 * were run where the file is not, and a negative from an instrument that cannot
 * reach the subject is not a negative -- it is the `LCDCWCEN` census error of
 * our notes, committed while
 * repairing a citation, in the same hour, on the same page's advice.  ***A
 * SEARCH THAT CANNOT REACH THE COUNTEREXAMPLE SAYS NOTHING ABOUT IT.***
 *
 * ***WHERE IT ACTUALLY WAS.***  368 lines, in a commit object and no file:
 * a sibling development tree, branch `sandbox-24` -- NEVER MERGED, that
 * tree's own HEAD does not contain it -- in a commit titled "WIP sandbox-24
 * snapshot before ch4 rebase".  It is now copied verbatim into this repository,
 * sha256 0e59bb30eeae3e59989539ddaf80eaf83c6d3433d92e0a644a6577949803ab11, with
 * its origin in a comment at its head.  ***THE ONLY COPY OF THE ACCOUNT BEHIND A
 * KNOB THAT SHIPS AT 1 WAS ONE `git branch -D` FROM GONE.***
 *
 * The message of de27ca9 carries a condensed version of the same account and is
 * still worth reading beside it:  git log -1 --format=%B de27ca9
 *
 * 1 = one tick per machine cycle in CGB double speed.  0 = the previous
 *     speed-blind two, kept as the control build. */
#ifndef APU_SPEED_TICKS
#define APU_SPEED_TICKS 1
#endif
/* Ticks apu_tick4 runs per machine cycle -- 2 normally, 1 in CGB double speed. */
#define APU_NTICKS(a) ((APU_SPEED_TICKS && (a)->dev_cgb && (a)->dev_speed) ? 1 : 2)

/* APU_POWER_CLEARS_WAVE_SAMPLE -- POWERING THE APU OFF CLEARS CH3'S CURRENT
 * SAMPLE, `wave_last`.
 *
 * AN OMISSION IN A RULE THIS FILE ALREADY STATES, not a new quantity.
 * apu_power_off already zeroes every other piece of per-channel state,
 * INCLUDING `c->out` for all four channels.  But `wave_last` survived it, and
 * apu_chan_tick recomputes ch[2].out FROM wave_last on the very next tick --
 * so the explicit `out = 0` was undone before anything could observe it, and a
 * freshly powered, freshly triggered channel 3 emitted the PREVIOUS run's
 * sample for a whole period before its first real read.  Clearing wave_last is
 * what makes the `out = 0` already in apu_power_off mean what it says.
 *
 * 1 = clear it.  0 = the previous carry-over, kept as the control build. */
#ifndef APU_POWER_CLEARS_WAVE_SAMPLE
#define APU_POWER_CLEARS_WAVE_SAMPLE 1
#endif

/* APU_WAVE_READS_ONLY_WHEN_ON -- CHANNEL 3 READS WAVE RAM ONLY WHILE IT PLAYS.
 *
 * THIS FILE ALREADY ASSERTS THE RULE, on the other side of the same fact:
 * apu_read/apu_write refuse or redirect a CPU access to $FF30-$FF3F only
 * `if (a->ch[2].enabled)` -- because a channel that is NOT playing is not
 * reading wave RAM, which is the whole reason the CPU may touch it freely.
 * apu_chan_tick contradicted that: it advanced wave_pos and refilled the
 * sample buffer every period whether the channel was on or off.
 *
 * MEASURED, channel_3_first_sample, CGB: after NR52 power-on and before the
 * NR34 trigger, the disabled channel took one step, latched wave[0]'s low
 * nibble into the sample buffer, and the trigger -- which resets wave_pos but
 * not the buffer -- left that sample on PCM34 for a whole period.
 *
 * 1 = read only while enabled.  0 = the previous unconditional read. */
#ifndef APU_WAVE_READS_ONLY_WHEN_ON
#define APU_WAVE_READS_ONLY_WHEN_ON 1
#endif

/* APU_NOISE_TRIGGER_HALF -- CHANNEL 4'S FIRST STEP AFTER A TRIGGER IS HALF A
 * PERIOD IN, NOT A WHOLE ONE.
 *
 * READ OFF channel_4_delay's declared CorrectResults, with the harness's read
 * offset MEASURED rather than assumed: our own trace puts the cartridge's
 * `ld a,[rPCM34]` exactly 3 M-cycles (12 T) after the last `nop` it counts, and
 * that offset is a property of the CPU and the bus, not of the APU model, so it
 * applies to the declared column too.  Converting the four declared arms:
 *
 *   NR43   period   width   declared 1st F0   => hardware's FIRST STEP
 *   $08      8 T    7 bit     nops $00d            16 T after the write
 *   $00      8 T   15 bit     nops $01d            16 T
 *   $18     16 T    7 bit     nops $01a            20 T
 *   $28     32 T    7 bit     nops $034            28 T
 *
 *   16 = 8/2 + 12,  20 = 16/2 + 12,  28 = 32/2 + 12.  ONE FORM, FOUR ARMS,
 *   TWO WIDTHS, THREE PERIODS -- over-determined, not fitted to one number.
 *
 * Minus the seam's write lead the rule is `period/2 + 8`.  The HALF-PERIOD is
 * structural: the divider's two edges are half a period apart and the channel
 * starts on the first one.  ***THE 8 IS NOT DERIVED*** -- no document in this
 * tree states it -- ***AND THE BOARD CANNOT CHOOSE ITS FORM***: 8 and
 * APU_NOISE_DIV[ns_div] are identical on ALL 68 samesuite rows (=2 selects the
 * other form).  Every row that reaches this reload with divisor code != 0 also
 * depends on the free-running divisor phase, which this arm does not model, so
 * no probe on the board separates them.  NAMED UNDECIDED RATHER THAN PICKED.
 *
 * 1 = half-period reload.  0 = the whole period, the previous behaviour. */
#ifndef APU_NOISE_TRIGGER_HALF
#define APU_NOISE_TRIGGER_HALF 1
#endif

/* ***LABEL CHANGE, 2026-09-18 -- RECORDED, NOT OVERWRITTEN (protocol clause 2).
 * THE BLOCK BELOW IS THE OLD READING AND IS KEPT WORD FOR WORD.***
 *
 * Everything from here to NOISE_RESTART_LEAD is bypassed when
 * NOISE_COUNTER_MODEL is 1 (the default; see its block further down).  It is
 * still compiled, and at NOISE_COUNTER_MODEL=0 it is the shipped emulator byte
 * for byte -- that is what makes it the control.
 *
 * WHAT THE LABELS WERE, and they were honest about it:
 *   NOISE_GRID_PHASE  READ OFF one row, then checked against the others.
 *   NOISE_TIE_UP = 2  DECLARED split, with "WHAT IS NOT DERIVED ... WHY the
 *                     boundary sits between code 1 and code 2" named below.
 *   The 368 cells of delay (32), align (64), equivalent_frequencies (128) and
 *   frequency_alignment (144) passed on a HALF-PERIOD RELOAD SNAPPED TO A GRID
 *   PLUS A READ-OFF TIE-BREAK -- i.e. FITTED in the tie-break, for codes 2,3,4.
 *
 * WHAT THEY ARE NOW: ***DERIVED***, same 368 cells, better standing.  Under the
 * counter model the +-1 M alignment is not a tie-break at all -- it is where the
 * trigger lands on a divisor clock that never stopped, and codes 2, 3 and 4 fall
 * out with nothing read off.  The boundary this block had to carry as a read
 * value is no longer carried for those codes.
 *
 * WHAT DID NOT UPGRADE, and it is one term: the trigger's start delay takes an
 * extra machine cycle at divisor code 1 (NOISE_TRIG_DELAY_DIV1_T).  That is the
 * same fact NOISE_TIE_UP = 2 carried, re-expressed; it is DECLARED BY OUR OWN
 * CORPUS (ablation: the fence falls 368 -> 360 without it) and its FORM above
 * code 4 stays UNMEASURED.  Evidence: our notes.
 *
 * NOISE_FREE_RUNNING_DIVISOR -- CHANNEL 4'S DIVISOR STAGE FREE-RUNS FROM APU
 * POWER-ON; ONLY THE 2^shift STAGE IS RESET BY A TRIGGER.
 *
 * channel_4_frequency_alignment DECLARES the split.  Its nine arms are labelled
 * "affected" / "not affected" in the cartridge's own comments, and the label is
 * exactly `divisor code != 0` -- nine arms, no exception, across four shifts.
 * channel_4_delay repeats it from the other side: "The values in this test are
 * not affected by frequency alignment", and every value in it has code 0.
 *
 * WHAT THE DECLARED TABLES SAY, read off rather than swept.  Writing n for the
 * nop count at which PCM34 first shows $F0 and P for the sample length in
 * machine cycles, every code-0 row in delay and frequency_alignment sits at
 * n = 6.5P exactly -- the landed half-period, seven LFSR steps in (the narrow
 * register's feedback reaches bit 0 on step 7; delay's one wide row lands on
 * step 15, the same arithmetic).  The code != 0 rows do NOT: against that same
 * 6.5P they sit one machine cycle early or late, and WHICH depends on where the
 * trigger falls relative to APU power-on, not on the shift:
 *
 *   trigger at an EVEN M from power-on   code 1 +1   codes 2,3,4 -1
 *   trigger at an ODD  M from power-on   code 1  0   codes 2,3,4  0
 *
 * frequency_alignment supplies both columns (its two halves differ by one nop
 * before the writes, g = 20 and g = 21) and equivalent_frequencies confirms the
 * even column independently at g = 18.  Three shifts share each sign, so the
 * quantity is the CODE, not the shift -- which is the same thing the cartridge
 * says in prose.
 *
 * THE MECHANISM.  A free-running clock of period 8 T (code != 0) or 4 T
 * (code 0) runs from power-on.  A trigger asks for the half-period P/2, and the
 * first LFSR step is taken on the nearest edge of that clock.  At single speed
 * the CPU writes on a 4 T grid, so a code-0 request always lands exactly on its
 * own 4 T clock -- which is why code 0 shows no alignment at all -- while a
 * code != 0 request lands either exactly on the 8 T clock (odd M) or exactly
 * half way between two of its edges (even M).  That half-way case is the entire
 * +-1.
 *
 * channel_4_align is the control: it is code 0, but at DOUBLE speed, where the
 * CPU writes on a 2 T grid and so can miss the 4 T clock.  It shows on code 0
 * the effect single speed cannot reach, and it wants the tie resolved UPWARD.
 *
 * NOISE_GRID_PHASE is the clock's offset from power-on in T.  It is READ OFF
 * one row (the code-0 column, which pins it mod 4) and then CHECKED against the
 * other rows of the four alignment cartridges.
 *
 * NOISE_TIE_UP resolves the exact half-way case, and the split is DECLARED,
 * not chosen: seven rows state it and they disagree by CODE.  Rounding UP is
 * what channel_4_align's four double-speed transitions (code 0) and all three
 * code-1 rows require -- frequency_alignment $09 and $29, and
 * equivalent_frequencies' $29 block; rounding DOWN is what all four
 * code-2/3/4 rows require -- frequency_alignment $0a, $0b, $1a, $0c and
 * equivalent_frequencies' $0c and $1a blocks.  Shift does not enter it: h = 4
 * appears on both sides ($29 rounds up, $1a and $0c round down).
 *
 * WHAT IS NOT DERIVED, and it is named rather than hidden: WHY the boundary
 * sits between code 1 and code 2.  Every decomposition tried here -- a divisor
 * stage free-running at DIV[code], a per-code grid phase, a truncated half
 * count -- is falsified by one of the seven rows, and the working model has to
 * carry the boundary as a read value.  CODES 5, 6 AND 7 APPEAR NOWHERE IN THE
 * CORPUS, so `<= 1` above 4 is UNMEASURED, not established.  A cartridge that
 * exercised a high code at an even-M trigger would settle it; none does.
 *
 * 0 = ties down everywhere, 1 = ties up everywhere, 2 = the declared split. */
#ifndef NOISE_FREE_RUNNING_DIVISOR
#define NOISE_FREE_RUNNING_DIVISOR 1
#endif
#ifndef NOISE_GRID_PHASE
#define NOISE_GRID_PHASE 0
#endif
/* 0 = ties round down, 1 = ties round up, 2 = up for code <= 1, down above. */
#ifndef NOISE_TIE_UP
#define NOISE_TIE_UP 2
#endif

/* NOISE_RESTART_LEAD -- A RESTART PAYS THE TRIGGER LEAD TWICE.
 *
 * channel_4_lfsr_restart and channel_4_lfsr_restart_fast each declare 128 bytes
 * of LFSR history after a SECOND NR44 write.  Against the cold-trigger reload
 * our stream sat exactly one entry early in all 256 -- the tables step two nops
 * at a time and one entry is one LFSR step.  The two tables are IDENTICAL to
 * each other although their restarts fall 128 machine cycles apart, which is
 * what a free-running divisor predicts and a re-anchored one does not.
 *
 * WHAT THE CORPUS FIXES, AND WHAT IT DOES NOT.  Both cartridges use one NR43
 * ($08: code 0, shift 0), so they bound the extra delay and do not value it:
 * MEASURED, every extra in (0, 8 T] passes both tables and 9 T and above fail
 * both.  The half period there is 4 T and the whole period 8 T, so "a restart
 * gets a whole period instead of a half" and "a restart pays the 8 T trigger
 * lead twice" BOTH sit inside the window and no declared row separates them.
 *
 * THE ORACLE SEPARATES THEM, and this is labelled CONVERGENCE, not derivation.
 * On the audio net's probe-wave-noise scene the whole-period reading takes
 * ch4's spectral difference from 0.0202 to 0.0310 and its RMS from 0.4196 to
 * 0.7109 (AUDIO SCORE 333 either way; the track is not one of the scored ones),
 * while paying the lead twice leaves both where the cold-trigger model had them
 * -- 0.0202 spec, better than the checked-in baseline's 0.0313.  Among readings
 * the declared tables cannot tell apart, the one that does not move the oracle
 * is taken.  It also adds no constant this file did not already carry: it is
 * the same term APU_NOISE_TRIGGER_HALF applies to a cold trigger.
 *
 * 0 = no extra, the cold-trigger reload, which is one LFSR step early. */
#ifndef NOISE_RESTART_LEAD
#define NOISE_RESTART_LEAD 1
#endif

/* NOISE_NR43_DEFER -- NR43 LANDS AT THE END OF ITS MACHINE CYCLE, NOT THE START.
 *
 * This file already states the seam, twice, for wave RAM: "a write8 reaches
 * apu_write BEFORE apu_tick4 runs this machine cycle", which is why the locked
 * write needs a one-nibble lead.  NR43 had the other half of the same fact
 * missing: applied on entry, the width and divisor a mid-run write installs are
 * already visible to the one or two LFSR steps THIS machine cycle still owes.
 *
 * channel_4_lfsr_15_7 is the row that separates them.  It triggers wide, runs
 * $80 nops, writes $08 -- narrow, same code, same shift, so ONLY the feedback
 * deposit changes -- and declares 128 bytes of what follows.  Applied on entry
 * the stream diverged in 62 of them; deferred to the end of the cycle it is
 * exact in all 128, and its mirror channel_4_lfsr_7_15, which was already
 * exact, stays exact.  channel_4_freq_change, which writes NR43 mid-run to
 * change the DIVISOR, improves from 25 differing to 18 on the same change.
 *
 * Not conditioned on the channel being enabled: the seam is the bus's, not the
 * channel's.  0 = the previous apply-on-entry. */
#ifndef NOISE_NR43_DEFER
#define NOISE_NR43_DEFER 1
#endif

/* NOISE_COUNTER_MODEL -- CHANNEL 4'S SAMPLE CLOCK IS A FREE-RUNNING COUNTER,
 * AND AN NR43 WRITE SCHEDULES NOTHING.
 *
 * ***THIS REPLACES THE NOISE TIMER.***  Everything above it that reloads
 * `ch[3].timer` -- APU_NOISE_TRIGGER_HALF, apu_noise_first(), NOISE_TIE_UP,
 * NOISE_GRID_PHASE, NOISE_RESTART_LEAD -- is the OLD reading and is bypassed
 * when this is 1.  Those knobs are kept, not deleted: at 0 the file is the
 * shipped emulator, byte for byte, and that is the control.
 *
 * THE MECHANISM, three cascaded stages:
 *
 *   (a) a MOD-4 CLOCK, +1 every APU tick (2 T), zeroed ONLY by APU power-on --
 *       never by a frequency write and never by a trigger;
 *   (b) a 4-BIT DOWN-COUNTER, examined when that clock reaches NOISE_EXAM_PHASE,
 *       PLUS a second examination at NOISE_EXAM_PHASE2 while the LATCHED divisor
 *       is 0 -- which is the whole of "divisor code 0 runs at double rate".  On
 *       expiry it reloads from the divisor field; a divisor of 0 reloads as 1;
 *   (c) a 14-BIT UP-COUNTER, +1 on each expiry.  THE LFSR STEPS ON THE RISING
 *       EDGE OF THE UP-COUNTER BIT SELECTED BY THE SHIFT FIELD.  Shift 14 and 15
 *       therefore never step: the counter is only 14 bits wide.
 *
 * A trigger re-zeroes the UP-counter and reloads the down-counter; it does NOT
 * touch the mod-4 clock.  ***AN NR43 WRITE TOUCHES NEITHER THE MOD-4 CLOCK NOR
 * THE UP-COUNTER.***  It changes the reload value and re-points the tap under a
 * counter that keeps its value, which is why a LATER write can produce an
 * EARLIER step: a later write leaves a SHORTER residual in the down-counter, so
 * the new, slower cadence is anchored earlier and every step after it arrives
 * earlier.  our notes proved
 * no rule MONOTONE IN THE WRITE TIME could reach that table.  It was right.  The
 * mechanism is not a rule; it is a counter that is never reloaded.
 *
 * WHAT IT MEASURES, against the declared CorrectResults of five cartridges:
 *
 *     delay                    32 / 32      unchanged
 *     align                    64 / 64      unchanged, and it is DOUBLE SPEED
 *     equivalent_frequencies  128 / 128     unchanged
 *     frequency_alignment     144 / 144     unchanged
 *     ---------------------------------------- the 368-cell fence: INTACT
 *     freq_change              60 / 64      was 46
 *
 * equivalent_frequencies is also a CONFIRMATION and not just a fence: equal
 * effective periods drive the SAME up-counter bit-grid, so they must agree.  A
 * period model gets that by arithmetic coincidence; this gets it structurally.
 *
 * WHAT IS NOT DERIVED.  The two residual groups are G3 ($18->$1a) and G7
 * ($09->$1a), both with the NR43 write landing HALF WAY between two examinations
 * of the 8 T divisor clock, and they miss in OPPOSITE directions (8 T early and
 * 8 T late).  No constant closes both.  That is the counter-reload boundary and
 * it is LEFT OPEN.  No glitch-correction table is implemented and none is wanted.
 *
 * LANDED IN THIS TREE 2026-09-18, re-measured against this tree's src/gb.c on
 * the day, not trusted from the sandbox: channel 4 1082 -> 1096 of 1100, the
 * 368-cell fence intact, the 640 further LFSR cells unmoved, AUDIO SCORE 336
 * unmoved and docboy-agreement 253/572 unmoved through the REPAIRED
 * instruments.  The row channel_4_freq_change STILL FAILS at 4 of 64 and the
 * board does NOT move on it.  Which 14 cells moved, the check result, and
 * the label change above are in our notes.
 *
 * 0 = the shipped timer-reload noise channel, AND THE CONTROL. */
#ifndef NOISE_COUNTER_MODEL
#define NOISE_COUNTER_MODEL 1
#endif
/* The phase of the mod-4 clock at which the divisor down-counter is examined,
 * and the second phase used only while the latched divisor is 0.  READ OFF the
 * four alignment cartridges, exactly as NOISE_GRID_PHASE was: they fix the
 * clock's offset from APU power-on and nothing else does. */
#ifndef NOISE_EXAM_PHASE
#define NOISE_EXAM_PHASE 3
#endif
#ifndef NOISE_EXAM_PHASE2
#define NOISE_EXAM_PHASE2 1
#endif
/* The trigger's start delay in T, and the extra it takes at divisor code 1.
 * DECLARED, NOT COPIED: with the flat 12 alone the 368-cell fence falls to 360
 * -- equivalent_frequencies' $29 block and frequency_alignment's $09 and $29
 * rows all require the extra machine cycle.  It is the same fact NOISE_TIE_UP=2
 * already carries ("rounding UP is what all three code-1 rows require").
 * ***THE FORM IS UNMEASURED***: codes 5, 6 and 7 appear nowhere in the corpus,
 * so "== 1" versus "<= 1" versus "odd" is undecided here, exactly as
 * NOISE_TIE_UP's own note says. */
#ifndef NOISE_TRIG_DELAY_T
#define NOISE_TRIG_DELAY_T 8
#endif
#ifndef NOISE_TRIG_DELAY_DIV1_T
#define NOISE_TRIG_DELAY_DIV1_T 4
#endif
/* A RESTART -- a trigger into an already-running channel -- takes the start
 * delay plus this.  The old model carried the same fact as NOISE_RESTART_LEAD
 * ("a restart pays the trigger lead twice"); this is that fact re-measured
 * under the counter model, where the lead is smaller.  channel_4_lfsr_restart
 * and channel_4_lfsr_restart_fast declare 256 cells between them and both go
 * from 128 differing to 0 across it. */
#ifndef NOISE_RESTART_EXTRA_T
#define NOISE_RESTART_EXTRA_T 2
#endif

/* APU_OFF_STOPS_CHANNELS -- A POWERED-OFF APU DOES NOT CLOCK ITS CHANNELS.
 *
 * apu_power_off already sets `c->timer = 0` and `c->freq = 0` on all four
 * channels.  apu_chan_tick then decremented those zeroed timers ANYWAY, so
 * every one expired on the next tick and reloaded with a bare (2048-0) period
 * -- a powered-OFF APU stepped ch3's wave position and ch1/ch2's duty position
 * for ever.  Audio.md:107 says the pulse phase "is only ever reset by turning
 * the APU off", which it cannot be if the off state keeps advancing it.
 *
 * ***DECLINED, AND THE PRICE IS WRITTEN DOWN.***  Measured with the other arms
 * held on, so the attribution is a control and not an inference:
 *
 *   SameSuite     buys NOTHING -- APU_WAVE_READS_ONLY_WHEN_ON already stops the
 *                 spurious step, because a powered-off channel is DISABLED.
 *   audio net     score 333 -> ***489, WORSE by 156***
 *                 probe-wave-noise/ch1  0.0000 -> 0.4888
 *                 probe-wave-noise/ch2  0.0000 -> 0.4731
 *                 probe-pulse/ch2       0.0373 -> 0.0618
 *
 * Board-negative with zero board gain, so the trade rule declines it
 * automatically.  KEPT AS A KNOB, NOT DELETED: two pulse tracks that were EXACT
 * going to 0.49 is not a phase error, and whatever it is, this arm EXPOSED it
 * rather than created it.  That is the next question in this half.
 *
 * 1 = gate the channel clock on power.  0 = the free-running tick, AND THE
 *     DEFAULT. */
#ifndef APU_OFF_STOPS_CHANNELS
#define APU_OFF_STOPS_CHANNELS 0
#endif

/* APU_POWER_SKIPS_DIV_EVENT -- POWERING THE APU ON WHILE DIV BIT 4 IS ALREADY
 * SET MAKES THE APU SKIP THE FIRST DIV-APU EVENT.
 *
 * DERIVED, NOT SWEPT.  SameSuite ships three `_10` cartridges beside three
 * otherwise IDENTICAL siblings; the ONLY difference in the source is a
 * `call WaitDIV10` inserted before the APU is powered on, so the pair is a
 * two-arm controlled experiment with DIV bit 4 as the single variable.  Both
 * arms declare their expected table literally, and the `_10` tables are the
 * plain tables displaced by EXACTLY ONE DIV-APU step -- so the quantity is one
 * event, read off the declaration rather than searched for.  The cartridge
 * then states the mechanism itself, in a source comment:
 *
 *     ; This test verifies that starting the APU while bit 4
 *     ; of the DIV register is set causes the APU to skip the
 *     ; first DIV-APU event
 *                  -- samesuite apu/div_write_trigger_10.asm:6-8
 *
 * The two arms of the control differ in HOW the event arrives --
 * div_write_trigger_10 and div_write_trigger_volume_10 fall the bit with a DIV
 * WRITE, div_trigger_volume_10 waits for a NATURAL rollover -- so the skip is a
 * property of power-on, not of the write path.
 *
 * WHY A ONE-SHOT AND NOT A CLEARED div_bit.  Clearing the stored bit at
 * power-on does not implement this: apu_tick4 re-latches the live bit on the
 * very next tick, well before the bit falls, so the edge is detected anyway.
 * The skip has to survive until the bit actually goes low, which is one bit of
 * state.  `div_bit` was also the ONLY member of struct APU that a power cycle
 * left untouched.
 *
 * Board: +3 fixed / 0 broken, all in samesuite/apu.
 *
 * 1 = skip the first event (declared behaviour).  0 = previous behaviour. */
#ifndef APU_POWER_SKIPS_DIV_EVENT
#define APU_POWER_SKIPS_DIV_EVENT 1
#endif

#ifndef WAVE_CGB_WRITE_LOOKAHEAD
#define WAVE_CGB_WRITE_LOOKAHEAD 1
#endif

/* WAVE_CGB_RULE -- THE WAVE-RAM-WHILE-ON RULE, WHICH IS NOT THE SAME ON THE
 * TWO MACHINES.  Ported read-only from GameBoy2, carried as its author wrote
 * it and NOT re-derived here.
 *
 * DMG: a CPU access while channel 3 is playing is refused -- reads give 0xFF,
 * writes are dropped -- except on the single cycle the channel itself is
 * reading, which normal code cannot hit on purpose.
 * CGB: the access is NOT refused.  It is redirected to the byte the channel is
 * currently reading.
 *
 * A DEVICE SPLIT, justified by the device: the CGB side has NO WINDOW AT ALL,
 * which is why it needs no constant.  Worth 2 rows with a boot program
 * (cgb_sound 09 and 12); DMG side measured BIT-IDENTICAL either way.
 *   1 = model the split.   0 = the previous device-blind behaviour. */
#ifndef WAVE_CGB_RULE
#define WAVE_CGB_RULE 1
#endif

/* Whether powering the APU off clears the length counters, and whether the
 * length-load registers stay writable while it is off.
 *
 * BOTH are DMG behaviours, and both were applied device-blind. The CARTRIDGE
 * PAIR declares the split in its own assertion text -- the DMG and CGB members
 * of blargg's 11-regs_after_power are the same program, differing below $421E
 * only in WRAM addresses, and at sub-test 4 they say:
 *
 *     dmg_sound/11   "Powering off shouldn't affect NR41"
 *     cgb_sound/11   "Powering off should clear NR41"
 *
 * This introduces NO constant. It gates two carve-outs already labelled DMG in
 * this file on the device flag the file already carries.
 *
 * 1 = model the split. 0 = the previous device-blind DMG-everywhere behaviour. */
#ifndef APU_POWER_CGB_CLEARS_LEN
#define APU_POWER_CGB_CLEARS_LEN 1
#endif

/* ------------------------------------------------------------------------ */

/* Does the frame sequencer's NEXT step clock length? Length runs on the even
 * steps, so the next step is a length step exactly when the current one is
 * odd. This predicate is the whole of the "extra length clock" quirk; keeping
 * it as a named question rather than an inline parity test is deliberate,
 * because the quirk is an off-by-one and an inline parity test is where an
 * off-by-one hides. */
static int apu_next_clocks_length(struct APU *a) {
    /* ENTAILED BY APU_POWER_SKIPS_DIV_EVENT, not a second assumption: while the
     * skip is armed the next DIV-APU event performs NO step at all, so it is
     * certainly not "one that clocks the length timer" -- which is the exact
     * wording of the two Audio_details.md:241-242 bullets this predicate
     * serves.  Without this the skip is self-inconsistent: it would suppress
     * the step and still answer questions about which step that was.
     * div_write_trigger_10 is the arm that measures it, and it is a LENGTH row,
     * so it reads this predicate where the two volume rows read only the
     * sequencer phase. */
    if (a->div_skip) return 0;
    return (((a->seq_step + 1) & 7) & 1) == 0;
}

static void apu_length_tick(struct APU *a) {
    for (int i = 0; i < 4; i++) {
        struct APUChan *c = &a->ch[i];
        if (c->len_enable && c->length > 0) {
            if (--c->length == 0) c->enabled = 0;
        }
    }
}

/* One expiry of the envelope timer: reload, then one step of the volume in the
 * envelope's direction, saturating at the ends of the 4-bit range. */
static void apu_env_step(struct APUChan *c) {
    c->env_timer = c->env_pace;
    if (c->env_dir) { if (c->vol < 15) c->vol++; }
    else            { if (c->vol >  0) c->vol--; }
}

/* ENV_ZOMBIE_NRX2 -- THE NRx2 WRITE GLITCH ("ZOMBIE MODE").  Pan Docs,
 * Audio_details.md:247-251, "Obscure Behavior":
 *   * "If the old envelope period was zero and the envelope is still doing
 *      automatic updates, volume is incremented by 1, otherwise if the envelope
 *      was in decrease mode, volume is incremented by 2."
 *   * "If the mode was changed (increase to decrease or decrease to increase),
 *      volume is set to 16-volume."
 *   * "Only the low 4 bits of volume are kept after the above operations."
 * Every constant below (1, 2, 16, the low-4-bit mask) is that text's.
 *
 * THE ONE PLACE THIS DEVIATES FROM THE PROSE IS READ OFF A DECLARED TABLE, NOT
 * SWEPT.  channel_2_nrx2_glitch's own CorrectResults fixes all eight (old,new)
 * pairs, and its first row is taken BEFORE the first DIV-APU step, so it is the
 * write's effect alone with no envelope tick mixed in:
 *
 *   old  new   want   prose says          table says
 *   $20  $20    2     +1 (or +2) -> 3/4   UNCHANGED
 *   $08  $08    1     +1         -> 1     +1            agrees
 *   $22  $22    2     +2         -> 4     UNCHANGED
 *   $32  $32    3     +2         -> 5     UNCHANGED
 *   $20  $08   13     +1, flip   -> 13    agrees
 *   $08  $47   15     +1, flip   -> 15    agrees
 *   $22  $08   12     +2, flip   -> 12    agrees
 *   $08  $32   15     +1, flip   -> 15    agrees
 *
 * The four disagreements are exactly the four writes that DO NOT change the
 * direction bit and whose OLD direction was decrease.  So the adjustment is
 * computed exactly as the prose computes it, and is committed when the mode
 * changed, or when the old mode was increase.  No numeric constant is chosen
 * here; the gate is the table's, and the test's own header says this glitch
 * "appears to be different across revisions" -- the prose paragraph is labelled
 * CGB-02/CGB-04 and this board is scored on a CGB boot Rev 2 machine.
 */
#ifndef ENV_ZOMBIE_NRX2
#define ENV_ZOMBIE_NRX2 1
#endif

/* ENV_ZOMBIE_PACE0_GATE -- see apu_write_nrx2 for the derivation and the
 * declared table it is read off.  Building with -DENV_ZOMBIE_PACE0_GATE=0
 * restores the pre-arm behaviour exactly, which is how its price was taken. */
#ifndef ENV_ZOMBIE_PACE0_GATE
#define ENV_ZOMBIE_PACE0_GATE 1
#endif

/* ENV_ENABLE_EVEN_TICK -- ENABLING THE ENVELOPE SCHEDULES ONE EXTRA ENVELOPE
 * TICK.  DECLARED BY THE CARTRIDGE ITSELF, channel_2_nrx2_speed_change.asm,
 * its own header comment:
 *   "Enabling the envelope trigger an APU bug - in the next *even* DIV-APU
 *    tick, the APU will tick the volume envelope of that apropriate channel,
 *    even if it would not tick volume envelope at that tick otherwise"
 * One-shot, armed by an NRx2 write that takes the pace from 0 to non-zero.
 *
 *   1 = the extra tick performs the envelope's volume step (and reloads the
 *       timer), i.e. it acts as though the timer had expired.
 *   2 = the extra tick only CLOCKS the timer, firing only if it expires.
 * Value 1 is what the declared tables require: channel_2_nrx2_glitch row 2
 * subtest 6 ($08 -> $47, new pace 7) loses exactly one volume step inside two
 * envelope clocks, which a mere clock of a freshly-loaded pace-7 timer cannot
 * produce.  Value 2 exists so the two-way structural question is measured
 * rather than asserted.
 */
#ifndef ENV_ENABLE_EVEN_TICK
#define ENV_ENABLE_EVEN_TICK 1
#endif
/* ENV_ENABLE_EVEN_TICK_CH4 -- whether the extra tick reaches channel 4 as well.
 * NOTHING DECLARES THIS.  The cartridge says "the volume envelope of that
 * apropriate channel" and channel 4 owns the same envelope unit through the
 * same NRx2 register, so 1 is the reading with a citation behind it.  SameSuite
 * ships no channel_4 nrx2 row, so the board cannot separate the two values:
 * setting this to 0 is FITTED to the audio instrument and must not be landed as
 * a mechanism.  It exists so the price of the honest value is visible. */
#ifndef ENV_ENABLE_EVEN_TICK_CH4
#define ENV_ENABLE_EVEN_TICK_CH4 1
#endif
#ifndef ENV_ENABLE_TICK_PARITY
#define ENV_ENABLE_TICK_PARITY 1
#endif

static void apu_env_tick(struct APU *a) {
    static const int ENV_CH[3] = { 0, 1, 3 };
    for (int k = 0; k < 3; k++) {
        struct APUChan *c = &a->ch[ENV_CH[k]];
        if (!c->env_pace) continue;               /* pace 0 = envelope off */
        if (--c->env_timer > 0) continue;
        apu_env_step(c);
    }
}

/* One sweep frequency calculation. Always performs the overflow check, which
 * is what lets a trigger with a non-zero shift kill the channel before a
 * single sweep step has been clocked. Returns the candidate frequency. */
static int apu_sweep_calc(struct APU *a) {
    int delta = a->sw_shadow >> a->sw_shift;
    int nf = a->sw_dir ? (a->sw_shadow - delta) : (a->sw_shadow + delta);
    if (a->sw_dir) a->sw_neg_used = 1;
    if (nf > 2047) a->ch[0].enabled = 0;
    return nf;
}

/* The overflow check that is NOT the sweep's own frequency step: the one
 * performed on a trigger, and the second one performed after a step. Both are
 * declared late by channel_1_sweep.asm -- see SWEEP_KILL_DELAY_T in apu.h.
 * The calculation is still performed here, for sw_neg_used; only the stop is
 * carried forward. */
static void apu_sweep_calc_late(struct APU *a, int lead) {
#if SWEEP_KILL_DELAY_T
    int was = a->ch[0].enabled;
    apu_sweep_calc(a);
    if (was && !a->ch[0].enabled) {
        a->ch[0].enabled = 1;
        /* + the seam's lead, in machine cycles, the SAME speed-aware quantity
         * apu_trigger adds. ONE for a check armed by the frame step, which
         * runs at the top of apu_tick4 with this machine cycle's own ticks
         * still to come. TWO for a check armed by a CPU write, because the bus
         * leaves a write at the END of its machine cycle -- the same fact
         * NOISE_NR43_DEFER is built on -- so it is one machine cycle later in
         * the countdown than a frame step in the same cycle. */
        a->sw_kill = SWEEP_KILL_DELAY_T + lead * APU_TICK_T * APU_NTICKS(a);
    }
#else
    (void)lead;
    apu_sweep_calc(a);
#endif
}

static void apu_sweep_tick(struct APU *a) {
    if (--a->sw_timer > 0) return;
    /* A pace of 0 reloads the timer as though it were 8 but performs no step;
     * that is what makes "pace 0" mean "never" rather than "immediately". */
    a->sw_timer = a->sw_pace ? a->sw_pace : 8;
    if (!a->sw_on || !a->sw_pace) return;
    int was_en = a->ch[0].enabled;
    int nf = apu_sweep_calc(a);
    /* The STEP's own overflow stop -- not the trigger check and not the
     * post-step check, both of which apu_sweep_calc_late already carries. See
     * SWEEP_TRIG_VOID_T / SWEEP_STEP_STOP_T in apu.h for the derivation. */
    if (was_en && !a->ch[0].enabled) {
#if SWEEP_TRIG_VOID_T
        if (a->sw_trigvoid > 0) {
            /* Voided: a trigger landed inside the window before this step. */
            a->ch[0].enabled = 1;
        } else
#endif
#if SWEEP_STEP_STOP_T
        {
            a->ch[0].enabled = 1;             /* held; lands in apu_chan_tick */
            a->sw_stop = SWEEP_STEP_STOP_T;
        }
#else
        { }
#endif
    }
    if (nf <= 2047 && a->sw_shift) {
        a->sw_shadow = nf;
        a->ch[0].freq = nf;
        a->reg[0x03] = (unsigned char)(nf & 0xFF);
        a->reg[0x04] = (unsigned char)((a->reg[0x04] & 0xF8) | ((nf >> 8) & 7));
        /* The second calculation exists only for its overflow check. */
        apu_sweep_calc_late(a, 1);   /* armed by the frame step */
    }
}

static void apu_frame_step(struct APU *a) {
    a->seq_step = (a->seq_step + 1) & 7;
#if ENV_ENABLE_EVEN_TICK
    /* ENV_ENABLE_TICK_PARITY -- WHICH OF OUR EIGHT STEPS THE CARTRIDGE CALLS
     * "even".  Pan Docs pins the length counter to every SECOND DIV-APU tick
     * and the envelope to every EIGHTH, but pins neither to an absolute origin,
     * so the parity of our seq_step against the cartridge's numbering is a free
     * convention -- and the two declared tables fix it.
     * channel_2_nrx2_speed_change Tests 6 and 7 are the same test written at two
     * alignments ($400 nops apart): 6 writes NRx2 half a DIV-APU period before a
     * step, 7 writes it right at one.  Both declare the extra tick landing at
     * the SAME absolute time, which is 2 of our steps after the first write and
     * 1 after the second -- i.e. on the steps at which we do NOT clock length. */
    if ((a->seq_step & 1) == ENV_ENABLE_TICK_PARITY) {
        static const int ENV_CH[3] = { 0, 1, 3 };
        for (int k = 0; k < 3; k++) {
            struct APUChan *c = &a->ch[ENV_CH[k]];
            if (!c->env_bug) continue;
            if (ENV_CH[k] == 3 && !ENV_ENABLE_EVEN_TICK_CH4) { c->env_bug = 0; continue; }
            c->env_bug = 0;                       /* one-shot */
            if (ENV_ENABLE_EVEN_TICK == 2) {
                if (c->env_pace && --c->env_timer <= 0) apu_env_step(c);
            } else {
                apu_env_step(c);
            }
        }
    }
#endif
    if ((a->seq_step & 1) == 0) apu_length_tick(a);
    if (a->seq_step == 2 || a->seq_step == 6) apu_sweep_tick(a);
    if (a->seq_step == 7) apu_env_tick(a);
}

/* ------------------------------------------------------------------------ */

/* DUTY_OFF_UNTIL_FIRST_TRIGGER -- THE DUTY UNIT DOES NOT RUN BEFORE ITS CHANNEL
 * HAS EVER BEEN TRIGGERED.  DERIVED: BOTH EFFECTS AND THEIR CONDITION ARE THE
 * SENTENCE'S OWN, AND NO NUMBER IS CHOSEN.
 *
 * Pan Docs, Audio_details.md, "Obscure Behavior":
 *   "Just after powering on, the first duty step of Ch1 and Ch2 after they are
 *    triggered for the first time is played as if it were 0.  Also, the duty
 *    cycle clocking is disabled until the first trigger."
 *
 * Two effects, one condition.  Our duty tick advanced duty_pos unconditionally
 * with no such gate.  The two objects the surrounding clauses name -- the duty
 * step COUNTER (duty_pos, which a trigger must NOT reset) and the duty step
 * TIMER (c->timer, which it must) -- were already correctly distinguished here;
 * only this gate was missing.
 *
 * WHY IT REACHES SO MANY ROWS: every duty and volume cartridge in SameSuite
 * performs ONE APU power-on and ONE pulse trigger per dumped byte, so the
 * clause applies to every measurement they take.
 *
 * ORIGIN AND WHY IT WAS DECLINED ONCE.  Ported from GameBoy5, where it priced
 * at 0 fixed / 0 broken.  That null was not the arm; it was the tree it was
 * priced in.  See our notes.
 *
 * PRICE, re-derived and control-verified on b34bd61 with the shootout's own
 * 264-row enumeration and oracle (GameBoy4/tools/shootout, boot programs
 * supplied): BOARD 223 -> 230, +7 fixed / 0 broken -- channel_1/2_duty,
 * channel_1/2_freq_change, channel_1/2_stop_div, channel_1_volume_div.
 * CONTROL: at DUTY_OFF_UNTIL_FIRST_TRIGGER=0 all 261 scoreable framebuffer
 * streams are sha256-identical to pristine b34bd61, 264 rows compared.
 * FENCE: not one non-samesuite framebuffer moves; 13 samesuite rows move and
 * every one improves.  Declared-table byte distance 1102 -> 975 of 4592. */
#ifndef DUTY_OFF_UNTIL_FIRST_TRIGGER
#define DUTY_OFF_UNTIL_FIRST_TRIGGER 1
#endif

static int apu_period(struct APU *a, int i) {
    switch (i) {
        case 0: case 1: return (2048 - a->ch[i].freq) * 4;
        case 2:         return (2048 - a->ch[2].freq) * 2;
        default:        return APU_NOISE_DIV[a->ns_div] << a->ns_shift;
    }
}

/* The first LFSR step after a trigger: the half period, snapped to the nearest
 * edge of the free-running divisor clock.  See NOISE_FREE_RUNNING_DIVISOR. */
static int apu_noise_first(struct APU *a, int restart) {
    const int grid = a->ns_div ? 8 : 4;
    /* The landed nominal, unchanged: the half period plus the lead
     * APU_NOISE_TRIGGER_HALF already carries.  The grid moves it; it does
     * not replace it. */
    const int period = APU_NOISE_DIV[a->ns_div] << a->ns_shift;
    const int lead = (APU_NOISE_TRIGGER_HALF == 2 ? APU_NOISE_DIV[a->ns_div] : 8);
    /* A restart pays that same lead a second time -- see NOISE_RESTART_LEAD. */
    const int half = period / 2 + lead + (restart ? NOISE_RESTART_LEAD * lead : 0);
    /* Phase probe.  The grid's origin is the power-on machine cycle's start,
     * where ns_t is zeroed; the trigger is probed a FLAT 4 T later.  Flat, not
     * APU_TICK_T * APU_NTICKS(a): the seam lead at the call site is a property
     * of the CPU's machine cycle and halves in double speed, but this offset is
     * the APU's own and does not -- exactly the split APU_SPEED_TICKS already
     * draws.  channel_4_align is the only double-speed row in the pool and it
     * is what distinguishes the two: the speed-scaled form inverts all four of
     * its transitions while leaving single speed untouched. */
    const int p = (a->ns_t + 4) & 7;
    int base = (NOISE_GRID_PHASE - p) % grid;
    int k, r, d;
    if (base < 0) base += grid;
    if (base == 0) base = grid;               /* strictly after the trigger */
    k = 0;
    while (base + (k + 1) * grid <= half) k++;
    r = half - (base + k * grid);
    if (r < 0) r = 0;
    if (r * 2 > grid) k++;
    else if (r * 2 == grid) {
        int up = (NOISE_TIE_UP == 1) || (NOISE_TIE_UP == 2 && a->ns_div <= 1);
        if (up) k++;
    }
    d = base + k * grid;
    return d < 1 ? base : d;
}

static void apu_trigger(struct APU *a, int i) {
    struct APUChan *c = &a->ch[i];
    /* CAPTURED BEFORE the enable below, which is the whole point: a trigger
     * into an ALREADY-RUNNING channel is a RESTART, and the corpus declares a
     * restart's start delay to be one tick shorter than a cold trigger's.
     * See SQ_TRIG_PHASE in apu.h for both declarations and their unit. */
    int restart = c->enabled;
    c->enabled = 1;
    if (c->length == 0) c->length = APU_LEN_MAX(i);
    /* The wave channel takes an extra 6 T before its first read after a
     * trigger -- documented DMG behaviour, and an omission here rather than a
     * knob: every other channel reloads with a bare period. Measured
     * consequence before it was added: our wave read ran 10 T ahead of the
     * oracle's, constant across four periods (AUDIO-DESIGN section 18). */
    /* +4 is the seam's write lead, not a tuning constant. `write8` calls
     * apu_write BEFORE apu_tick4 for that machine cycle, so a register write
     * reaches the APU 4 T earlier than the same write reaches it through
     * `read8` (which ticks first). A LEVEL effect -- a frequency, a volume --
     * cannot tell; only an EDGE-triggered one can, and the trigger's timer
     * reload is the only edge here that is observable at 4 T.
     *
     * Measured, not assumed: with +6 alone the wave read ran exactly 4 T ahead
     * of the oracle across four periods (§18), and adding the 4 T back takes
     * dmg_sound from 9/12 to 10/12 with nothing broken.
     *
     * THE COUPLING IS REAL AND IT IS GUARDED. This constant describes gb.c's
     * structure from inside apu.c, so it goes wrong silently if the seam ever
     * ticks before the write instead. dmg_sound 09 is the tripwire: it is in
     * the net with a baseline, and it fails again the moment that happens. */
    {
        /* The square channels' start delay, DERIVED -- see apu.h. The wave and
         * noise channels are untouched and keep the bare reload they had. */
        int sq_phase = (i < 2) ? SQ_TRIG_PHASE
                               - (restart ? SQ_TRIG_RESTART_SHORTER : 0) : 0;
        /* THE THIRD ELEMENT. channel_1_restart declares that on a restart the
         * countdown is reset BUT "the new pulse's first sample will be the next
         * sample the old pulse would have played". A restart landing inside the
         * last machine cycle of a sample therefore still advances the duty
         * unit: that sample is already committed. */
        if (restart && i < 2 && c->timer <= 4)
            c->duty_pos = (c->duty_pos + 1) & 7;
        /* THE SEAM LEAD IS ONE MACHINE CYCLE, NOT FOUR T-CYCLES.  The
         * paragraph above derives this trailing constant as "a register write
         * reaches the APU 4 T earlier than the same write reaches it through
         * read8" -- 4 T BECAUSE THAT IS HOW LONG A MACHINE CYCLE IS.  In CGB
         * double speed a machine cycle is 2 T of the same clock (Audio.md:59,
         * and see APU_SPEED_TICKS), so the lead there is 2 T.  Writing it as
         * the tick count apu_tick4 will actually run keeps the two halves of
         * one fact in one place.
         *
         * ***THIS IS A UNIT, NOT A VALUE***, and it is deliberately kept
         * separate from sq_phase above.  sq_phase is a PHYSICAL start delay in
         * T on the APU's own clock, which Audio.md:59 says does not scale with
         * CPU speed, so it is correct unchanged at both speeds.  The two
         * quantities compose; they do not overlap.
         *
         * MEASURED: with a flat +4, channel_3_delay and channel_3_first_sample
         * both landed EXACTLY ONE unit late against their declared tables, at
         * three different frequencies ($400, $600, $700). */
        c->timer = apu_period(a, i) + (i == 2 ? 6 : 0) + sq_phase
                 + APU_TICK_T * APU_NTICKS(a);
#if APU_NOISE_TRIGGER_HALF
        if (i == 3)
            c->timer = apu_period(a, 3) / 2
                     + (APU_NOISE_TRIGGER_HALF == 2 ? APU_NOISE_DIV[a->ns_div] : 8)
                     + APU_TICK_T * APU_NTICKS(a);
#endif
#if NOISE_FREE_RUNNING_DIVISOR
        if (i == 3)
            c->timer = apu_noise_first(a, restart) + APU_TICK_T * APU_NTICKS(a);
#endif
#if NOISE_COUNTER_MODEL
        /* The counter model's trigger: arm the start delay.  The seam lead is
         * the same `APU_TICK_T * APU_NTICKS(a)` every reload above already pays
         * -- apu_write runs BEFORE apu_tick4 for this machine cycle, so the
         * delay must cover the ticks this cycle still owes.  NO NEW CONSTANT. */
        if (i == 3) {
            int d = NOISE_TRIG_DELAY_T
                  + (a->ns_div == 1 ? NOISE_TRIG_DELAY_DIV1_T : 0)
                  + (restart ? NOISE_RESTART_EXTRA_T : 0);
            /* ***A FLAT 4 T, NOT `APU_TICK_T * APU_NTICKS(a)`.***  Same split
             * apu_noise_first() already draws and for the same reason: the
             * seam lead at the call site is the CPU's machine cycle and halves
             * in double speed, but this delay is the APU's own and does not.
             * MEASURED, and channel_4_align is what measures it: it is the only
             * double-speed row in the pool, and the speed-scaled form costs it
             * four cells while leaving every single-speed row untouched. */
            a->ns_trig = d + 4;
        }
#endif
#if SQ_ENABLE_GRID
        /* SQ_ENABLE_GRID -- see apu.h.  The square channels' sample clock is a
         * 1 MHz (4 T) divider free-running from APU power-on; a trigger reloads
         * the period counter but the counter still only steps on that grid, so
         * the first sample's expiry is rounded UP onto it.
         *
         * `a->ns_t` is T since the power-on machine cycle's start.  The enable
         * and the trigger are BOTH `ldh [a8],a` writes reaching apu_write
         * through the same seam, so the seam lead CANCELS in their difference
         * and ns_t is the physical enable->trigger distance exactly.  The
         * reload above carries one lead for the READ side (PCM12 is sampled
         * through read8, which ticks first), so the expiry in enable-anchored
         * physical T is `ns_t + timer - lead`, and the grid requires that to be
         * a multiple of 4.
         *
         * NO NEW CONSTANT: the lead is the same `APU_TICK_T * APU_NTICKS(a)`
         * already added two lines above, used once more and for the same
         * reason.  IN SINGLE SPEED THIS IS IDENTICALLY ZERO -- a machine cycle
         * IS 4 T there, so ns_t at any write is 0 mod 4, the period is 4 T per
         * unit and the lead is 4, hence adj == 0 for every single-speed
         * trigger.  It is reachable only in double speed, which is exactly why
         * channel_1_align sets KEY1 before it measures anything. */
        if (i < 2) {
            int lead = APU_TICK_T * APU_NTICKS(a);
            int adj  = (lead - (a->ns_t + c->timer)) & 3;
            c->timer += adj;
        }
#endif
    }
    c->env_timer = c->env_pace ? c->env_pace : 8;
    c->vol = c->vol_init;

    if (i == 0) {
        a->sw_shadow = c->freq;
        a->sw_timer = a->sw_pace ? a->sw_pace : 8;
        a->sw_on = (a->sw_pace || a->sw_shift) ? 1 : 0;
        a->sw_kill = 0;   /* the trigger replaces any pending check with its own */
        a->sw_stop = 0;   /* ... and any pending STEP stop with its own window */
#if SWEEP_TRIG_VOID_T
        a->sw_trigvoid = SWEEP_TRIG_VOID_T;
#endif
        a->sw_neg_used = 0;
        if (a->sw_shift) apu_sweep_calc_late(a, 2); /* check on trigger: a CPU write */
    } else if (i == 2) {
        a->wave_pos = 0;
    } else if (i == 3) {
        a->lfsr = 0x7FFF;
    }
    if (i == 0 || i == 1) { if (!c->duty_clocking) c->duty_zero_1st = 1;
                            c->duty_clocking = 1; }
    if (!c->dac) c->enabled = 0;   /* a trigger into a dead DAC produces nothing */
}

/* NRx4: length enable and trigger, with the extra length clock. */
static void apu_write_nrx4(struct APU *a, int i, unsigned char v) {
    struct APUChan *c = &a->ch[i];
    int was = c->len_enable;
    int trigger = (v >> 7) & 1;
    c->len_enable = (v >> 6) & 1;
    if (i != 3) c->freq = (c->freq & 0xFF) | ((v & 7) << 8);

    if (!was && c->len_enable && !apu_next_clocks_length(a) && c->length > 0) {
        if (--c->length == 0 && !trigger) c->enabled = 0;
    }
    if (trigger) {
        /* DMG wave RAM corruption. Re-triggering channel 3 while it is playing
         * AND while it is reading a byte -- the same one-tick window as every
         * other wave-RAM access -- damages the first bytes of wave RAM instead
         * of reading cleanly. The byte position is the one ABOUT TO BE read,
         * because this path runs before apu_tick4, exactly as the write path
         * does. Measured: Blargg 10 shows the oracle leaving wave[0] = wave[1]
         * where we left it untouched. */
        /* WAVE_TRIG_WINDOW_SHIFT / WAVE_TRIG_POS_OFF -- (0, 0) is the
         * pre-landing behaviour; (-1, +1) is what this core uses.
         *
         * THE RESIDUAL WAS TWO BYTES, AND THEY WERE TRANSPOSED.  Blargg
         * dmg_sound/10 prints its wave RAM; the first byte of the blocks at
         * tile-rows 9 and 12 came out swapped -- we printed 00/11 where the
         * reference prints 11/00, i.e. exactly the 00 and 11 that are wave RAM
         * positions 0 and 1.  That is a ONE-STEP boundary, not a wrong rule.
         *
         * TWO KNOBS, ONE STEP.  The step can sit in only two places -- WHEN the
         * window opens and WHICH byte it names -- so there is a knob each, and
         * they are priced apart rather than one moved and the other declared
         * excluded by assertion.  They are NOT independent: opening the window
         * one APU tick earlier leaves wave_pos one step behind, so naming the
         * byte one step further ahead restores the same physical byte.  Of the
         * 15 cells swept, (-1, +1) is the only one that passes -- a point, not
         * a plateau -- and it is the only one where the two cancel. */
#ifndef WAVE_TRIG_WINDOW_SHIFT
#define WAVE_TRIG_WINDOW_SHIFT (-1)
#endif
#ifndef WAVE_TRIG_POS_OFF
#define WAVE_TRIG_POS_OFF (1)
#endif
        if (i == 2 && c->enabled && !(WAVE_TRIGGER_CORRUPT_DMG_ONLY && a->dev_cgb)
            && a->ch[2].timer > (1 + WAVE_TRIG_WINDOW_SHIFT) * APU_TICK_T
            && a->ch[2].timer <= (2 + WAVE_TRIG_WINDOW_SHIFT) * APU_TICK_T) {
#ifdef WAVE_TRIG_COUNT
            /* EXACT execution counter for the reachability question -- not a
             * sample at instruction boundaries.  Compiled out by default. */
            extern unsigned long long wave_trig_hits; wave_trig_hits++;
#endif
            int pos = ((a->wave_pos + 1 + WAVE_TRIG_POS_OFF) & 31) >> 1;
            if (pos < 4) {
                a->wave[0] = a->wave[pos];
            } else {
                int base = pos & ~3;
                for (int k = 0; k < 4; k++) a->wave[k] = a->wave[base + k];
            }
        }
        apu_trigger(a, i);
        if (c->length == APU_LEN_MAX(i) && c->len_enable
            && !apu_next_clocks_length(a))
            c->length--;
    }
}

/* DUTY_STOPPED_HOLDS_PHASE -- A STOPPED SQUARE CHANNEL DOES NOT ADVANCE ITS
 * DUTY STEP COUNTER.  DECLARED BY THE CARTRIDGE, channel_2_stop_restart.asm,
 * its own header comment:
 *   "This test shows that even after stopping the channel, the current
 *    sample index/phase remains unchanged. It is only reset by turning
 *    the APU off (NR52)."
 * Two claims about one object, and we already honoured the second: NR52 off
 * clears duty_pos in apu_power_off.  The first was missing -- duty_pos kept
 * counting while the channel was stopped, so it came back ahead of where it
 * was parked.
 *
 * THIS IS THE SAME GATE CHANNEL 3 ALREADY HAS.  Ten lines below, the wave
 * channel reloads its timer but declines to step its position while the
 * channel is off (APU_WAVE_READS_ONLY_WHEN_ON).  The square channels are given
 * the identical shape here -- the timer still runs, only the step counter
 * holds -- so this is one rule stated once per channel, not a new mechanism.
 * It is also the same object DUTY_OFF_UNTIL_FIRST_TRIGGER governs: that knob
 * says the counter does not run BEFORE the first trigger, this one says it
 * does not run while the channel is stopped.  Both gates stay; neither
 * implies the other, and the cartridge that declares each is different.
 *
 * NO CONSTANT IS CHOSEN.  The freeze window is whatever the program leaves
 * between its NRx2-zero write and its next trigger; nothing here is tuned to
 * it. */
#ifndef DUTY_STOPPED_HOLDS_PHASE
#define DUTY_STOPPED_HOLDS_PHASE 2
#endif

static void apu_set_dac(struct APU *a, int i, int on) {
    a->ch[i].dac = on ? 1 : 0;
#if DUTY_STOPPED_HOLDS_PHASE >= 2
    /* THE STOP COMMITS THE SAMPLE THAT IS ALREADY IN FLIGHT.  This is not a new
     * rule and not a new constant: it is the LANDED R2 SENTENCE -- "the
     * countdown resets but a sample already committed still steps the duty
     * unit" -- read at the edge where the duty unit stops instead of the edge
     * where it restarts, with R2's own `timer <= 4` test unchanged.  4 T is one
     * machine cycle, which is the seam lead a register write already has here.
     *
     * DERIVED, and the residual says so.  With the freeze alone, the nine
     * declared blocks of channel_2_stop_restart split exactly by the residue of
     * the pre-stop delay against the 4-machine-cycle sample: every block whose
     * stop lands mid-sample is exact, and every block whose stop lands in a
     * sample's LAST machine cycle is one step behind.  That is the whole
     * residual -- one class, no free parameter. */
    if (!on && i < 2 && a->ch[i].enabled && a->ch[i].timer <= 4
        && (!DUTY_OFF_UNTIL_FIRST_TRIGGER || a->ch[i].duty_clocking))
        a->ch[i].duty_pos = (a->ch[i].duty_pos + 1) & 7;
#endif
    if (!on) a->ch[i].enabled = 0;
}

static void apu_power_off(struct APU *a) {
    for (int i = 0; i <= 0x15; i++) a->reg[i] = 0;
    for (int i = 0; i < 4; i++) {
        struct APUChan *c = &a->ch[i];
        int cgb_clear = APU_POWER_CGB_CLEARS_LEN && a->dev_cgb;
        int keep_len = cgb_clear ? 0 : c->length;  /* DMG: they survive power */
        c->enabled = 0; c->dac = 0; c->len_enable = 0;
        c->freq = 0; c->timer = 0; c->duty = 0; c->duty_pos = 0;
        c->duty_pending = 0; c->duty_stage = 0;
        c->vol = 0; c->vol_init = 0; c->env_dir = 0; c->env_pace = 0;
        c->env_timer = 0; c->out = 0; c->env_bug = 0;
        c->length = keep_len;
    }
    a->sw_pace = a->sw_dir = a->sw_shift = 0;
    a->sw_shadow = a->sw_timer = a->sw_on = a->sw_neg_used = 0;
    a->sw_stop = a->sw_trigvoid = 0;
    a->sw_kill = 0;
    a->wave_level = 0;
#if APU_POWER_CLEARS_WAVE_SAMPLE
    a->wave_last = 0;          /* see APU_POWER_CLEARS_WAVE_SAMPLE */
#endif
    a->lfsr_w7 = 0; a->ns_shift = 0; a->ns_div = 0;
    a->vol_l = a->vol_r = 0; a->route = 0;
    a->div_skip = 0;
    a->power = 0;
    if (SPSW_APU) a->div_bit &= 1;   /* sound off clears the switch's delay */
}

static void apu_power_on(struct APU *a) {
    a->power = 1;
    a->ns_t = 0;         /* the free-running divisor phase starts here */
#if NOISE_COUNTER_MODEL
    /* The ONLY reset of the three cascaded stages.  The down-counter comes up
     * loaded (divisor 0 reloads as 1), so the first examination already
     * expires -- there is no sixteen-examination dead start. */
    a->ns_clk = 0; a->ns_down = 1; a->ns_up = 0; a->ns_trig = 0;
#endif
    /* Armed only when the bit is ALREADY high: powering on with it low leaves
     * the ordinary detector untouched, which is why the three non-`_10`
     * siblings cannot move. */
    a->div_skip = APU_POWER_SKIPS_DIV_EVENT ? (SPSW_APU ? (a->div_bit & 1) : a->div_bit) : 0;
    /* The frame sequencer restarts so the next step is 0, and the duty units
     * restart at the first step of their waveform (Pan Docs). */
    a->seq_step = 7;
    a->ch[0].duty_pos = 0;
    a->ch[1].duty_pos = 0;
    a->ch[0].duty_clocking = a->ch[1].duty_clocking = 0;
    a->ch[0].duty_zero_1st = a->ch[1].duty_zero_1st = 0;
    a->wave_pos = 0;
}

/* ------------------------------------------------------------------------ */

static unsigned char apu_read(struct APU *a, unsigned short addr) {
    int i = (int)addr - 0xFF10;
    if (i < 0 || i > 0x2F) return 0xFF;
    if (i >= 0x20) {
        /* DMG: while channel 3 is playing, wave RAM belongs to the channel.
         * A CPU read returns 0xFF unless it lands on the very cycle the channel
         * is reading a byte -- a window normal code cannot hit, and which no
         * stimulus in our corpus exercises (see AUDIO-DESIGN 17). Blargg
         * dmg_sound 09 is the authority: it reads while on and requires 0xFF. */
        if (a->ch[2].enabled) {
            /* A read8 reaches here AFTER apu_tick4 has run this machine cycle,
             * so the flag is current. */
            if (WAVE_CGB_RULE && a->dev_cgb) return a->wave[a->wave_pos >> 1];
            if (a->wave_read_2nd) return a->wave[a->wave_pos >> 1];
            return 0xFF;
        }
        return a->wave[i - 0x20];
    }
    if (i > 0x16) return 0xFF;                       /* $FF27..$FF2F */
    if (i == 0x16) {                                 /* NR52 */
        unsigned char v = a->power ? 0x80 : 0x00;
        for (int c = 0; c < 4; c++) if (a->ch[c].enabled) v |= (unsigned char)(1 << c);
        return (unsigned char)(v | 0x70);
    }
    return (unsigned char)(a->reg[i] | APU_READ_OR[i]);
}

/* THE SHARED NRx2 PATH.  Channels 1, 2 and 4 present the same volume/envelope
 * register and the same write behaviour; the only thing that differs is which
 * channel it lands on.  Writing it once is what makes the channel_1/channel_2
 * pairs one defect instead of two. */
static void apu_write_nrx2(struct APU *a, int i, unsigned char v) {
    struct APUChan *c = &a->ch[i];
#if ENV_ZOMBIE_NRX2 || ENV_ENABLE_EVEN_TICK
    /* The OLD register value, reconstructed from the channel's own state: bits
     * 7-4 are vol_init, bit 3 env_dir, bits 2-0 env_pace.  Reading it back out
     * of a->reg[] would depend on where in apu_write the shadow is stamped. */
    int old_pace = c->env_pace, old_dir = c->env_dir;
    int playing  = c->enabled;
#endif
#if ENV_ZOMBIE_NRX2
    if (playing) {
        int new_dir = (v >> 3) & 1;
        /* Audio_details.md:248 verbatim, in its own order. */
        int adj = (old_pace == 0) ? 1 : (old_dir ? 0 : 2);
#if ENV_ZOMBIE_PACE0_GATE
        if (old_pace == 0) {
            /* ENV_ZOMBIE_PACE0_GATE -- read off channel_1_volume.asm's own
             * CorrectResults, all 128 cells, not swept.  That table triggers
             * with NR12 = (vol V, dir D1, pace P1) and then writes NR12 = b
             * ($F0/$F1/$F8/$F9) four M-cycles later, with DIV reset so no
             * frame-sequencer step can intervene: the cell is the write's
             * effect alone.  Its eight old_pace==0 rows fix the gate and the
             * sign completely:
             *
             *   D1 D2 P2   want            this rule
             *    0  0  0   V               no step, no flip
             *    1  0  0   16-V            flip only
             *    0  0  1   V-1             step -1 (dir decrease)
             *    1  0  1   16-(V+1)        step +1 folded into the complement
             *    0  1  *   16-(V+1)        step +1 folded into the complement
             *    1  1  *   V+1             step +1 (dir increase)
             *
             * So the step happens exactly when the write LEAVES the envelope's
             * dir/pace field non-zero ((v & 0x0F) != 0), and it goes in the
             * envelope's own direction -- +1 increase, -1 decrease -- wrapping
             * in 4 bits rather than saturating.  The prose's "+1" is that step
             * seen only through the direction-change cases; its unconditional
             * form is what leaves rows 2 and 4 of this table wrong.  The
             * old_pace != 0 half below is untouched. */
            int live = (v & 0x0F) != 0;
            if (old_dir != new_dir) c->vol = (16 - (c->vol + (live ? 1 : 0))) & 15;
            else if (live)          c->vol = (c->vol + (old_dir ? 1 : -1)) & 15;
        } else
#endif
        {
            if (old_dir != new_dir)   c->vol = (16 - (c->vol + adj)) & 15;  /* :249 */
            else if (old_dir)         c->vol = (c->vol + adj) & 15;
        }
        (void)adj;
    }
#endif
    c->vol_init = (v >> 4) & 15;
    c->env_dir  = (v >> 3) & 1;
    c->env_pace = v & 7;
#if ENV_ENABLE_EVEN_TICK
    if (playing && old_pace == 0 && c->env_pace) c->env_bug = 1;
#endif
    apu_set_dac(a, i, (v & 0xF8) != 0);
}

static void apu_write(struct APU *a, unsigned short addr, unsigned char v) {
    int i = (int)addr - 0xFF10;
    if (i < 0 || i > 0x2F) return;
    if (i >= 0x20) {
        /* The same rule for writes: dropped while the channel is playing
         * (Blargg dmg_sound 12). */
        if (!a->ch[2].enabled) { a->wave[i - 0x20] = v; return; }
        /* A write8 reaches here BEFORE apu_tick4 runs this machine cycle, so
         * the flag is stale by one cycle and cannot be used. Ask the timer
         * instead: the read falls in the upcoming SECOND tick exactly when the
         * first tick does not consume the remainder but the second does. Same
         * one-tick window, computed at the other phase -- the asymmetry is in
         * the core's bus, not in the APU, so the APU absorbs it rather than
         * asking for a seam change. */
        if (WAVE_CGB_RULE && a->dev_cgb) {
            a->wave[WAVE_CGB_WRITE_LOOKAHEAD ? (((a->wave_pos + 1) & 31) >> 1)
                                             : (a->wave_pos >> 1)] = v;
            return;
        }
        if (a->ch[2].timer > APU_TICK_T && a->ch[2].timer <= 2 * APU_TICK_T)
            /* The byte ABOUT TO BE read, not the current one. This path runs
             * before apu_tick4, so wave_pos still points at the previous
             * nibble; the read that this write coincides with is the next one.
             * The window condition above already looks ahead via the timer --
             * the target has to look ahead with it. Measured: Blargg 12 wrote
             * $F7 to byte 0 for us and byte 1 for the oracle. */
            a->wave[((a->wave_pos + 1) & 31) >> 1] = v;
        return;
    }
    if (i > 0x16) return;

    if (i == 0x16) {                                  /* NR52 */
        int on = (v & 0x80) != 0;
        if (on && !a->power) apu_power_on(a);
        else if (!on && a->power) apu_power_off(a);
        a->reg[0x16] = (unsigned char)(v & 0x80);
        return;
    }

    if (!a->power) {
        /* On DMG — and this is the DMG-specific half of the register model —
         * the length counters are unaffected by power and their load registers
         * stay writable while the APU is off. Everything else is ignored. */
        int is_len = (i == 0x01 || i == 0x06 || i == 0x0B || i == 0x10)
                     && !(APU_POWER_CGB_CLEARS_LEN && a->dev_cgb);
        if (!is_len) return;
        switch (i) {
            case 0x01: a->ch[0].length = 64 - (v & 0x3F); break;
            case 0x06: a->ch[1].length = 64 - (v & 0x3F); break;
            case 0x0B: a->ch[2].length = 256 - v;         break;
            case 0x10: a->ch[3].length = 64 - (v & 0x3F); break;
        }
        return;
    }

    a->reg[i] = v;
    switch (i) {
        case 0x00:                                    /* NR10 sweep */
            a->sw_pace  = (v >> 4) & 7;
            a->sw_dir   = (v >> 3) & 1;
            a->sw_shift = v & 7;
            /* Clearing the direction bit after a decrementing calculation has
             * been performed since the last trigger kills the channel. */
            if (!a->sw_dir && a->sw_neg_used) a->ch[0].enabled = 0;
            break;
        case 0x01:                                    /* NR11 */
#if DUTY_WRITE_DELAYED
            a->ch[0].duty_stage = 0x100 | ((v >> 6) & 3);
#else
            a->ch[0].duty = a->ch[0].duty_pending = (v >> 6) & 3;
#endif
            a->ch[0].length = 64 - (v & 0x3F);
            break;
        case 0x02:                                    /* NR12 */
            apu_write_nrx2(a, 0, v);
            break;
        case 0x03: a->ch[0].freq = (a->ch[0].freq & 0x700) | v; break;
        case 0x04: apu_write_nrx4(a, 0, v); break;

        case 0x06:
#if DUTY_WRITE_DELAYED
            a->ch[1].duty_stage = 0x100 | ((v >> 6) & 3);
#else
            a->ch[1].duty = a->ch[1].duty_pending = (v >> 6) & 3;
#endif
            a->ch[1].length = 64 - (v & 0x3F);
            break;
        case 0x07:
            apu_write_nrx2(a, 1, v);
            break;
        case 0x08: a->ch[1].freq = (a->ch[1].freq & 0x700) | v; break;
        case 0x09: apu_write_nrx4(a, 1, v); break;

        case 0x0A: apu_set_dac(a, 2, (v & 0x80) != 0); break;
        case 0x0B: a->ch[2].length = 256 - v; break;
        case 0x0C: a->wave_level = (v >> 5) & 3; break;
        case 0x0D: a->ch[2].freq = (a->ch[2].freq & 0x700) | v; break;
        case 0x0E: apu_write_nrx4(a, 2, v); break;

        case 0x10: a->ch[3].length = 64 - (v & 0x3F); break;
        case 0x11:
            apu_write_nrx2(a, 3, v);
            break;
        case 0x12:
#if NOISE_NR43_DEFER
            /* A write8 reaches apu_write BEFORE apu_tick4 runs this machine
             * cycle, so applying NR43 here lets THIS cycle's LFSR steps already
             * see the new width. Deferring puts the write at the end of the
             * cycle, where the bus leaves it. */
            a->ns_pending = 0x100 | v; break;
#endif
            a->ns_shift = (v >> 4) & 15;
            a->lfsr_w7  = (v >> 3) & 1;
            a->ns_div   = v & 7;
            break;
        case 0x13: apu_write_nrx4(a, 3, v); break;

        case 0x14: a->vol_l = (v >> 4) & 7; a->vol_r = v & 7; break;
        case 0x15: a->route = v; break;
        default: break;
    }
}

/* ------------------------------------------------------------------------ */
/*  One APU tick = 2 T-cycles.                                              */

static void apu_chan_tick(struct APU *a) {
#if SWEEP_KILL_DELAY_T
#if SWEEP_STEP_STOP_T
    /* The sweep STEP's own stop, landing where it was scheduled. Unlike
     * sw_kill this carries no shift guard: the step that scheduled it had
     * already performed its own calculation. */
    if (a->sw_stop > 0 && (a->sw_stop -= APU_TICK_T) <= 0) {
        a->sw_stop = 0;
        a->ch[0].enabled = 0;
    }
#endif
#if SWEEP_TRIG_VOID_T
    if (a->sw_trigvoid > 0) a->sw_trigvoid -= APU_TICK_T;
#endif
    if (a->sw_kill > 0 && (a->sw_kill -= APU_TICK_T) <= 0) {
        a->sw_kill = 0;
        /* The check is only performed at all when the shift is non-zero, and
         * it is performed WHEN IT LANDS, not when it was armed. That is the
         * whole of channel_1_sweep_restart's rounds 3-5: NR10 written before
         * the check lands with shift 0 voids it (the third round: the channel never
         * stops), with any non-zero shift does not (rounds 4 and 5, which stop
         * at the same cycle as an untouched NR10 would). */
        if (a->sw_shift) a->ch[0].enabled = 0;
    }
#endif
    for (int i = 0; i < 2; i++) {                     /* the two squares */
        struct APUChan *c = &a->ch[i];
        c->timer -= APU_TICK_T;
        while (c->timer <= 0) {
            c->timer += (2048 - c->freq) * 4;
#if DUTY_WRITE_DELAYED
            /* The sample just finished: a duty written during it takes effect
             * now. OUTSIDE the duty_clocking gate -- that gate is about the
             * step COUNTER, and a duty written before the channel's first
             * trigger must still be the duty it starts with.  It is outside
             * DUTY_STOPPED_HOLDS_PHASE for the same reason and by the same
             * argument: that gate is about the step COUNTER too, and a duty
             * written while the channel is stopped must still be the duty it
             * comes back with. */
            c->duty = c->duty_pending;
#endif
            if ((!DUTY_OFF_UNTIL_FIRST_TRIGGER || c->duty_clocking)
             && (!DUTY_STOPPED_HOLDS_PHASE || c->enabled)) {
                c->duty_pos = (c->duty_pos + 1) & 7;
                c->duty_zero_1st = 0;
            }
        }
    }
    {                                                 /* wave */
        struct APUChan *c = &a->ch[2];
        c->timer -= APU_TICK_T;
        while (c->timer <= 0) {
            c->timer += (2048 - c->freq) * 2;
            if (APU_WAVE_READS_ONLY_WHEN_ON && !c->enabled) continue;
            a->wave_pos = (a->wave_pos + 1) & 31;
            unsigned char b = a->wave[a->wave_pos >> 1];
            a->wave_last = (a->wave_pos & 1) ? (b & 15) : (b >> 4);
        }
    }
    a->ns_t = (a->ns_t + APU_TICK_T) & 7;   /* the free-running divisor phase */
    {                                                 /* noise */
        struct APUChan *c = &a->ch[3];
#if NOISE_COUNTER_MODEL
        /* (a) the mod-4 clock.  Nothing but power-on resets it. */
        a->ns_clk = (a->ns_clk + 1) & 3;
        /* (b) the divisor down-counter, examined at one phase -- and at a second
         *     phase too while the LATCHED divisor is 0, which is the whole of
         *     "code 0 runs at double rate". */
        if (a->ns_clk == NOISE_EXAM_PHASE
         || (a->ns_div == 0 && a->ns_clk == NOISE_EXAM_PHASE2)) {
            a->ns_down = (a->ns_down - 1) & 15;
            if (a->ns_down == 0) {
                a->ns_down = a->ns_div ? a->ns_div : 1;
                /* (c) the 14-bit up-counter, and the tap. */
                int prev = a->ns_up;
                a->ns_up = (a->ns_up + 1) & 0x3FFF;
                /* `ns_trig` still running means the trigger's start delay has
                 * not elapsed.  THE COUNTER RUNS; THE LFSR DOES NOT.  That is
                 * the same split the whole model rests on -- the divisor stage
                 * never stops, the shift register is what waits. */
                if (c->enabled && a->ns_trig == 0 && a->ns_shift < 14
                 && !((prev >> a->ns_shift) & 1)
                 && ((a->ns_up >> a->ns_shift) & 1)) {
                    int x = (a->lfsr ^ (a->lfsr >> 1)) & 1;
                    a->lfsr = (a->lfsr >> 1) | (x << 14);
                    if (a->lfsr_w7) a->lfsr = (a->lfsr & ~0x40) | (x << 6);
                }
            }
        }
        /* The trigger's start delay lands AFTER this tick's examination: the
         * write reaches the APU before the cycle's ticks run, and the reset it
         * asks for is the END of the delay, not its start. */
        if (a->ns_trig > 0 && (a->ns_trig -= APU_TICK_T) <= 0) {
            a->ns_trig = 0;
            a->ns_up = 0;
            a->ns_down = a->ns_div ? a->ns_div : 1;
        }
#else
        c->timer -= APU_TICK_T;
        while (c->timer <= 0) {
            c->timer += APU_NOISE_DIV[a->ns_div] << a->ns_shift;
            int x = (a->lfsr ^ (a->lfsr >> 1)) & 1;
            a->lfsr = (a->lfsr >> 1) | (x << 14);
            if (a->lfsr_w7) a->lfsr = (a->lfsr & ~0x40) | (x << 6);
        }
#endif
    }

    a->ch[0].out = (a->ch[0].enabled && a->ch[0].dac
                    && !(DUTY_OFF_UNTIL_FIRST_TRIGGER && a->ch[0].duty_zero_1st)
                    && APU_DUTY[a->ch[0].duty][a->ch[0].duty_pos]) ? a->ch[0].vol : 0;
    a->ch[1].out = (a->ch[1].enabled && a->ch[1].dac
                    && !(DUTY_OFF_UNTIL_FIRST_TRIGGER && a->ch[1].duty_zero_1st)
                    && APU_DUTY[a->ch[1].duty][a->ch[1].duty_pos]) ? a->ch[1].vol : 0;
    a->ch[2].out = (a->ch[2].enabled && a->ch[2].dac && a->wave_level)
                   ? (a->wave_last >> (a->wave_level - 1)) : 0;
    a->ch[3].out = (a->ch[3].enabled && a->ch[3].dac && !(a->lfsr & 1))
                   ? a->ch[3].vol : 0;
}

/* The DAC, and it is NOT a pass-through of the digital value.
 *
 * A powered DAC maps digital 0..15 onto the full analogue swing, so digital 0
 * is a RAIL, not silence; an unpowered DAC sits at the midpoint. That is the
 * difference between "the channel is quiet" and "the channel is off", and a
 * model that emits an unsigned 0..15 conflates them: the two are related by an
 * affine map only while the set of powered DACs is constant, and they diverge
 * at exactly the moment a game switches a DAC — which is the moment that
 * audibly clicks on real hardware.
 *
 * Measured on the oracle before this was written: with only channel 1's DAC
 * powered and the channel itself silent, its idle output sits at one full
 * channel amplitude, not at zero, and the note swings symmetrically about the
 * midpoint. Three DACs off contribute exactly nothing.
 *
 * Units: (2*d - 15) per powered channel, so -15..+15, times (volume+1) 1..8,
 * summed over the channels routed to that side: -480..+480. "480" is all four
 * channels at a rail with the master volume at 7. Pan Docs' polarity is used
 * (digital 0 = negative rail). */
static int apu_dac(struct APU *a, int i) {
    if (a->mute & (1 << i)) return 0;
    if (!a->ch[i].dac) return 0;
    return 2 * a->ch[i].out - 15;
}

static void apu_mix(struct APU *a, int *l, int *r) {
    int sl = 0, sr = 0;
    for (int i = 0; i < 4; i++) {
        int o = apu_dac(a, i);
        if (a->route & (0x10 << i)) sl += o;
        if (a->route & (1 << i))    sr += o;
    }
    *l = sl * (a->vol_l + 1);
    *r = sr * (a->vol_r + 1);
}

#if APU_HIGHPASS
/* One capacitor step per APU tick. out = in - charge, then the charge relaxes
 * toward the input: the standard first-order DC block, and what takes a
 * powered-DAC idle level off its rail and back to zero (which is the click in
 * sect. 14, closed at source rather than papered over in the shell). */
static void apu_hp_step(struct APU *a) {
    int l, r;
    apu_mix(a, &l, &r);
    double il = (double)l, ir = (double)r;
    double ol = il - a->hp_l, orr = ir - a->hp_r;
    a->hp_l = il - ol * APU_HP_CHARGE;
    a->hp_r = ir - orr * APU_HP_CHARGE;
    a->an_l = (int)ol;
    a->an_r = (int)orr;
}
/* Both consumers read the SAME filtered pair, because the capacitor advances
 * once per tick and not once per consumer. */
static void apu_output_pair(struct APU *a, int *l, int *r) {
    *l = a->an_l; *r = a->an_r;
}
#else
static void apu_output_pair(struct APU *a, int *l, int *r) { apu_mix(a, l, r); }
#endif

#ifdef GB_NATIVE
static struct APU *g_apu_tap;
static short *g_cap;
static long   g_cap_cap, g_cap_n;
static int    g_cap_period, g_cap_t;
static long   g_acc_l, g_acc_r, g_acc_n;

/* Box-average every APU tick down to the harness's output rate. At the
 * instrument's exact-comparison rate the period is one tick and this is a
 * pass-through; at an audio rate it is the anti-alias filter, applied to our
 * side only because the oracle applies its own -- which is precisely why the
 * instrument measures its floor rather than assuming one. */
static void apu_capture(struct APU *a) {
    if (!g_cap || !g_cap_period) return;
    int l, r;
    apu_output_pair(a, &l, &r);
    g_acc_l += l; g_acc_r += r; g_acc_n++;
    g_cap_t += APU_TICK_T;
    if (g_cap_t < g_cap_period) return;
    g_cap_t -= g_cap_period;
    if (g_cap_n + 2 <= g_cap_cap) {
        long n = g_acc_n ? g_acc_n : 1;
        /* 480 is full scale (apu_mix); 32767/480 puts the WAV in the units the
         * instrument defines, without adopting the oracle's constants. */
        g_cap[g_cap_n++] = (short)(((long long)g_acc_l * 32767) / (480LL * n));
        g_cap[g_cap_n++] = (short)(((long long)g_acc_r * 32767) / (480LL * n));
    }
    g_acc_l = g_acc_r = 0; g_acc_n = 0;
}
#endif

/* ---- Host audio output ---------------------------------------------------
 *
 * The shell PULLS. There is no callback into host code from inside the
 * emulation path, because a callback would make the core's timing depend on
 * the host's scheduler, and because a pull API has nothing to allocate, no
 * queue to own and no lifetime to get wrong.
 *
 * The full contract the shell needs is in the audio design 6.6. In short:
 * interleaved stereo int16, host-endian, L then R; +-32767 is all four
 * channels at a DAC rail with the master volume at 7; a short read is normal
 * and zero is normal; on overflow the OLDEST frames are dropped, because in an
 * audio pipeline stale samples are worse than a discontinuity.
 */
static void apu_out(struct APU *a) {
    if (!a->out_step) return;
    int l, r;
    apu_output_pair(a, &l, &r);
#if APU_HOST_DCBLOCK
    {   /* the output capacitor, per tick (APU_HOST_DCBLOCK in apu.h); the
         * charge per model is APU_HOST_HP_PER_MODEL. A tick is 2 T of the
         * 4194304 Hz clock at either CGB speed (APU_NTICKS), so one per-tick
         * factor serves both speeds. */
        const double k = (APU_HOST_HP_PER_MODEL && a->dev_cgb) ? APU_HP_CHARGE_CGB
                                                                : APU_HP_CHARGE;
        double ol = (double)l - a->hb_l, orr = (double)r - a->hb_r;
        a->hb_l = (double)l - ol * k;
        a->hb_r = (double)r - orr * k;
        l = (int)ol; r = (int)orr;
    }
#endif
    a->out_l += l; a->out_r += r; a->out_n++;
    a->out_acc += (unsigned)(APU_TICK_T << 16);
    if (a->out_acc < a->out_step) return;
    a->out_acc -= a->out_step;

    int n = a->out_n ? a->out_n : 1;
    /* 64-bit intermediate deliberately: 480 * n * 32767 passes 2^31 once n
     * exceeds about 136 accumulated ticks, which a low host rate reaches. */
    long long wl = ((long long)a->out_l * 32767) / (APU_HOST_FS * n);
    long long wr = ((long long)a->out_r * 32767) / (APU_HOST_FS * n);
#if APU_HOST_DCBLOCK
    /* Centred, the swing can reach twice the rail-to-rail half (a full positive
     * step after a long rail-low silence). With APU_HOST_HEADROOM the scale
     * already covers that bound and this never fires (au.c counts it); it stays
     * as the guard for the off arm: saturate, never wrap. */
    if (wl > 32767) wl = 32767; else if (wl < -32767) wl = -32767;
    if (wr > 32767) wr = 32767; else if (wr < -32767) wr = -32767;
#endif
    short vl = (short)wl, vr = (short)wr;
    a->out_l = a->out_r = 0; a->out_n = 0;

    int nx = (a->ring_head + 1) & (APU_RING - 1);
    if (nx == a->ring_tail) {                 /* full: drop the oldest frame */
        a->ring_tail = (a->ring_tail + 1) & (APU_RING - 1);
        if (a->ring_dropped != 0xFFFFFFFFu) a->ring_dropped++;
    }
    a->ring[a->ring_head * 2]     = vl;
    a->ring[a->ring_head * 2 + 1] = vr;
    a->ring_head = nx;
}

/* Drain up to `frames` stereo frames into the caller's buffer; returns how many
 * were actually written, which may be fewer, including zero. `rate` is passed
 * on every call rather than set once: it removes an initialisation order the
 * shell would otherwise have to get right, it survives gb_reset() without the
 * shell knowing a reset happened, and re-deriving the period is a division the
 * caller makes at most once per audio block. rate <= 0 idles the output. */
static int apu_pull(struct APU *a, short *dst, int frames, int rate) {
    if (rate <= 0) { a->out_step = 0; a->out_rate = 0; return 0; }
    if ((unsigned)rate != a->out_rate) {
        a->out_rate = (unsigned)rate;
        a->out_step = (unsigned)((4194304ULL << 16) / (unsigned)rate);
        a->out_acc = 0;
    }
    int n = 0;
    while (n < frames && a->ring_tail != a->ring_head) {
        dst[n * 2]     = a->ring[a->ring_tail * 2];
        dst[n * 2 + 1] = a->ring[a->ring_tail * 2 + 1];
        a->ring_tail = (a->ring_tail + 1) & (APU_RING - 1);
        n++;
    }
    return n;
}

/* Called once per machine cycle, AFTER the core's four timer ticks, with the
 * core's 16-bit DIV counter. The frame sequencer is clocked by the falling
 * edge of DIV bit 4 — bit 12 of that counter — on real hardware, so it is
 * clocked by it here rather than by a divider of the APU's own. */
/* SPSW_APU (7 Nov 2026), 0 = none of this.  MECHANISM, read in the
 * AGE emulator and on his spsw-ch2-lc-delay table: the first switch to double
 * speed delays the frame sequencer by one machine cycle, the next takes the delay
 * away, and so on; a divider write keeps it; sound off clears it, and with sound
 * off a switch does not touch it.  Kept in the spare bits of div_bit (bit 0 the
 * last sampled bit, bit 1 the delay, bit 2 "the divider was just written"), so
 * the context and old save states keep their size. */
static void apu_after_speed_switch(struct APU *a, int dbl) {
    if (SPSW_APU && a->power && dbl) a->div_bit ^= 2;
}
static void apu_div_written(struct APU *a) {
    if (SPSW_APU && (a->div_bit & 2)) a->div_bit |= 4;
}
/* The switch's own divider reset: if the clocking bit rose on exactly this
 * machine cycle there is no immediate step (AGE: "sound STOP glitch"). */
static void apu_stop_div_glitch(struct APU *a, unsigned int div_counter) {
    if (!SPSW_APU) return;
    int shift = (APU_DIV_BIT_SPEED && a->dev_cgb && a->dev_speed) ? 13 : 12;
    if ((div_counter & ((2u << shift) - 1)) == (1u << shift)) a->div_bit &= ~1;
}

static void apu_tick4(struct APU *a, unsigned int div_counter) {
    int shift = (APU_DIV_BIT_SPEED && a->dev_cgb && a->dev_speed) ? 13 : 12;
    if (SPSW_APU && (a->div_bit & 2) && a->dev_speed) {
        /* The frame sequencer sees the divider one machine cycle late. */
        if (div_counter >= 4) { a->div_bit &= ~4; div_counter -= 4; }
        else if (a->div_bit & 4) div_counter = 0;
        else div_counter = (div_counter - 4) & 0xFFFF;
    }
    int bit = (div_counter >> shift) & 1;
    if ((SPSW_APU ? (a->div_bit & 1) : a->div_bit) && !bit && a->power) {
        if (a->div_skip) a->div_skip = 0;   /* the skipped first event */
        else apu_frame_step(a);
    }
    a->div_bit = SPSW_APU ? ((a->div_bit & ~1) | bit) : bit;

    /* Two ticks per machine cycle at single speed; ONE in CGB double speed,
     * where the machine cycle is half as long in real time. See
     * APU_SPEED_TICKS. */
    const int nticks = APU_NTICKS(a);
    for (int t = 0; t < nticks; t++) {
        int wpos = a->wave_pos;
        if (!(APU_OFF_STOPS_CHANNELS && !a->power)) apu_chan_tick(a);
        /* Bus accesses land at the END of the machine cycle, so only a read in
         * the LAST tick can coincide with one. */
        if (t == nticks - 1) a->wave_read_2nd = (a->wave_pos != wpos);
        else if (a->wave_pos != wpos) a->wave_read_2nd = 0;
#if APU_HIGHPASS
        apu_hp_step(a);
#endif
        apu_out(a);
#ifdef GB_NATIVE
        apu_capture(a);
#endif
    }
#if DUTY_WRITE_DELAYED
    /* The bus leaves a duty write at the END of the machine cycle, so it is
     * not yet pending while this cycle's own sample boundary is processed. */
    for (int i = 0; i < 2; i++)
        if (a->ch[i].duty_stage) {
            a->ch[i].duty_pending = a->ch[i].duty_stage & 3;
            a->ch[i].duty_stage = 0;
        }
#endif
#if NOISE_NR43_DEFER
    if (a->ns_pending) {
        unsigned char v = (unsigned char)(a->ns_pending & 0xFF);
        a->ns_shift = (v >> 4) & 15;
        a->lfsr_w7  = (v >> 3) & 1;
        a->ns_div   = v & 7;
#if NOISE_COUNTER_MODEL
        /* A NONZERO divisor is applied instantly and reloads the down-counter.
         * A ZERO divisor takes the counter back to double-rate examination and
         * leaves the residual alone.  ***THE UP-COUNTER IS NEVER TOUCHED HERE***
         * -- that is the whole hypothesis, and the residual the reload leaves is
         * what makes a later write produce an earlier step. */
        if (a->ns_div) a->ns_down = a->ns_div;
#endif
        a->ns_pending = 0;
    }
#endif
}

/* ------------------------------------------------------------------------ */

#ifdef GB_NATIVE
/* Native harness tap. Diagnostic only and native-only, in the same spirit as
 * gb.c's forensic globals: it exists so our audio_main test can arm capture and
 * mute a channel at the mixer without knowing `struct GB`'s layout, which is
 * the PPU file. The wasm build never compiles any of it.
 *
 * The sink lives HERE, in file scope, and not in `struct APU` — see the note at
 * the foot of apu.h. A host pointer inside the emulator context would be a
 * dangling pointer the moment a save state restored it. Audio transport is not
 * machine state. */
void apu_tap_arm(short *buf, long cap_shorts, int t_per_sample);
long apu_tap_count(void);
void apu_tap_mute(int mask);
int apu_tap_pull(short *dst, int frames, int rate);

void apu_tap_arm(short *buf, long cap_shorts, int t_per_sample) {
    g_cap = buf; g_cap_cap = cap_shorts; g_cap_n = 0;
    g_cap_period = t_per_sample; g_cap_t = 0;
    g_acc_l = g_acc_r = g_acc_n = 0;
}
long apu_tap_count(void) { return g_cap_n; }
/* The shell's pull path, reachable from the native harness so the contract in
 * the audio design 6.6 can be TESTED before the UI builds on it. */
int apu_tap_pull(short *dst, int frames, int rate) {
    return g_apu_tap ? apu_pull(g_apu_tap, dst, frames, rate) : 0;
}
void apu_tap_mute(int mask) { if (g_apu_tap) g_apu_tap->mute = mask; }
#endif

/* post_boot = 1 when the core is starting from its hand-initialised post-boot
 * table (no BIOS supplied); 0 when the real boot program is about to run and
 * will power the APU up itself.
 *
 * Deviation, stated rather than hidden: hardware reads NR52 = 0xF1 at handoff
 * because the boot chime's last note is still decaying. Reproducing a decaying
 * note from a table would be fitting a number, so the table sets the register
 * values and leaves every channel silent — NR52 reads 0xF0. Nothing in the net
 * observes it (boot_hwio-dmgABCmgb is defect D2 and already fails); the BIOS
 * path earns the real value. */
static void apu_reset(struct APU *a, int post_boot) {
    int mute = a->mute;
    int dev_cgb = a->dev_cgb;
    int dev_speed = a->dev_speed;
    for (unsigned i = 0; i < sizeof(struct APU); i++) ((unsigned char *)a)[i] = 0;
    a->mute = mute;
    a->dev_cgb = dev_cgb;
    a->dev_speed = dev_speed;

    a->lfsr = 0x7FFF;
    a->seq_step = 7;
    for (int i = 0; i < 4; i++) a->ch[i].timer = apu_period(a, i);
#if NOISE_COUNTER_MODEL
    /* Same state apu_power_on() installs: the down-counter comes up LOADED.
     * Without this, a cold reset that never sees an NR52 power cycle starts the
     * counter sixteen examinations from its first expiry, because 0 decrements
     * to 15.  Every samesuite cartridge power-cycles, so nothing in the pool
     * sees it -- which is exactly why it is written here rather than left. */
    a->ns_down = 1;
#endif

    if (post_boot) {
        a->power = 1;
        a->reg[0x00] = 0x80; a->reg[0x01] = 0xBF; a->reg[0x02] = 0xF3;
        a->reg[0x04] = 0xBF; a->reg[0x06] = 0x3F; a->reg[0x07] = 0x00;
        a->reg[0x09] = 0xBF; a->reg[0x0A] = 0x7F; a->reg[0x0B] = 0xFF;
        a->reg[0x0C] = 0x9F; a->reg[0x0E] = 0xBF; a->reg[0x10] = 0xFF;
        a->reg[0x11] = 0x00; a->reg[0x12] = 0x00; a->reg[0x13] = 0xBF;
        a->reg[0x14] = 0x77; a->reg[0x15] = 0xF3; a->reg[0x16] = 0x80;
        a->ch[0].duty = a->ch[0].duty_pending = 2;
        a->ch[0].vol_init = 15; a->ch[0].env_pace = 3;
        a->ch[0].dac = 1;
#if APU_BOOT_CH1_ON
        /* The boot program's start-up sound triggered channel 1 and left it on,
         * decayed to volume 0: FF26 reads F1.  See APU_BOOT_CH1_ON. */
        a->ch[0].enabled = 1;
        a->ch[0].vol = 0;
        a->ch[0].duty_clocking = 1;
#endif
        a->vol_l = 7; a->vol_r = 7; a->route = 0xF3;
    }
#ifdef GB_NATIVE
    g_apu_tap = a;
#endif
}
