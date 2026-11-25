// play/cores/n64/rumble.mjs: the Rumble Pak's motor on the player's own pad. It runs on the PAGE (the Gamepad API is a
// page's, not a worker's), in the site's form for a display effect of an artwork (play/cores/gb/art.mjs has the Game
// Boy's): an effect { id, options, attach({ presenter, core, live }) } whose frame() the host calls each frame. It reads
// core.rumble, the module's level of the motor from 0 to 1,000 (core.mjs: the share of the last six fields in which the
// motor ran), and nothing of the machine.
//
// WHAT CHROME OFFERS (157, desktop and Android): a connected pad's vibrationActuator, a GamepadHapticActuator, with
// playEffect("dual-rumble", { duration, startDelay, strongMagnitude, weakMagnitude }) for the two motors most pads have,
// "trigger-rumble" for the triggers' own motors of an Xbox pad on Windows, reset(), and effects, the list of the kinds a
// pad can play (canPlay was taken out). A new playEffect replaces the one playing. A pad without motors, or one the
// browser cannot drive, has no actuator or lists no "dual-rumble". Where no pad can vibrate, a phone's own motor
// (navigator.vibrate, Chrome on Android; nothing on a desktop) stands in, as the site does for the Game Boy.
//
// The console's Rumble Pak has one motor with a weight off its centre: both of a pad's motors are driven, the large
// one with the level and the small one with half of it. An effect is asked for 120 ms and asked again every 90 ms while
// the level holds, so a page that stalls lets the pad stop by itself; a level of 0 stops it at once (reset).

export const KICK_MS = 120, AGAIN_MS = 90;

// The driver, apart from the page so a check can give it stand-ins: pads() the connected pads, vibrate(ms) a phone's
// own motor or null, now() in ms. fault 1352, wrong on purpose: a pad that lists "dual-rumble" is passed over.
export function makeRumble({ pads, vibrate = null, now = () => performance.now(), fault = 0 }) {
  let buzzing = false, lastKick = -1e9, lastLevel = 0, phone = false;
  const stats = { starts: 0, kicks: 0, phone: 0, stops: 0 };
  const canRumble = (g) => !!g?.vibrationActuator && typeof g.vibrationActuator.playEffect === "function" && (!Array.isArray(g.vibrationActuator.effects) || (fault !== 1352 && g.vibrationActuator.effects.includes("dual-rumble")));
  const able = () => { try { return Array.from(pads() ?? []).filter((g) => g && g.connected && canRumble(g)); } catch { return []; } };
  function kick(level) {
    const ps = able(), strong = Math.max(0.25, Math.min(1, level / 1000));
    for (const g of ps) { try { const p = g.vibrationActuator.playEffect("dual-rumble", { startDelay: 0, duration: KICK_MS, strongMagnitude: strong, weakMagnitude: strong / 2 }); p?.catch?.(() => {}); stats.kicks++; } catch {} }
    phone = !ps.length && !!vibrate;
    if (phone) { try { vibrate(KICK_MS - 10); stats.phone++; } catch {} }
  }
  function stop() {
    if (!buzzing) return;
    for (const g of able()) { try { g.vibrationActuator.reset()?.catch?.(() => {}); } catch {} }
    if (phone && vibrate) { try { vibrate(0); } catch {} }
    buzzing = false; phone = false; stats.stops++;
  }
  return {
    stats, stop,
    // One frame of the page: the motor's level now.
    frame(level) {
      level = Math.max(0, Math.min(1000, Number(level) || 0));
      if (level <= 0) { stop(); lastLevel = 0; return; }
      const t = now();
      if (!buzzing) { buzzing = true; stats.starts++; lastKick = -1e9; }
      if (t - lastKick >= AGAIN_MS || level !== lastLevel) { lastKick = t; kick(level); }
      lastLevel = level;
    },
  };
}

// The site's effect. One setting, kept for the console: whether the pad vibrates at all.
export const rumbleEffect = {
  id: "rumble",
  options: [{ id: "n64Rumble", label: "Rumble", help: "Vibrate the controller (or the phone) while a Rumble Pak's motor runs. Choose a Rumble Pak for controller 1's slot in the game's settings", type: "bool", default: true, key: "n64.rumble", group: "display", scope: "console" }],
  attach({ core, live }) {
    const phoneMotor = (ms) => { if (typeof navigator !== "undefined" && navigator.vibrate && matchMedia("(pointer: coarse)").matches) navigator.vibrate(ms); };
    const drive = makeRumble({ pads: () => (typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : []), vibrate: phoneMotor });
    let on = true;
    return {
      stats: drive.stats,
      setOption(id, v) { if (id === "n64Rumble") { on = !!v; if (!on) drive.stop(); } },
      frame() { const c = core(); drive.frame(on && live() && c ? c.rumble | 0 : 0); },
    };
  },
};
export const effects = [rumbleEffect];
// No artwork of its own: the host's describe() of an artwork module is answered with none.
export const describe = async () => null;
