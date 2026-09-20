/* Modèle de molécule : graphe d'atomes et de liaisons, cycles, historique annuler/rétablir. */
(function () {
  let seq = 0;
  const nid = () => ++seq;

  /* ---------- Atome ---------- */
  function Atom(sym, pos, opt = {}) {
    return {
      id: opt.id != null ? opt.id : nid(),
      el: sym,                                   // symbole chimique
      x: pos.x || 0, y: pos.y || 0, z: pos.z || 0,
      charge: opt.charge || 0,                   // charge formelle
      lp: opt.lp == null ? null : opt.lp,        // doublets non liants (null = calcul automatique)
      radical: opt.radical || 0,                 // électrons célibataires
      label: opt.label || '',                    // étiquette libre (R, R₁, Nu…)
      locked: !!opt.locked,                      // atome figé lors de l'optimisation
      iso: opt.iso || 0,                         // nombre de masse imposé (isotope)
    };
  }

  /* ---------- Liaison ----------
     type : 'n' normale | 'w' coin plein (vers l'avant) | 'h' coin hachuré (vers l'arrière)
            | 'd' pointillés (liaison partielle / hydrogène) */
  function Bond(a, b, order = 1, opt = {}) {
    return { id: opt.id != null ? opt.id : nid(), a, b, order, type: opt.type || 'n' };
  }

  /* ---------- Molécule ---------- */
  class Molecule {
    constructor(name = 'Sans titre') {
      this.name = name;
      this.atoms = [];
      this.bonds = [];
      this.meta = {};                 // informations libres (source, commentaire…)
      this._idx = null;
    }

    /* --- Index (voisins) reconstruit à la demande --- */
    get index() {
      if (this._idx) return this._idx;
      const byId = new Map(), nb = new Map();
      this.atoms.forEach(a => { byId.set(a.id, a); nb.set(a.id, []); });
      this.bonds.forEach(b => {
        if (!nb.has(b.a) || !nb.has(b.b)) return;
        nb.get(b.a).push({ atom: b.b, bond: b });
        nb.get(b.b).push({ atom: b.a, bond: b });
      });
      return (this._idx = { byId, nb });
    }
    touch() { this._idx = null; return this; }

    atom(id) { return this.index.byId.get(id) || null; }
    /* Numéro d'affichage, de 1 à N : les identifiants internes ne sont jamais montrés */
    numero(id) { const i = this.atoms.findIndex(a => a.id === id); return i < 0 ? '?' : i + 1; }
    etiquette(id) { const a = this.atom(id); return a ? a.el + this.numero(id) : '?'; }
    bond(id) { return this.bonds.find(b => b.id === id) || null; }
    /* Liaison entre deux atomes, quel que soit l'ordre des extrémités */
    bondBetween(a, b) { return this.bonds.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)) || null; }
    neighbors(id) { return this.index.nb.get(id) || []; }
    neighborIds(id) { return this.neighbors(id).map(n => n.atom); }
    degree(id) { return this.neighbors(id).length; }
    /* Somme des ordres de liaison (valence engagée) */
    bondOrderSum(id) { return this.neighbors(id).reduce((s, n) => s + n.bond.order, 0); }

    /* --- Construction --- */
    addAtom(sym, pos = { x: 0, y: 0, z: 0 }, opt) {
      const a = Atom(sym, pos, opt);
      this.atoms.push(a); this.touch();
      return a;
    }
    addBond(a, b, order = 1, opt) {
      if (a === b) return null;
      const ex = this.bondBetween(a, b);
      if (ex) { ex.order = order; if (opt && opt.type) ex.type = opt.type; this.touch(); return ex; }
      const bo = Bond(a, b, order, opt);
      this.bonds.push(bo); this.touch();
      return bo;
    }
    removeAtom(id) {
      this.atoms = this.atoms.filter(a => a.id !== id);
      this.bonds = this.bonds.filter(b => b.a !== id && b.b !== id);
      this.touch();
    }
    removeBond(id) { this.bonds = this.bonds.filter(b => b.id !== id); this.touch(); }
    /* Supprime un atome et tout ce qui n'est plus relié au reste (nettoyage des hydrogènes orphelins) */
    removeAtomDeep(id) {
      const hs = this.neighbors(id).filter(n => this.atom(n.atom).el === 'H' && this.degree(n.atom) === 1).map(n => n.atom);
      this.removeAtom(id);
      hs.forEach(h => this.removeAtom(h));
    }

    /* --- Géométrie --- */
    pos(id) { const a = this.atom(id); return a ? { x: a.x, y: a.y, z: a.z } : null; }
    setPos(id, p) { const a = this.atom(id); if (a) { a.x = p.x; a.y = p.y; a.z = p.z; } }
    center() {
      if (!this.atoms.length) return { x: 0, y: 0, z: 0 };
      const s = this.atoms.reduce((c, a) => ({ x: c.x + a.x, y: c.y + a.y, z: c.z + a.z }), { x: 0, y: 0, z: 0 });
      return { x: s.x / this.atoms.length, y: s.y / this.atoms.length, z: s.z / this.atoms.length };
    }
    /* Centre de masse (barycentre pondéré par les masses molaires) */
    centerOfMass() {
      let m = 0, s = { x: 0, y: 0, z: 0 };
      this.atoms.forEach(a => {
        const w = (M.elements.get(a.el) || { mass: 1 }).mass;
        m += w; s.x += a.x * w; s.y += a.y * w; s.z += a.z * w;
      });
      return m ? { x: s.x / m, y: s.y / m, z: s.z / m } : s;
    }
    recenter() {
      const c = this.center();
      this.atoms.forEach(a => { a.x -= c.x; a.y -= c.y; a.z -= c.z; });
      return this;
    }
    radius() { const c = this.center(); return this.atoms.reduce((r, a) => Math.max(r, M.V.dist(a, c)), 0); }

    /* --- Parcours --- */
    /* Tous les atomes atteignables depuis `from` sans passer par `blocked` */
    reachable(from, blocked = new Set()) {
      const seen = new Set([from]), stack = [from];
      while (stack.length) {
        const cur = stack.pop();
        for (const n of this.neighbors(cur)) {
          if (blocked.has(n.atom) || seen.has(n.atom)) continue;
          seen.add(n.atom); stack.push(n.atom);
        }
      }
      return seen;
    }
    /* Composantes connexes (fragments) */
    fragments() {
      const seen = new Set(), out = [];
      for (const a of this.atoms) {
        if (seen.has(a.id)) continue;
        const comp = this.reachable(a.id);
        comp.forEach(i => seen.add(i));
        out.push([...comp]);
      }
      return out;
    }
    /* Le côté « b » d'une liaison a–b est-il détachable (pas dans un cycle commun) ? */
    sideOf(a, b) {
      const s = this.reachable(b, new Set([a]));
      return s.has(a) ? null : s;   // null = la liaison appartient à un cycle
    }
    /* Plus court chemin (liste d'ids) entre deux atomes */
    path(a, b) {
      const prev = new Map([[a, null]]), q = [a];
      while (q.length) {
        const cur = q.shift();
        if (cur === b) { const p = []; let c = b; while (c != null) { p.unshift(c); c = prev.get(c); } return p; }
        for (const n of this.neighbors(cur)) if (!prev.has(n.atom)) { prev.set(n.atom, cur); q.push(n.atom); }
      }
      return null;
    }

    /* --- Cycles : plus petit jeu de cycles indépendants (approche par liaison) --- */
    rings() {
      if (this._rings) return this._rings;
      const found = [], seenKey = new Set();
      for (const bd of this.bonds) {
        // Plus court chemin de a à b sans emprunter la liaison elle-même
        const prev = new Map([[bd.a, null]]), q = [bd.a];
        let hit = false;
        while (q.length && !hit) {
          const cur = q.shift();
          for (const n of this.neighbors(cur)) {
            if (n.bond.id === bd.id) continue;
            if (prev.has(n.atom)) continue;
            prev.set(n.atom, cur);
            if (n.atom === bd.b) { hit = true; break; }
            q.push(n.atom);
          }
        }
        if (!prev.has(bd.b)) continue;
        const ring = []; let c = bd.b;
        while (c != null) { ring.push(c); c = prev.get(c); }
        if (ring.length < 3) continue;
        const key = ring.slice().sort((x, y) => x - y).join(',');
        if (seenKey.has(key)) continue;
        seenKey.add(key); found.push(ring);
      }
      found.sort((a, b) => a.length - b.length);
      // On ne garde qu'un jeu indépendant : nb de cycles = liaisons − atomes + fragments
      const target = this.bonds.length - this.atoms.length + this.fragments().length;
      const kept = [], covered = new Set();
      for (const r of found) {
        if (kept.length >= target) break;
        const bonds = ringBonds(this, r).map(b => b.id);
        if (bonds.some(id => !covered.has(id)) || kept.length < target) {
          kept.push(r); bonds.forEach(id => covered.add(id));
        }
      }
      return (this._rings = kept);
    }
    inRing(id) { return this.rings().some(r => r.includes(id)); }
    ringsOf(id) { return this.rings().filter(r => r.includes(id)); }
    /* Une liaison appartient-elle à un cycle ? */
    bondInRing(b) { return this.rings().some(r => ringHasBond(r, b)); }

    /* --- Copie & sérialisation --- */
    clone() {
      const m = new Molecule(this.name);
      m.atoms = this.atoms.map(a => Object.assign({}, a));
      m.bonds = this.bonds.map(b => Object.assign({}, b));
      m.meta = M.util.clone(this.meta);
      return m;
    }
    toJSON() {
      return {
        format: 'lmc', version: 1, name: this.name, meta: this.meta,
        atoms: this.atoms.map(a => ({ i: a.id, e: a.el, p: [M.util.round(a.x, 4), M.util.round(a.y, 4), M.util.round(a.z, 4)], c: a.charge || undefined, lp: a.lp == null ? undefined : a.lp, r: a.radical || undefined, l: a.label || undefined, k: a.locked || undefined, iso: a.iso || undefined })),
        bonds: this.bonds.map(b => ({ i: b.id, a: b.a, b: b.b, o: b.order, t: b.type === 'n' ? undefined : b.type })),
      };
    }
    static fromJSON(o) {
      const m = new Molecule(o.name || 'Sans titre');
      m.meta = o.meta || {};
      (o.atoms || []).forEach(a => {
        m.atoms.push(Atom(a.e, { x: a.p[0], y: a.p[1], z: a.p[2] }, { id: a.i, charge: a.c, lp: a.lp, radical: a.r, label: a.l, locked: a.k, iso: a.iso }));
      });
      (o.bonds || []).forEach(b => m.bonds.push(Bond(b.a, b.b, b.o, { id: b.i, type: b.t })));
      seq = Math.max(seq, ...m.atoms.map(a => a.id), ...m.bonds.map(b => b.id), 0);
      return m.touch();
    }
    /* Fusionne une autre molécule (ids réattribués) et renvoie la table de correspondance */
    merge(other, offset = { x: 0, y: 0, z: 0 }) {
      const map = new Map();
      other.atoms.forEach(a => {
        const n = this.addAtom(a.el, { x: a.x + offset.x, y: a.y + offset.y, z: a.z + offset.z },
          { charge: a.charge, lp: a.lp, radical: a.radical, label: a.label, iso: a.iso });
        map.set(a.id, n.id);
      });
      other.bonds.forEach(b => this.addBond(map.get(b.a), map.get(b.b), b.order, { type: b.type }));
      return map;
    }
  }

  function ringBonds(mol, ring) {
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      const b = mol.bondBetween(ring[i], ring[(i + 1) % ring.length]);
      if (b) out.push(b);
    }
    return out;
  }
  function ringHasBond(ring, b) {
    const i = ring.indexOf(b.a), j = ring.indexOf(b.b);
    if (i < 0 || j < 0) return false;
    const d = Math.abs(i - j);
    return d === 1 || d === ring.length - 1;
  }

  /* Invalidation du cache des cycles à chaque modification */
  const _touch = Molecule.prototype.touch;
  Molecule.prototype.touch = function () { this._rings = null; return _touch.call(this); };

  /* ---------- Document : molécule courante + historique ---------- */
  class Document {
    constructor() {
      this.mol = new Molecule();
      this.undoStack = [];
      this.redoStack = [];
      this.selection = new Set();     // ids d'atomes sélectionnés
      this.selBonds = new Set();      // ids de liaisons sélectionnées
      this.dirty = false;
      this.path = null;
      this.limit = 120;
    }
    /* Enregistre l'état avant une modification ; `label` sert à l'info-bulle « Annuler » */
    snapshot(label = 'Modification') {
      this.undoStack.push({ label, json: JSON.stringify(this.mol.toJSON()), sel: [...this.selection] });
      if (this.undoStack.length > this.limit) this.undoStack.shift();
      this.redoStack.length = 0;
      this.dirty = true;
    }
    _restore(s) {
      this.mol = Molecule.fromJSON(JSON.parse(s.json));
      this.selection = new Set(s.sel.filter(id => this.mol.atom(id)));
      this.selBonds.clear();
    }
    undo() {
      if (!this.undoStack.length) return false;
      const cur = { label: 'Rétablir', json: JSON.stringify(this.mol.toJSON()), sel: [...this.selection] };
      const s = this.undoStack.pop();
      this.redoStack.push(cur);
      this._restore(s); this.dirty = true;
      M.bus.emit('doc:changed', { reason: 'undo' });
      return true;
    }
    redo() {
      if (!this.redoStack.length) return false;
      const cur = { label: 'Annuler', json: JSON.stringify(this.mol.toJSON()), sel: [...this.selection] };
      const s = this.redoStack.pop();
      this.undoStack.push(cur);
      this._restore(s); this.dirty = true;
      M.bus.emit('doc:changed', { reason: 'redo' });
      return true;
    }
    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }
    setMolecule(mol, label) {
      this.mol = mol;
      this.selection.clear(); this.selBonds.clear();
      this.undoStack.length = 0; this.redoStack.length = 0;
      this.dirty = false;
      M.bus.emit('doc:changed', { reason: 'load', label });
    }
    changed(reason = 'edit') { this.dirty = true; this.mol.touch(); M.bus.emit('doc:changed', { reason }); }
    selectedAtoms() { return [...this.selection].map(id => this.mol.atom(id)).filter(Boolean); }
  }

  M.Molecule = Molecule;
  M.Document = Document;
  M.Atom = Atom;
  M.Bond = Bond;
  M.ringBonds = ringBonds;
})();
