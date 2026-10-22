import { AFFIX_WHAT, RARITY_COLOR, type Item } from '../game/items';
import type { Hero } from '../game/state';
import { nameOf } from '../game/sim';
import { t, tr } from '../i18n';

/**
 * What a swap would do, before it is done: the new item's numbers against
 * exactly the thing it would replace, better in green and worse in red.
 * One row per number that differs, a line for an affix lost or gained.
 */
export function DiffRows({ it, vs }: { it: Item; vs: Item | null }) {
  const rows: { label: string; now: string; was: string; delta: number }[] = [];
  if (it.kind === 'sword' || it.kind === 'bow') {
    const avg = (x: Item) => (x.dmgMin + x.dmgMax) / 2;
    rows.push({ label: tr('Vahinko', 'Damage'), now: `${it.dmgMin}–${it.dmgMax}`, was: vs ? `${vs.dmgMin}–${vs.dmgMax}` : '', delta: vs ? avg(it) - avg(vs) : 1 });
    const sp = (x: Item) => Math.round((1 - x.speed) * 100);
    if (sp(it) !== (vs ? sp(vs) : 0)) rows.push({ label: tr('Nopeus', 'Speed'), now: `+${sp(it)} %`, was: vs ? `+${sp(vs)} %` : '', delta: sp(it) - (vs ? sp(vs) : 0) });
    const re = (x: Item) => Math.round((x.reach - 1) * 100);
    if (re(it) !== (vs ? re(vs) : 0)) rows.push({ label: it.kind === 'sword' ? tr('Ulottuvuus', 'Reach') : tr('Kantama', 'Range'), now: `+${re(it)} %`, was: vs ? `+${re(vs)} %` : '', delta: re(it) - (vs ? re(vs) : 0) });
  }
  if (it.kind === 'coat') rows.push({ label: tr('Panssari', 'Armour'), now: String(it.armor), was: vs ? String(vs.armor) : '', delta: vs ? it.armor - vs.armor : 1 });
  const gained = it.affix && it.affix !== vs?.affix ? t(AFFIX_WHAT[it.affix]) : null;
  const lost = vs?.affix && vs.affix !== it.affix ? t(AFFIX_WHAT[vs.affix]) : null;
  return (
    <div className="diff">
      {rows.map((r) => (
        <div key={r.label} className={`drow ${r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}`}>
          <span className="dl">{r.label}</span>
          <b className="dn">{r.now}</b>
          {r.was && (
            <span className="dw">
              {r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : '='} {r.was}
            </span>
          )}
        </div>
      ))}
      {gained && <div className="drow up"><span className="dl">+</span><b className="dn">{gained}</b></div>}
      {lost && <div className="drow down"><span className="dl">−</span><b className="dn">{lost}</b></div>}
    </div>
  );
}

/** One choice: the thing in that place now, and what the new item would change. */
export function Choice({ title, held, it, h, action, onPick, disabled }: { title: string; held: Item | null; it: Item; h: Hero; action: string; onPick: () => void; disabled?: boolean }) {
  return (
    <div className="choice">
      <div className="ctitle">
        {title}
        {held ? (
          <span style={{ color: RARITY_COLOR[held.rarity] }}> · {nameOf(h, held)}</span>
        ) : (
          <span className="muted"> · {tr('tyhjä', 'empty')}</span>
        )}
      </div>
      <DiffRows it={it} vs={held} />
      <button className="btn choose" disabled={disabled} onClick={onPick}>
        {action}
      </button>
    </div>
  );
}
