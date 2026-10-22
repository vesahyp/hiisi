import { L, type Text } from '../../i18n';
import type { SkillId } from '../skills';

/**
 * The skill tree: four rows, one per style, and a general row. A node
 * costs one point from a character level; a node with a `gate` also
 * requires that use-level of the row's skill, so the tree can only follow
 * what the player fights with. The first slice has the sword, the bow and
 * the general rows; the magic and shadow rows exist so the tree shows the
 * whole shape, locked.
 *
 * A node is either a technique (goes on a button, has a cooldown) or a
 * passive. The sim reads `has(hero, id)` where the rule lives.
 */
export type RowId = 'miekka' | 'jousi' | 'yleinen' | 'taika' | 'varjo';

export interface NodeDef {
  id: string;
  row: RowId;
  /** the skill whose use-level gates it; general nodes have none */
  skill: SkillId | null;
  gate: number;
  /** the node before it in the chain, if any */
  after: string | null;
  /** a side node hangs off its parent and is drawn small */
  side: boolean;
  icon: string;
  name: Text;
  what: Text;
  /** a technique: seconds of cooldown; 0 for a passive */
  cooldown: number;
  /** techniques and passives the slice does not have yet are shown locked */
  inSlice: boolean;
}

const n = (id: string, row: RowId, skill: SkillId | null, gate: number, after: string | null, side: boolean, icon: string, name: Text, what: Text, cooldown = 0, inSlice = true): NodeDef => ({ id, row, skill, gate, after, side, icon, name, what, cooldown, inSlice });

export const NODES: NodeDef[] = [
  // the sword
  n('halkaisu', 'miekka', 'miekka', 1, null, false, '⚔', L('Halkaisu', 'Cleave'), L('Laaja, raskas kaari: osuu kaikkiin edessä puolitoistakertaisella vahingolla.', 'A wide heavy arc: hits everything in front for one and a half times the damage.'), 6),
  n('vahva', 'miekka', 'miekka', 2, 'halkaisu', true, '✚', L('Vahva käsi', 'Strong arm'), L('+15 % miekan vahinkoa.', '+15 % sword damage.')),
  n('torjunta', 'miekka', 'miekka', 3, 'halkaisu', false, '🛡', L('Torjunta', 'Parry'), L('Pito torjuu edestä; torjunta iskun hetkellä horjuttaa lyöjän.', 'Hold to block from the front; a block on the moment of the blow staggers the attacker.')),
  n('ulottuvuus', 'miekka', 'miekka', 5, 'torjunta', true, '↔', L('Ulottuvuus', 'Reach'), L('Miekan kaari kolmanneksen pidempi.', 'The sword arc a third longer.')),
  n('syoksy', 'miekka', 'miekka', 6, 'torjunta', false, '➶', L('Syöksy', 'Lunge'), L('Syöksy lähimpään viholliseen ja lyö kaksinkertaisesti.', 'Dash to the nearest enemy and strike for double damage.'), 7),
  n('pyorre', 'miekka', 'miekka', 10, 'syoksy', false, '🌀', L('Pyörre', 'Whirl'), L('Pyörähdys osuu kaikkiin ympärillä kahdesti.', 'A spin hits everything around you twice.'), 10),
  n('mestari', 'miekka', 'miekka', 15, 'pyorre', false, '★', L('Miekkamestari', 'Sword master'), L('Joka kolmas osuma on kriittinen: kaksinkertainen.', 'Every third hit is critical: double.')),
  // the bow
  n('jannitys', 'jousi', 'jousi', 1, null, false, '🏹', L('Jännitys', 'Draw'), L('Täysi jännitys lävistää rivin ja tekee kaksinkertaisen vahingon.', 'A full draw pierces the row and deals double damage.')),
  n('hiljainen', 'jousi', 'jousi', 2, 'jannitys', true, '🤫', L('Hiljainen jänne', 'Quiet string'), L('Laukaus ei herätä nukkuvia.', 'A shot does not wake sleepers.')),
  n('ansa', 'jousi', 'jousi', 3, 'jannitys', false, '🪤', L('Ansa', 'Trap'), L('Laske ansa jalkoihin: astuja pysähtyy kolmeksi sekunniksi ja ottaa vahinkoa.', 'Set a trap at your feet: whoever steps in stops for three seconds and takes damage.'), 8),
  n('nopeaveto', 'jousi', 'jousi', 5, 'ansa', true, '⏩', L('Nopea veto', 'Fast draw'), L('Jännitys 30 % nopeampi.', 'Draws 30 % faster.')),
  n('nuolisade', 'jousi', 'jousi', 6, 'ansa', false, '☄', L('Nuolisade', 'Arrow rain'), L('Nuolia sataa lähimmän vihollisen ympärille.', 'Arrows rain round the nearest enemy.'), 9),
  n('kaksoisnuoli', 'jousi', 'jousi', 10, 'nuolisade', false, '⇉', L('Kaksoisnuoli', 'Twin arrow'), L('Joka laukaus on kaksi nuolta.', 'Every shot is two arrows.')),
  n('haukansilma', 'jousi', 'jousi', 15, 'kaksoisnuoli', false, '★', L('Haukansilmä', "Hawk's eye"), L('Nuolet hakeutuvat viholliseen.', 'Arrows seek the enemy.')),
  // general: always open, so a point always has a home
  n('sydan', 'yleinen', null, 0, null, false, '♥', L('Sydän', 'Heart'), L('+20 elämää.', '+20 health.')),
  n('askel', 'yleinen', null, 0, 'sydan', false, '👣', L('Askel', 'Stride'), L('+8 % nopeutta.', '+8 % speed.')),
  n('sisu', 'yleinen', null, 0, 'askel', false, '🔥', L('Sisu', 'Grit'), L('Parannusjuoma parantaa kokonaan.', 'A healing potion heals in full.')),
  n('nahka', 'yleinen', null, 0, 'sisu', false, '🛡', L('Paksu nahka', 'Thick skin'), L('+2 panssaria.', '+2 armour.')),
  // the magic and shadow rows are locked in the first slice
  n('tulipallo', 'taika', 'tuli', 1, null, false, '🔥', L('Tulipallo', 'Fireball'), L('Tulossa: taika on seuraava viipale.', 'Coming: magic is the next slice.'), 5, false),
  n('seina', 'taika', 'tuli', 3, 'tulipallo', false, '🧱', L('Liekkiseinä', 'Fire wall'), L('Tulossa.', 'Coming.'), 12, false),
  n('hallanuoli', 'taika', 'halla', 6, 'seina', false, '❄', L('Hallanuoli', 'Frost bolt'), L('Tulossa.', 'Coming.'), 0, false),
  n('suoja', 'taika', 'henki', 10, 'hallanuoli', false, '✨', L('Suoja', 'Ward'), L('Tulossa.', 'Coming.'), 14, false),
  n('henkiapuri', 'taika', 'henki', 15, 'suoja', false, '★', L('Henkiapuri', 'Spirit helper'), L('Tulossa.', 'Coming.'), 0, false),
  n('hiipiminen', 'varjo', 'varjo', 1, null, false, '🐾', L('Hiipiminen', 'Sneak'), L('Tulossa: varjo on kolmas viipale.', 'Coming: shadow is the third slice.'), 0, false),
  n('selka', 'varjo', 'varjo', 3, 'hiipiminen', false, '🗡', L('Selkäänpuukotus', 'Backstab'), L('Tulossa.', 'Coming.'), 0, false),
  n('savu', 'varjo', 'varjo', 6, 'selka', false, '💨', L('Savu', 'Smoke'), L('Tulossa.', 'Coming.'), 10, false),
  n('myrkky', 'varjo', 'varjo', 10, 'savu', false, '☠', L('Myrkky', 'Poison'), L('Tulossa.', 'Coming.'), 0, false),
  n('varjomestari', 'varjo', 'varjo', 15, 'myrkky', false, '★', L('Varjomestari', 'Shadow master'), L('Tulossa.', 'Coming.'), 0, false),
];

export const NODE_BY_ID: Record<string, NodeDef> = Object.fromEntries(NODES.map((x) => [x.id, x]));

export const ROWS: { id: RowId; name: Text; skill: SkillId | null; color: string }[] = [
  { id: 'miekka', name: L('MIEKKA', 'SWORD'), skill: 'miekka', color: '#ffd040' },
  { id: 'jousi', name: L('JOUSI', 'BOW'), skill: 'jousi', color: '#8ae070' },
  { id: 'yleinen', name: L('YLEINEN', 'GENERAL'), skill: null, color: '#ece6d2' },
  { id: 'taika', name: L('TAIKA', 'MAGIC'), skill: 'tuli', color: '#ff7a2a' },
  { id: 'varjo', name: L('VARJO', 'SHADOW'), skill: 'varjo', color: '#8a7fd0' },
];

export const isTechnique = (d: NodeDef): boolean => d.cooldown > 0;
