import { useEffect, useRef, useState } from 'react';
import { DT, step, takeInto, wearFrom, packFrom, startFloor, whereOldGoes, whereWord, PACK_SIZE, countItems, isWeapon, spawn } from '../game/sim';
import { Choice } from './Compare';
import { generateDungeon } from '../game/dungeon';
import type { SimState } from '../game/state';
import { Renderer } from '../render/renderer';
import { InputController } from '../input/input';
import { audio } from '../audio';
import { Rng } from '../game/rng';
import { botInput, botSpend, BOT, HUMAN } from '../../tools/autoplayer';
import { t, tr } from '../i18n';
import { RARITY_COLOR, isMelee, kindIcon, makePotion, rollCoat, rollWeapon, type Item, type MeleeKind } from '../game/items';
import { dropItem } from '../game/combat';
import { NODE_BY_ID } from '../game/content/tree';
import { held, heroStats, fighterOf } from '../game/hero';
import { xpToNext, buildName } from '../game/skills';
import { ItemCard } from './Cards';
import { Sheets, type Tab } from './Sheets';
import { UpdateBanner } from './Update';
import { GuideBody } from './Guide';
import { clearSave, writeSave } from '../records';

export interface RunSummary {
  floor: number;
  level: number;
  time: number;
  kills: number;
  build: string;
  won: boolean;
  seed: number;
}

interface Hud {
  floor: number;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  points: number;
  hands: { item: Item | null; active: boolean }[];
  techs: { id: string | null; name: string; icon: string; cd: number; ready: boolean; usable: boolean }[];
  potions: number;
  packCount: number;
  near: Item | null;
  nearVs: Item | null;
  log: { text: string; color: string; age: number }[];
  banner: { text: string; sub: string; color?: string } | null;
  toast: { text: string; color: string } | null;
  boss: { name: string; hp: number; max: number } | null;
  buffs: string[];
}

type Overlay = { kind: 'none' } | { kind: 'pause' } | { kind: 'sheet'; tab: Tab } | { kind: 'guide' } | { kind: 'loot'; id: number };

function ConfirmButton({ className, label, sure, onConfirm }: { className: string; label: string; sure: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button className={armed ? `${className} danger` : className} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? sure : label}
    </button>
  );
}

export function Game({ sim, onEnd, onQuit }: { sim: SimState; onEnd: (r: RunSummary) => void; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const moveStickRef = useRef<HTMLDivElement>(null);
  const aimStickRef = useRef<HTMLDivElement>(null);
  const moveZoneRef = useRef<HTMLDivElement>(null);
  const aimZoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputController | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const overlayRef = useRef<Overlay>({ kind: 'none' });
  const [overlay, setOverlayState] = useState<Overlay>({ kind: 'none' });
  const [hud, setHud] = useState<Hud | null>(null);
  const [muted, setMuted] = useState(audio.muted);
  const [, setTick] = useState(0);
  const endedRef = useRef(false);
  const s = sim;

  const setOverlay = (o: Overlay) => {
    overlayRef.current = o;
    setOverlayState(o);
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const root = rootRef.current!;
    (window as unknown as { __sim: SimState }).__sim = s;
    // For scripts/floor-shots.mjs: jump floors and reveal them.
    (window as unknown as { __gen: typeof generateDungeon; __start: typeof startFloor }).__gen = generateDungeon;
    (window as unknown as { __gen: typeof generateDungeon; __start: typeof startFloor }).__start = startFloor;
    // For scripts/floor-shots.mjs: the whole floor as remembered.
    (window as unknown as { __reveal: () => void }).__reveal = () => {
      const d = s.dungeon;
      for (let i = 0; i < d.seen.length; i++) if (d.tiles[i] !== 0 && d.seen[i] === 0) d.seen[i] = 1;
    };
    // For the layout checks: where the hero is drawn, in css px.
    (window as unknown as { __heroScreen: () => { x: number; y: number } }).__heroScreen = () => renderer.toScreen(s.hero.x, s.hero.y);
    // For scripts/arsenal-shots.mjs: a rolled weapon, and a dummy beside the hero.
    (window as unknown as { __roll: (kind: MeleeKind | 'bow', level: number, rarity: number) => Item }).__roll = (kind, level, rarity) => rollWeapon(s.rng, kind, level, rarity);
    (window as unknown as { __dummy: (kind: string, dx: number, dy: number) => void }).__dummy = (kind, dx, dy) => {
      const e = spawn(s, kind, s.hero.x + dx, s.hero.y + dy, -1, false);
      e.hp = 1e9;
      e.maxHp = 1e9;
      e.mode = 'sleep';
    };
    // For scripts/loot-check.mjs: every item the run holds, and a rolled item under the hero.
    (window as unknown as { __count: () => number }).__count = () => countItems(s);
    (window as unknown as { __drop: (kind: MeleeKind | 'bow' | 'coat' | 'potion', rarity?: number) => void }).__drop = (kind, rarity = 0) => {
      const h = s.hero;
      const it = kind === 'coat' ? rollCoat(s.rng, s.floor, rarity) : kind === 'potion' ? makePotion('heal', s.potionColors) : rollWeapon(s.rng, kind, s.floor, rarity);
      dropItem(s, h.x, h.y, it);
    };
    const renderer = new Renderer(canvas);
    rendererRef.current = renderer;
    s.view = renderer.view();
    const input = new InputController();
    input.attach(root);
    inputRef.current = input;
    audio.unlock();
    audio.startMusic();
    if (s.saveBlob) writeSave(s.saveBlob);

    let wake: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (window.top === window) nav.wakeLock?.request('screen').then((l) => (wake = l)).catch(() => undefined);

    const onResize = () => {
      renderer.resize();
      s.view = renderer.view();
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);

    const params = new URLSearchParams(location.search);
    const botKind = params.get('bot');
    const bot = botKind === '1' || botKind === 'human';
    const who = botKind === 'human' ? HUMAN : BOT;
    const speed = Math.max(1, Number(params.get('speed') ?? 1));
    const botRng = new Rng(s.seed ^ 0x5151);
    const perf = { frames: 0, ms: 0, worst: 0 };
    (window as unknown as { __perf: typeof perf }).__perf = perf;

    const publishHud = () => {
      const h = s.hero;
      const st = heroStats(h);
      const boss = s.enemies.find((e) => e.def.boss && !e.dead && e.aware);
      const near = h.near !== null ? (s.drops.find((d) => d.id === h.near)?.item ?? null) : null;
      const it = held(h);
      const heal = h.pack.find((x) => x.kind === 'potion' && x.potion === 'heal');
      setHud({
        floor: s.floor,
        level: h.level,
        xp: h.xp / xpToNext(h.level),
        hp: Math.max(0, Math.round(h.hp)),
        maxHp: st.maxHp,
        points: h.points,
        hands: h.hands.map((item, i) => ({ item, active: i === h.active })),
        techs: h.techs.map((id) => {
          if (!id) return { id, name: '', icon: '', cd: 0, ready: false, usable: false };
          const d = NODE_BY_ID[id];
          const cd = (h.cooldowns[id] ?? 0) / d.cooldown;
          const usable = d.row === 'lahi' ? !!it && isMelee(it.kind) : d.row === 'jousi' ? it?.kind === 'bow' : true;
          return { id, name: t(d.name), icon: d.icon, cd, ready: cd <= 0 && usable, usable };
        }),
        potions: heal?.count ?? 0,
        packCount: h.pack.length,
        near,
        nearVs: near ? (near.kind === 'coat' ? h.coat : near.kind === 'potion' ? null : (h.hands.find((x) => x?.kind === near.kind) ?? it)) : null,
        log: s.log.slice(-3).map((l) => ({ text: l.text, color: l.color, age: s.time - l.at })),
        banner: s.banner ? { text: s.banner.text, sub: s.banner.sub, color: s.banner.color } : null,
        toast: s.toast ? { text: s.toast.text, color: s.toast.color } : null,
        boss: boss ? { name: t(boss.def.name), hp: boss.hp, max: boss.maxHp } : null,
        buffs: [h.buffs.strength > 0 ? tr('voima', 'strength') : '', h.buffs.speed > 0 ? tr('nopeus', 'speed') : '', h.buffs.poison > 0 ? tr('myrkky', 'poison') : ''].filter(Boolean),
      });
    };

    let last = performance.now();
    let acc = 0;
    let hudAcc = 0;
    let endAcc = 0;
    let raf = 0;
    let hitStop = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ov = overlayRef.current;
      // keys that open and close the screens
      if (input.edge('escape') || input.edge('p')) {
        if (ov.kind === 'none') setOverlay({ kind: 'pause' });
        else setOverlay({ kind: 'none' });
      }
      for (const [key, tab] of [['m', 'map'], ['i', 'pack'], ['b', 'pack'], ['c', 'character'], ['t', 'tree']] as const) {
        if (input.edge(key)) setOverlay(ov.kind === 'sheet' && ov.tab === tab ? { kind: 'none' } : { kind: 'sheet', tab });
      }
      const t0 = performance.now();
      if (renderer.needsResize()) onResize();
      const h = s.hero;
      input.heroScreen = renderer.toScreen(h.x, h.y);
      const it = held(h);
      input.range = it?.kind === 'bow' ? 288 : 70;
      hitStop = Math.max(0, hitStop - dt);
      if (ov.kind === 'none' && !s.gameOver && hitStop <= 0) {
        acc += dt * speed;
        let n = 0;
        while (acc >= DT && n < 4 * speed) {
          const hpBefore = h.hp;
          const bossBefore = s.enemies.some((e) => e.def.boss && !e.dead);
          step(s, bot ? botInput(s, h, botRng, who) : input.read(), DT);
          if (bot && h.points > 0) botSpend(s, h, who);
          acc -= DT;
          n++;
          if (h.alive && hpBefore - h.hp > heroStats(h).maxHp * 0.2) hitStop = Math.max(hitStop, 0.05);
          if (bossBefore && !s.enemies.some((e) => e.def.boss && !e.dead)) hitStop = Math.max(hitStop, 0.08);
          if (s.saveWanted) {
            s.saveWanted = false;
            writeSave(s.saveBlob);
          }
          if (s.gameOver) break;
        }
        if (acc > DT * 4 * speed) acc = 0;
      } else if (s.gameOver) {
        step(s, input.read(), dt);
        endAcc += dt;
        if (endAcc > (s.won ? 2.6 : 2.2) && !endedRef.current) {
          endedRef.current = true;
          clearSave();
          onEnd({ floor: s.floor, level: h.level, time: s.time, kills: s.run.kills, build: t(buildName(h.skills, fighterOf(h))), won: s.won, seed: s.seed });
        }
      }
      if (s.sounds.length) {
        for (const name of s.sounds) audio.play(name);
        s.sounds.length = 0;
      }
      audio.intensity = s.enemies.some((e) => e.aware && !e.dead) ? (s.bossAlive && s.enemies.some((e) => e.def.boss && e.aware) ? 1 : 0.6) : 0;
      renderer.render(s, ov.kind === 'none' && hitStop <= 0 ? dt : 0);
      if (miniRef.current) renderer.drawMinimap(miniRef.current, s);
      drawSticks(input, moveStickRef.current, aimStickRef.current);
      moveZoneRef.current?.classList.toggle('on', input.move.active);
      aimZoneRef.current?.classList.toggle('on', input.aim.active);
      const ms = performance.now() - t0;
      perf.frames++;
      perf.ms += ms;
      if (ms > perf.worst) perf.worst = ms;
      hudAcc += dt;
      if (hudAcc > 0.08) {
        hudAcc = 0;
        publishHud();
      }
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      if (document.visibilityState === 'hidden' && overlayRef.current.kind === 'none' && !s.gameOver) setOverlay({ kind: 'pause' });
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      input.detach(root);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      audio.stopMusic();
      void wake?.release().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const h = s.hero;
  const other = hud?.hands.find((x) => !x.active)?.item ?? null;
  const openSheet = (tab: Tab) => setOverlay({ kind: 'sheet', tab });

  return (
    <div className="game" ref={rootRef}>
      <canvas ref={canvasRef} />
      {hud && (
        <div className="hud">
          <div className="hudrow">
            <div className="floor">
              {tr('Kerros', 'Floor')} <b>{hud.floor}</b>
            </div>
            <div className="lvl">
              {tr('Taso', 'Level')} {hud.level}
              <div className="bar xp">
                <i style={{ width: `${Math.round(hud.xp * 100)}%` }} />
              </div>
              {hud.points > 0 && <span className="pts">+{hud.points}</span>}
            </div>
          </div>
          <div className="bar hp">
            <i style={{ width: `${Math.round((100 * hud.hp) / hud.maxHp)}%`, background: hud.hp < hud.maxHp * 0.3 ? 'linear-gradient(#ff8a70, #c03020)' : undefined }} />
            <span>
              {hud.hp} / {hud.maxHp}
            </span>
          </div>
          {/* the two hands as pills: icon, damage, the skill; a tap swaps */}
          <div className="hands" data-ui>
            {hud.hands.map((x, i) =>
              x.item ? (
                <button key={i} className={`slot ${x.active ? 'on' : ''}`} style={{ borderColor: RARITY_COLOR[x.item.rarity] }} onClick={() => !x.active && inputRef.current?.swap()} aria-label={t(x.item.name)}>
                  <span className="sic">{kindIcon(x.item)}</span>
                  <span className="sname" style={{ color: RARITY_COLOR[x.item.rarity] }}>
                    {x.item.dmgMin}–{x.item.dmgMax}
                  </span>
                  <span className="req">{h.skills[isMelee(x.item.kind) ? 'lahi' : 'jousi'].lvl}</span>
                </button>
              ) : (
                <div key={i} className="slot empty">
                  {tr('tyhjä', 'empty')}
                </div>
              ),
            )}
          </div>
          {hud.buffs.length > 0 && <div className="buffs">{hud.buffs.join(' · ')}</div>}
        </div>
      )}
      {hud?.boss && (
        <div className="bossbar">
          <div className="name">{hud.boss.name}</div>
          <div className="bar">
            <div style={{ width: `${(100 * Math.max(0, hud.boss.hp)) / hud.boss.max}%` }} />
          </div>
        </div>
      )}
      {hud?.banner && (
        <div className="banner" key={hud.banner.text + hud.banner.sub}>
          <div className="t" style={hud.banner.color ? { color: hud.banner.color } : undefined}>
            {hud.banner.text}
          </div>
          <div className="s">{hud.banner.sub}</div>
        </div>
      )}
      {hud && hud.log.length > 0 && (
        <div className="log">
          {hud.log.slice(-1).map((l, i) => (
            <div key={i} style={{ color: l.color, opacity: Math.max(0.3, 1 - l.age / 6) }}>
              {l.text}
            </div>
          ))}
        </div>
      )}
      <div className="corner">
        <button className="minimap" data-ui onClick={() => openSheet('map')} aria-label={tr('Kartta', 'Map')}>
          <canvas ref={miniRef} />
        </button>
        <button className="iconbtn bag" data-ui onClick={() => openSheet('pack')} aria-label={tr('Reppu', 'Pack')}>
          🎒{hud && hud.packCount > 0 && <b>{hud.packCount}</b>}
        </button>
        <button className={`iconbtn ${hud && hud.points > 0 ? 'pulse' : ''}`} data-ui onClick={() => openSheet(hud && hud.points > 0 ? 'tree' : 'character')} aria-label={tr('Hahmo', 'Character')}>
          {hud && hud.points > 0 ? '✦' : '☰'}
        </button>
        <button className="iconbtn" data-ui onClick={() => setOverlay({ kind: 'pause' })} aria-label={tr('Tauko', 'Pause')}>
          ❚❚
        </button>
      </div>

      {/* What the walk-over rule left under the hero: one line in the left
          column, out of the play area (docs/loot-ui.md). A tap opens the
          comparison as a paused overlay; E takes it into the hand of its kind. */}
      {/* under the HUD block: where a swapped item went, then the loot chip */}
      <div className="under">
      {hud?.toast && (
        <div className="itoast" key={hud.toast.text} style={{ color: hud.toast.color }}>
          {hud.toast.text}
        </div>
      )}
      {hud?.near && h.near !== null && (
        <button className="lootchip" data-ui style={{ borderColor: RARITY_COLOR[hud.near.rarity] }} onClick={() => setOverlay({ kind: 'loot', id: h.near! })}>
          <span className="lname" style={{ color: RARITY_COLOR[hud.near.rarity] }}>
            {t(hud.near.name)}
          </span>
          <span className="lnum">
            {hud.near.kind === 'coat' ? `${tr('panssari', 'armour')} ${hud.near.armor}${hud.nearVs ? ` (${hud.nearVs.armor})` : ''}` : `${hud.near.dmgMin}–${hud.near.dmgMax}${hud.nearVs ? ` (${hud.nearVs.dmgMin}–${hud.nearVs.dmgMax})` : ''}`}
            {' · '}
            {tr('napauta', 'tap')}
          </span>
        </button>
      )}
      </div>

      {/* The bottom half is the controls, drawn always as faint outlines so a
          new player sees where to touch: the move ring where the left thumb
          rests, the attack ring under the right thumb, the buttons in an arc
          round it. They brighten when touched. The real stick still starts
          where the thumb lands. */}
      <div className="zone move" ref={moveZoneRef}>
        <div className="ring" />
        <small>{tr('kävele', 'walk')}</small>
      </div>
      <div className="zone attack" ref={aimZoneRef}>
        <div className="ring" />
        <small>{tr('lyö · pito lataa', 'strike · hold charges')}</small>
      </div>
      <div className="ctl" data-ui>
        {hud?.techs.map((x, i) => (
          <button
            key={i}
            className={`tech t${i + 1} ${x.id ? '' : 'none'} ${x.ready ? 'ready' : ''} ${x.id && !x.usable ? 'off' : ''}`}
            style={{ ['--f' as string]: `${Math.round((1 - x.cd) * 100)}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              if (x.id) inputRef.current?.tech(i as 0 | 1);
            }}
            aria-label={x.name || tr('Tyhjä tekniikka', 'Empty technique')}
          >
            <span>{x.icon || (i + 1)}</span>
            {x.name && <small>{x.name}</small>}
          </button>
        ))}
        <button className="potion" onPointerDown={(e) => { e.preventDefault(); inputRef.current?.potion(); }} aria-label={tr('Juo parannusjuoma', 'Drink a healing potion')}>
          🧪{hud && hud.potions > 0 && <b>{hud.potions}</b>}
        </button>
        <button className={`swapbtn ${other ? '' : 'none'}`} style={other ? { borderColor: RARITY_COLOR[other.rarity] } : undefined} onPointerDown={(e) => { e.preventDefault(); if (other) inputRef.current?.swap(); }} aria-label={other ? tr(`Vaihda: ${t(other.name)}`, `Swap to ${t(other.name)}`) : tr('Vaihda kättä', 'Swap hands')}>
          <span>⇄</span>
          {other && <small>{kindIcon(other)}</small>}
        </button>
      </div>
      <div className="stick" ref={moveStickRef}>
        <div />
      </div>
      <div className="stick aim" ref={aimStickRef}>
        <div />
      </div>

      {overlay.kind === 'sheet' && rendererRef.current && <Sheets s={s} tab={overlay.tab} renderer={rendererRef.current} onTab={(tab) => setOverlay({ kind: 'sheet', tab })} onClose={() => setOverlay({ kind: 'none' })} onChange={() => setTick((x) => x + 1)} />}
      {overlay.kind === 'loot' && (() => {
        const dr = s.drops.find((x) => x.id === overlay.id);
        const it = dr?.item;
        if (!dr || !it) return null;
        const done = () => setOverlay({ kind: 'none' });
        const dest = whereWord(whereOldGoes(h));
        const room = h.pack.length < PACK_SIZE;
        return (
          <div className="overlay loot" data-ui>
            <h2>{tr('Lattialla', 'On the floor')}</h2>
            <div className="lootbody">
              <ItemCard it={it} h={h} />
              <div className="choices">
                {isWeapon(it) &&
                  ([0, 1] as const).map((slot) => {
                    const held = h.hands[slot];
                    return <Choice key={slot} title={tr(`Käsi ${slot + 1}`, `Hand ${slot + 1}`)} held={held} it={it} h={h} action={held ? tr(`Vaihda käteen ${slot + 1}: ${t(held.name)} ${dest}`, `Swap into hand ${slot + 1}: ${t(held.name)} ${dest}`) : tr(`Käteen ${slot + 1}`, `Into hand ${slot + 1}`)} onPick={() => { takeInto(s, h, dr, slot, false); done(); }} />;
                  })}
                {it.kind === 'coat' && <Choice title={tr('Ylle', 'Worn')} held={h.coat} it={it} h={h} action={h.coat ? tr(`Pue: ${t(h.coat.name)} ${dest}`, `Wear: ${t(h.coat.name)} ${dest}`) : tr('Pue', 'Wear')} onPick={() => { wearFrom(s, h, dr); done(); }} />}
              </div>
            </div>
            <div className="row">
              <button className="btn" disabled={!room} onClick={() => { packFrom(s, h, dr); done(); }}>
                {room ? tr('Reppuun', 'To the pack') : tr('Reppu on täynnä', 'The pack is full')}
              </button>
              <button className="btn ghost" onClick={done}>
                {tr('Jätä lattialle', 'Leave it on the floor')}
              </button>
            </div>
            <p className="small">{tr('Mikään ei katoa: vaihdettu ase menee reppuun, tai lattialle jos reppu on täynnä. Reppu-välilehdeltä voi vaihtaa takaisin.', 'Nothing is lost: a swapped weapon goes to the pack, or onto the floor when the pack is full. The pack tab swaps it back.')}</p>
          </div>
        );
      })()}
      {overlay.kind === 'pause' && (
        <div className="overlay" data-ui>
          <h2>{tr('Tauko', 'Paused')}</h2>
          <p className="small">
            {tr('Kerros', 'Floor')} {s.floor} · {tr('taso', 'level')} {h.level} · {t(buildName(h.skills, fighterOf(h)))}
          </p>
          <div className="row">
            <button className="btn" onClick={() => openSheet('character')}>
              {tr('Hahmo', 'Character')}
            </button>
            <button className="btn" onClick={() => openSheet('tree')}>
              {tr('Taitopuu', 'Tree')}
            </button>
            <button className="btn" onClick={() => openSheet('pack')}>
              {tr('Reppu', 'Pack')}
            </button>
            <button className="btn" onClick={() => openSheet('map')}>
              {tr('Kartta', 'Map')}
            </button>
          </div>
          <div className="row pausebar">
            <button className="btn primary" onClick={() => setOverlay({ kind: 'none' })}>
              {tr('Jatka', 'Resume')}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                audio.setMuted(!muted);
                setMuted(!muted);
              }}
            >
              {muted ? tr('Äänet päälle', 'Sound on') : tr('Äänet pois', 'Sound off')}
            </button>
            <ConfirmButton className="btn ghost" label={tr('Valikkoon', 'To the menu')} sure={tr('Kierros jatkuu kerroksen alusta. Varmasti?', 'The run resumes from the top of the floor. Sure?')} onConfirm={onQuit} />
          </div>
          <button className="btn ghost" onClick={() => setOverlay({ kind: 'guide' })}>
            {tr('Näin pelataan', 'How to play')}
          </button>
        </div>
      )}
      {overlay.kind === 'guide' && (
        <div className="overlay" data-ui>
          <h2>{tr('Näin pelataan', 'How to play')}</h2>
          <GuideBody />
          <button className="btn primary" onClick={() => setOverlay({ kind: 'pause' })}>
            {tr('Takaisin', 'Back')}
          </button>
        </div>
      )}
      {overlay.kind === 'none' && <UpdateBanner />}
    </div>
  );
}

function drawSticks(input: InputController, move: HTMLDivElement | null, aim: HTMLDivElement | null): void {
  for (const [st, el] of [
    [input.move, move],
    [input.aim, aim],
  ] as const) {
    if (!el) continue;
    if (!st.active || (st === input.aim && !st.dragged)) {
      el.style.display = 'none';
      continue;
    }
    el.style.display = 'block';
    el.style.left = `${st.cx}px`;
    el.style.top = `${st.cy}px`;
    const dx = st.x - st.cx;
    const dy = st.y - st.cy;
    const d = Math.hypot(dx, dy);
    const m = Math.min(d, input.radius);
    const k = d > 0 ? m / d : 0;
    (el.firstChild as HTMLDivElement).style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
  }
}
