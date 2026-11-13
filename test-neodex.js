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
  return 'clics programmés : ' + s.clicks + ', tempo ' + s.bpm;
};
