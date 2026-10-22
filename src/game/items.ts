import { L, t, type Text } from '../i18n';
import type { Rng } from './rng';

/**
 * Items: the weapons the two hands hold, the coat, and potions. A weapon
 * is kind x rarity x level, with one affix from blue up. Potions of the
 * unknown kinds carry a colour that the run shuffles; drinking one tells
 * you what that colour is for the rest of the run.
 */
export type ItemKind = 'sword' | 'bow' | 'coat' | 'potion';
export type PotionKind = 'heal' | 'strength' | 'speed' | 'poison';
export type Affix = 'sharp' | 'quick' | 'long' | 'heavy' | 'piercing' | 'taut' | 'light';

export const RARITY_COLOR = ['#b8b8b8', '#6ee06e', '#4aa8ff', '#c070ff', '#ff9a2a'];
export const RARITY_NAME: Text[] = [L('romu', 'junk'), L('tavallinen', 'common'), L('harvinainen', 'rare'), L('eepos', 'epic'), L('legenda', 'legend')];

export interface Item {
  id: number;
  kind: ItemKind;
  rarity: number;
  level: number;
  name: Text;
  /** weapons: damage per hit */
  dmgMin: number;
  dmgMax: number;
  /** weapons: swing or draw time multiplier, lower is faster */
  speed: number;
  /** swords: reach multiplier; bows: range multiplier */
  reach: number;
  affix: Affix | null;
  /** coats: damage taken off every hit */
  armor: number;
  potion: PotionKind | null;
  /** potions: the colour the run gave this kind */
  color: string;
  count: number;
}

export const POTION_COLORS = ['#3a6ad0', '#c050a0', '#60c060', '#e0b048', '#40c0c0'];
export const POTION_COLOR_NAME: Record<string, Text> = {
  '#3a6ad0': L('sininen', 'blue'),
  '#c050a0': L('violetti', 'violet'),
  '#60c060': L('vihreä', 'green'),
  '#e0b048': L('keltainen', 'yellow'),
  '#40c0c0': L('samea', 'murky'),
};
export const POTION_NAME: Record<PotionKind, Text> = {
  heal: L('Parannusjuoma', 'Healing potion'),
  strength: L('Voimajuoma', 'Potion of strength'),
  speed: L('Nopeusjuoma', 'Potion of speed'),
  poison: L('Myrkkyjuoma', 'Potion of poison'),
};
export const POTION_WHAT: Record<PotionKind, Text> = {
  heal: L('Parantaa puolet elämästä.', 'Heals half your health.'),
  strength: L('Vahinko +40 % puoleksi minuutiksi.', 'Damage +40 % for half a minute.'),
  speed: L('Nopeus +30 % puoleksi minuutiksi.', 'Speed +30 % for half a minute.'),
  poison: L('Myrkyttää: elämä valuu hetken.', 'Poisons: health drains for a while.'),
};

const SWORD_BASE: Text[] = [L('miekka', 'sword'), L('säilä', 'blade'), L('kalpa', 'broadsword')];
const BOW_BASE: Text[] = [L('jousi', 'bow'), L('pitkäjousi', 'longbow'), L('metsästysjousi', 'hunting bow')];
const COAT_BASE: Text[] = [L('villatakki', 'wool coat'), L('nahkatakki', 'leather coat'), L('turkki', 'fur coat')];
const RARITY_WORD: Text[] = [L('Ruosteinen', 'Rusty'), L('Kunnon', 'Sound'), L('Hiiden', "Hiisi's"), L('Louhen', "Louhi's"), L('Väinön', "Väinö's")];
const COAT_WORD: Text[] = [L('Kulunut', 'Worn'), L('Lämmin', 'Warm'), L('Vahva', 'Sturdy'), L('Louhen', "Louhi's"), L('Väinön', "Väinö's")];

export const AFFIX_NAME: Record<Affix, Text> = {
  sharp: L('Terävä', 'Sharp'),
  quick: L('Nopea', 'Quick'),
  long: L('Pitkä', 'Long'),
  heavy: L('Raskas', 'Heavy'),
  piercing: L('Lävistävä', 'Piercing'),
  taut: L('Jäntevä', 'Taut'),
  light: L('Kevyt', 'Light'),
};
export const AFFIX_WHAT: Record<Affix, Text> = {
  sharp: L('+20 % vahinkoa', '+20 % damage'),
  quick: L('lyö tai jännittää 25 % nopeammin', 'swings or draws 25 % faster'),
  long: L('+30 % ulottuvuutta', '+30 % reach'),
  heavy: L('osuma työntää vihollisen taakse', 'a hit knocks the enemy back'),
  piercing: L('nuoli lävistää aina', 'every arrow pierces'),
  taut: L('jännitys 35 % nopeampi', 'draws 35 % faster'),
  light: L('+10 % kävelyvauhtia', '+10 % walking speed'),
};
const SWORD_AFFIX: Affix[] = ['sharp', 'quick', 'long', 'heavy'];
const BOW_AFFIX: Affix[] = ['sharp', 'quick', 'long', 'piercing', 'taut'];

let nextId = 1;
export function itemId(): number {
  return nextId++;
}
export function resetItemIds(n: number): void {
  nextId = n;
}

const blank = (kind: ItemKind, rarity: number, level: number): Item => ({
  id: itemId(),
  kind,
  rarity,
  level,
  name: L(''),
  dmgMin: 0,
  dmgMax: 0,
  speed: 1,
  reach: 1,
  affix: null,
  armor: 0,
  potion: null,
  color: '',
  count: 1,
});

export function rollWeapon(rng: Rng, kind: 'sword' | 'bow', level: number, rarity: number): Item {
  const it = blank(kind, rarity, level);
  const base = kind === 'sword' ? rng.pick(SWORD_BASE) : rng.pick(BOW_BASE);
  // damage: the level sets the floor, the rarity the budget
  const scale = (1 + level * 0.18) * (1 + rarity * 0.22);
  const lo = kind === 'sword' ? 9 : 7;
  const hi = kind === 'sword' ? 14 : 12;
  it.dmgMin = Math.round(lo * scale);
  it.dmgMax = Math.round(hi * scale);
  if (rarity >= 2) {
    it.affix = rng.pick(kind === 'sword' ? SWORD_AFFIX : BOW_AFFIX);
    if (it.affix === 'sharp') {
      it.dmgMin = Math.round(it.dmgMin * 1.2);
      it.dmgMax = Math.round(it.dmgMax * 1.2);
    }
    if (it.affix === 'quick') it.speed = 0.75;
    if (it.affix === 'taut') it.speed = 0.65;
    if (it.affix === 'long') it.reach = 1.3;
  }
  const word = RARITY_WORD[rarity];
  const nm = (fi: string, en: string) => (it.affix ? L(`${t0(AFFIX_NAME[it.affix], 'fi')} ${fi.toLowerCase()}`, `${t0(AFFIX_NAME[it.affix], 'en')} ${en.toLowerCase()}`) : L(fi, en));
  it.name = nm(`${word.fi} ${base.fi}`, `${word.en} ${base.en}`);
  return it;
}

const t0 = (x: Text, l: 'fi' | 'en') => x[l];

export function rollCoat(rng: Rng, level: number, rarity: number): Item {
  const it = blank('coat', rarity, level);
  const base = rng.pick(COAT_BASE);
  it.armor = Math.round(1 + level * 0.6 + rarity * 1.5);
  it.name = L(`${COAT_WORD[rarity].fi} ${base.fi}`, `${COAT_WORD[rarity].en} ${base.en}`);
  // from blue up, half the coats are light: the pace of a ranger for anyone
  if (rarity >= 2 && rng.chance(0.5)) {
    it.affix = 'light';
    it.name = L(`Kevyt ${COAT_WORD[rarity].fi.toLowerCase()} ${base.fi}`, `Light ${COAT_WORD[rarity].en.toLowerCase()} ${base.en}`);
  }
  return it;
}

export function makePotion(kind: PotionKind, colors: Record<PotionKind, string>, count = 1): Item {
  const it = blank('potion', 0, 1);
  it.potion = kind;
  it.color = colors[kind];
  it.count = count;
  it.name = POTION_NAME[kind];
  return it;
}

/** What a floor drops: the rarity curve by floor, kinds by weight. */
export function rollDrop(rng: Rng, floor: number, colors: Record<PotionKind, string>, bonus = 0): Item {
  const roll = rng.next();
  if (roll < 0.3) {
    const kind = rng.weighted<PotionKind>(['heal', 'strength', 'speed', 'poison'], (k) => (k === 'heal' ? 3 : k === 'poison' ? 1.2 : 2));
    return makePotion(kind, colors);
  }
  const rarity = rollRarity(rng, floor, bonus);
  if (roll < 0.4) return rollCoat(rng, floor, rarity);
  return rollWeapon(rng, rng.chance(0.5) ? 'sword' : 'bow', floor, rarity);
}

export function rollRarity(rng: Rng, floor: number, bonus = 0): number {
  const r = rng.next() - floor * 0.03 - bonus;
  if (r < 0.06) return 3;
  if (r < 0.25) return 2;
  if (r < 0.6) return 1;
  return 0;
}

/** A weapon's worth, for the bot and the pickup card: average damage times rarity. */
export function weaponScore(it: Item): number {
  return ((it.dmgMin + it.dmgMax) / 2) * (1 + it.rarity * 0.1) * (it.affix ? 1.1 : 1);
}

export function itemLabel(it: Item): string {
  return it.kind === 'potion' ? t(it.name) : t(it.name);
}
