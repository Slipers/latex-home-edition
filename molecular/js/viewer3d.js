/* Visualiseur 3D (three.js) : modes de représentation, sélection, mesures, manipulation. */
(function () {
  const V = M.V, U = M.util;
  const T = () => window.THREE;

  const MODES = {
    'boules-batonnets': { nom: 'Boules et bâtonnets', rAtome: 0.30, rLiaison: 0.10, vdw: false },
    'batonnets': { nom: 'Bâtonnets', rAtome: 0.14, rLiaison: 0.14, vdw: false },
    'spheres': { nom: 'Sphères de van der Waals', rAtome: 1, rLiaison: 0, vdw: true },
    'fil': { nom: 'Fil de fer', rAtome: 0.05, rLiaison: 0.035, vdw: false },
    'squelette': { nom: 'Squelette (carbones implicites)', rAtome: 0.16, rLiaison: 0.11, vdw: false, squelette: true },
  };

  class Viewer {
    constructor(hote) {
      this.hote = hote;
      this.doc = null;
      this.mode = 'boules-batonnets';
      this.opts = {
        labels: 'aucun',        // aucun | symbole | numero | symbole+numero | charge
        doublets: false,        // doublets non liants
        charges: false,         // charges partielles δ
        dipole: false,          // moment dipolaire
        h: true,                // afficher les hydrogènes
        qualite: 2,             // 1 rapide, 2 normale, 3 fine
        perspective: true,
        ombres: true,
      };
      this.selection = new Set();
      this.mesure = [];         // atomes choisis pour une mesure
      this.outil = 'orbite';    // orbite | selection | deplacer | lier | supprimer | element
      this.elementActif = 'C';
      this.survol = null;
      this._init();
    }

    _init() {
      const TH = T();
      this.scene = new TH.Scene();
      this.groupe = new TH.Group();
      this.scene.add(this.groupe);
      this.overlay = new TH.Group();
      this.scene.add(this.overlay);

      const w = this.hote.clientWidth || 800, h = this.hote.clientHeight || 600;
      this.camPersp = new TH.PerspectiveCamera(42, w / h, 0.1, 2000);
      this.camOrtho = new TH.OrthographicCamera(-10, 10, 10, -10, -500, 1000);
      this.camera = this.camPersp;
      this.cible = new TH.Vector3(0, 0, 0);
      this.distance = 18;
      this.theta = 0.6; this.phi = 1.15;

      this.renderer = new TH.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      /* updateStyle = false : la taille à l'écran est fixée par la feuille de style
         (width/height à 100 %), sans quoi un style en ligne figerait le canevas à sa
         taille initiale et ferait déborder la grille. */
      this.renderer.setSize(w, h, false);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = TH.PCFSoftShadowMap;
      this.hote.appendChild(this.renderer.domElement);

      this.lumieres = new TH.Group();
      const amb = new TH.AmbientLight(0xffffff, 0.55);
      const key = new TH.DirectionalLight(0xffffff, 0.85); key.position.set(6, 10, 9); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 80;
      key.shadow.camera.left = -20; key.shadow.camera.right = 20; key.shadow.camera.top = 20; key.shadow.camera.bottom = -20;
      const fill = new TH.DirectionalLight(0xffffff, 0.35); fill.position.set(-8, -4, -6);
      const rim = new TH.DirectionalLight(0xffffff, 0.25); rim.position.set(0, -10, 6);
      this.lumieres.add(amb, key, fill, rim);
      this.scene.add(this.lumieres);
      this.key = key;

      this.sol = new TH.Mesh(new TH.PlaneGeometry(200, 200),
        new TH.ShadowMaterial({ opacity: 0.12 }));
      this.sol.rotation.x = -Math.PI / 2; this.sol.receiveShadow = true; this.sol.visible = false;
      this.scene.add(this.sol);

      this.raycaster = new TH.Raycaster();
      this.souris = new TH.Vector2();
      this.geoSphere = [8, 16, 32].map(n => new TH.SphereGeometry(1, n * 2, n));
      this.geoCyl = [6, 12, 24].map(n => new TH.CylinderGeometry(1, 1, 1, n, 1, true));
      this._materiaux = new Map();
      this._brancherEvenements();
      this._boucle();
      this.redimensionner();
    }

    /* ---------- Matériaux mis en cache par couleur ---------- */
    mat(couleur, opt = {}) {
      const k = couleur + ':' + (opt.emissive || 0) + ':' + (opt.opacity || 1) + ':' + (opt.plat ? 1 : 0);
      if (this._materiaux.has(k)) return this._materiaux.get(k);
      const TH = T();
      const m = opt.plat
        ? new TH.MeshBasicMaterial({ color: couleur, transparent: opt.opacity < 1, opacity: opt.opacity || 1 })
        : new TH.MeshPhongMaterial({
          color: couleur, shininess: 62, specular: 0x333333,
          emissive: opt.emissive || 0x000000,
          transparent: (opt.opacity || 1) < 1, opacity: opt.opacity || 1,
        });
      this._materiaux.set(k, m);
      return m;
    }

    /* ---------- Reconstruction de la scène ---------- */
    setDocument(doc) { this.doc = doc; this.reconstruire(); this.cadrer(); }

    reconstruire() {
      const TH = T();
      while (this.groupe.children.length) {
        const c = this.groupe.children.pop();
        if (c.geometry && c.geometry._jetable) c.geometry.dispose();
      }
      this.atomesMesh = new Map();
      this.liaisonsMesh = new Map();
      if (!this.doc) return;
      const mol = this.doc.mol;
      const cfg = MODES[this.mode];
      const q = this.opts.qualite - 1;
      const gS = this.geoSphere[q], gC = this.geoCyl[q];
      const cacheH = !this.opts.h;
      const squelette = !!cfg.squelette;
      const visible = a => {
        if (cacheH && a.el === 'H' && mol.degree(a.id) === 1) return false;
        if (squelette && a.el === 'C' && mol.degree(a.id) >= 2 && !this.selection.has(a.id)) return false;
        if (squelette && a.el === 'H' && mol.degree(a.id) === 1) {
          const v = mol.neighborIds(a.id)[0];
          if (v != null && mol.atom(v).el === 'C') return false;
        }
        return true;
      };
      this._visible = visible;

      /* Atomes */
      mol.atoms.forEach(a => {
        if (!visible(a)) return;
        const e = M.elements.get(a.el) || { color: '#cccccc', rvdw: 1.7, rcov: 0.7 };
        const r = cfg.vdw ? e.rvdw * 0.98 : cfg.rAtome * (a.el === 'H' ? 0.78 : 1) * (1 + (e.rcov - 0.76) * 0.28);
        const sel = this.selection.has(a.id);
        const mesh = new TH.Mesh(gS, this.mat(e.color, { emissive: sel ? 0x2a4d8f : 0x000000 }));
        mesh.scale.setScalar(r);
        mesh.position.set(a.x, a.y, a.z);
        mesh.castShadow = this.opts.ombres; mesh.receiveShadow = this.opts.ombres;
        mesh.userData = { type: 'atome', id: a.id };
        this.groupe.add(mesh);
        this.atomesMesh.set(a.id, mesh);
        if (sel) this.groupe.add(this._halo(mesh.position, r * 1.35));
      });

      /* Liaisons */
      if (cfg.rLiaison > 0) mol.bonds.forEach(b => {
        const A = mol.atom(b.a), B = mol.atom(b.b);
        if (!A || !B || !visible(A) && !visible(B)) return;
        if (!visible(A) || !visible(B)) {
          if (!squelette) return;
        }
        const ea = M.elements.get(A.el) || { color: '#ccc' }, eb = M.elements.get(B.el) || { color: '#ccc' };
        const pa = new TH.Vector3(A.x, A.y, A.z), pb = new TH.Vector3(B.x, B.y, B.z);
        const sel = this.doc.selBonds.has(b.id);
        const n = b.order === 3 ? 3 : b.order >= 2 ? 2 : 1;
        const perp = this._perpendiculaire(mol, b);
        const ecart = cfg.rLiaison * (b.order === 3 ? 2.5 : 2.6);
        for (let k = 0; k < n; k++) {
          const dec = n === 1 ? 0 : (k - (n - 1) / 2) * ecart;
          const off = perp.clone().multiplyScalar(dec);
          const rr = cfg.rLiaison * (n === 1 ? 1 : b.order === 1.5 && k === 1 ? 0.55 : 0.72);
          const longueur = b.order === 1.5 && k === 1 ? 0.62 : 1;
          this._cylindreDouble(pa.clone().add(off), pb.clone().add(off), rr, ea.color, eb.color, gC, b.id, sel, longueur, b.type);
        }
      });

      /* Doublets non liants */
      if (this.opts.doublets) this._doublets(mol, gS);
      /* Étiquettes */
      if (this.opts.labels !== 'aucun' || this.opts.charges) this._etiquettes(mol);
      /* Moment dipolaire */
      if (this.opts.dipole) this._dipole(mol);
      this._mesures(mol);
      this.sol.visible = this.opts.ombres && this.mode !== 'fil';
      if (this.sol.visible) this.sol.position.y = -(mol.atoms.reduce((m, a) => Math.min(m, a.y), 0) + 2.5);
      this.besoinRendu = true;
    }

    _halo(pos, r) {
      const TH = T();
      const m = new TH.Mesh(this.geoSphere[0], new TH.MeshBasicMaterial({ color: 0x4d8dff, transparent: true, opacity: 0.22, depthWrite: false }));
      m.scale.setScalar(r); m.position.copy(pos); m.userData = { type: 'halo' };
      return m;
    }

    /* Direction perpendiculaire à la liaison, dans le plan des substituants */
    _perpendiculaire(mol, b) {
      const TH = T();
      const A = mol.atom(b.a), B = mol.atom(b.b);
      const axe = V.norm(V.sub(B, A));
      let ref = null;
      const cand = mol.neighborIds(b.a).filter(i => i !== b.b).concat(mol.neighborIds(b.b).filter(i => i !== b.a));
      for (const c of cand) {
        const v = V.sub(mol.atom(c), A);
        const p = V.sub(v, V.mul(axe, V.dot(v, axe)));
        if (V.len(p) > 0.25) { ref = V.norm(p); break; }
      }
      if (!ref) ref = V.perp(axe);
      return new TH.Vector3(ref.x, ref.y, ref.z);
    }

    _cylindreDouble(pa, pb, r, ca, cb, geo, bondId, sel, frac, type) {
      const TH = T();
      if (frac < 1) {            // trait intérieur raccourci (liaison aromatique)
        const d = pb.clone().sub(pa).multiplyScalar((1 - frac) / 2);
        pa = pa.clone().add(d); pb = pb.clone().sub(d);
      }
      const mid = pa.clone().add(pb).multiplyScalar(0.5);
      const seg = (p1, p2, col) => {
        const dir = p2.clone().sub(p1);
        const len = dir.length();
        if (len < 1e-4) return;
        const m = new TH.Mesh(geo, this.mat(col, { emissive: sel ? 0x2a4d8f : 0x000000 }));
        m.scale.set(r, len, r);
        m.position.copy(p1).add(p2).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new TH.Vector3(0, 1, 0), dir.normalize());
        m.castShadow = this.opts.ombres;
        m.userData = { type: 'liaison', id: bondId };
        this.groupe.add(m);
      };
      if (type === 'd') {           // liaison en pointillés
        const n = 7, dir = pb.clone().sub(pa);
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = t0 + 0.55 / n;
          seg(pa.clone().add(dir.clone().multiplyScalar(t0)), pa.clone().add(dir.clone().multiplyScalar(t1)), i < n / 2 ? ca : cb);
        }
        return;
      }
      seg(pa, mid, ca);          // demi-liaison à la couleur du premier atome
      seg(mid, pb, cb);          // demi-liaison à la couleur du second
    }

    _doublets(mol, geo) {
      const TH = T();
      mol.atoms.forEach(a => {
        const n = M.geo.doublets(mol, a.id);
        if (!n || (!this.opts.h && a.el === 'H')) return;
        const e = M.elements.get(a.el) || { rcov: 0.7 };
        const voisins = mol.neighborIds(a.id).map(i => V.norm(V.sub(mol.atom(i), a)));
        const total = voisins.length + n;
        const dirs = M.geo.orienter(M.geo.directions(Math.min(6, Math.max(total, 1))), voisins).slice(voisins.length);
        for (let k = 0; k < n; k++) {
          const d = dirs[k] || V.perp(voisins[0] || { x: 0, y: 0, z: 1 });
          const base = V.add(a, V.mul(d, (MODES[this.mode].vdw ? e.rvdw : 0.34) + 0.16));
          const lat = V.norm(V.cross(d, voisins[0] || { x: 0, y: 0, z: 1 }));
          [-1, 1].forEach(s => {
            const p = V.add(base, V.mul(isFinite(lat.x) ? lat : { x: 1, y: 0, z: 0 }, s * 0.11));
            const m = new TH.Mesh(geo, this.mat('#7f9ec9', { plat: true, opacity: 0.92 }));
            m.scale.setScalar(0.062);
            m.position.set(p.x, p.y, p.z);
            m.userData = { type: 'doublet', id: a.id };
            this.groupe.add(m);
          });
        }
      });
    }

    /* Étiquette de texte : le canevas est ajusté à la chaîne, et la taille finale
       est recalculée à chaque image pour rester constante à l'écran. */
    _texteSprite(txt, couleur) {
      const TH = T();
      const POLICE = 'bold 64px "Segoe UI", system-ui, sans-serif';
      const cv = document.createElement('canvas');
      let g = cv.getContext('2d');
      g.font = POLICE;
      cv.width = Math.max(48, Math.ceil(g.measureText(txt).width) + 26);
      cv.height = 96;
      g = cv.getContext('2d');                 // le redimensionnement réinitialise le contexte
      g.font = POLICE;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 9; g.lineJoin = 'round';
      g.strokeStyle = this.fondClair ? 'rgba(255,255,255,.94)' : 'rgba(10,14,22,.94)';
      g.strokeText(txt, cv.width / 2, cv.height / 2);
      g.fillStyle = couleur;
      g.fillText(txt, cv.width / 2, cv.height / 2);
      const tex = new TH.CanvasTexture(cv);
      tex.minFilter = TH.LinearFilter;
      const sp = new TH.Sprite(new TH.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      sp.userData = { type: 'etiquette', aspect: cv.width / cv.height };
      sp._jetable = true;
      return sp;
    }

    _etiquettes(mol) {
      const q = this.opts.charges ? M.analyse.chargesPartielles(mol) : null;
      const col = this.fondClair ? '#101828' : '#f2f5fa';
      mol.atoms.forEach(a => {
        if (this._visible && !this._visible(a)) return;
        let t = '';
        const o = this.opts.labels;
        if (o === 'symbole') t = a.el;
        else if (o === 'numero') t = String(mol.numero(a.id));
        else if (o === 'symbole+numero') t = a.el + mol.numero(a.id);
        if (a.label) t = a.label;
        const qf = a.charge || 0;
        if (qf) t += qf > 0 ? (qf > 1 ? '+' + qf : '⁺') : (qf < -1 ? qf : '⁻');
        if (this.opts.charges && q) {
          const dq = q.get(a.id) || 0;
          if (Math.abs(dq) > 0.04) t = (t ? t + ' ' : '') + (dq > 0 ? 'δ+' : 'δ−') + U.num(Math.abs(dq), 2);
        }
        if (!t) return;
        const e = M.elements.get(a.el) || { rvdw: 1.5 };
        const r = MODES[this.mode].vdw ? e.rvdw : 0.42;
        const sp = this._texteSprite(t, col);
        sp.position.set(a.x, a.y + r + 0.16, a.z);
        this.groupe.add(sp);
      });
    }

    _dipole(mol) {
      const TH = T();
      const d = M.analyse.momentDipolaire(mol);
      if (d.debye < 0.05) return;
      const c = mol.centerOfMass();
      const dir = new TH.Vector3(d.vecteur.x, d.vecteur.y, d.vecteur.z).normalize();
      const L = Math.min(4.5, 1.1 + d.debye * 0.7);
      const fl = new TH.ArrowHelper(dir, new TH.Vector3(c.x, c.y, c.z).addScaledVector(dir, -L / 2), L, 0xe0503a, L * 0.26, L * 0.15);
      fl.userData = { type: 'dipole' };
      this.groupe.add(fl);
      const sp = this._texteSprite('μ = ' + U.num(d.debye, 2) + ' D', '#e0503a');
      sp.position.set(c.x + dir.x * L * 0.72, c.y + dir.y * L * 0.72 + 0.45, c.z + dir.z * L * 0.72);
      this.groupe.add(sp);
    }

    _mesures(mol) {
      const TH = T();
      if (this.mesure.length < 2) return;
      const pts = this.mesure.map(id => mol.atom(id)).filter(Boolean);
      if (pts.length < 2) return;
      const geo = new TH.BufferGeometry().setFromPoints(pts.map(p => new TH.Vector3(p.x, p.y, p.z)));
      geo._jetable = true;
      const ligne = new TH.Line(geo, new TH.LineDashedMaterial({ color: 0xffb020, dashSize: 0.18, gapSize: 0.12, depthTest: false }));
      ligne.computeLineDistances();
      ligne.userData = { type: 'mesure' };
      this.groupe.add(ligne);
      const m = M.analyse.mesures(mol, this.mesure);
      if (!m) return;
      const c = pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, y: s.y + p.y / pts.length, z: s.z + p.z / pts.length }), { x: 0, y: 0, z: 0 });
      const sp = this._texteSprite(U.num(m.valeur, m.type === 'distance' ? 3 : 1) + ' ' + m.unite, '#ffb020');
      sp.position.set(c.x, c.y + 0.4, c.z);
      this.groupe.add(sp);
    }

    /* ---------- Caméra ---------- */
    cadrer(anim = true) {
      if (!this.doc || !this.doc.mol.atoms.length) return;
      const mol = this.doc.mol;
      const c = mol.center();
      const r = Math.max(1.6, mol.radius() + (MODES[this.mode].vdw ? 2.0 : 0.9));
      this.cible.set(c.x, c.y, c.z);
      const cible = r / Math.tan(U.rad(this.camPersp.fov / 2)) * 1.06;
      if (anim) this._animerVers(cible); else this.distance = cible;
      this.besoinRendu = true;
    }
    _animerVers(d) {
      const d0 = this.distance, t0 = performance.now();
      const pas = () => {
        const t = Math.min(1, (performance.now() - t0) / 320);
        this.distance = d0 + (d - d0) * (1 - Math.pow(1 - t, 3));
        this.besoinRendu = true;
        if (t < 1) requestAnimationFrame(pas);
      };
      pas();
    }
    majCamera() {
      const TH = T();
      const s = Math.sin(this.phi), x = this.distance * s * Math.sin(this.theta);
      const y = this.distance * Math.cos(this.phi), z = this.distance * s * Math.cos(this.theta);
      this.camera.position.set(this.cible.x + x, this.cible.y + y, this.cible.z + z);
      this.camera.lookAt(this.cible);
      if (this.camera === this.camOrtho) {
        const a = this.hote.clientWidth / Math.max(1, this.hote.clientHeight);
        const h = this.distance * 0.42;
        this.camOrtho.left = -h * a; this.camOrtho.right = h * a; this.camOrtho.top = h; this.camOrtho.bottom = -h;
        this.camOrtho.updateProjectionMatrix();
      }
      this.key.position.copy(this.camera.position).multiplyScalar(0.8).add(new TH.Vector3(4, 8, 2));
      /* Les étiquettes sont des sprites : sans correction elles grossiraient avec le zoom.
         On les redimensionne proportionnellement à la distance pour garder une taille lisible. */
      const h = this.distance * 0.042;
      this.groupe.children.forEach(o => {
        if (!o.isSprite || !o.userData || o.userData.type !== 'etiquette') return;
        o.scale.set(h * o.userData.aspect, h, 1);
      });
    }
    setPerspective(on) {
      this.opts.perspective = on;
      this.camera = on ? this.camPersp : this.camOrtho;
      this.redimensionner();
    }
    /* Oriente la caméra selon un axe : utile pour les projections de Newman */
    regarderSelon(u, up) {
      const d = V.norm(u);
      this.phi = Math.acos(U.clamp(d.y, -1, 1));
      this.theta = Math.atan2(d.x, d.z);
      void up;
      this.besoinRendu = true;
    }

    redimensionner() {
      const w = this.hote.clientWidth || 1, h = this.hote.clientHeight || 1;
      this.renderer.setSize(w, h, false);
      this.camPersp.aspect = w / h; this.camPersp.updateProjectionMatrix();
      this.besoinRendu = true;
    }

    setFond(couleur, clair) {
      this.fondClair = clair;
      this.scene.background = new (T()).Color(couleur);
      this.scene.fog = null;
      if (this.doc) this.reconstruire();
      this.besoinRendu = true;
    }

    /* ---------- Interaction ---------- */
    _brancherEvenements() {
      const el = this.renderer.domElement;
      el.style.touchAction = 'none';
      let bouton = -1, lx = 0, ly = 0, glisse = false, cible = null, depart = null;

      const pos = e => {
        const r = el.getBoundingClientRect();
        this.souris.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        this.souris.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      };

      el.addEventListener('pointerdown', e => {
        el.setPointerCapture(e.pointerId);
        bouton = e.button; lx = e.clientX; ly = e.clientY; glisse = false;
        pos(e);
        cible = this.viser();
        depart = cible && cible.type === 'atome' ? V.copy(this.doc.mol.atom(cible.id)) : null;
      });

      el.addEventListener('pointermove', e => {
        const dx = e.clientX - lx, dy = e.clientY - ly;
        if (bouton < 0) { pos(e); this._survoler(); return; }
        if (!glisse && Math.abs(dx) + Math.abs(dy) < 3) return;
        glisse = true;
        pos(e);
        const deplacerAtome = this.outil === 'deplacer' && cible && cible.type === 'atome' && bouton === 0;
        if (deplacerAtome) { this._deplacerAtome(cible.id, depart, e); }
        else if (bouton === 0 && !e.shiftKey) {
          this.theta -= dx * 0.0085; this.phi = U.clamp(this.phi - dy * 0.0085, 0.02, Math.PI - 0.02);
        } else {
          const TH = T();
          const k = this.distance * 0.0016;
          const droite = new TH.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
          const haut = new TH.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
          this.cible.addScaledVector(droite, -dx * k).addScaledVector(haut, dy * k);
        }
        lx = e.clientX; ly = e.clientY;
        this.besoinRendu = true;
      });

      el.addEventListener('pointerup', e => {
        el.releasePointerCapture(e.pointerId);
        const etait = bouton; bouton = -1;
        if (glisse) { if (this.outil === 'deplacer' && cible) M.bus.emit('vue:atome-deplace', cible.id); return; }
        if (etait === 0) this._clic(e, cible);
        cible = null;
      });

      el.addEventListener('wheel', e => {
        e.preventDefault();
        const f = Math.exp(U.clamp(e.deltaY, -160, 160) * 0.0012);
        this.distance = U.clamp(this.distance * f, 1.2, 400);
        this.besoinRendu = true;
      }, { passive: false });

      el.addEventListener('dblclick', e => {
        pos(e);
        const c = this.viser();
        if (c && c.type === 'atome') {
          const a = this.doc.mol.atom(c.id);
          this.cible.set(a.x, a.y, a.z);
        } else this.cadrer();
        this.besoinRendu = true;
      });
      el.addEventListener('contextmenu', e => e.preventDefault());
      window.addEventListener('resize', () => this.redimensionner());
    }

    viser() {
      if (!this.doc) return null;
      this.raycaster.setFromCamera(this.souris, this.camera);
      const objets = this.groupe.children.filter(o => o.userData && (o.userData.type === 'atome' || o.userData.type === 'liaison'));
      const hits = this.raycaster.intersectObjects(objets, false);
      if (!hits.length) return null;
      const h = hits[0];
      return { type: h.object.userData.type, id: h.object.userData.id, point: h.point, distance: h.distance };
    }

    _survoler() {
      const c = this.viser();
      const k = c ? c.type + c.id : null;
      if (k === this._survolCle) return;
      this._survolCle = k;
      this.survol = c;
      this.renderer.domElement.style.cursor = c ? (this.outil === 'deplacer' ? 'grab' : 'pointer') : (this.outil === 'element' ? 'copy' : 'default');
      M.bus.emit('vue:survol', c);
    }

    _clic(e, cible) {
      M.bus.emit('vue:clic', { cible, event: e, souris: { x: this.souris.x, y: this.souris.y } });
    }

    _deplacerAtome(id, depart, e) {
      const TH = T();
      const a = this.doc.mol.atom(id);
      if (!a) return;
      const normale = new TH.Vector3().subVectors(this.camera.position, this.cible).normalize();
      const p = new TH.Plane().setFromNormalAndCoplanarPoint(normale, new TH.Vector3(depart.x, depart.y, depart.z));
      this.raycaster.setFromCamera(this.souris, this.camera);
      const pt = new TH.Vector3();
      if (!this.raycaster.ray.intersectPlane(p, pt)) return;
      a.x = pt.x; a.y = pt.y; a.z = pt.z;
      this.doc.mol.touch();
      this.reconstruire();
      void e;
    }

    /* Coordonnées 3D d'un clic dans le plan de la caméra passant par la cible */
    pointDansPlan() {
      const TH = T();
      const normale = new TH.Vector3().subVectors(this.camera.position, this.cible).normalize();
      const p = new TH.Plane().setFromNormalAndCoplanarPoint(normale, this.cible);
      this.raycaster.setFromCamera(this.souris, this.camera);
      const pt = new TH.Vector3();
      return this.raycaster.ray.intersectPlane(p, pt) ? { x: pt.x, y: pt.y, z: pt.z } : { x: 0, y: 0, z: 0 };
    }

    _boucle() {
      const tick = () => {
        requestAnimationFrame(tick);
        if (this.rotationAuto) { this.theta += 0.0035; this.besoinRendu = true; }
        if (!this.besoinRendu) return;
        this.besoinRendu = false;
        this.majCamera();
        this.renderer.render(this.scene, this.camera);
      };
      tick();
    }

    image(echelle = 2) {
      const w = this.hote.clientWidth, h = this.hote.clientHeight;
      this.renderer.setSize(w * echelle, h * echelle, false);
      this.camPersp.aspect = w / h; this.camPersp.updateProjectionMatrix();
      this.majCamera();
      this.renderer.render(this.scene, this.camera);
      const url = this.renderer.domElement.toDataURL('image/png');
      this.renderer.setSize(w, h, false);
      this.besoinRendu = true;
      return url;
    }
  }

  M.Viewer = Viewer;
  M.MODES = MODES;
})();
