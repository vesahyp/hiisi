import { tr } from '../i18n';

/** How to play, in words. The drawn guide comes after the first playtest. */
export function GuideBody() {
  const rows: [string, string][] = [
    [tr('Vasen peukalo', 'Left thumb'), tr('kävelee. Tikun paikka on siinä mihin peukalo laskeutuu.', 'walks. The stick sits where the thumb lands.')],
    [tr('Oikea napautus', 'Right tap'), tr('lyö tai ampuu lähintä vihollista, jonka näet.', 'strikes or shoots the nearest enemy you can see.')],
    [tr('Oikea veto', 'Right drag'), tr('näyttää tähtäyksen; nosto lyö tai ampuu sen suuntaan.', 'shows the aim; lifting strikes or shoots along it.')],
    [tr('Oikea pito', 'Right hold'), tr('lataa: jousi jännittyy, miekka vetää lyönnin taakse. Pidä niin kauan kuin haluat, nosto laukaisee. Vahinko kasvaa latauksen mukana täyteen asti; napautus on heikko. Miekan lataus myös torjuu edestä, kun Torjunta on opittu.', 'charges: the bow draws, the sword winds up. Hold as long as you like, lifting fires. Damage grows with the charge to the full one; a tap is weak. The wound-up sword also guards from the front once Parry is learned.')],
    [tr('Tekniikat', 'Techniques'), tr('kaksi nappia oikean peukalon yllä. Ne tulevat taitopuusta ja tarvitsevat oikean aseen käteen.', 'two buttons above the right thumb. They come from the tree and need the right weapon in hand.')],
    [tr('⇄', '⇄'), tr('vaihtaa kättä: miekasta jouseen ja takaisin. Käden kultainen numero on sen aseen taito.', 'swaps hands: sword to bow and back. The gold number on a hand is that weapon\'s skill.')],
    [tr('🧪', '🧪'), tr('juo parannusjuoman. Muut juomat juodaan repusta.', 'drinks a healing potion. Other potions are drunk from the pack.')],
    [tr('Pienoiskartta', 'The minimap'), tr('avaa koko kerroksen. Portaat alas ovat kauimmaisessa huoneessa.', 'opens the whole floor. The stairs down are in the farthest room.')],
    [tr('Taidot', 'Skills'), tr('nousevat osumista. Katto on kerros + 5, joten syvemmälle meno nostaa kattoa. Taso antaa pisteen taitopuuhun.', 'rise from hits. The cap is floor + 5, so going deeper raises it. A level gives a point for the tree.')],
    [tr('Portaat', 'The stairs'), tr('seiso niillä hetki. Elämä palaa portailla. Kierros tallentuu kerroksen alussa.', 'stand on them a moment. Health returns on the stairs. The run saves at the top of each floor.')],
    [tr('Kuolema', 'Death'), tr('on kuolema. Hahmo jää ennätyksiin.', 'is death. The character goes to the records.')],
  ];
  return (
    <div className="guide">
      {rows.map(([k, v]) => (
        <div key={k} className="grow">
          <b>{k}</b>
          <span>{v}</span>
        </div>
      ))}
      <div className="keys">
        <div className="key">
          <kbd>WASD</kbd>
          <span>{tr('kävele', 'walk')}</span>
        </div>
        <div className="key">
          <kbd>{tr('hiiri', 'mouse')}</kbd>
          <span>{tr('tähtää; klik lyö, pito jännittää tai torjuu', 'aims; click strikes, hold draws or blocks')}</span>
        </div>
        <div className="key">
          <kbd>Q</kbd>
          <span>{tr('vaihda kättä', 'swap hands')}</span>
        </div>
        <div className="key">
          <kbd>1 2</kbd>
          <span>{tr('tekniikat', 'techniques')}</span>
        </div>
        <div className="key">
          <kbd>R</kbd>
          <span>{tr('parannusjuoma', 'healing potion')}</span>
        </div>
        <div className="key">
          <kbd>E</kbd>
          <span>{tr('ota', 'take')}</span>
        </div>
        <div className="key">
          <kbd>C T I M</kbd>
          <span>{tr('hahmo, taitopuu, reppu, kartta', 'character, tree, pack, map')}</span>
        </div>
        <div className="key">
          <kbd>Esc</kbd>
          <span>{tr('tauko', 'pause')}</span>
        </div>
      </div>
    </div>
  );
}
