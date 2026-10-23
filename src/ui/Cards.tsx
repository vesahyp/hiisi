import { AFFIX_WHAT, POTION_WHAT, RARITY_COLOR, RARITY_NAME, isMelee, kindName, type Item } from '../game/items';
import { FAMILY } from '../game/content/weapons';
import type { Hero } from '../game/state';
import { nameOf } from '../game/sim';
import { skillOf } from '../game/hero';
import { t, tr } from '../i18n';
import { SKILLS } from '../game/skills';
import { familyOf, staminaCost, SWING_TIME } from '../game/attacks';

const skillName = (id: string) => t(SKILLS.find((s) => s.id === id)!.name);

/** The family's rhythm in a word: the windup, the swing and the recovery together. */
function rhythmWord(it: Item): string {
  const f = familyOf(it);
  const secs = f.windup + SWING_TIME * f.swing + f.recover;
  return secs < 0.5 ? tr('nopea', 'fast') : secs < 1.0 ? tr('tasainen', 'even') : secs < 1.6 ? tr('raskas', 'heavy') : tr('hyvin raskas', 'very heavy');
}

/** An item's card: name, kind and numbers, beside what it would replace. */
export function ItemCard({ it, vs, h, compact = false }: { it: Item; vs?: Item | null; h: Hero; compact?: boolean }) {
  const col = RARITY_COLOR[it.rarity];
  const known = it.kind !== 'potion' || (it.potion ? h.known[it.potion] : true);
  const sk = skillOf(it);
  const lvl = sk ? h.skills[sk].lvl : 0;
  const avg = (x: Item) => (x.dmgMin + x.dmgMax) / 2;
  return (
    <div className={`icard r${it.rarity} ${compact ? 'compact' : ''}`} style={{ borderColor: col }}>
      <div className="iname" style={{ color: col }}>
        {nameOf(h, it)}
        {it.count > 1 && <span className="count">×{it.count}</span>}
      </div>
      <div className="isub">
        {kindName(it)}
        {it.kind !== 'potion' && ` · ${t(RARITY_NAME[it.rarity])} · ${tr('kerros', 'floor')} ${it.level}`}
        {it.kind === 'potion' && !known && ` · ${tr('tuntematon', 'unknown')}`}
      </div>
      {!compact && (isMelee(it.kind) || it.kind === 'bow') && (
        <div className="istats">
          <div className={`stat ${vs ? (avg(it) > avg(vs) ? 'up' : avg(it) < avg(vs) ? 'down' : '') : ''}`}>
            <span>{tr('Vahinko', 'Damage')}</span>
            <b>
              {it.dmgMin}–{it.dmgMax}
            </b>
          </div>
          <div className="stat">
            <span>{sk ? skillName(sk) : ''}</span>
            <b>{lvl}</b>
          </div>
          {isMelee(it.kind) && (
            <div className="stat">
              <span>{tr('Puhti', 'Stamina')}</span>
              <b>
                {Math.round(staminaCost(h, it, 0))} / {Math.round(staminaCost(h, it, 1))}
              </b>
            </div>
          )}
          {isMelee(it.kind) && (
            <div className="stat">
              <span>{tr('Rytmi', 'Rhythm')}</span>
              <b>{rhythmWord(it)}</b>
            </div>
          )}
          {it.speed !== 1 && (
            <div className="stat up">
              <span>{tr('Nopeus', 'Speed')}</span>
              <b>+{Math.round((1 - it.speed) * 100)} %</b>
            </div>
          )}
          {it.reach !== 1 && (
            <div className="stat up">
              <span>{tr('Ulottuvuus', 'Reach')}</span>
              <b>+{Math.round((it.reach - 1) * 100)} %</b>
            </div>
          )}
        </div>
      )}
      {compact && (isMelee(it.kind) || it.kind === 'bow') && (
        <div className="istats">
          <div className={`stat ${vs ? (avg(it) > avg(vs) ? 'up' : avg(it) < avg(vs) ? 'down' : '') : ''}`}>
            <span>{tr('Vahinko', 'Damage')}</span>
            <b>
              {it.dmgMin}–{it.dmgMax}
              {vs && (
                <small>
                  {' '}
                  ({tr('kädessä', 'in hand')} {vs.dmgMin}–{vs.dmgMax})
                </small>
              )}
            </b>
          </div>
        </div>
      )}
      {it.kind === 'coat' && (
        <div className="istats">
          <div className={`stat ${vs ? (it.armor > vs.armor ? 'up' : it.armor < vs.armor ? 'down' : '') : ''}`}>
            <span>{tr('Panssari', 'Armour')}</span>
            <b>
              {it.armor}
              {vs && <small> ({tr('yllä', 'worn')} {vs.armor})</small>}
            </b>
          </div>
        </div>
      )}
      {isMelee(it.kind) && !compact && <div className="itrait family">{t(FAMILY[it.kind].what)}</div>}
      {it.affix && <div className="itrait">{t(AFFIX_WHAT[it.affix])}</div>}
      {it.kind === 'potion' && it.potion && (known ? <div className="itrait">{t(POTION_WHAT[it.potion])}</div> : <div className="itrait unknown">{tr('Juo, niin tiedät. Täydellä elämällä riski on pieni.', 'Drink to find out. With full health the risk is small.')}</div>)}
    </div>
  );
}
