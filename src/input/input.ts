import { NO_INPUT, type HeroInput } from '../game/state';

/**
 * Two thumbs and a keyboard, Höyry's way with one more verb.
 *
 * Touch: a touch that starts on the left half is the move stick, its base
 * where the thumb lands. A touch on the right half is the weapon: lift
 * quickly without dragging and it attacks the nearest enemy; drag and an
 * aim shows, lift and it attacks along it; keep the thumb down without
 * dragging and it is the hold verb (the bow draws, the sword blocks),
 * released when the thumb lifts. Buttons marked `data-ui` (techniques,
 * potion, swap, take, pause) are left to React.
 *
 * Keyboard and mouse: WASD or arrows walk, the mouse aims, the left button
 * attacks on a click and holds on a press, Q swaps, 1 and 2 are the
 * techniques, R drinks, E takes, M the map, I the pack, C the character,
 * T the tree, Esc pauses.
 *
 * Attack, release and the buttons are edges: `read` returns them once.
 */
export interface Stick {
  active: boolean;
  cx: number;
  cy: number;
  x: number;
  y: number;
  touchId: number | null;
  dragged: boolean;
  since: number;
}

const TAP = 0.22;
const newStick = (): Stick => ({ active: false, cx: 0, cy: 0, x: 0, y: 0, touchId: null, dragged: false, since: 0 });

export class InputController {
  readonly move = newStick();
  readonly aim = newStick();
  readonly radius = 64;
  heroScreen = { x: 0, y: 0, scale: 1 };
  range = 300;
  private keys = new Set<string>();
  private attackEdge = false;
  private releaseEdge = false;
  private attackAim = { x: 0, y: 0 };
  private techEdge: [boolean, boolean] = [false, false];
  private potionEdge = false;
  private swapEdge = false;
  private takeEdge = false;
  private mouse = { x: 0, y: 0, down: false, since: 0, seen: false };
  /** keys pressed this step, for the screens: m, i, c, t, escape */
  private keyEdges = new Set<string>();
  usedTouch = false;
  private el: HTMLElement | null = null;

  private onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (e.type === 'keydown') {
      if (!this.keys.has(k)) {
        if (k === 'q') this.swapEdge = true;
        if (k === '1') this.techEdge[0] = true;
        if (k === '2') this.techEdge[1] = true;
        if (k === 'r') this.potionEdge = true;
        if (k === 'e' || k === 'f') this.takeEdge = true;
        this.keyEdges.add(k);
      }
      this.keys.add(k);
    } else this.keys.delete(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  };

  private mouseAim(): { x: number; y: number } {
    const h = this.heroScreen;
    const dx = (this.mouse.x - h.x) / h.scale;
    const dy = (this.mouse.y - h.y) / h.scale;
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, Math.max(0.25, d / this.range));
    return { x: (dx / d) * reach, y: (dy / d) * reach };
  }

  private onMouseMove = (e: MouseEvent) => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.mouse.seen = true;
  };
  private onMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-ui], button, .overlay')) return;
    this.onMouseMove(e);
    if (e.button === 0) {
      this.mouse.down = true;
      this.mouse.since = performance.now();
    }
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button !== 0 || !this.mouse.down) return;
    this.mouse.down = false;
    const held = (performance.now() - this.mouse.since) / 1000;
    if (held < TAP) {
      this.attackEdge = true;
      this.attackAim = this.mouseAim();
    } else {
      this.releaseEdge = true;
      this.attackAim = this.mouseAim();
    }
  };
  private onContext = (e: Event) => e.preventDefault();

  private onTouchStart = (e: TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-ui], button, .overlay')) return;
    this.usedTouch = true;
    const w = this.el?.clientWidth || window.innerWidth;
    for (const t of Array.from(e.changedTouches)) {
      const st = t.clientX < w / 2 ? this.move : this.aim;
      if (st.touchId !== null) continue;
      st.touchId = t.identifier;
      st.active = true;
      st.dragged = false;
      st.cx = t.clientX;
      st.cy = t.clientY;
      st.x = t.clientX;
      st.y = t.clientY;
      st.since = performance.now();
    }
    e.preventDefault();
  };

  private onTouchMove = (e: TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-ui], button, .overlay')) return;
    for (const t of Array.from(e.changedTouches)) {
      for (const st of [this.move, this.aim]) {
        if (st.touchId !== t.identifier) continue;
        st.x = t.clientX;
        st.y = t.clientY;
        if (Math.hypot(st.x - st.cx, st.y - st.cy) > 16) st.dragged = true;
      }
    }
    e.preventDefault();
  };

  private onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      for (const st of [this.move, this.aim]) {
        if (st.touchId !== t.identifier) continue;
        st.touchId = null;
        st.active = false;
        if (st === this.aim) {
          // a thumb down longer than a tap was a hold, whether or not it
          // drifted: the release fires the charge along the drag if there
          // was one, else at the nearest enemy; a quick lift is a tap, a
          // quick drag an aimed attack
          const held = (performance.now() - st.since) / 1000;
          const vec = st.dragged ? this.stickVec(st) : { x: 0, y: 0 };
          if (held >= TAP) {
            this.releaseEdge = true;
            this.attackAim = vec;
          } else {
            this.attackEdge = true;
            this.attackAim = vec;
          }
        }
        st.dragged = false;
      }
    }
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouse.down = false;
  };

  private stickVec(st: Stick): { x: number; y: number } {
    const dx = (st.x - st.cx) / this.radius;
    const dy = (st.y - st.cy) / this.radius;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return { x: 0, y: 0 };
    const m = Math.min(1, d);
    return { x: (dx / d) * m, y: (dy / d) * m };
  }

  attach(el: HTMLElement): void {
    this.el = el;
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    el.addEventListener('touchstart', this.onTouchStart, { passive: false });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd);
    el.addEventListener('touchcancel', this.onTouchEnd);
    el.addEventListener('mousemove', this.onMouseMove);
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    el.addEventListener('contextmenu', this.onContext);
    window.addEventListener('blur', this.onBlur);
  }

  detach(el: HTMLElement): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove', this.onTouchMove);
    el.removeEventListener('touchend', this.onTouchEnd);
    el.removeEventListener('touchcancel', this.onTouchEnd);
    el.removeEventListener('mousemove', this.onMouseMove);
    el.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    el.removeEventListener('contextmenu', this.onContext);
    window.removeEventListener('blur', this.onBlur);
    this.el = null;
  }

  swap(): void {
    this.swapEdge = true;
  }
  take(): void {
    this.takeEdge = true;
  }
  tech(i: 0 | 1): void {
    this.techEdge[i] = true;
  }
  potion(): void {
    this.potionEdge = true;
  }

  /** One step of input. Edges are consumed. */
  read(): HeroInput {
    const inp: HeroInput = { ...NO_INPUT, tech: [false, false] };
    if (this.move.active) {
      const v = this.stickVec(this.move);
      const d = Math.hypot(v.x, v.y);
      if (d > 0.12) {
        const m = Math.min(1, (d - 0.12) / 0.6);
        inp.mx = (v.x / d) * m;
        inp.my = (v.y / d) * m;
      }
    } else {
      const k = this.keys;
      let dx = 0;
      let dy = 0;
      if (k.has('a') || k.has('arrowleft')) dx -= 1;
      if (k.has('d') || k.has('arrowright')) dx += 1;
      if (k.has('w') || k.has('arrowup')) dy -= 1;
      if (k.has('s') || k.has('arrowdown')) dy += 1;
      const d = Math.hypot(dx, dy);
      if (d) {
        inp.mx = dx / d;
        inp.my = dy / d;
      }
    }
    const now = performance.now();
    if (this.aim.active) {
      // the right thumb down: a hold once past the tap time, and the drag
      // (if any) is the aim while it holds, so a drift never drops a charge
      if (this.aim.dragged) {
        const v = this.stickVec(this.aim);
        inp.aiming = true;
        inp.aimX = v.x;
        inp.aimY = v.y;
      }
      if ((now - this.aim.since) / 1000 >= TAP) inp.hold = true;
    } else if (this.mouse.seen && !this.usedTouch) {
      const v = this.mouseAim();
      inp.aiming = true;
      inp.aimX = v.x;
      inp.aimY = v.y;
      if (this.mouse.down && (now - this.mouse.since) / 1000 >= TAP) inp.hold = true;
    }
    if (this.attackEdge) {
      inp.attack = true;
      inp.aimX = this.attackAim.x;
      inp.aimY = this.attackAim.y;
      this.attackEdge = false;
    }
    if (this.releaseEdge) {
      inp.holdRelease = true;
      inp.aimX = this.attackAim.x;
      inp.aimY = this.attackAim.y;
      this.releaseEdge = false;
    }
    inp.tech = [this.techEdge[0], this.techEdge[1]];
    this.techEdge = [false, false];
    inp.potion = this.potionEdge;
    inp.swap = this.swapEdge;
    inp.take = this.takeEdge;
    this.potionEdge = false;
    this.swapEdge = false;
    this.takeEdge = false;
    return inp;
  }

  pressed(key: string): boolean {
    return this.keys.has(key);
  }

  /** A key that went down since the last call, consumed. */
  edge(key: string): boolean {
    if (!this.keyEdges.has(key)) return false;
    this.keyEdges.delete(key);
    return true;
  }
}
