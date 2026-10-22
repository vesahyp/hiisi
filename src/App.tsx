import { useEffect, useState } from 'react';
import { Game, type RunSummary } from './ui/Game';
import { Title, Death, RecordsScreen, GuideScreen } from './ui/Screens';
import { loadRecords, loadSave, saveRun, type Records } from './records';
import { UpdateBanner } from './ui/Update';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { BUILD, BUILD_NAME } from './version';
import { lang, setLang } from './i18n';
import { newRun, startFloor } from './game/sim';
import { restore } from './game/save';
import type { SimState } from './game/state';

type Screen = { kind: 'title' } | { kind: 'records' } | { kind: 'guide' } | { kind: 'run'; sim: SimState; key: number } | { kind: 'dead'; r: RunSummary; rank: number };

export default function App() {
  return (
    <ErrorBoundary>
      <Screens />
    </ErrorBoundary>
  );
}

function savedFloor(): number {
  const blob = loadSave();
  if (!blob) return 0;
  try {
    return (JSON.parse(blob) as { floor?: number }).floor ?? 0;
  } catch {
    return 0;
  }
}

function Screens() {
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const [records, setRecords] = useState<Records>(() => loadRecords());
  const [, setLangState] = useState(lang);
  const [saveFloor, setSaveFloor] = useState(() => savedFloor());
  useEffect(() => {
    window.scrollTo(0, 0);
    if (screen.kind === 'title') setSaveFloor(savedFloor());
  }, [screen.kind]);

  const startNew = () => {
    const asked = Number(new URLSearchParams(location.search).get('seed'));
    const seed = asked || (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    setScreen({ kind: 'run', sim: newRun(seed), key: seed });
  };
  const resume = () => {
    const blob = loadSave();
    const s = blob ? restore(blob) : null;
    if (!s) {
      startNew();
      return;
    }
    startFloor(s);
    setScreen({ kind: 'run', sim: s, key: Date.now() });
  };

  let body;
  switch (screen.kind) {
    case 'title':
      body = (
        <Title
          records={records}
          hasSave={saveFloor > 0}
          saveFloor={saveFloor}
          onContinue={resume}
          onNew={startNew}
          onRecords={() => setScreen({ kind: 'records' })}
          onGuide={() => setScreen({ kind: 'guide' })}
          onLang={(l) => {
            setLang(l);
            setLangState(l);
          }}
        />
      );
      break;
    case 'records':
      body = <RecordsScreen records={records} onBack={() => setScreen({ kind: 'title' })} />;
      break;
    case 'guide':
      body = <GuideScreen onBack={() => setScreen({ kind: 'title' })} />;
      break;
    case 'run':
      body = (
        <Game
          key={screen.key}
          sim={screen.sim}
          onQuit={() => setScreen({ kind: 'title' })}
          onEnd={(r) => {
            const saved = saveRun({ floor: r.floor, level: r.level, time: r.time, kills: r.kills, build: r.build, won: r.won, date: new Date().toISOString() });
            setRecords(saved.records);
            setScreen({ kind: 'dead', r, rank: saved.rank });
          }}
        />
      );
      break;
    case 'dead':
      body = <Death r={screen.r} rank={screen.rank} onAgain={startNew} onMenu={() => setScreen({ kind: 'title' })} />;
      break;
  }
  return (
    <>
      {body}
      {screen.kind !== 'run' && <UpdateBanner />}
      {screen.kind === 'title' && (
        <div className="build">
          {BUILD_NAME} · {BUILD} · <a href="mockups/">{lang() === 'fi' ? 'mallikuvat' : 'mockups'}</a>
        </div>
      )}
    </>
  );
}
