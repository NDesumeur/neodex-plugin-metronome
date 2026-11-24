// Métronome : un métronome visuel en pixel art, avec la mesure, les accents, les subdivisions et le tempo tapé.
// Les clics sont programmés dans l'horloge audio (à l'échantillon près), même quand l'onglet n'est pas devant. Il tourne dans le bac à sable de NeoDex.
const HTML = `<div class="appWrap wide">
  <div class="agHead"><span class="label">Métronome</span><span class="hint">Espace : démarrer ou arrêter · flèches : tempo (±1, ±5) · T : taper le tempo · A : accent</span></div>
  <div class="gMain"><div class="gameBox"><canvas id="meCanvas" width="240" height="128" role="img" aria-label="Métronome"></canvas></div>
    <div class="gSide">
      <div class="sysCard"><b>TEMPO</b>
        <div class="row"><button class="btn" id="meM5">−5</button><button class="btn" id="meM1">−1</button><input type="range" id="meBpm" min="30" max="260" value="100"><button class="btn" id="meP1">+1</button><button class="btn" id="meP5">+5</button></div>
        <div class="row"><button class="btn main" id="mePlay">DÉMARRER</button><button class="btn" id="meTap">TAPER</button></div>
      </div>
      <div class="sysCard"><b>MESURE</b>
        <div class="row"><select class="gSel" id="meSig"></select><select class="gSel" id="meSub"></select><select class="gSel" id="meSnd"></select></div>
        <div class="row"><label><input type="checkbox" id="meAcc"> Accent sur le premier temps</label></div>
        <div class="row"><span class="hint">Volume</span><input type="range" id="meVol" min="0" max="100" value="70"></div>
      </div>
      <div class="sysCard"><b>ENTRAÎNEMENT</b>
        <div class="row"><select class="gSel" id="meProg"></select><span class="hint">jusqu'à</span><input type="number" class="gSel meTop" id="meTop" min="30" max="260"><span class="hint">BPM</span></div>
        <div class="row"><select class="gSel" id="meSil"></select></div>
      </div>
      <div class="hint">Clique sur un temps de la mesure pour changer son accent : fort, normal ou muet. Le tempo tapé suit tes quatre derniers appuis.</div>
    </div></div>
</div>`;
const CSS = `.gMain{display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap}
.gameBox{display:grid;place-items:center;padding:10px;background:#05010b;flex:0 0 auto;position:relative}
.meTop{width:76px}
.gameBox canvas{height:min(64vh,520px);width:auto;aspect-ratio:240/128;image-rendering:pixelated;cursor:var(--cp,pointer);touch-action:none}
.gSide{display:flex;flex-direction:column;gap:14px;flex:1;min-width:280px;max-width:440px}
.gSide .sysCard{display:flex;flex-direction:column;gap:10px}`;
const ME_SIG = [['2/4', 2, 4], ['3/4', 3, 4], ['4/4', 4, 4], ['5/4', 5, 4], ['6/8', 6, 8], ['7/8', 7, 8], ['9/8', 9, 8], ['12/8', 12, 8]];
const ME_SUB = [['Sans subdivision', 1], ['Croches', 2], ['Triolets', 3], ['Doubles croches', 4]];
const ME_SND = [['Clic', 'square', 1600, 1000], ['Bois', 'triangle', 1200, 800], ['Bip', 'sine', 1760, 880], ['Cloche', 'sine', 2093, 1047]];
// les programmes : [nom, BPM ajoutés, toutes les N mesures] ; le silence : [nom, mesures jouées, mesures muettes]
const ME_PROG = [['Tempo fixe', 0, 0], ['+2 BPM toutes les 4 mesures', 2, 4], ['+5 BPM toutes les 8 mesures', 5, 8], ['+5 BPM toutes les 4 mesures', 5, 4], ['+5 BPM toutes les 2 mesures', 5, 2], ['+10 BPM toutes les 16 mesures', 10, 16]];
const ME_SIL = [['Pas de silence', 0, 0], ['Silence : 1 mesure sur 2', 1, 1], ['Silence : 2 mesures sur 4', 2, 2], ['Silence : 1 mesure sur 4', 3, 1], ['Silence : 4 mesures sur 8', 4, 4]];
const ME_NAMES = [[40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [999, 'Prestissimo']];
/* ---------- l'habillage pixel art, dessiné à la main : police bitmap (accents compris), cadres, boutons, icônes ----------
   Tout est en pixels pleins, agrandis par 2 sans lissage : aucun dégradé, aucune ombre floue. */
const PXK = (() => {
  // chaque lettre : ses lignes, de haut en bas, à partir de la ligne 2 de la case (0-1 : accents des majuscules, 9-10 : jambages)
  const S = {
    A: '.###. #...# #...# ##### #...# #...# #...#', B: '####. #...# #...# ####. #...# #...# ####.', C: '.###. #...# #.... #.... #.... #...# .###.',
    D: '####. #...# #...# #...# #...# #...# ####.', E: '##### #.... #.... ####. #.... #.... #####', F: '##### #.... #.... ####. #.... #.... #....',
    G: '.###. #...# #.... #.### #...# #...# .####', H: '#...# #...# #...# ##### #...# #...# #...#', I: '### .#. .#. .#. .#. .#. ###',
    J: '..### ...#. ...#. ...#. #..#. #..#. .##..', K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#', L: '#.... #.... #.... #.... #.... #.... #####',
    M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#...# ##..# #.#.# #..## #...# #...# #...#', O: '.###. #...# #...# #...# #...# #...# .###.',
    P: '####. #...# #...# ####. #.... #.... #....', Q: '.###. #...# #...# #...# #.#.# #..#. .##.#', R: '####. #...# #...# ####. #.#.. #..#. #...#',
    S: '.#### #.... #.... .###. ....# ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..', U: '#...# #...# #...# #...# #...# #...# .###.',
    V: '#...# #...# #...# #...# #...# .#.#. ..#..', W: '#...# #...# #...# #.#.# #.#.# ##.## #...#', X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
    Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '##### ....# ...#. ..#.. .#... #.... #####',
    a: '..... ..... .###. ....# .#### #...# .####', b: '#.... #.... ####. #...# #...# #...# ####.', c: '..... ..... .###. #.... #.... #.... .###.',
    d: '....# ....# .#### #...# #...# #...# .####', e: '..... ..... .###. #...# ##### #.... .###.', f: '..## .#.. #### .#.. .#.. .#.. .#..',
    g: '..... ..... .#### #...# #...# #...# .#### ....# .###.', h: '#.... #.... ####. #...# #...# #...# #...#', i: '.#. ... ##. .#. .#. .#. ###',
    'ı': '... ... ##. .#. .#. .#. ###', j: '...# .... ..## ...# ...# ...# ...# #..# .##.', k: '#... #... #..# #.#. ##.. #.#. #..#',
    l: '##. .#. .#. .#. .#. .#. ###', m: '..... ..... ##.#. #.#.# #.#.# #.#.# #...#', n: '..... ..... ####. #...# #...# #...# #...#',
    o: '..... ..... .###. #...# #...# #...# .###.', p: '..... ..... ####. #...# #...# #...# ####. #.... #....', q: '..... ..... .#### #...# #...# #...# .#### ....# ....#',
    r: '.... .... #.## ##.. #... #... #...', s: '..... ..... .#### #.... .###. ....# ####.', t: '.#.. .#.. #### .#.. .#.. .#.. ..##',
    u: '..... ..... #...# #...# #...# #..## .##.#', v: '..... ..... #...# #...# #...# .#.#. ..#..', w: '..... ..... #...# #...# #.#.# #.#.# .#.#.',
    x: '..... ..... #...# .#.#. ..#.. .#.#. #...#', y: '..... ..... #...# #...# #...# #...# .#### ....# .###.', z: '..... ..... ##### ...#. ..#.. .#... #####',
    0: '.###. #...# #..## #.#.# ##..# #...# .###.', 1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.', 2: '.###. #...# ....# ...#. ..#.. .#... #####',
    3: '####. ....# ....# .###. ....# ....# ####.', 4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ....# #...# .###.',
    6: '.###. #.... #.... ####. #...# #...# .###.', 7: '##### ....# ...#. ..#.. .#... .#... .#...', 8: '.###. #...# #...# .###. #...# #...# .###.',
    9: '.###. #...# #...# .#### ....# ....# .###.',
    '.': '. . . . . . #', ',': '.. .. .. .. .. .# .# #.', ':': '. . # . . . #', ';': '.. .. .# .. .. .# .# #.', '!': '# # # # # . #',
    '?': '.###. #...# ....# ...#. ..#.. ..... ..#..', "'": '# # . . . . .', '"': '#.# #.# ... ... ... ... ...', '-': '... ... ... ### ... ... ...',
    '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....', '/': '....# ...#. ...#. ..#.. .#... .#... #....', '(': '.# #. #. #. #. #. .#', ')': '#. .# .# .# .# .# #.',
    '%': '##..# ##.#. ...#. ..#.. .#... .#.## #..##', '·': '. . . # . . .', '×': '..... ..... #...# .#.#. ..#.. .#.#. #...#',
    '<': '...# ..#. .#.. #... .#.. ..#. ...#', '>': '#... .#.. ..#. ...# ..#. .#.. #...', '=': '.... .... #### .... #### .... ....',
    '_': '..... ..... ..... ..... ..... ..... #####', '#': '.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.', '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
    '…': '..... ..... ..... ..... ..... ..... #.#.#', '«': '..... ..#.# .#.#. #.#.. .#.#. ..#.# .....', '»': '..... #.#.. .#.#. ..#.# .#.#. #.#.. .....',
    '◀': '...# ..## .### #### .### ..## ...#', '▶': '#... ##.. ###. #### ###. ##.. #...', '→': '..... ..#.. ...#. ##### ...#. ..#.. .....',
    '←': '..... ..#.. .#... ##### .#... ..#.. .....', '↑': '..#.. .###. #.#.# ..#.. ..#.. ..#.. ..#..', '↓': '..#.. ..#.. ..#.. ..#.. #.#.# .###. ..#..',
    '*': '..... #.#.# .###. ##### .###. #.#.# .....', '[': '## #. #. #. #. #. ##', ']': '## .# .# .# .# .# ##', '|': '# # # # # # #',
    '@': '.###. #...# #.### #.#.# #.### #.... .###.', '€': '..### .#... ####. .#... ####. .#... ..###', '$': '..#.. .#### #.#.. .###. ..#.# ####. ..#..',
    '°': '.#. #.# .#. ... ... ... ...', '~': '..... ..... .#..# #.##. ..... ..... .....', '♪': '..##. ..#.# ..#.. ..#.. .##.. ###.. .#...',
  };
  const ACC = { a: ['..#', '.#.'], g: ['#..', '.#.'], c: ['.#.', '#.#'], d: ['...', '#.#'], t: ['.#.#', '#.#.'], z: ['.#.', '##.'] };  // aigu, grave, circonflexe, tréma, tilde, cédille
  const COMP = { é: 'ea', è: 'eg', ê: 'ec', ë: 'ed', á: 'aa', à: 'ag', â: 'ac', ä: 'ad', í: 'ıa', ì: 'ıg', î: 'ıc', ï: 'ıd', ó: 'oa', ò: 'og', ô: 'oc', ö: 'od',
    ú: 'ua', ù: 'ug', û: 'uc', ü: 'ud', ÿ: 'yd', ñ: 'nt', ç: 'cz', É: 'Ea', È: 'Eg', Ê: 'Ec', Ë: 'Ed', Á: 'Aa', À: 'Ag', Â: 'Ac', Ä: 'Ad', Í: 'Ia', Î: 'Ic', Ï: 'Id',
    Ó: 'Oa', Ô: 'Oc', Ö: 'Od', Ú: 'Ua', Ù: 'Ug', Û: 'Uc', Ü: 'Ud', Ñ: 'Nt', Ç: 'Cz' };
  const SUB = { 'œ': 'oe', 'Œ': 'OE', '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', ' ': ' ', ' ': ' ', '•': '·', '✓': 'v', 'ᐸ': '<', 'ᐳ': '>', '＜': '<', '＞': '>', '｜': '|', '／': '/', '！': '!', '？': '?', '（': '(', '）': ')', '：': ':', '　': ' ' };  // ᐸ ᐳ : les < > des titres YouTube
  const H = 11, glyphs = new Map(); let raster;
  function glyph(ch) {
    let g = glyphs.get(ch); if (g) return g;
    const px = [], add = (rows, ox, oy) => rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') px.push([ox + x, oy + y]); });
    const c = COMP[ch], src = S[c ? c[0] : ch]; let w = 3;
    if (src) {
      const rows = src.split(' '); w = Math.max(...rows.map(r => r.length)); add(rows, 0, 2);
      if (c) { const a = ACC[c[1]]; add(a, Math.floor((w - a[0].length) / 2), c[1] === 'z' ? 9 : /[A-Z]/.test(c[0]) ? 0 : 1); }
    } else if (ch !== ' ') {  // japonais, emoji… : la lettre du système, réduite à des pixels nets (sans lissage) sur la même hauteur que la police
      const q = (raster ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })), RW = 16;
      q.canvas.width = RW; q.canvas.height = H; q.font = '11px "MS Gothic", "Yu Gothic UI", Meiryo, "Segoe UI Symbol", sans-serif'; q.fillStyle = '#000'; q.fillText(ch, 0, 10);
      const d = q.getImageData(0, 0, RW, H).data; let mx = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < RW; x++) if (d[(y * RW + x) * 4 + 3] > 110) { px.push([x, y]); mx = Math.max(mx, x + 1); }
      w = mx || 3;
      if (!px.length) { w = 5; add(['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'], 0, 2); }  // vraiment inconnue : une petite case
    }
    g = { w, px }; glyphs.set(ch, g); return g;
  }
  function layout(text) {
    let x = 0; const items = [];
    for (const ch of String(text)) for (const c of SUB[ch] ?? ch) { const g = glyph(c); items.push([g, x]); x += g.w + 1; }
    return { w: Math.max(0, x - 1), items };
  }
  function draw(g, text, x, y, color, s = 1) {  // (x, y) : coin haut gauche de la case
    const L = layout(text); g.fillStyle = color;
    for (const [gl, ox] of L.items) for (const [px, py] of gl.px) g.fillRect(x + (ox + px) * s, y + py * s, s, s);
    return L.w * s;
  }
  const bmp = new Map();
  function sprite(text, color, s = 1) {  // le texte tout prêt, gardé pour les images suivantes du jeu
    const k = text + '|' + color + '|' + s; let c = bmp.get(k); if (c) return c;
    c = document.createElement('canvas'); c.width = Math.max(1, layout(text).w * s); c.height = H * s; draw(c.getContext('2d'), text, 0, 0, color, s);
    if (bmp.size > 400) bmp.delete(bmp.keys().next().value);
    bmp.set(k, c); return c;
  }
  // comme fillText : (x, y) sur la ligne de base, aligné à gauche, au centre ou à droite
  function fill(g, text, x, y, color, s = 1, align = 'left') {
    const c = sprite(String(text), color, s), dx = align === 'center' ? -c.width / 2 : align === 'right' ? -c.width : 0;
    g.drawImage(c, Math.round(x + dx), Math.round(y - 9 * s));
  }
  const scale = size => Math.max(1, Math.round((size || 8) / 8));
  function art(rows, pal, s = 1) {  // un dessin en lignes de caractères, chaque caractère une couleur de la palette (« . » : transparent)
    const c = document.createElement('canvas'); c.width = Math.max(...rows.map(r => r.length)) * s; c.height = rows.length * s;
    const g = c.getContext('2d');
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = pal[r[x]]; if (col) { g.fillStyle = col; g.fillRect(x * s, y * s, s, s); } } });
    return c;
  }
  return { H, layout, draw, sprite, fill, scale, art };
})();

// les pièces de l'interface, pixel par pixel (K : contour, les autres lettres : la palette du jeu)
const PX_PANEL = ['..KKKKKKKKKKKK..', '.KAAAAAAAAAAAAK.', 'KALAAAAAAAAAALSK', 'KAAKKKKKKKKKKSSK', 'KAAKHHHHHHHHKSSK', 'KAAKHDDDDDDDKSSK', 'KAAKHDDDDDDDKSSK', 'KAAKHDDDDDDDKSSK',
  'KAAKHDDDDDDDKSSK', 'KAAKHDDDDDDDKSSK', 'KAAKHDDDDDDDKSSK', 'KAAKHDDDDDDDKSSK', 'KAAKKKKKKKKKKSSK', 'KALSSSSSSSSSSLSK', '.KSSSSSSSSSSSSK.', '..KKKKKKKKKKKK..'];
const PX_CARD = ['.KKKKKKKKKK.', 'KFFFFFFFFFFK', 'KFHHHHHHHHFK', 'KFHDDDDDDDFK', 'KFHDDDDDDDFK', 'KFHDDDDDDDFK', 'KFHDDDDDDDFK', 'KFHDDDDDDDFK', 'KFHDDDDDDDFK', 'KFSSSSSSSSFK', 'KFFFFFFFFFFK', '.KKKKKKKKKK.'];
const PX_BTN = ['.KKKKKKKKKK.', 'KWWWWWWWWWWK', 'KWMMMMMMMMBK', 'KWMMMMMMMMBK', 'KWMMMMMMMMBK', 'KWMMMMMMMMBK', 'KWMMMMMMMMBK', 'KWMMMMMMMMBK', 'KBBBBBBBBBBK', 'KKKKKKKKKKKK', 'KDDDDDDDDDDK', '.KKKKKKKKKK.'];
const PX_BTN_DOWN = ['............', '............', '.KKKKKKKKKK.', 'KBBBBBBBBBBK', 'KBMMMMMMMMWK', 'KBMMMMMMMMWK', 'KBMMMMMMMMWK', 'KBMMMMMMMMWK', 'KBMMMMMMMMWK', 'KBMMMMMMMMWK', 'KWWWWWWWWWWK', '.KKKKKKKKKK.'];
const PX_TRACK = ['.KKKKKKKKKK.', 'KDDDDDDDDDDK', 'KDDDDDDDDDDK', 'KDDDDDDDDDDK', 'KHHHHHHHHHHK', '.KKKKKKKKKK.'];
const PX_KNOB = ['.KKKKK.', 'KWWWWWK', 'KWAAABK', 'KWAAABK', 'KKKKKKK', 'KWAAABK', 'KWAAABK', 'KBBBBBK', 'KDDDDDK', '.KKKKK.'];
const PX_RAIL = ['KDDDDDDK', 'KDDDDDDK', 'KDDDDDDK', 'KDDHHDDK'];
const PX_ICONS = {
  play: ['kk......', 'kakk....', 'kaaakk..', 'kaaaaakk', 'kaaaaaak', 'kaaaaakk', 'kaaakk..', 'kakk....', 'kk......'],
  full: ['www...www', 'w.......w', 'w.......w', '.........', '....a....', '.........', 'w.......w', 'w.......w', 'www...www'],
  note: ['...aaaaaa', '...aaaaaa', '...a....a', '...a....a', '...a....a', '.aaa..aaa', 'aaaa.aaaa', 'aaaa.aaaa', '.aa...aa.'],
  star: ['....g....', '....g....', '...ggg...', 'ggggwgggg', '.ggwwwgg.', '..ggggg..', '..oo.oo..', '.oo...oo.', '.o.....o.'],
  crown: ['g...g...g', 'gg.ggg.gg', 'ggggggggg', 'grgggggrg', 'ggggggggg', 'ooooooooo'],
  folder: ['oooo.....', 'oggoooooo', 'ggggggggg', 'ggggggggg', 'ggggggggg', 'ggggggggg', 'ooooooooo'],
  vol: ['....w....', '...ww..b.', 'wwwww.b.b', 'wwwww.b.b', 'wwwww.b.b', 'wwwww.b.b', '...ww..b.', '....w....'],
  clock: ['..wwwww..', '.w.....w.', 'w...a...w', 'w...a...w', 'w...aaa.w', 'w.......w', 'w.......w', '.w.....w.', '..wwwww..'],
  cursor: ['....a....', '..aaaaa..', '.a..a..a.', '.a.....a.', 'aaa.w.aaa', '.a.....a.', '.a..a..a.', '..aaaaa..', '....a....'],
  plus: ['...b...', '...b...', '...b...', 'bbbbbbb', '...b...', '...b...', '...b...'],
  down: ['wwwwwww', '.wwwww.', '..www..', '...w...'],
};

/* habille la page du jeu : root = son conteneur, T = sa palette, icons = [motif du texte, icône] pour les boutons et libellés */
function pxSkin(root, { T, icons = [], emblem, title }) {
  root.classList.add('pxk'); const s = 2, url = c => c.toDataURL();
  const btnPal = (M, W, B, D) => ({ K: T.k, W, M, B, D });
  const BN = btnPal(T.btn, T.btnHi, T.btnLo, T.k2), BH = btnPal(T.btnHov, T.btnHovHi, T.btnLo, T.k2);
  const BA = btnPal(T.acc, T.accL, T.accS, T.accD), BAH = btnPal(T.accL, '#ffffff', T.acc, T.accD);
  const img = { panel: PXK.art(PX_PANEL, { K: T.k, A: T.acc, S: T.accS, L: T.rivet, H: T.hl, D: T.fill }, s),
    card: PXK.art(PX_CARD, { K: T.k, F: T.line, H: T.hl, D: T.fill, S: T.k2 }, s), cardOn: PXK.art(PX_CARD, { K: T.k, F: T.acc, H: T.accS, D: T.fillOn, S: T.accD }, s),
    btn: PXK.art(PX_BTN, BN, s), btnH: PXK.art(PX_BTN, BH, s), btnD: PXK.art(PX_BTN_DOWN, BH, s),
    main: PXK.art(PX_BTN, BA, s), mainH: PXK.art(PX_BTN, BAH, s), mainD: PXK.art(PX_BTN_DOWN, BA, s),
    track: PXK.art(PX_TRACK, { K: T.k, D: T.k2, H: T.line }, s), knob: PXK.art(PX_KNOB, { K: T.k, W: T.accL, A: T.acc, B: T.accS, D: T.accD }, s),
    rail: PXK.art(PX_RAIL, { K: T.k, D: T.k2, H: T.line }, s), tile: PXK.art(T.tile, { x: T.bgDot, ':': T.bgDot2, '+': T.spark, '*': T.spark2 }, s) };
  const u = Object.fromEntries(Object.entries(img).map(([k, c]) => [k, url(c)]));
  const nine = (k, sl) => `border-style:solid;border-width:${sl * s}px;border-image:url(${u[k]}) ${sl * s} fill / ${sl * s}px stretch`;
  const IP = { k: T.k, w: T.text, a: T.acc, b: T.acc2, g: T.gold, o: T.orange, r: T.red, n: T.green, N: T.green2, m: T.muted, s: T.accS };
  const iconUrl = new Map(), icon = name => {
    let v = iconUrl.get(name); if (!v) { const c = PXK.art(PX_ICONS[name] || emblem, IP, s); v = { u: url(c), w: c.width, h: c.height }; iconUrl.set(name, v); }
    const b = document.createElement('b'); b.className = 'pxI'; b.setAttribute('aria-hidden', 'true'); b.style.cssText = `width:${v.w}px;height:${v.h}px;background-image:url(${v.u})`; return b;
  };
  const R = '.pxk.pxk';
  const css = document.createElement('style');
  css.textContent = `html,html body{background:${T.bg} url(${u.tile}) 0 0/${img.tile.width}px ${img.tile.height}px repeat!important}
::-webkit-scrollbar{width:16px;height:16px} ::-webkit-scrollbar-track{background:url(${u.rail}) 0 0/16px 8px repeat-y} ::-webkit-scrollbar-thumb{${nine('main', 4)}} ::-webkit-scrollbar-corner{background:none}
${R}{color:${T.text}}
${R} .px{box-shadow:none;background:none}
${R} .agHead{gap:18px;margin:0}
${R} .agHead .label{display:flex;align-items:center;gap:12px}
${R} .btn,${R} .tab{${nine('btn', 4)};height:auto;min-height:0;padding:0 6px 4px;margin:0;color:${T.text};font:12px/1 monospace;display:inline-flex;align-items:center;gap:6px;filter:none;text-shadow:none;letter-spacing:0;cursor:var(--cp,pointer)}
${R} .btn:hover,${R} .tab:hover{border-image-source:url(${u.btnH})}
${R} .btn:active,${R} .tab:active{border-image-source:url(${u.btnD});padding:4px 6px 0}
${R} .btn.main,${R} .tab.on{border-image-source:url(${u.main});color:${T.k}}
${R} .btn.main:hover,${R} .tab.on:hover{border-image-source:url(${u.mainH})}
${R} .btn.main:active,${R} .tab.on:active{border-image-source:url(${u.mainD})}
${R} .btn:focus-visible,${R} .tab:focus-visible{outline:2px dashed ${T.acc2};outline-offset:2px}
${R} .btn .pxV,${R} .tab .pxV{white-space:nowrap}
${R} .sysCard{${nine('card', 4)};padding:4px 6px;gap:8px;background:none}
${R} .sysCard.on{border-image-source:url(${u.cardOn})}
${R} .sysCard.on>b{color:${T.acc}}
${R} .sysCard>b{color:${T.text}}
${R} .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
${R} .gameBox,${R} .thBox{${nine('panel', 5)};box-shadow:none;background:none;padding:2px;gap:8px;grid-template-rows:auto auto}
${R} .gameBox canvas,${R} .thBox canvas{display:block;background:#05010b}
${R} .gameBox:fullscreen,${R} .thBox:fullscreen{border:0;padding:0;background:#000}
${R} .rhFs{position:static;opacity:1;justify-self:end;margin:0 6px 6px 0}
${R} .rhTabs{gap:8px;flex-wrap:wrap}
${R} .hint{color:${T.muted};line-height:24px}
${R} label{color:${T.muted};display:inline-flex;align-items:center;gap:8px}
${R} .rhDel{color:${T.red};top:6px;right:8px}
${R} input[type=range]{-webkit-appearance:none;appearance:none;background:none;height:20px;width:150px}
${R} input[type=range]::-webkit-slider-runnable-track{height:12px;${nine('track', 2)}}
${R} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:20px;border:0;background:url(${u.knob}) 0 0/100% 100%;margin-top:-8px;cursor:var(--cp,pointer)}
${R} .pxSel{justify-content:space-between;gap:10px;max-width:100%;overflow:hidden}
${R} .rhImport .pxSel{flex:1;min-width:0}
.pxMenu{position:fixed;z-index:50;${nine('card', 4)};padding:2px;max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;color:${T.text}}
.pxMenu button{all:unset;padding:3px 8px;cursor:var(--cp,pointer);white-space:nowrap}
.pxMenu button:hover,.pxMenu button:focus-visible,.pxMenu button.on{background:${T.btnHov};color:${T.text}}
.pxMenu button.on{color:${T.acc}}
.pxT{position:relative;white-space:normal;font:12px/1 monospace;letter-spacing:0;text-transform:none}
.pxT i{display:inline-block;vertical-align:middle;background:currentColor;-webkit-mask:var(--m) 0 0/100% 100% no-repeat;mask:var(--m) 0 0/100% 100% no-repeat;image-rendering:pixelated}
.pxI{display:inline-block;vertical-align:middle;background:0 0/100% 100% no-repeat;image-rendering:pixelated;margin-right:6px}
.pxV>.pxI+.pxI{margin-left:-4px}
.pxSr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;
  document.head.append(css);
  // un mot = une image (en masque : sa couleur suit celle du texte), une règle par mot pour ne pas répéter l'image
  const words = new Map(), sheet = document.head.appendChild(document.createElement('style')).sheet;
  const word = w => {
    let k = words.get(w);
    if (!k) { const c = PXK.sprite(w, '#fff', s); k = 'pw' + words.size; words.set(w, k); sheet.insertRule(`.${k}{--m:url(${c.toDataURL()});width:${c.width}px;height:${c.height}px}`, sheet.cssRules.length); }
    const i = document.createElement('i'); i.className = k; return i;
  };
  function render(vis, text, lead) {
    const parts = [], ic = lead && icons.find(([re]) => re.test(text.trim()));
    if (ic) parts.push(icon(ic[1]));
    for (const m of text.matchAll(/(★+)|(\s+)|([^\s★]+)/g)) {
      if (m[1]) for (const _ of m[1]) parts.push(icon('star'));
      else if (m[2]) parts.push(document.createTextNode(' '));
      else parts.push(word(m[3]));
    }
    vis.replaceChildren(...parts);
  }
  const lead = node => node.parentElement?.matches('button,label,.tab,.btn') && !node.previousSibling;
  function pixText(node) {  // le texte reste dans la page (lecteur d'écran, copier) ; on voit ses lettres en pixels
    const wrap = document.createElement('span'), sr = document.createElement('span'), vis = document.createElement('span');
    wrap.className = 'pxT'; sr.className = 'pxSr'; vis.className = 'pxV'; vis.setAttribute('aria-hidden', 'true');
    const first = lead(node); node.replaceWith(wrap); sr.append(node); wrap.append(sr, vis); render(vis, node.data, first);
  }
  function pxSelect(sel) {  // une liste déroulante en pixels ; la vraie reste cachée et garde sa valeur et ses événements
    sel.dataset.px = '1'; sel.style.display = 'none';
    const b = document.createElement('button'), lab = document.createElement('span'); b.type = 'button'; b.className = 'btn pxSel'; b.append(lab, icon('down')); sel.after(b);
    const sync = () => { const t = sel.selectedOptions[0]?.textContent || '—'; if (lab.dataset.t !== t) { lab.dataset.t = t; lab.textContent = t; } };
    const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(sel, 'value', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sync(); } });
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true, attributes: true });
    sel.addEventListener('change', sync);
    b.onclick = () => {
      document.querySelector('.pxMenu')?.remove();
      const m = document.createElement('div'), r = b.getBoundingClientRect(); m.className = 'pxMenu'; m.setAttribute('role', 'listbox');
      for (const o of sel.options) {
        const it = document.createElement('button'); it.type = 'button'; it.textContent = o.textContent; it.className = o.selected ? 'on' : ''; it.setAttribute('role', 'option');
        it.onclick = () => { sel.value = o.value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); close(); b.focus(); };
        m.append(it);
      }
      root.append(m);
      const below = innerHeight - r.bottom; m.style.minWidth = r.width + 'px'; m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 4) + 'px';
      m.style.top = (below > m.offsetHeight + 8 || below > r.top ? r.bottom + 2 : r.top - m.offsetHeight - 2) + 'px';
      const close = () => { m.remove(); removeEventListener('pointerdown', out, true); removeEventListener('keydown', key, true); removeEventListener('blur', close); };
      const out = e => { if (!m.contains(e.target) && e.target !== b && !b.contains(e.target)) close(); };
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); b.focus(); } };
      addEventListener('pointerdown', out, true); addEventListener('keydown', key, true); addEventListener('blur', close);
      (m.querySelector('.on') || m.firstChild)?.focus();
    };
    sync();
  }
  const SKIP = 'select,option,textarea,script,style,canvas,.pxT,[data-pxskip]';
  let queued = false;
  function pass() {
    queued = false;
    root.querySelectorAll('select.gSel:not([data-px])').forEach(pxSelect);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), todo = [];
    for (let n; (n = w.nextNode());) if (n.data.trim() && n.parentElement && !n.parentElement.closest(SKIP)) todo.push(n);
    todo.forEach(pixText);
  }
  new MutationObserver(ms => {
    for (const m of ms) if (m.type === 'characterData') { const wrap = m.target.parentNode?.closest?.('.pxT'); if (wrap) render(wrap.lastChild, m.target.data, false); }
    if (!queued) { queued = true; queueMicrotask(pass); }
  }).observe(root, { childList: true, subtree: true, characterData: true });
  // le titre : grosses lettres à contour, trois tons, et l'emblème du jeu
  const lab = root.querySelector('.agHead .label');
  if (lab) {
    const L = PXK.layout(title), c = document.createElement('canvas'), g = c.getContext('2d'), on = [];
    c.width = L.w + 3; c.height = PXK.H + 3;
    for (const [gl, ox] of L.items) for (const [x, y] of gl.px) on.push([ox + x + 1, y + 1]);
    g.fillStyle = T.k; for (const [x, y] of on) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [2, 2], [1, 2], [2, 1]]) g.fillRect(x + dx, y + dy, 1, 1);
    for (const [x, y] of on) { g.fillStyle = y <= 5 ? T.accL : y <= 7 ? T.acc : T.accS; g.fillRect(x, y, 1, 1); }
    const big = document.createElement('canvas'), z = 4; big.width = c.width * z; big.height = c.height * z;
    const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(c, 0, 0, big.width, big.height);
    const t = document.createElement('b'); t.className = 'pxI'; t.style.cssText = `width:${big.width}px;height:${big.height}px;background-image:url(${big.toDataURL()})`;
    const e = PXK.art(emblem, IP, 3), em = document.createElement('b'); em.className = 'pxI'; em.style.cssText = `width:${e.width}px;height:${e.height}px;background-image:url(${e.toDataURL()})`;
    const sr = document.createElement('span'); sr.className = 'pxSr'; sr.textContent = lab.textContent;
    lab.dataset.pxskip = '1'; lab.replaceChildren(em, t, sr);
  }
  pass();
}



export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const host = ctx.host, { el, toast } = host;
  const folder = ctx.folder;
  host.addStyle(CSS);
  view.innerHTML = HTML;
  const $ = id => view.querySelector('#' + id) || document.getElementById(id);
  const doc = async n => { try { return await folder.read(n); } catch { return null; } };
  const px = (g, color, x, y, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const sprite = (g, rows, x, y, pal) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) px(g, c, x + i, y + j); } });
  const seeded = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pxFont = (g, text, x, y, color, size = 8, align = 'left') => { const s = PXK.scale(size); PXK.fill(g, text, x + s, y + s, '#05010b', s, align); PXK.fill(g, text, x, y, color, s, align); };
  const gameText = (g, w, lines, y0) => {  // lignes centrées en police pixel, sur une bande sombre
    g.fillStyle = 'rgba(11,3,28,.78)'; g.fillRect(0, y0 - 14, w, lines.length * 14 + 14);
    lines.forEach(([text, color, size], i) => PXK.fill(g, text, w / 2, y0 + i * 14, color, PXK.scale(size), 'center'));
  };
  const theme = (acc, accL, accS, accD, acc2, base = ['#0c0a12', '#16121e', '#221c2c', '#2e263a', '#3a3046', '#62566e']) => {
    const [k, k2, fill, fillOn, hl, line] = base;
    return { k, k2, fill, fillOn, hl, line, acc, accL, accS, accD, rivet: '#f0f0f8', btn: hl, btnHi: line, btnLo: k2, btnHov: '#443852', btnHovHi: '#82768e', text: '#f4f0f8', muted: '#c0b8cc',
      acc2, gold: '#ffd84a', orange: '#ff8a3a', red: '#ff4a3a', green: '#7ee07a', green2: '#2f8a3a', bg: '#100c16', bgDot: fill, bgDot2: k2, spark: accD, spark2: acc,
      tile: ['................', '...:............', '................', '..........+.....', '................', '................', '.....:..........', '................', '................', '.............:..', '................', '..+.............', '................', '.........:......', '................', '................'] };
  };
  let ac = null, mute = false;
  const beep = (f, d, type = 'square', slide = 0, vol = .03, at = 0) => { if (mute) return; try { ac ??= new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + at; o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); } catch {} };
  const on = () => view.classList.contains('on');
  // la manette : croix et stick gauche = flèches, A = Entrée, B = Échap, X = Retour arrière, Y = H, Start = P ; envoyées comme des touches du clavier
  const padKeys = (map = {}) => {
    const KEY = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 0: 'Enter', 1: 'Escape', 2: 'Backspace', 3: 'h', 9: 'p', ...map };
    const held = new Map(), send = (k, type) => document.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
    const loop = () => {
      requestAnimationFrame(loop);
      if (!on() || !navigator.getGamepads) return;
      const p = [...navigator.getGamepads()].find(Boolean); if (!p) return;
      const now = performance.now(), down = new Set();
      for (const [i, k] of Object.entries(KEY)) if (p.buttons[i]?.pressed) down.add(k);
      const [ax = 0, ay = 0] = p.axes;
      if (ax < -.5) down.add('ArrowLeft'); if (ax > .5) down.add('ArrowRight'); if (ay < -.5) down.add('ArrowUp'); if (ay > .5) down.add('ArrowDown');
      for (const k of down) { const t = held.get(k); if (t === undefined) { held.set(k, now + 260); send(k, 'keydown'); } else if (/^Arrow/.test(k) && now > t) { held.set(k, now + 110); send(k, 'keydown'); } }
      for (const k of [...held.keys()]) if (!down.has(k)) { held.delete(k); send(k, 'keyup'); }
    };
    requestAnimationFrame(loop);
  };
  pxSkin(view.querySelector('.appWrap'), { title: 'MÉTRONOME', T: theme('#ffb84a', '#fff0c8', '#c0802a', '#2a1a08', '#5ae0ff'),
    emblem: ['.....kk.....', '....kwwk....', '....kwak....', '...kwwawk...', '...kwwwak...', '..kwwwwwak..', '..kwwkwwwk..', '.kwwwkwwwwk.', '.kwwwwkwwwk.', 'kwwwwwwwwwwk', 'kkkkkkkkkkkk', '.kk......kk.'],
    icons: [[/^DÉMARRER|^ARRÊTER/, 'play'], [/^TEMPO/, 'clock'], [/^MESURE/, 'note']] });
  const W = 240, H = 128;
  const cfg = { bpm: 100, sig: 2, sub: 0, snd: 0, acc: true, vol: 70, accents: {}, prog: 0, top: 160, sil: 0, ...(await doc('reglages')) };
  let saveT = null; const keepCfg = () => { clearTimeout(saveT); saveT = setTimeout(() => folder.write('reglages', cfg).catch(() => {}), 600); };
  const fill = (sel, list) => sel.replaceChildren(...list.map(([n], i) => { const o = el('option', '', n); o.value = i; return o; }));
  fill($('meSig'), ME_SIG); fill($('meSub'), ME_SUB); fill($('meSnd'), ME_SND); fill($('meProg'), ME_PROG); fill($('meSil'), ME_SIL);
  const sig = () => ME_SIG[cfg.sig], beats = () => sig()[1];
  // l'accent de chaque temps : 2 fort, 1 normal, 0 muet (réglé par mesure)
  const accentOf = i => { const a = cfg.accents[sig()[0]]; return a?.[i] ?? (i === 0 && cfg.acc ? 2 : (sig()[2] === 8 && i % 3 === 0 && i ? 2 : 1)); };
  let au = null, gain = null, running = false, nextT = 0, step = 0, timer = 0, queue = [], taps = [], bar = 0, live = cfg.bpm;  // live : le tempo du moment (le programme le fait monter)
  const clamp = v => Math.max(30, Math.min(260, Math.round(v)));
  function click(t, kind) {  // kind 2 accent, 1 temps, 0.5 subdivision
    const [, type, hi, lo] = ME_SND[cfg.snd], o = au.createOscillator(), g = au.createGain();
    o.type = type; o.frequency.value = kind === 2 ? hi : kind === 1 ? lo : lo * .75;
    const v = (kind === 2 ? 1 : kind === 1 ? .7 : .35) * (cfg.snd === 3 ? .9 : .6);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + (cfg.snd === 3 ? .25 : .05));
    o.connect(g).connect(gain); o.start(t); o.stop(t + .3); queue.push({ o, t });
  }
  // programme les clics 1,6 s à l'avance : même un onglet en arrière-plan (minuteries ralenties à 1 par seconde) garde le tempo
  function schedule() {
    const subs = ME_SUB[cfg.sub][1], per = subs * beats(), [, add, every] = ME_PROG[cfg.prog] || ME_PROG[0], [, on, off] = ME_SIL[cfg.sil] || ME_SIL[0];
    while (nextT < au.currentTime + 1.6) {
      if (step && step % per === 0) { bar++; if (add && bar % every === 0 && live < cfg.top) live = Math.min(cfg.top, live + add); }
      const dt = 60 / live / (sig()[2] === 8 ? 2 : 1) / subs, silent = on > 0 && bar % (on + off) >= on;
      const beat = Math.floor(step / subs) % beats(), sub = step % subs, a = sub ? .5 : accentOf(beat);
      if (a && !silent) click(nextT, a);
      beatsAt.push([nextT, beat, sub, silent, live]); nextT += dt; step++;
    }
    queue = queue.filter(q => q.t > au.currentTime - 1); if (beatsAt.length > 400) beatsAt.splice(0, 200);
  }
  let beatsAt = [];
  function restart() {  // un réglage changé : on retire les clics déjà programmés et on repart du prochain temps
    if (!running) return;
    for (const q of queue) if (q.t > au.currentTime + .01) try { q.o.stop(); } catch {}
    queue = []; beatsAt = beatsAt.filter(b => b[0] <= au.currentTime);
    const subs = ME_SUB[cfg.sub][1]; step = Math.ceil(step / subs / beats()) * subs * beats(); nextT = au.currentTime + .08; schedule();
  }
  function play(v = !running) {
    running = v;
    if (running) { au ??= new AudioContext(); if (!gain) { gain = au.createGain(); gain.connect(au.destination); } gain.gain.value = cfg.vol / 100; au.resume(); step = 0; bar = 0; live = cfg.bpm; nextT = au.currentTime + .08; beatsAt = []; schedule(); timer = setInterval(schedule, 250); }
    else { clearInterval(timer); for (const q of queue) try { q.o.stop(); } catch {} queue = []; }
    $('mePlay').textContent = running ? 'ARRÊTER' : 'DÉMARRER';
  }
  const setBpm = v => { cfg.bpm = clamp(v); live = cfg.bpm; $('meBpm').value = cfg.bpm; keepCfg(); restart(); };
  function tap(t = performance.now()) {
    if (taps.length && t - taps[taps.length - 1] > 2000) taps = [];
    taps.push(t); if (taps.length > 5) taps.shift();
    if (taps.length >= 2) { const d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); setBpm(60000 / d); }
  }
  // le dessin : le métronome en bois et son balancier, les temps de la mesure, le tempo
  let g = null, tick = 0;
  const current = () => { if (!running || !au) return null; const now = au.currentTime; let b = null; for (const x of beatsAt) if (x[0] <= now) b = x; return b; };
  const boxes = () => { const n = beats(), s = Math.min(16, Math.floor(150 / n)); return Array.from({ length: n }, (_, i) => [W / 2 - n * s / 2 + i * s + 1, 104, s - 2, 14]); };
  function draw() {
    g.imageSmoothingEnabled = false; tick++;
    px(g, '#1a120a', 0, 0, W, H); for (let y = 0; y < H; y += 4) px(g, '#20160c', 0, y, W, 1);
    const cur = current(), bpm = cur?.[4] || cfg.bpm, spb = 60 / bpm / (sig()[2] === 8 ? 2 : 1);
    // le balancier : il va d'un côté à l'autre à chaque temps
    let ang = 0; if (cur) { const p = Math.min(1, (au.currentTime - cur[0]) / spb); ang = Math.cos(p * Math.PI) * (cur[1] % 2 ? -1 : 1) * .5; }
    const bx = 64, by = 96;
    for (let y = 0; y < 70; y++) { const w = 10 + y * .45; px(g, '#6a3a1e', bx - w / 2, by - 70 + y, w, 1); px(g, '#8a5230', bx - w / 2 + 1, by - 70 + y, Math.max(1, w / 2 - 2), 1); }
    px(g, '#3a1e0e', bx - 22, by, 44, 4); px(g, '#e8d8b0', bx - 10, by - 42, 20, 26); px(g, '#c8b890', bx - 10, by - 18, 20, 2);
    for (let i = 0; i < 6; i++) px(g, '#5a4a2a', bx - 6, by - 40 + i * 4, 4, 1);
    for (let r = 0; r < 58; r++) { const x = bx + Math.sin(ang) * r, y = by - 8 - Math.cos(ang) * r; px(g, '#d8d0c0', x, y, 1, 1); }
    { const r = 30 + (cfg.bpm - 30) / 230 * 24, x = bx + Math.sin(ang) * r, y = by - 8 - Math.cos(ang) * r; px(g, '#16100a', x - 3, y - 2, 7, 5); px(g, '#ffb84a', x - 2, y - 1, 5, 3); }
    px(g, '#ffb84a', bx - 2, by - 10, 4, 4);
    // le tempo
    const name = ME_NAMES.find(([m]) => bpm < m)[1];
    pxFont(g, String(bpm), 172, 44, bpm !== cfg.bpm ? '#5ae0ff' : '#fff0c8', 32, 'center');
    if (cur?.[3]) pxFont(g, 'SILENCE', 172, 96, '#5ae0ff', 8, 'center'); else if (running && cfg.prog && bpm >= cfg.top) pxFont(g, 'TEMPO VISÉ ATTEINT', 172, 96, '#7ee07a', 8, 'center');
    pxFont(g, 'BPM · ' + name, 172, 62, '#ffb84a', 8, 'center');
    pxFont(g, sig()[0] + (cfg.sub ? ' · ' + ME_SUB[cfg.sub][0].toLowerCase() : ''), 172, 80, '#c8a878', 8, 'center');
    boxes().forEach(([x, y, w, h], i) => { const a = accentOf(i), lit = cur && !cur[3] && cur[1] === i && au.currentTime - cur[0] < .15;
      px(g, '#0a0604', x, y, w, h); px(g, lit ? (a === 2 ? '#ff5a3a' : '#ffd84a') : a === 2 ? '#7a3a1e' : a ? '#4a3420' : '#241a10', x + 1, y + 1, w - 2, h - 2);
      if (a === 2) px(g, lit ? '#ffffff' : '#ff8a5a', x + 2, y + 2, w - 4, 1); if (!a) px(g, '#5a4a3a', x + w / 2 - 2, y + 6, 4, 1); });
    if (tick % 30 === 0) g.canvas.setAttribute('aria-label', 'Métronome ' + (running ? 'en marche' : 'à l’arrêt') + ', ' + cfg.bpm + ' battements par minute, ' + name + ', mesure ' + sig()[0] + (cur ? ', temps ' + (cur[1] + 1) : '') + '.');
  }
  const sync = () => { $('meProg').value = cfg.prog; $('meTop').value = cfg.top; $('meSil').value = cfg.sil; $('meBpm').value = cfg.bpm; $('meSig').value = cfg.sig; $('meSub').value = cfg.sub; $('meSnd').value = cfg.snd; $('meAcc').checked = cfg.acc; $('meVol').value = cfg.vol; };
  $('meBpm').oninput = e => setBpm(+e.target.value);
  for (const [id, d] of [['meM5', -5], ['meM1', -1], ['meP1', 1], ['meP5', 5]]) $(id).onclick = () => setBpm(cfg.bpm + d);
  $('mePlay').onclick = () => { play(); $('mePlay').blur(); };
  $('meTap').onclick = tap;
  $('meSig').onchange = e => { cfg.sig = +e.target.value; keepCfg(); restart(); };
  $('meSub').onchange = e => { cfg.sub = +e.target.value; keepCfg(); restart(); };
  $('meSnd').onchange = e => { cfg.snd = +e.target.value; keepCfg(); };
  $('meAcc').onchange = e => { cfg.acc = e.target.checked; delete cfg.accents[sig()[0]]; keepCfg(); restart(); };
  $('meProg').onchange = e => { cfg.prog = +e.target.value; if (cfg.prog && cfg.top <= cfg.bpm) { cfg.top = clamp(cfg.bpm + 40); $('meTop').value = cfg.top; } keepCfg(); live = cfg.bpm; bar = 0; restart(); };
  $('meTop').onchange = e => { cfg.top = clamp(+e.target.value || cfg.bpm); $('meTop').value = cfg.top; keepCfg(); };
  $('meSil').onchange = e => { cfg.sil = +e.target.value; bar = 0; keepCfg(); restart(); };
  $('meVol').oninput = e => { cfg.vol = +e.target.value; if (gain) gain.gain.value = cfg.vol / 100; keepCfg(); };
  $('meCanvas').onpointerdown = e => {  // un clic sur un temps : fort → normal → muet
    const c = e.currentTarget.getBoundingClientRect(), x = (e.clientX - c.left) / c.width * W, y = (e.clientY - c.top) / c.height * H;
    const i = boxes().findIndex(([bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by - 4 && y < by + bh + 4);
    if (i < 0) { play(); return; }
    const a = cfg.accents[sig()[0]] ??= Array.from({ length: beats() }, (_, k) => accentOf(k)); a[i] = (a[i] + 2) % 3; keepCfg(); restart();
  };
  document.addEventListener('keydown', e => {
    if (!on() || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key, d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[k];
    if (k === ' ') { e.preventDefault(); play(); }
    else if (d) { e.preventDefault(); setBpm(cfg.bpm + d * (e.shiftKey || k === 'ArrowUp' || k === 'ArrowDown' ? 5 : 1)); }
    else if (k === 't' || k === 'T') tap();
    else if (k === 'a' || k === 'A') { cfg.acc = !cfg.acc; delete cfg.accents[sig()[0]]; $('meAcc').checked = cfg.acc; keepCfg(); restart(); }
  });
  {  // vérification : le tempo tapé, les bornes, les accents par défaut (6/8 : 1 et 4 forts), le nom du tempo
    const bad = [], keepC = JSON.stringify(cfg);
    taps = [1000, 1500, 2000]; tap(2500);
    if (cfg.bpm !== 120) bad.push('tempo tapé ' + cfg.bpm + ' au lieu de 120');
    setBpm(999); if (cfg.bpm !== 260) bad.push('borne haute'); setBpm(1); if (cfg.bpm !== 30) bad.push('borne basse');
    cfg.sig = 4; cfg.acc = true; cfg.accents = {}; if ([0, 1, 2, 3, 4, 5].map(accentOf).join('') !== '211211') bad.push('accents 6/8 : ' + [0, 1, 2, 3, 4, 5].map(accentOf).join(''));
    if (ME_NAMES.find(([m]) => 100 < m)[1] !== 'Andante') bad.push('nom du tempo');
    if (ME_PROG.some(p => p[1] && !(p[2] > 0)) || ME_SIL.some(x => x[1] && !(x[2] > 0))) bad.push('programmes');
    Object.assign(cfg, JSON.parse(keepC)); taps = []; clearTimeout(saveT);
    console.assert(!bad.length, 'metronome', bad); view.dataset.selfcheck = bad.join(' | ') || 'ok';
  }
  sync();
  let raf = 0; const frame = () => { if (!on()) { raf = 0; return; } raf = requestAnimationFrame(frame); draw(); };
  ctx.onOpen(() => { g ??= $('meCanvas').getContext('2d'); if (!raf) raf = requestAnimationFrame(frame); });
  $('meCanvas').__state = () => ({ running, bpm: cfg.bpm, live, bar, clicks: queue.length, silent: beatsAt.filter(b => b[3]).length });
}
