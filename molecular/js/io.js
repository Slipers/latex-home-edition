/* Import et export : format natif .lmc, XYZ, MOL (V2000), PDB, SMILES, chemfig (LaTeX), SVG, PNG. */
(function () {
  const U = M.util;

  /* ---------- Format natif .lmc ---------- */
  function versLmc(doc, vue) {
    return JSON.stringify({
      format: 'lmc', version: 1, application: 'LaTeX MolecularChemistry Edition',
      genereLe: new Date().toISOString(),
      molecule: doc.mol.toJSON(),
      vue: vue || null,
    }, null, 1);
  }
  function depuisLmc(txt) {
    const o = JSON.parse(txt);
    if (!o || (o.format !== 'lmc' && !o.molecule && !o.atoms)) throw new Error('Ce fichier n’est pas un document LaTeX MolecularChemistry.');
    const mol = M.Molecule.fromJSON(o.molecule || o);
    return { mol, vue: o.vue || null };
  }

  /* ---------- XYZ ---------- */
  function versXyz(mol) {
    const l = [String(mol.atoms.length), mol.name || 'molécule'];
    mol.atoms.forEach(a => l.push(a.el.padEnd(3) + [a.x, a.y, a.z].map(v => U.round(v, 5).toFixed(5).padStart(12)).join(' ')));
    return l.join('\n') + '\n';
  }
  function depuisXyz(txt) {
    const lignes = txt.split(/\r?\n/);
    const n = parseInt(lignes[0], 10);
    if (!isFinite(n)) throw new Error('Fichier XYZ : la première ligne doit contenir le nombre d’atomes.');
    const mol = new M.Molecule((lignes[1] || '').trim() || 'Importé (XYZ)');
    for (let i = 0; i < n; i++) {
      const c = (lignes[2 + i] || '').trim().split(/\s+/);
      if (c.length < 4) throw new Error('Fichier XYZ : ligne ' + (3 + i) + ' incomplète.');
      mol.addAtom(normaliserSymbole(c[0]), { x: +c[1], y: +c[2], z: +c[3] });
    }
    deduireLiaisons(mol);
    return mol;
  }
  const normaliserSymbole = s => {
    const t = String(s).replace(/[^A-Za-z]/g, '');
    const e = M.elements.get(t) || M.elements.get(t[0]);
    return e ? e.sym : 'C';
  };

  /* Reconstruction des liaisons à partir des distances interatomiques */
  function deduireLiaisons(mol, tolerance = 0.45) {
    mol.bonds.length = 0;
    const A = mol.atoms;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const ea = M.elements.get(A[i].el), eb = M.elements.get(A[j].el);
      if (!ea || !eb) continue;
      const d = M.V.dist(A[i], A[j]);
      if (d < 0.4) continue;
      if (d <= ea.rcov + eb.rcov + tolerance) mol.addBond(A[i].id, A[j].id, 1);
    }
    devinerOrdres(mol);
    mol.touch();
    return mol;
  }
  /* Ordres de liaison estimés d'après les longueurs et la valence disponible */
  function devinerOrdres(mol) {
    const manque = id => M.geo.liaisonsAttendues(mol.atom(id).el, mol.atom(id).charge) - mol.bondOrderSum(id);
    const candidats = mol.bonds.filter(b => mol.atom(b.a).el !== 'H' && mol.atom(b.b).el !== 'H')
      .map(b => {
        const d = M.V.dist(mol.atom(b.a), mol.atom(b.b));
        const s = M.geo.bondLength(mol.atom(b.a).el, mol.atom(b.b).el, 1);
        return { b, ratio: d / s };
      }).sort((x, y) => x.ratio - y.ratio);
    candidats.forEach(({ b, ratio }) => {
      if (ratio > 0.95) return;
      const ordre = ratio < 0.83 ? 3 : 2;
      if (manque(b.a) >= ordre - 1 && manque(b.b) >= ordre - 1) b.order = ordre;
    });
    mol.touch();
  }

  /* ---------- MOL / SDF (V2000) ---------- */
  function versMol(mol) {
    const f = (v, n = 4) => v.toFixed(n).padStart(10);
    const l = [mol.name || '', '  LaTeX MolecularChemistry Edition', ''];
    l.push(String(mol.atoms.length).padStart(3) + String(mol.bonds.length).padStart(3) + '  0  0  0  0  0  0  0  0999 V2000');
    const idx = new Map(mol.atoms.map((a, i) => [a.id, i + 1]));
    mol.atoms.forEach(a => {
      const ch = { 3: 1, 2: 2, 1: 3, '-1': 5, '-2': 6, '-3': 7 }[a.charge] || 0;
      l.push(f(a.x) + f(a.y) + f(a.z) + ' ' + a.el.padEnd(3) + ' 0' + String(ch).padStart(3) + '  0  0  0  0  0  0  0  0  0  0');
    });
    mol.bonds.forEach(b => {
      const o = b.order === 1.5 ? 4 : Math.round(b.order);
      const st = b.type === 'w' ? 1 : b.type === 'h' ? 6 : 0;
      l.push(String(idx.get(b.a)).padStart(3) + String(idx.get(b.b)).padStart(3) + String(o).padStart(3) + String(st).padStart(3) + '  0  0  0');
    });
    const charges = mol.atoms.filter(a => a.charge);
    for (let i = 0; i < charges.length; i += 8) {
      const bloc = charges.slice(i, i + 8);
      l.push('M  CHG' + String(bloc.length).padStart(3) + bloc.map(a => String(idx.get(a.id)).padStart(4) + String(a.charge).padStart(4)).join(''));
    }
    l.push('M  END');
    return l.join('\n') + '\n';
  }
  function depuisMol(txt) {
    const lignes = txt.split(/\r?\n/);
    const cpt = lignes[3];
    if (!cpt) throw new Error('Fichier MOL : en-tête absent.');
    const na = parseInt(cpt.slice(0, 3), 10), nb = parseInt(cpt.slice(3, 6), 10);
    if (!isFinite(na)) throw new Error('Fichier MOL : nombre d’atomes illisible.');
    const mol = new M.Molecule((lignes[0] || '').trim() || 'Importé (MOL)');
    const ids = [];
    for (let i = 0; i < na; i++) {
      const L = lignes[4 + i] || '';
      const a = mol.addAtom(normaliserSymbole(L.slice(31, 34)), { x: +L.slice(0, 10), y: +L.slice(10, 20), z: +L.slice(20, 30) });
      const cod = parseInt(L.slice(36, 39), 10);
      const ch = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 }[cod];
      if (ch) a.charge = ch;
      ids.push(a.id);
    }
    for (let i = 0; i < nb; i++) {
      const L = lignes[4 + na + i] || '';
      const x = parseInt(L.slice(0, 3), 10) - 1, y = parseInt(L.slice(3, 6), 10) - 1;
      const o = parseInt(L.slice(6, 9), 10), st = parseInt(L.slice(9, 12), 10);
      if (!(ids[x] && ids[y])) continue;
      mol.addBond(ids[x], ids[y], o === 4 ? 1.5 : o, { type: st === 1 ? 'w' : st === 6 ? 'h' : 'n' });
    }
    lignes.filter(L => L.startsWith('M  CHG')).forEach(L => {
      const c = L.slice(6).trim().split(/\s+/).map(Number);
      for (let i = 1; i < c.length; i += 2) { const a = mol.atom(ids[c[i] - 1]); if (a) a.charge = c[i + 1]; }
    });
    const plat = mol.atoms.every(a => Math.abs(a.z) < 1e-6);
    if (plat && mol.atoms.length > 2) M.geo.construire3D(mol);
    mol.touch();
    return mol;
  }

  /* ---------- PDB ---------- */
  function versPdb(mol) {
    const l = ['COMPND    ' + (mol.name || 'MOLECULE').toUpperCase(),
      'AUTHOR    GENERE PAR LATEX MOLECULARCHEMISTRY EDITION'];
    const idx = new Map(mol.atoms.map((a, i) => [a.id, i + 1]));
    mol.atoms.forEach((a, i) => {
      l.push('HETATM' + String(i + 1).padStart(5) + ' ' + (a.el + String(i + 1)).padEnd(4).slice(0, 4)
        + ' LIG     1    ' + [a.x, a.y, a.z].map(v => v.toFixed(3).padStart(8)).join('')
        + '  1.00  0.00          ' + a.el.padStart(2));
    });
    mol.atoms.forEach(a => {
      const v = mol.neighborIds(a.id);
      if (!v.length) return;
      for (let i = 0; i < v.length; i += 4) {
        l.push('CONECT' + String(idx.get(a.id)).padStart(5) + v.slice(i, i + 4).map(x => String(idx.get(x)).padStart(5)).join(''));
      }
    });
    l.push('END');
    return l.join('\n') + '\n';
  }
  function depuisPdb(txt) {
    const mol = new M.Molecule('Importé (PDB)');
    const num = new Map();
    txt.split(/\r?\n/).forEach(L => {
      if (!/^(ATOM|HETATM)/.test(L)) return;
      let sym = L.slice(76, 78).trim();
      if (!sym) sym = L.slice(12, 16).trim().replace(/[^A-Za-z]/g, '').slice(0, 2);
      const a = mol.addAtom(normaliserSymbole(sym), { x: +L.slice(30, 38), y: +L.slice(38, 46), z: +L.slice(46, 54) });
      num.set(parseInt(L.slice(6, 11), 10), a.id);
    });
    let liens = 0;
    txt.split(/\r?\n/).forEach(L => {
      if (!L.startsWith('CONECT')) return;
      const a = num.get(parseInt(L.slice(6, 11), 10));
      if (a == null) return;
      for (let i = 11; i + 5 <= L.length; i += 5) {
        const b = num.get(parseInt(L.slice(i, i + 5), 10));
        if (b != null) { mol.addBond(a, b, 1); liens++; }
      }
    });
    if (!liens) deduireLiaisons(mol); else devinerOrdres(mol);
    return mol;
  }

  /* ---------- chemfig (LaTeX) ---------- */
  /* Produit un schéma 2D utilisable directement avec le paquet chemfig */
  function versChemfig(mol, opt = {}) {
    const lourds = mol.atoms.filter(a => a.el !== 'H').map(a => a.id);
    if (!lourds.length) return '\\chemfig{H}';
    const R = M.proj.repere(mol, lourds);
    const proj = id => {
      const p = M.V.sub(mol.atom(id), R.c);
      return { x: M.V.dot(p, R.u), y: M.V.dot(p, R.v), z: M.V.dot(p, R.w) };
    };
    const P = new Map(lourds.map(id => [id, proj(id)]));
    const garde = new Set(lourds);
    const vu = new Set(), fermetures = new Map();
    let numCycle = 0;
    const etiq = id => {
      const a = mol.atom(id);
      const nH = mol.neighborIds(id).filter(i => mol.atom(i).el === 'H').length;
      if (a.el === 'C' && !a.charge && !a.label) return nH && opt.tousLesH ? 'CH_' + nH : '';
      let t = a.label || a.el;
      if (nH) t += 'H' + (nH > 1 ? '_' + nH : '');
      if (a.charge) t += '^{' + (Math.abs(a.charge) > 1 ? Math.abs(a.charge) : '') + (a.charge > 0 ? '+' : '-') + '}';
      return t;
    };
    const lien = b => (b.order === 2 ? '=' : b.order === 3 ? '~' : b.type === 'w' ? '>' : b.type === 'h' ? '>|' : '-');
    const angle = (a, b) => {
      const pa = P.get(a), pb = P.get(b);
      return Math.round(Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180 / Math.PI);
    };
    /* cycles : repérage des liaisons de retour */
    const enCours = new Set();
    (function marquer(id, pere) {
      vu.add(id); enCours.add(id);
      mol.neighborIds(id).filter(x => garde.has(x)).forEach(n => {
        if (n === pere) return;
        if (enCours.has(n)) { fermetures.set(Math.min(id, n) + ':' + Math.max(id, n), ++numCycle); return; }
        if (!vu.has(n)) marquer(n, id);
      });
      enCours.delete(id);
    })(lourds[0], null);
    const ecrits = new Set();
    function branche(id, pere) {
      ecrits.add(id);
      let t = etiq(id);
      const suite = mol.neighborIds(id).filter(x => garde.has(x) && x !== pere);
      const ferm = suite.filter(n => fermetures.has(Math.min(id, n) + ':' + Math.max(id, n)));
      ferm.forEach(n => { t += '?[' + String.fromCharCode(96 + fermetures.get(Math.min(id, n) + ':' + Math.max(id, n))) + ']'; });
      const reste = suite.filter(n => !ferm.includes(n) && !ecrits.has(n));
      reste.forEach((n, k) => {
        const b = mol.bondBetween(id, n);
        const seg = lien(b) + '[:' + angle(id, n) + ']' + branche(n, id);
        t += (k < reste.length - 1) ? '(' + seg + ')' : seg;
      });
      return t;
    }
    return '\\chemfig{' + branche(lourds[0], null) + '}';
  }

  /* ---------- Téléchargement dans le navigateur ---------- */
  function telecharger(nom, contenu, mime = 'text/plain;charset=utf-8') {
    const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1200);
  }
  const depuisDataUrl = u => {
    const [tete, b64] = u.split(',');
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: (/data:([^;]+)/.exec(tete) || [])[1] || 'application/octet-stream' });
  };

  const FORMATS = [
    { ext: 'lmc', nom: 'Document MolecularChemistry', ecrire: (m, d, v) => versLmc(d, v), lire: t => depuisLmc(t).mol },
    { ext: 'xyz', nom: 'Coordonnées XYZ', ecrire: m => versXyz(m), lire: depuisXyz },
    { ext: 'mol', nom: 'MDL Molfile (V2000)', ecrire: m => versMol(m), lire: depuisMol },
    { ext: 'sdf', nom: 'SDF', ecrire: m => versMol(m) + '$$$$\n', lire: depuisMol },
    { ext: 'pdb', nom: 'Protein Data Bank', ecrire: m => versPdb(m), lire: depuisPdb },
    { ext: 'smi', nom: 'SMILES', ecrire: m => M.smiles.ecrire(m) + '\n', lire: t => M.smiles.lire(t.split(/\s|\n/)[0]) },
    { ext: 'tex', nom: 'chemfig (LaTeX)', ecrire: m => versChemfig(m), lire: null },
  ];
  /* Détection automatique du format à l'import */
  function lireAuto(nom, texte) {
    const ext = (nom.split('.').pop() || '').toLowerCase();
    const f = FORMATS.find(x => x.ext === ext && x.lire);
    if (f) return f.lire(texte);
    const t = texte.trim();
    if (t.startsWith('{')) return depuisLmc(t).mol;
    if (/^(ATOM|HETATM|HEADER|COMPND)/m.test(t)) return depuisPdb(t);
    if (/V2000|V3000/.test(t)) return depuisMol(t);
    if (/^\s*\d+\s*$/m.test(t.split('\n')[0])) return depuisXyz(t);
    return M.smiles.lire(t.split(/\s|\n/)[0]);
  }

  M.io = {
    versLmc, depuisLmc, versXyz, depuisXyz, versMol, depuisMol, versPdb, depuisPdb,
    versChemfig, deduireLiaisons, devinerOrdres, telecharger, depuisDataUrl, FORMATS, lireAuto,
  };
})();
