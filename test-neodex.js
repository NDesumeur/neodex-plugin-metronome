// lancé par le test « local » de NeoDex : vérification interne, puis démarre, monte le tempo au clavier, vérifie que des clics sont programmés, arrête
module.exports = async ({ pj, sleep }) => {
  const key = k => pj(`document.dispatchEvent(new KeyboardEvent('keydown', {key: '${k}', bubbles: true})), 0`);
  const state = () => pj(`document.getElementById('meCanvas').__state()`);
  const sc = await pj(`document.querySelector('[data-selfcheck]')?.dataset.selfcheck`); if (sc !== 'ok') throw new Error('vérification interne : ' + sc);
  const b0 = (await state()).bpm;
  await key(' '); await sleep(800); await key('ArrowRight'); await key('ArrowUp'); await sleep(500);
  const s = await state();
  if (!s.running || !s.clicks) throw new Error('pas de clics programmés : ' + JSON.stringify(s));
  if (s.bpm !== Math.min(260, b0 + 6)) throw new Error('tempo ' + s.bpm + ' au lieu de ' + (b0 + 6));
  await key(' '); await sleep(200);
  if ((await state()).running) throw new Error('ne s’arrête pas');
  // l'entraînement : à 200 BPM en 4/4, +5 toutes les 2 mesures jusqu'à 210 ; puis une mesure muette sur deux
  const sel = (id, v) => pj(`(() => { const e = document.getElementById('${id}'); e.value = '${v}'; e.dispatchEvent(new Event('change')); return 0; })()`);
  await sel('meSig', 2); await pj(`(() => { const r = document.getElementById('meBpm'); r.value = 200; r.dispatchEvent(new Event('input')); return 0; })()`);
  await sel('meProg', 4); await sel('meTop', 210); await key(' ');
  let p; for (let i = 0; i < 20; i++) { await sleep(500); p = await state(); if (p.live >= 210) break; }
  if (p.live !== 210 || p.bpm !== 200) throw new Error('programme : ' + JSON.stringify(p));
  await sel('meSil', 1); await sleep(4000); const q = await state();
  if (!q.silent) throw new Error('silence : aucune mesure muette · ' + JSON.stringify(q));
  await key(' '); await sel('meProg', 0); await sel('meSil', 0);
  return 'clics programmés : ' + s.clicks + ', tempo ' + s.bpm + ' · programme 200 → ' + p.live + ' BPM, ' + q.silent + ' temps muets';
};
