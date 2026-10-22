import { L, type Text } from '../../i18n';
import type { Affix } from '../items';

/**
 * The melee families. Each plays differently in shape and behaviour, not
 * only in numbers: the sword's arc, the axe's cleave and bleed, the mace's
 * stagger and slam, the spear's thrust line, the dagger's speed and
 * backstab, the flail's orbit, the scythe's full circle, the anchor's pull.
 * One skill, Lähitaistelu, trains them all; the weapon brings the feel.
 * A new family is a row here plus its branch in attacks.ts and a sprite.
 */
export type MeleeKind = 'sword' | 'axe' | 'mace' | 'spear' | 'dagger' | 'flail' | 'scythe' | 'anchor';
export type HitShape = 'arc' | 'line' | 'ring' | 'orbit' | 'throw';
export type HitEffect = 'none' | 'bleed' | 'stagger' | 'push' | 'backstab' | 'reap' | 'pull';

export interface Family {
  kind: MeleeKind;
  name: Text;
  /** the name of a fighter who leads with it */
  fighter: Text;
  /** names for junk and common items: words a Finn knows at a glance */
  bases: Text[];
  /** names from blue up: the rarer words */
  rareBases: Text[];
  icon: string;
  /** damage per hit at level 1, rarity 0 */
  lo: number;
  hi: number;
  /** the swing's length, as a multiple of the sword's */
  swing: number;
  /** seconds before the next swing */
  lock: number;
  /** seconds of hold to a full charge */
  wind: number;
  /** px from the hero */
  reach: number;
  /** half the arc, radians (arc shapes); the line's half width (line shapes) */
  width: number;
  shape: HitShape;
  /** a step forward on the swing, px */
  lunge: number;
  knock: number;
  /** heavy: a slower walk while charging, no guard */
  heavy: boolean;
  /** can hold the guard while wound up */
  guard: boolean;
  effect: HitEffect;
  /** a full charge turns into a ground slam (ring) or a running thrust (dash) */
  full: 'none' | 'slam' | 'run';
  affixes: Affix[];
  sound: string;
  /** drop weight on floors 1 to 5 */
  weight: number;
  /** what the card says it does */
  what: Text;
}

export const FAMILIES: Family[] = [
  {
    kind: 'sword', name: L('Miekka', 'Sword'), fighter: L('Miekkamies', 'Swordsman'), bases: [L('miekka', 'sword')], rareBases: [L('säilä', 'blade'), L('kalpa', 'broadsword')], icon: '🗡',
    lo: 9, hi: 14, swing: 1, lock: 0.6, wind: 0.8, reach: 44, width: 1.05, shape: 'arc', lunge: 10, knock: 100, heavy: false, guard: true, effect: 'none', full: 'none',
    affixes: ['sharp', 'quick', 'long', 'heavy'], sound: 'swing', weight: 3,
    what: L('Nopea kaari ja askel eteen. Ladattuna torjuu edestä, kun Torjunta on opittu.', 'A quick arc and a step forward. Wound up, it guards from the front once Parry is learned.'),
  },
  {
    kind: 'axe', name: L('Kirves', 'Axe'), fighter: L('Kirvesmies', 'Axeman'), bases: [L('kirves', 'axe')], rareBases: [L('tappara', 'war axe'), L('piilu', 'hewing axe')], icon: '🪓',
    lo: 12, hi: 20, swing: 1.5, lock: 0.9, wind: 1.0, reach: 48, width: 1.75, shape: 'arc', lunge: 6, knock: 260, heavy: true, guard: false, effect: 'bleed', full: 'none',
    affixes: ['sharp', 'long', 'heavy'], sound: 'cleave', weight: 2,
    what: L('Leveä, hidas halkaisu. Osuma lennättää ja jättää vuotamaan kolmeksi sekunniksi.', 'A wide slow cleave. A hit sends them flying and leaves them bleeding for three seconds.'),
  },
  {
    kind: 'mace', name: L('Nuija', 'Mace'), fighter: L('Nuijamies', 'Maceman'), bases: [L('nuija', 'mace')], rareBases: [L('sotanuija', 'war mace'), L('vasara', 'hammer')], icon: '🔨',
    lo: 14, hi: 22, swing: 1.6, lock: 1.0, wind: 1.1, reach: 42, width: 0.95, shape: 'arc', lunge: 4, knock: 140, heavy: true, guard: false, effect: 'stagger', full: 'slam',
    affixes: ['sharp', 'heavy', 'quick'], sound: 'maul', weight: 2,
    what: L('Hidas ja raskas: joka osuma horjuttaa. Täysi lataus on maaisku, joka osuu ympärillesi ja murtaa panssarin viideksi sekunniksi.', 'Slow and heavy: every hit staggers. A full charge is a ground slam all round you that breaks armour for five seconds.'),
  },
  {
    kind: 'spear', name: L('Keihäs', 'Spear'), fighter: L('Keihäsmies', 'Spearman'), bases: [L('keihäs', 'spear')], rareBases: [L('peitsi', 'lance'), L('hanko', 'pike')], icon: '🔱',
    lo: 10, hi: 15, swing: 1.1, lock: 0.7, wind: 0.8, reach: 82, width: 12, shape: 'line', lunge: 8, knock: 340, heavy: false, guard: true, effect: 'push', full: 'run',
    affixes: ['sharp', 'quick', 'long'], sound: 'thrust', weight: 2,
    what: L('Pitkä pisto suoraa linjaa: osuu kaikkiin linjalla ja työntää ne kauemmas. Täysi lataus on juoksupisto.', 'A long thrust down a line: hits everyone on it and pushes them away. A full charge is a running thrust.'),
  },
  {
    kind: 'dagger', name: L('Tikari', 'Dagger'), fighter: L('Puukkojunkkari', 'Knife fighter'), bases: [L('tikari', 'dagger'), L('puukko', 'knife')], rareBases: [L('väkipuukko', 'long knife')], icon: '🔪',
    lo: 6, hi: 9, swing: 0.6, lock: 0.3, wind: 0.5, reach: 30, width: 0.7, shape: 'arc', lunge: 8, knock: 40, heavy: false, guard: false, effect: 'backstab', full: 'none',
    affixes: ['sharp', 'quick'], sound: 'stab', weight: 2,
    what: L('Hyvin nopea, lyhyt. Ei torju. Kolminkertainen viholliseen, joka ei ole huomannut sinua.', 'Very fast and short. No guard. Triple damage on an enemy that has not noticed you.'),
  },
  {
    kind: 'flail', name: L('Varsta', 'Flail'), fighter: L('Varstamies', 'Flailman'), bases: [L('varsta', 'flail')], rareBases: [L('kuulaketju', 'ball and chain'), L('piikkikuula', 'morning star')], icon: '⛓',
    lo: 11, hi: 17, swing: 1.2, lock: 0.8, wind: 1.3, reach: 46, width: 1.0, shape: 'orbit', lunge: 0, knock: 180, heavy: true, guard: false, effect: 'none', full: 'none',
    affixes: ['sharp', 'heavy', 'long'], sound: 'whirl', weight: 1.2,
    what: L('Pito pyörittää kuulaa ympärilläsi: se osuu mihin sattuu. Liike syöttää pyörintää. Nosto heittää kuulan suoraan eteen.', 'Hold and the ball orbits you, hitting what it meets. Moving feeds the spin. The release hurls the ball straight ahead.'),
  },
  {
    kind: 'scythe', name: L('Viikate', 'Scythe'), fighter: L('Viikatemies', 'Reaper'), bases: [L('viikate', 'scythe')], rareBases: [L('kuolonviikate', 'reaper')], icon: '⚰',
    lo: 13, hi: 21, swing: 1.8, lock: 1.1, wind: 1.1, reach: 52, width: Math.PI, shape: 'ring', lunge: 0, knock: 120, heavy: true, guard: false, effect: 'reap', full: 'none',
    affixes: ['sharp', 'long'], sound: 'reap', weight: 1,
    what: L('Yksi hidas täysi ympyrä: osuu kaikkiin ympärilläsi. Tappo palauttaa vähän elämää.', 'One slow full circle: hits everything round you. A kill gives a little health back.'),
  },
  {
    kind: 'anchor', name: L('Ankkuri', 'Anchor'), fighter: L('Ankkurimies', 'Anchorman'), bases: [L('ankkuri', 'anchor')], rareBases: [L('ketjuankkuri', 'chained anchor')], icon: '⚓',
    lo: 15, hi: 24, swing: 1.4, lock: 1.2, wind: 1.2, reach: 128, width: 14, shape: 'throw', lunge: 0, knock: 0, heavy: true, guard: false, effect: 'pull', full: 'none',
    affixes: ['sharp', 'heavy'], sound: 'chain', weight: 0.8,
    what: L('Lataus heittää ankkurin suoraan eteen ja vetää kaiken mihin se tarttuu jalkoihisi.', 'A charge hurls the anchor straight ahead and drags everything it hooks to your feet.'),
  },
];

export const FAMILY: Record<MeleeKind, Family> = Object.fromEntries(FAMILIES.map((f) => [f.kind, f])) as Record<MeleeKind, Family>;
export const MELEE_KINDS = FAMILIES.map((f) => f.kind);
export const isMelee = (kind: string): kind is MeleeKind => (MELEE_KINDS as string[]).includes(kind);
