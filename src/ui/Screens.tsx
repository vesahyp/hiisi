import { useEffect, useState } from 'react';
import { tr, lang, type Lang } from '../i18n';
import { fmtTime, type Records } from '../records';
import { audio } from '../audio';
import type { RunSummary } from './Game';
import { GuideBody } from './Guide';

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

export function Title({ records, hasSave, saveFloor, onContinue, onNew, onRecords, onGuide, onLang }: { records: Records; hasSave: boolean; saveFloor: number; onContinue: () => void; onNew: () => void; onRecords: () => void; onGuide: () => void; onLang: (l: Lang) => void }) {
  const go = (f: () => void) => {
    audio.unlock();
    audio.play('tap');
    f();
  };
  return (
    <div className="screen title">
      <h1 className="logo">HIISI</h1>
      <p className="tagline">{tr('Laskeudu Hiiden mäkeen. Miekka, jousi, ja taidot jotka kasvavat siitä mitä teet.', "Go down into Hiisi's hill. A sword, a bow, and skills that grow from what you do.")}</p>
      {hasSave ? (
        <>
          <button className="btn primary big" onClick={() => go(onContinue)}>
            {tr('Jatka', 'Continue')} <small>{tr(`kerros ${saveFloor}`, `floor ${saveFloor}`)}</small>
          </button>
          <ConfirmButton className="btn" label={tr('Uusi kierros', 'New run')} sure={tr('Tallennettu kierros katoaa. Varmasti?', 'The saved run is lost. Sure?')} onConfirm={() => go(onNew)} />
        </>
      ) : (
        <button className="btn primary big" onClick={() => go(onNew)}>
          {tr('Pelaa', 'Play')}
        </button>
      )}
      <div className="row pair">
        <button className="btn half" onClick={onGuide}>
          {tr('Näin pelataan', 'How to play')}
        </button>
        {records.runs > 0 && (
          <button className="btn half" onClick={onRecords}>
            {tr('Ennätykset', 'Records')}
          </button>
        )}
      </div>
      {records.deepest > 0 && <p className="small">{tr(`Syvin kerros: ${records.deepest}`, `Deepest floor: ${records.deepest}`)}</p>}
      <div className="row">
        <button className="btn ghost" onClick={() => onLang(lang() === 'fi' ? 'en' : 'fi')}>
          {lang() === 'fi' ? 'English' : 'Suomeksi'}
        </button>
      </div>
      <p className="small credits">{tr('Viipale yksi: viisi kerrosta, miekka ja jousi, karhu pohjalla.', 'Slice one: five floors, sword and bow, a bear at the bottom.')}</p>
    </div>
  );
}

export function Death({ r, rank, onAgain, onMenu }: { r: RunSummary; rank: number; onAgain: () => void; onMenu: () => void }) {
  return (
    <div className="screen">
      <h2>{r.won ? tr('Mäki jatkuu syvemmälle', 'The hill goes deeper') : tr('Kuolema on kuolema', 'Death is death')}</h2>
      <p className="small">{r.won ? tr('Viipale yksi päättyy kerrokseen 5. Lisää kerroksia, taikaa ja varjo ovat tulossa.', 'Slice one ends at floor 5. More floors, magic and shadow are coming.') : tr('Hahmo on poissa. Seuraava alkaa alusta, mutta sinä muistat mäen.', 'The character is gone. The next one starts over, but you remember the hill.')}</p>
      <div className="stats">
        <span>{tr('Kerros', 'Floor')}</span>
        <b>{r.floor}</b>
        <span>{tr('Taso', 'Level')}</span>
        <b>{r.level}</b>
        <span>{tr('Tyyli', 'Style')}</span>
        <b>{r.build}</b>
        <span>{tr('Tappoja', 'Kills')}</span>
        <b>{r.kills}</b>
        <span>{tr('Aika', 'Time')}</span>
        <b>{fmtTime(r.time)}</b>
      </div>
      {rank >= 0 && <p className="record">{rank === 0 ? tr('Uusi ennätys!', 'A new record!') : tr(`Sijalla ${rank + 1}`, `Rank ${rank + 1}`)}</p>}
      <button className="btn primary big" onClick={onAgain}>
        {tr('Uusi kierros', 'New run')}
      </button>
      <button className="btn ghost" onClick={onMenu}>
        {tr('Valikkoon', 'To the menu')}
      </button>
    </div>
  );
}

export function RecordsScreen({ records, onBack }: { records: Records; onBack: () => void }) {
  return (
    <div className="screen">
      <h2>{tr('Ennätykset', 'Records')}</h2>
      <p className="small">
        {tr('Kierroksia', 'Runs')} {records.runs} · {tr('syvin', 'deepest')} {records.deepest}
        {records.wins > 0 && ` · ${tr('läpi', 'cleared')} ${records.wins}`}
      </p>
      <table className="records">
        <thead>
          <tr>
            <th>#</th>
            <th>{tr('Kerros', 'Floor')}</th>
            <th>{tr('Taso', 'Level')}</th>
            <th>{tr('Tyyli', 'Style')}</th>
            <th className="n">{tr('Aika', 'Time')}</th>
          </tr>
        </thead>
        <tbody>
          {records.best.map((b, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                {b.floor}
                {b.won ? ' ✓' : ''}
              </td>
              <td>{b.level}</td>
              <td>{b.build}</td>
              <td className="n">{fmtTime(b.time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn ghost" onClick={onBack}>
        {tr('Takaisin', 'Back')}
      </button>
    </div>
  );
}

export function GuideScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen">
      <h2>{tr('Näin pelataan', 'How to play')}</h2>
      <GuideBody />
      <button className="btn primary" onClick={onBack}>
        {tr('Takaisin', 'Back')}
      </button>
    </div>
  );
}
