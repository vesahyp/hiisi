import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { SimState } from '../game/state';
import type { Renderer } from '../render/renderer';
import { t, tr } from '../i18n';
import { buildName, hitsToNext, skillCap, SKILLS, xpToNext } from '../game/skills';
import { canLearn, canRefund, has, heroStats, learn, refund, setTech } from '../game/hero';
import { NODE_BY_ID, NODES, ROWS, isTechnique, type RowId } from '../game/content/tree';
import { RARITY_COLOR, type Item } from '../game/items';
import { ItemCard } from './Cards';
import { drink, dropFromPack, equip, explored, nameOf, PACK_SIZE } from '../game/sim';
import { fmtTime } from '../records';
import { audio } from '../audio';

export type Tab = 'character' | 'tree' | 'pack' | 'map';

const TABS: { id: Tab; name: [string, string] }[] = [
  { id: 'character', name: ['Hahmo', 'Character'] },
  { id: 'tree', name: ['Taitopuu', 'Tree'] },
  { id: 'pack', name: ['Reppu', 'Pack'] },
  { id: 'map', name: ['Kartta', 'Map'] },
];

/** The four screens over a paused run: the character, the tree, the pack, the map. */
export function Sheets({ s, tab, renderer, onTab, onClose, onChange }: { s: SimState; tab: Tab; renderer: Renderer; onTab: (t: Tab) => void; onClose: () => void; onChange: () => void }) {
  const [, setTick] = useState(0);
  const changed = () => {
    setTick((x) => x + 1);
    onChange();
  };
  return (
    <div className="overlay sheet" data-ui>
      <div className="sheethead">
        <div className="tabs">
          {TABS.map((x) => (
            <button key={x.id} className={`tab ${tab === x.id ? 'on' : ''} ${x.id === 'tree' && s.hero.points > 0 ? 'hot' : ''}`} onClick={() => onTab(x.id)}>
              {tr(x.name[0], x.name[1])}
              {x.id === 'tree' && s.hero.points > 0 && <b> +{s.hero.points}</b>}
            </button>
          ))}
        </div>
        <button className="close" onClick={onClose} aria-label={tr('Sulje', 'Close')}>
          ✕
        </button>
      </div>
      {tab === 'character' && <Character s={s} />}
      {tab === 'tree' && <Tree s={s} onChange={changed} />}
      {tab === 'pack' && <Pack s={s} onChange={changed} />}
      {tab === 'map' && <FloorMap s={s} renderer={renderer} />}
    </div>
  );
}

function Character({ s }: { s: SimState }) {
  const h = s.hero;
  const st = heroStats(h);
  const cap = skillCap(s.floor);
  return (
    <div className="cols">
      <div className="panel">
        <div className="who">
          <div>
            <div className="n">{tr('Kulkija', 'The wanderer')}</div>
            <div className="t">
              {tr('Taso', 'Level')} {h.level}
              {h.points > 0 && ` · ${h.points} ${tr('taitopistettä', 'points')}`}
            </div>
            <div className="s">
              {tr('Kokemus', 'Experience')} {h.xp} / {xpToNext(h.level)}
            </div>
            <div className="bar xp" style={{ width: 140, marginTop: 4 }}>
              <i style={{ width: `${Math.round((100 * h.xp) / xpToNext(h.level))}%` }} />
            </div>
          </div>
        </div>
        <div className="stats">
          <div>
            {tr('Elämä', 'Health')} <b>{Math.round(h.hp)} / {st.maxHp}</b>
          </div>
          <div>
            {tr('Panssari', 'Armour')} <b>{st.armor}</b>
          </div>
          <div>
            {tr('Nopeus', 'Speed')} <b>{Math.round((st.speed / 170) * 100)} %</b>
          </div>
          <div>
            {tr('Tappoja', 'Kills')} <b>{s.run.kills}</b>
          </div>
          <div>
            {tr('Kerros', 'Floor')} <b>{s.floor}</b>
          </div>
          <div>
            {tr('Aika', 'Time')} <b>{fmtTime(s.time)}</b>
          </div>
        </div>
        <div className="build">
          <span>{t(buildName(h.skills))}</span> <small>{tr('tyyli: kaksi korkeinta taitoa', 'the style: the two highest skills')}</small>
        </div>
        <div className="note">
          <b>{tr('Elämä palaa portailla', 'Health returns on the stairs')}</b>
          {tr(', ei ajan kanssa. Kuolema päättää kierroksen: hahmo jää ennätyksiin syvyyden ja tyylin kanssa.', ', not with time. Death ends the run: the character goes to the records with depth and style.')}
        </div>
      </div>
      <div className="panel">
        <div className="h">
          {tr('TAIDOT', 'SKILLS')} · {tr('nousevat käytöstä', 'rise by use')} · {tr('katto nyt', 'cap now')} {cap}
        </div>
        <div className="skills">
          {SKILLS.map((sk) => {
            const x = h.skills[sk.id];
            const capped = x.lvl >= cap;
            const need = hitsToNext(x.lvl);
            return (
              <div key={sk.id} className={`sk ${capped ? 'capped' : ''} ${sk.inSlice ? '' : 'later'}`}>
                <div className="ic">{sk.icon}</div>
                <div className="nm">
                  {t(sk.name)}
                  <small>{!sk.inSlice ? tr('tulossa myöhemmin', 'coming later') : capped ? tr('katossa: nousee portaiden jälkeen', 'at the cap: rises after the stairs') : x.lvl === 0 && x.hits === 0 ? tr('ei käytetty', 'not used') : tr(`${need - x.hits} osumaa seuraavaan`, `${need - x.hits} hits to the next`)}</small>
                </div>
                <div className="bar skill">
                  <i style={{ width: `${capped ? 100 : Math.round((100 * x.hits) / need)}%` }} />
                </div>
                <div className="lv">
                  {x.lvl}
                  {capped && <small> / {cap}</small>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="note">
          {tr('Taito nousee vain osumista vihollisiin, jotka antavat vielä kokemusta. Katto on kerros + 5. ', 'A skill rises only from hits on enemies that still give experience. The cap is floor + 5. ')}
          <b>{tr('Alempi taito nousee nopeasti', 'A low skill rises fast')}</b>
          {tr(', joten toisen aseen voi ottaa käteen milloin vain.', ', so the other weapon can go in hand at any time.')}
        </div>
      </div>
    </div>
  );
}

function Tree({ s, onChange }: { s: SimState; onChange: () => void }) {
  const h = s.hero;
  const [sel, setSel] = useState<string>(() => {
    const open = NODES.find((n) => canLearn(s, h, n.id).ok);
    return open?.id ?? 'halkaisu';
  });
  const d = NODE_BY_ID[sel];
  const can = canLearn(s, h, sel);
  const learned = has(h, sel);
  const row = ROWS.find((r) => r.id === d.row)!;
  const X0 = 78;
  const STEP = 66;
  const Y0 = 44;
  const ROW = 70;
  let edges = '';
  const nodes: { x: number; y: number; id: string; side: boolean }[] = [];
  const labels: ReactElement[] = [];
  ROWS.forEach((r, ri) => {
    const y = Y0 + ri * ROW;
    const chain = NODES.filter((n) => n.row === r.id && !n.side);
    const sides = NODES.filter((n) => n.row === r.id && n.side);
    const lvl = r.skill ? h.skills[r.skill].lvl : null;
    labels.push(
      <g key={r.id}>
        <text className="branch" x="6" y={y - 4} style={{ fill: r.color }}>
          {t(r.name)}
        </text>
        {lvl !== null && (
          <text className="branch sub" x="6" y={y + 10} style={{ fill: r.color }}>
            {tr('taito', 'skill')} {lvl}
          </text>
        )}
      </g>,
    );
    let px = X0 - 30;
    chain.forEach((n, i) => {
      const x = X0 + i * STEP;
      edges += `<line class="edge ${has(h, n.id) ? 'lit' : ''}" x1="${px}" y1="${y}" x2="${x}" y2="${y}"/>`;
      px = x;
      nodes.push({ x, y, id: n.id, side: false });
    });
    for (const sd of sides) {
      const parent = chain.findIndex((n) => n.id === sd.after);
      const fx = X0 + parent * STEP;
      const sx = fx + 30;
      const sy = y - 28;
      edges += `<line class="edge ${has(h, sd.id) ? 'lit' : ''}" x1="${fx}" y1="${y}" x2="${sx}" y2="${sy}" stroke-dasharray="3 3"/>`;
      nodes.push({ x: sx, y: sy, id: sd.id, side: true });
    }
  });
  const stateOf = (id: string) => (has(h, id) ? 'taken' : canLearn(s, h, id).ok ? 'open' : 'locked');
  const techSlot = learned && isTechnique(d) ? h.techs.indexOf(sel) : -1;
  return (
    <div className="wrap tree">
      <div className="treebox">
        <svg viewBox="0 0 400 365">
          <g dangerouslySetInnerHTML={{ __html: edges }} />
          {labels}
          {nodes.map((n) => {
            const nd = NODE_BY_ID[n.id];
            const st = stateOf(n.id);
            const gated = nd.skill && h.skills[nd.skill].lvl < nd.gate;
            return (
              <g key={n.id} className={`node ${st} ${n.id === sel ? 'sel' : ''} ${nd.inSlice ? '' : 'later'}`} onClick={() => setSel(n.id)}>
                <circle cx={n.x} cy={n.y} r={n.side ? 10 : 16} />
                <text className="icon" x={n.x} y={n.y + (n.side ? 4 : 6)} textAnchor="middle" style={n.side ? { fontSize: 10 } : undefined}>
                  {nd.icon}
                </text>
                {!n.side && (
                  <text className="lbl" x={n.x} y={n.y + 28}>
                    {t(nd.name)}
                  </text>
                )}
                {gated && !n.side && st !== 'taken' && nd.inSlice && (
                  <>
                    <circle cx={n.x + 13} cy={n.y - 12} r={8} fill="#c04030" stroke="#0b0d0a" strokeWidth={1.5} />
                    <text x={n.x + 13} y={n.y - 9} textAnchor="middle" style={{ fontSize: 8, fill: '#fff' }}>
                      {nd.gate}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="info panel">
        <div className="name">
          {d.icon} {t(d.name)} <small>{t(row.name).toLowerCase()} · {isTechnique(d) ? tr('tekniikka', 'technique') : tr('ominaisuus', 'passive')}</small>
        </div>
        <div className="what">
          {t(d.what)}
          {isTechnique(d) && ` ${tr(`Latautuu ${d.cooldown} s.`, `Recharges in ${d.cooldown} s.`)}`}
        </div>
        <div className="reqs">
          <span className={h.points > 0 ? 'ok' : 'no'}>
            {tr('1 piste', '1 point')} · {tr('sinulla', 'you have')} {h.points}
          </span>
          {d.skill && d.gate > 0 && (
            <span className={h.skills[d.skill].lvl >= d.gate ? 'ok' : 'no'}>
              {t(SKILLS.find((x) => x.id === d.skill)!.name)} {d.gate} · {tr('sinulla', 'you have')} {h.skills[d.skill].lvl}
            </span>
          )}
          {d.after && <span className={has(h, d.after) ? 'ok' : 'no'}>{t(NODE_BY_ID[d.after].name)}</span>}
        </div>
        <div className="row">
          {learned ? (
            isTechnique(d) ? (
              <>
                <span className="pts">{techSlot >= 0 ? tr(`Napissa ${techSlot + 1}`, `On button ${techSlot + 1}`) : tr('Ei napissa', 'Not on a button')}</span>
                {[0, 1].map((i) => (
                  <button
                    key={i}
                    className="btn ghost"
                    onClick={() => {
                      setTech(h, i as 0 | 1, sel);
                      onChange();
                    }}
                  >
                    {tr(`Nappiin ${i + 1}`, `To button ${i + 1}`)}
                  </button>
                ))}
              </>
            ) : (
              <span className="pts">{tr('Opittu', 'Learned')}</span>
            )
          ) : (
            <button
              className={`btn ${can.ok ? 'primary' : 'ghost'}`}
              disabled={!can.ok}
              onClick={() => {
                if (learn(s, h, sel)) {
                  audio.play('learn');
                  onChange();
                }
              }}
            >
              {can.ok ? tr(`Opi: ${t(d.name)}`, `Learn ${t(d.name)}`) : can.why}
            </button>
          )}
        </div>
        <div className="note">
          {tr('Punainen numero on taidon taso, jonka solmu vaatii. Pienet solmut ovat sivuhaaroja. Kerroksen katto on nyt', 'The red number is the skill level the node needs. Small nodes are side branches. The floor cap is now')} {skillCap(s.floor)}.{' '}
          {canRefund(s) ? (
            <button
              className="btn ghost tiny"
              onClick={() => {
                refund(s, h);
                onChange();
              }}
            >
              {tr('Palauta kaikki pisteet', 'Refund every point')}
            </button>
          ) : (
            tr('Pisteet voi palauttaa kerroksen alussa, ennen ensimmäistä tappoa.', 'Points can be refunded at the top of a floor, before the first kill.')
          )}
        </div>
      </div>
    </div>
  );
}

function Pack({ s, onChange }: { s: SimState; onChange: () => void }) {
  const h = s.hero;
  const [sel, setSel] = useState<Item | null>(h.pack[0] ?? h.hands[h.active]);
  const cell = (it: Item | null, label: string, hand?: number) => (
    <button key={it ? it.id : label} className={`cell ${it ? `b${it.rarity}` : 'empty'} ${it && sel === it ? 'sel' : ''}`} onClick={() => it && setSel(it)} disabled={!it}>
      {hand !== undefined && it && <span className={`hand ${h.active === hand ? 'on' : ''}`}>{hand + 1}</span>}
      {it && it.kind === 'potion' && it.potion && !h.known[it.potion] && <span className="unk">?</span>}
      <span className="ic">{it ? (it.kind === 'sword' ? '🗡' : it.kind === 'bow' ? '🏹' : it.kind === 'coat' ? '🧥' : '🧪') : ''}</span>
      <small>{it ? nameOf(h, it) : label}</small>
      {it && it.count > 1 && <span className="n">{it.count}</span>}
    </button>
  );
  const vs = sel ? (sel.kind === 'coat' ? h.coat : sel.kind === 'potion' ? null : (h.hands.find((x) => x?.kind === sel.kind && x !== sel) ?? null)) : null;
  const inHand = sel ? h.hands.indexOf(sel) : -1;
  const act = (f: () => void) => {
    f();
    onChange();
    setSel((x) => (x && (h.pack.includes(x) || h.hands.includes(x) || h.coat === x) ? x : (h.pack[0] ?? h.hands[h.active])));
  };
  return (
    <div className="cols">
      <div className="panel">
        <div className="h">
          <span>{tr('YLLÄ JA KÄDESSÄ', 'WORN AND IN HAND')}</span>
          <span>{tr('napauta: kortti', 'tap: the card')}</span>
        </div>
        <div className="worn">
          {cell(h.hands[0], tr('käsi 1', 'hand 1'), 0)}
          {cell(h.hands[1], tr('käsi 2', 'hand 2'), 1)}
          {cell(h.coat, tr('takki', 'coat'))}
        </div>
        <div className="h" style={{ marginTop: 10 }}>
          <span>
            {tr('REPPU', 'PACK')} {h.pack.length} / {PACK_SIZE}
          </span>
        </div>
        <div className="pack">
          {h.pack.map((it) => cell(it, ''))}
          {Array.from({ length: Math.max(0, PACK_SIZE - h.pack.length) }, (_, i) => (
            <div key={`e${i}`} className="cell empty" />
          ))}
        </div>
      </div>
      <div className="panel">
        {sel ? (
          <>
            <ItemCard it={sel} vs={vs} h={h} />
            <div className="acts">
              {(sel.kind === 'sword' || sel.kind === 'bow') && inHand < 0 && (
                <>
                  <button className="btn primary" onClick={() => act(() => equip(s, h, sel, 0))}>
                    {tr('Käteen 1', 'Hand 1')}
                  </button>
                  <button className="btn" onClick={() => act(() => equip(s, h, sel, 1))}>
                    {tr('Käteen 2', 'Hand 2')}
                  </button>
                </>
              )}
              {sel.kind === 'coat' && h.coat !== sel && (
                <button className="btn primary" onClick={() => act(() => equip(s, h, sel, 0))}>
                  {tr('Pue', 'Wear')}
                </button>
              )}
              {sel.kind === 'potion' && (
                <button className="btn primary" onClick={() => act(() => drink(s, h, sel))}>
                  {tr('Juo', 'Drink')}
                </button>
              )}
              <button className="btn ghost" onClick={() => act(() => dropFromPack(s, h, sel))}>
                {tr('Pudota', 'Drop')}
              </button>
            </div>
            <div className="note">
              {sel.kind === 'potion'
                ? tr('Tuntematon juoma (?) tunnistetaan juomalla: se on riski, jonka voi ottaa kun elämä on täynnä. Parannusjuoma on aina punainen. Nappi 🧪 juo parannusjuoman.', 'An unknown potion (?) is identified by drinking: a risk to take with full health. The healing potion is always red. The 🧪 button drinks a healing potion.')
                : sel.kind === 'coat'
                  ? tr('Takki ottaa panssarinsa verran pois joka osumasta.', 'A coat takes its armour off every hit.')
                  : tr('Käteen ottaminen vaihtaa tyylin. Aseen taito nousee osumista. Kädessä olevan aseen vaihto kesken taistelun: ⇄-nappi.', 'A weapon in hand sets the style. Its skill rises from hits. Swap hands mid-fight with the ⇄ button.')}
            </div>
          </>
        ) : (
          <div className="note">{tr('Reppu on tyhjä.', 'The pack is empty.')}</div>
        )}
      </div>
    </div>
  );
}

function FloorMap({ s, renderer }: { s: SimState; renderer: Renderer }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderer.drawMinimap(ref.current, s, true);
  });
  const ex = explored(s);
  const leftOver = s.enemies.filter((e) => !e.dead).length;
  const boss = s.enemies.find((e) => e.def.boss && !e.dead);
  return (
    <div className="fullmap">
      <h2>
        {tr('Kerros', 'Floor')} {s.floor}
      </h2>
      <canvas ref={ref} />
      <div className="legend">
        <span>
          <i style={{ background: '#6ab0ff' }} />
          {tr('sinä', 'you')}
        </span>
        <span>
          <i style={{ background: '#ece6d2' }} />
          {tr('portaat', 'stairs')}
        </span>
        <span>
          <i style={{ background: '#a07030' }} />
          {tr('ovi', 'door')}
        </span>
        <span>
          <i style={{ background: '#ff6a4a' }} />
          {tr('vihollinen', 'enemy')}
        </span>
        <span>
          <i style={{ background: '#e0b048' }} />
          {tr('arkku', 'chest')}
        </span>
        <span>
          <i style={{ background: '#c070ff' }} />
          {tr('esine', 'item')}
        </span>
      </div>
      <div className="legend sub">
        {tr(`Tutkittu ${ex.seen} huonetta ${ex.total}:sta`, `Explored ${ex.seen} of ${ex.total} rooms`)}
        {` · ${tr(`${leftOver} vihollista jäljellä`, `${leftOver} enemies left`)}`}
        {boss && ` · ${tr('karhu vartioi portaita', 'the bear guards the stairs')}`}
      </div>
    </div>
  );
}

export { RARITY_COLOR, type RowId };
