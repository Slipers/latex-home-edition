/* Exécution de code Python sur l'ordinateur (module « Exécution Python »).
   Utilisé par l'application de bureau (electron/main.js) et par le petit serveur
   local de développement (server.js). Aucune dépendance : Node seul.

   · check()   : cherche un Python 3 installé (lanceur « py », PATH, dossiers
                 d'installation habituels) et les bibliothèques scientifiques présentes ;
   · run()     : exécute un code dans un dossier temporaire, avec une limite de temps,
                 récupère la sortie (texte) et les graphiques matplotlib (PNG) ;
   · stop()    : arrête une exécution en cours ;
   · install() : installe Python pour l'utilisateur (Windows : winget, sans droits
                 administrateur). Ailleurs : installation manuelle depuis python.org.

   Le code n'est jamais passé à un shell : il est écrit dans un fichier temporaire
   puis lancé directement par l'interpréteur (execFile / spawn sans shell). */
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const MIN = [3, 6];                    // f-strings
const MAX_OUT = 400 * 1024;            // caractères de sortie gardés (texte)
const MAX_FIGS = 12, MAX_FIG = 6e6;    // graphiques récupérés
const DEFAULT_TIMEOUT = 60 * 1000;
const PY_WINGET_ID = 'Python.Python.3.14';

/* Lanceur exécuté autour du code : erreurs sans les lignes du lanceur, graphiques
   matplotlib enregistrés en PNG à la fin (plt.show() ne bloque pas : backend Agg). */
const RUNNER = String.raw`
import sys, os, traceback, warnings
code_path, fig_dir = sys.argv[1], sys.argv[2]
sys.argv = ['code.py']
sys.path.insert(0, os.getcwd())
warnings.filterwarnings('ignore', message='.*non-interactive.*')
warnings.filterwarnings('ignore', message='.*FigureCanvasAgg.*')
import builtins
_input = builtins.input
def _echo_input(prompt=''):
    v = _input(prompt)
    print(v)
    return v
builtins.input = _echo_input
with open(code_path, encoding='utf-8') as f:
    src = f.read()
g = {'__name__': '__main__', '__builtins__': __builtins__}
status = 0
try:
    exec(compile(src, 'code.py', 'exec'), g)
except SystemExit as e:
    c = e.code
    if c is None:
        status = 0
    elif isinstance(c, int):
        status = c
    else:
        print(c, file=sys.stderr)
        status = 1
except BaseException as e:
    tb = e.__traceback__.tb_next if e.__traceback__ is not None else None
    traceback.print_exception(type(e), e, tb)
    status = 1
finally:
    try:
        plt = sys.modules.get('matplotlib.pyplot')
        if plt is not None:
            for i, n in enumerate(plt.get_fignums()[:${MAX_FIGS}]):
                plt.figure(n).savefig(os.path.join(fig_dir, 'fig%02d.png' % (i + 1)), dpi=144, bbox_inches='tight', facecolor='white')
    except Exception as e:
        print('[Graphiques non récupérés : %s]' % e, file=sys.stderr)
    try:
        sys.stdout.flush(); sys.stderr.flush()
    except Exception:
        pass
sys.exit(status)
`;

const PROBE = 'import sys, json, importlib.util as u; print(json.dumps({"v": sys.version.split()[0], "exe": sys.executable, "libs": [m for m in ("numpy", "matplotlib", "scipy", "pandas") if u.find_spec(m)]}))';

function execP(cmd, args, opts = {}) {
  return new Promise(resolve => {
    try {
      execFile(cmd, args, Object.assign({ timeout: 10000, windowsHide: true, maxBuffer: 1 << 20 }, opts), (err, stdout, stderr) =>
        resolve({ err, stdout: String(stdout || ''), stderr: String(stderr || '') }));
    } catch (err) { resolve({ err, stdout: '', stderr: '' }); }
  });
}

/* Dossiers « Python3xx » d'un répertoire, du plus récent au plus ancien */
function pyDirs(base, re) {
  try {
    return fs.readdirSync(base).filter(n => re.test(n))
      .sort((a, b) => (parseInt(b.replace(/\D/g, ''), 10) || 0) - (parseInt(a.replace(/\D/g, ''), 10) || 0))
      .map(n => path.join(base, n));
  } catch (_) { return []; }
}

/* Interpréteurs à essayer, dans l'ordre */
function candidates() {
  const c = [];
  if (isWin) {
    const la = process.env.LOCALAPPDATA || '', pf = process.env.ProgramFiles || 'C:\\Program Files', pf86 = process.env['ProgramFiles(x86)'] || '';
    // Dossiers d'installation (fonctionnent même si le PATH n'est pas à jour, juste après une installation)
    if (la) {
      pyDirs(path.join(la, 'Python'), /^pythoncore-3\.\d+/i).forEach(d => c.push([path.join(d, 'python.exe'), []]));   // gestionnaire d'installation de python.org
      pyDirs(path.join(la, 'Programs', 'Python'), /^Python3\d+/i).forEach(d => c.push([path.join(d, 'python.exe'), []]));
    }
    [pf, pf86].filter(Boolean).forEach(b => pyDirs(b, /^Python3\d+/i).forEach(d => c.push([path.join(d, 'python.exe'), []])));
    // Lanceur « py » puis PATH (l'alias du Microsoft Store sans Python installé ne répond pas « Python 3… » : écarté)
    if (la) c.push([path.join(la, 'Programs', 'Python', 'Launcher', 'py.exe'), ['-3']]);
    c.push(['py', ['-3']], ['python', []], ['python3', []]);
  } else {
    // Application graphique : le PATH du terminal n'est pas hérité (macOS), d'où les chemins connus
    ['/opt/homebrew/bin/python3', '/usr/local/bin/python3', '/Library/Frameworks/Python.framework/Versions/Current/bin/python3'].forEach(p => c.push([p, []]));
    c.push(['python3', []]);
    // macOS : /usr/bin/python3 sans les outils de développement ouvre une fenêtre d'installation ; on l'évite
    if (!isMac || fs.existsSync('/Library/Developer/CommandLineTools/usr/bin/python3') || fs.existsSync('/Applications/Xcode.app')) c.push(['/usr/bin/python3', []]);
    c.push(['python', []]);
  }
  return c.filter(([cmd]) => !path.isAbsolute(cmd) || fs.existsSync(cmd));
}

const newer = (v, min) => { const p = String(v).split('.').map(Number); return p[0] > min[0] || (p[0] === min[0] && (p[1] || 0) >= min[1]); };
let found = null;   // dernier interpréteur trouvé { version, exe, libs }

async function check(force) {
  if (found && !force) return found;
  found = null;
  const seen = new Set();
  for (const [cmd, pre] of candidates()) {
    const r = await execP(cmd, pre.concat(['-c', PROBE]), { timeout: 12000 });
    if (r.err) continue;
    let info = null;
    try { info = JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); } catch (_) { continue; }
    if (!info || !info.v || !info.exe || seen.has(info.exe.toLowerCase())) continue;
    seen.add(info.exe.toLowerCase());
    if (!newer(info.v, MIN)) continue;
    found = { ok: true, version: info.v, exe: info.exe, libs: info.libs || [] };
    return found;
  }
  return { ok: false };
}

/* ---------- Exécution ---------- */
const runs = new Map();   // id → { child, stopped }

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (isWin) execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
  else { try { child.kill('SIGKILL'); } catch (_) { /* déjà terminé */ } }
}

async function run({ id, code, stdin, cwd, timeout } = {}) {
  const py = await check(false);
  if (!py.ok) return { ok: false, error: 'nopython' };
  code = String(code || '');
  if (code.length > 2e6) return { ok: false, error: 'toolarge' };
  id = String(id || Date.now());
  let dir;
  try { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lhe-py-')); } catch (e) { return { ok: false, error: 'tmp', message: String(e.message || e) }; }
  const figDir = path.join(dir, 'figures');
  fs.mkdirSync(figDir);
  fs.writeFileSync(path.join(dir, 'code.py'), code, 'utf8');
  fs.writeFileSync(path.join(dir, 'lhe_runner.py'), RUNNER, 'utf8');
  let workDir = dir;
  try { if (cwd && fs.statSync(cwd).isDirectory()) workDir = cwd; } catch (_) { /* dossier introuvable : dossier temporaire */ }
  const limit = Math.max(1000, Math.min(Number(timeout) || DEFAULT_TIMEOUT, 10 * 60 * 1000));
  const t0 = Date.now();
  return new Promise(resolve => {
    const out = [];
    let size = 0, truncated = false, timedOut = false, done = false;
    const push = (s, t) => {
      if (truncated) return;
      if (size + t.length > MAX_OUT) { t = t.slice(0, MAX_OUT - size); truncated = true; }
      size += t.length;
      const last = out[out.length - 1];
      if (last && last.s === s) last.t += t; else out.push({ s, t });
    };
    let child;
    try {
      child = spawn(py.exe, ['-u', path.join(dir, 'lhe_runner.py'), path.join(dir, 'code.py'), figDir], {
        cwd: workDir, windowsHide: true,
        env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', MPLBACKEND: 'Agg', PYTHONDONTWRITEBYTECODE: '1' }),
      });
    } catch (e) {
      cleanup(dir);
      return resolve({ ok: false, error: 'spawn', message: String(e.message || e) });
    }
    const rec = { child, stopped: false };
    runs.set(id, rec);
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, limit);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', d => push('out', d));
    child.stderr.on('data', d => push('err', d));
    child.stdin.on('error', () => { /* le programme n'a pas tout lu : sans importance */ });
    child.stdin.end(stdin ? String(stdin).replace(/\r?\n?$/, '\n') : '');
    const finish = (exitCode, err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      runs.delete(id);
      const figures = [];
      try {
        fs.readdirSync(figDir).filter(n => /\.png$/i.test(n)).sort().slice(0, MAX_FIGS).forEach(n => {
          const buf = fs.readFileSync(path.join(figDir, n));
          if (buf.length <= MAX_FIG) figures.push('data:image/png;base64,' + buf.toString('base64'));
        });
      } catch (_) { /* pas de graphique */ }
      cleanup(dir);
      resolve({
        ok: true, exitCode, output: out, figures, ms: Date.now() - t0, truncated,
        timedOut, stopped: rec.stopped && !timedOut, timeout: limit, version: py.version,
        error: err ? 'spawn' : undefined, message: err ? String(err.message || err) : undefined,
      });
    };
    child.on('error', e => finish(null, e));
    child.on('close', c => finish(c, null));
  });
}

function stop(id) {
  const r = runs.get(String(id));
  if (!r) return false;
  r.stopped = true;
  killTree(r.child);
  return true;
}

/* Le dossier temporaire créé par run() (et lui seul) est supprimé */
function cleanup(dir) {
  if (!dir || !path.basename(dir).startsWith('lhe-py-') || path.dirname(dir) !== path.resolve(os.tmpdir())) return;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* fichiers encore ouverts : le système nettoiera */ }
}

/* ---------- Installation de Python ----------
   Windows : winget (inclus dans Windows 10/11) installe Python pour l'utilisateur seul,
   sans droits administrateur. Sinon, ou en cas d'échec : python.org (à la main). */
let installing = null;
async function install() {
  if (installing) return installing;
  installing = (async () => {
    if (!isWin) return { ok: false, reason: 'manual' };
    const w = await execP('winget', ['--version'], { timeout: 15000 });
    if (w.err) return { ok: false, reason: 'nowinget' };
    const r = await execP('winget', ['install', '--id', PY_WINGET_ID, '-e', '--source', 'winget', '--scope', 'user', '--silent',
      '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'], { timeout: 15 * 60 * 1000, maxBuffer: 8 << 20 });
    const py = await check(true);
    if (py.ok) return { ok: true, python: py };
    const log = (r.stdout + '\n' + r.stderr).replace(/[\u2580-\u259f\u2500-\u257f█▒░]+/g, '').replace(/\r/g, '\n').split('\n').map(s => s.trim()).filter(s => s && !/^[-\\|/]$/.test(s));
    return { ok: false, reason: 'failed', detail: log.slice(-4).join(' · ').slice(0, 300) };
  })();
  try { return await installing; } finally { installing = null; }
}

module.exports = { check, run, stop, install, PY_WINGET_ID };
