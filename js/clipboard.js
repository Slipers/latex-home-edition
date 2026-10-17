/* Copier / coller entre documents LaTeX Home Edition (même fenêtre, autre fichier, autre instance)
   - un morceau de texte : mise en forme, couleurs, formules, références et notes conservées ;
   - des blocs entiers (paragraphes, équations, tableaux, figures, encadrés…) : clic sur un bloc,
     puis Maj + clic sur un autre pour sélectionner tous les blocs entre les deux.
   Le presse-papiers reçoit trois versions : notre format (JSON, aussi glissé dans le HTML pour
   passer d'une instance à l'autre), du HTML lisible (Word…) et du texte brut. */
L.Clip = (function () {
  const MIME = 'application/x-lhe-clip';
  const MARK = 'lhe-clip:';
  let multi = [];        // blocs sélectionnés (Maj + clic), frères consécutifs d'une même liste

  const b64 = s => btoa(unescape(encodeURIComponent(s)));
  const unb64 = s => decodeURIComponent(escape(atob(s)));

  /* ---------- Contenu → texte brut / HTML lisible ---------- */
  const plainOf = html => {
    const d = document.createElement('div');
    d.innerHTML = String(html || '').replace(/<br>/g, '\n');
    d.querySelectorAll('.imath').forEach(x => { x.textContent = '$' + (x.dataset.latex || '') + '$'; });
    d.querySelectorAll('.fn, .rtag, .xref, .cite, .timg').forEach(x => x.remove());
    return d.textContent.replace(/[ \t]+/g, ' ').trim();
  };
  const readableHtml = html => {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    d.querySelectorAll('.imath').forEach(x => x.replaceWith(document.createTextNode('$' + (x.dataset.latex || '') + '$')));
    d.querySelectorAll('.fn, .rtag, .xref, .cite, .timg').forEach(x => x.remove());
    return d.innerHTML;
  };
  function blocksText(blocks, out, html) {
    for (const b of blocks) {
      if (b.type === 'paragraph' || b.type === 'heading') { out.push(plainOf(b.html)); html.push(b.type === 'heading' ? '<h3>' + readableHtml(b.html) + '</h3>' : '<p>' + readableHtml(b.html) + '</p>'); }
      else if (b.type === 'equation') { out.push('$$' + (b.latex || '') + '$$'); html.push('<p>$$' + L.escHtml(b.latex || '') + '$$</p>'); }
      else if (b.type === 'list') { out.push((b.items || []).map(it => '  '.repeat(it.level || 0) + '- ' + plainOf(it.html)).join('\n')); html.push('<ul>' + (b.items || []).map(it => '<li>' + readableHtml(it.html) + '</li>').join('') + '</ul>'); }
      else if (b.type === 'table') { out.push((b.rows || []).map(r => r.map(plainOf).join('\t')).join('\n')); html.push('<table>' + (b.rows || []).map(r => '<tr>' + r.map(c => '<td>' + readableHtml(c) + '</td>').join('') + '</tr>').join('') + '</table>'); }
      else if (b.type === 'code') { out.push(b.code || ''); html.push('<pre>' + L.escHtml(b.code || '') + '</pre>'); }
      if (b.children) blocksText(b.children, out, html);
    }
  }

  /* ---------- Ressources utilisées (images, références bibliographiques) ---------- */
  function eachString(v, fn) {
    if (typeof v === 'string') fn(v);
    else if (Array.isArray(v)) v.forEach(x => eachString(x, fn));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => eachString(v[k], fn));
  }
  function resources(payloadPart) {
    const doc = App.doc, assets = {}, bib = [];
    const cites = new Set();
    eachString(payloadPart, s => {
      for (const m of s.matchAll(/class="timg" data-src="([^"]+)"/g)) if (doc.assets && doc.assets[m[1]]) assets[m[1]] = doc.assets[m[1]];
      for (const m of s.matchAll(/class="cite" data-ref="([^"]+)"/g)) cites.add(m[1]);
    });
    if (Array.isArray(payloadPart)) L.walk(payloadPart, b => { if (b.type === 'figure' && b.src && doc.assets && doc.assets[b.src]) assets[b.src] = doc.assets[b.src]; });
    (doc.bib || []).forEach(e => { if (cites.has(e.id)) bib.push(e); });
    return { assets, bib };
  }

  /* ---------- Écriture / lecture du presse-papiers ---------- */
  function write(cd, payload, plain, html) {
    const json = JSON.stringify(payload);
    cd.setData('text/plain', plain);
    cd.setData('text/html', '<!--' + MARK + b64(json) + '-->' + html);
    try { cd.setData(MIME, json); } catch (e) {}
  }
  function read(cd) {
    if (!cd) return null;
    let json = '';
    try { json = cd.getData(MIME); } catch (e) {}
    if (!json) {
      const m = /<!--lhe-clip:([A-Za-z0-9+/=]+)-->/.exec(cd.getData('text/html') || '');
      if (m) try { json = unb64(m[1]); } catch (e) {}
    }
    if (!json) return null;
    let p;
    try { p = JSON.parse(json); } catch (e) { return null; }
    if (!p || p.v !== 1 || (p.kind !== 'inline' && p.kind !== 'blocks')) return null;
    // Contenu venu d'ailleurs : même nettoyage qu'un fichier .lhe reçu
    const clean = L.sanitizeDoc({ meta: {}, blocks: p.kind === 'blocks' ? (Array.isArray(p.blocks) ? p.blocks : []) : [{ type: 'paragraph', html: String(p.html || '') }], bib: p.bib, assets: p.assets });
    return { kind: p.kind, blocks: p.kind === 'blocks' ? clean.blocks : null, html: p.kind === 'inline' ? clean.blocks[0].html : null, bib: clean.bib.filter(e => e && typeof e.id === 'string'), assets: clean.assets };
  }

  /* ---------- Sélection de texte → fragment enrichi ---------- */
  const FORMAT = n => n.nodeType === 1 && (/^(B|STRONG|I|EM|U|SUB|SUP|CODE)$/.test(n.tagName) ||
    (n.tagName === 'SPAN' && Array.from(n.classList).some(c => c === 'fbox' || (c.startsWith('c-') && L.TEXT_COLORS[c.slice(2)]) || L.TEXT_SIZES[c])));
  function rangeHtml(r, field) {
    const box = document.createElement('div');
    box.appendChild(r.cloneContents());
    // Sélection entièrement dans un <b>, une couleur… : la mise en forme englobante est reprise
    let n = r.commonAncestorContainer;
    if (n.nodeType !== 1) n = n.parentNode;
    while (n && n !== field && field.contains(n)) {
      if (FORMAT(n)) { const w = n.cloneNode(false); while (box.firstChild) w.appendChild(box.firstChild); box.appendChild(w); }
      n = n.parentNode;
    }
    return L.sanitizeNode(box).replace(/(<br>)+$/, '');
  }
  const fieldOf = node => { const el = node && (node.nodeType === 1 ? node : node.parentElement); return el && el.closest ? el.closest('#paper [data-f]') : null; };

  /* ---------- Blocs sélectionnés (Maj + clic) ---------- */
  function setMulti(ids) {
    L.$$('#paper .blk.msel').forEach(x => x.classList.remove('msel'));
    multi = ids;
    multi.forEach(id => { const el = App.blockEl(id); if (el) el.classList.add('msel'); });
  }
  function clearMulti() { if (multi.length) setMulti([]); }
  // Plage de blocs frères entre deux blocs (on remonte au parent commun)
  function rangeBetween(a, b) {
    const chain = id => { const out = []; let f = L.find(App.doc, id); while (f) { out.unshift(f); f = f.parent ? L.find(App.doc, f.parent.id) : null; } return out; };
    const ca = chain(a), cb = chain(b);
    if (!ca.length || !cb.length) return [];
    let i = 0;
    while (i < ca.length - 1 && i < cb.length - 1 && ca[i].block.id === cb[i].block.id) i++;
    // ca[i] et cb[i] : ancêtres de a et b dans la même liste (si possible)
    if (ca[i].list !== cb[i].list) return [];
    const list = ca[i].list, x = ca[i].index, y = cb[i].index;
    return list.slice(Math.min(x, y), Math.max(x, y) + 1).map(bk => bk.id);
  }
  function selectedBlocks() {
    if (!multi.length) return null;
    const list = multi.map(id => L.find(App.doc, id)).filter(Boolean);
    return list.length ? list.map(f => f.block) : null;
  }

  /* ---------- Sélection qui traverse plusieurs blocs (commencée hors du texte) ---------- */
  function crossBlocks(r) {
    const paper = L.$('#paper');
    if (!paper.contains(r.commonAncestorContainer)) return null;
    const tops = L.$$('#paper > .blk, #paper .blk').filter(el => r.intersectsNode(el));
    // blocs les plus extérieurs seulement, dans l'ordre du document
    const outer = tops.filter(el => !tops.some(o => o !== el && o.contains(el)));
    if (outer.length < 1) return null;
    const ids = outer.map(el => el.dataset.id).filter(id => id && !id.startsWith('__'));
    if (!ids.length) return null;
    const blocks = ids.map(id => L.find(App.doc, id)).filter(Boolean).map(f => JSON.parse(JSON.stringify(f.block)));
    // Premier / dernier paragraphe : seulement la partie sélectionnée
    const trim = (blk, el, atStart) => {
      if (!blk || !['paragraph', 'heading'].includes(blk.type)) return;
      const f = el.querySelector('[data-f="html"]');
      if (!f) return;
      const rr = document.createRange();
      rr.selectNodeContents(f);
      if (atStart && f.contains(r.startContainer)) rr.setStart(r.startContainer, r.startOffset);
      if (!atStart && f.contains(r.endContainer)) rr.setEnd(r.endContainer, r.endOffset);
      blk.html = rangeHtml(rr, f);
    };
    trim(blocks[0], outer[0], true);
    trim(blocks[blocks.length - 1], outer[outer.length - 1], false);
    return blocks;
  }

  /* ---------- Copier / couper ---------- */
  function copyBlocks(cd, blocks) {
    const out = [], html = [];
    blocksText(blocks, out, html);
    const res = resources(blocks);
    write(cd, { v: 1, kind: 'blocks', blocks, assets: res.assets, bib: res.bib }, out.filter(Boolean).join('\n\n'), html.join(''));
  }
  function onCopy(e, cut) {
    if (!App.doc || !L.$('#modal').hidden || L.$('#paper').offsetParent === null) return;
    const t0 = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
    if (t0 && t0.closest && t0.closest('input, textarea, select, math-field, #mathdock, .sympick, #findBar')) return;
    const s = window.getSelection();
    const r = s.rangeCount ? s.getRangeAt(0) : null;
    const fromCatcher = catcher && catcher.contains(e.target);
    const textSel = r && !r.collapsed && !fromCatcher;
    cut = cut || pendingCut;
    // 1. Blocs sélectionnés (Maj + clic), sans texte sélectionné
    if (!textSel && multi.length) {
      const blocks = selectedBlocks();
      if (!blocks) return;
      e.preventDefault();
      copyBlocks(e.clipboardData, JSON.parse(JSON.stringify(blocks)));
      if (cut) removeBlocks(multi.slice());
      L.toast(blocks.length + (blocks.length > 1 ? ' blocs copiés' : ' bloc copié') + (cut ? ' (coupés)' : ''));
      return;
    }
    if (!textSel) return;
    const fa = fieldOf(r.startContainer), fb = fieldOf(r.endContainer);
    // 2. Texte dans un seul champ
    if (fa && fa === fb) {
      if (fa.dataset.f === 'code') return;   // code : copie native (texte brut)
      const html = rangeHtml(r, fa);
      if (!html) return;
      e.preventDefault();
      const res = resources(html);
      write(e.clipboardData, { v: 1, kind: 'inline', html, assets: res.assets, bib: res.bib }, plainOf(html), readableHtml(html));
      if (cut) {
        document.execCommand('delete');
        App.syncField(fa); App.commit();
      }
      return;
    }
    // 3. Sélection à cheval sur plusieurs blocs
    const blocks = crossBlocks(r);
    if (!blocks) return;
    e.preventDefault();
    copyBlocks(e.clipboardData, blocks);
  }

  function removeBlocks(ids) {
    ids.forEach(id => {
      const f = L.find(App.doc, id);
      if (!f) return;
      f.list.splice(f.index, 1);
      if (f.parent && !f.parent.children.length) f.parent.children.push(L.newBlock('paragraph'));
    });
    if (!App.doc.blocks.length) App.doc.blocks.push(L.newBlock('paragraph'));
    multi = []; App.sel = null;
    App.commit(); App.render();
  }

  /* ---------- Coller ---------- */
  // Images et références bibliographiques apportées par le contenu collé ; renvoie la table de renommage
  function adopt(p) {
    const doc = App.doc, ren = {};
    doc.assets = doc.assets || {};
    Object.keys(p.assets || {}).forEach(k => {
      if (doc.assets[k] === p.assets[k]) return;
      let id = k;
      if (doc.assets[id] !== undefined) { id = 'img' + L.uid(''); ren['data-src="' + k + '"'] = 'data-src="' + id + '"'; ren['fig:' + k] = id; }
      doc.assets[id] = p.assets[k];
    });
    doc.bib = doc.bib || [];
    (p.bib || []).forEach(e => {
      const same = doc.bib.find(x => x.id === e.id);
      if (same && JSON.stringify(same) === JSON.stringify(e)) return;
      const ne = JSON.parse(JSON.stringify(e));
      if (same) { ne.id = 'r' + L.uid(''); ren['class="cite" data-ref="' + e.id + '"'] = 'class="cite" data-ref="' + ne.id + '"'; }
      doc.bib.push(ne);
    });
    return ren;
  }
  const applyRen = (s, ren) => { for (const [a, b] of Object.entries(ren)) if (!a.startsWith('fig:')) s = s.split(a).join(b); return s; };
  function renameIn(v, ren) {
    if (typeof v === 'string') return applyRen(v, ren);
    if (Array.isArray(v)) return v.map(x => renameIn(x, ren));
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = renameIn(v[k], ren); return o; }
    return v;
  }
  // Nouveaux identifiants (le même contenu peut être collé plusieurs fois) ; les renvois internes suivent
  function freshBlocks(blocks, ren) {
    const map = {};
    const out = renameIn(JSON.parse(JSON.stringify(blocks)), ren);
    L.walk(out, b => { const id = L.uid(); if (b.id) map[b.id] = id; b.id = id; if (b.type === 'figure' && ren['fig:' + b.src]) b.src = ren['fig:' + b.src]; });
    const s = JSON.stringify(out).replace(/data-ref=\\"([^"\\]+)\\"/g, (m, id) => map[id] ? 'data-ref=\\"' + map[id] + '\\"' : m);
    return JSON.parse(s);
  }
  const inlineOfBlocks = blocks => blocks.length === 1 && ['paragraph', 'heading'].includes(blocks[0].type) ? blocks[0].html : null;

  function insertHtmlAtCaret(field, html) {
    field.focus();
    document.execCommand('insertHTML', false, html || '');
    App.syncField(field);
    App.hydrateChips();
    App.commit();
    App.pagesSoon && App.pagesSoon();
  }

  // Collage dans un champ de texte ; renvoie true si traité
  function pasteInField(e, field) {
    const p = read(e.clipboardData);
    if (!p || field.dataset.f === 'code') return false;
    e.preventDefault();
    const ren = adopt(p);
    if (p.kind === 'inline') { insertHtmlAtCaret(field, applyRen(p.html, ren)); return true; }
    const blocks = freshBlocks(p.blocks, ren);
    const inline = inlineOfBlocks(blocks);
    const blk = field.closest('.blk');
    const f = blk && field.dataset.b !== 'meta' ? L.find(App.doc, blk.dataset.id) : null;
    // Un seul paragraphe, ou champ qui n'accepte que du texte (titre, case de tableau, légende…) : collé dans le texte
    if (inline !== null || !f || field.tagName === 'TD' || field.dataset.f !== 'html' || !['paragraph', 'heading'].includes(f.block.type)) {
      const html = inline !== null ? inline : blocks.filter(b => b.html).map(b => b.html).join(' ');
      insertHtmlAtCaret(field, html);
      return true;
    }
    // Plusieurs blocs : insérés après le bloc courant (qui est remplacé s'il est vide)
    App.syncField(field);
    insertBlocks(blocks, f);
    return true;
  }
  function insertBlocks(blocks, f) {
    if (f) {
      const empty = f.block.type === 'paragraph' && L.isEmptyHtml(f.block.html);
      f.list.splice(f.index + (empty ? 0 : 1), empty ? 1 : 0, ...blocks);
    } else App.doc.blocks.push(...blocks);
    const last = blocks[blocks.length - 1];
    App.sel = last.id;
    App.focusAfter = ['paragraph', 'heading', 'list'].includes(last.type) ? { id: last.id, where: 'end' } : null;
    App.commit(); App.render();
    setMulti(blocks.map(b => b.id));
    L.toast(blocks.length + (blocks.length > 1 ? ' blocs collés' : ' bloc collé') + '. Ctrl+Z pour annuler.');
  }
  // Collage hors d'un champ (bloc sélectionné) : après le bloc sélectionné
  function pasteOutside(e) {
    if (!App.doc || !L.$('#modal').hidden || L.$('#paper').offsetParent === null) return;
    const t = e.target;
    const fromCatcher = catcher && catcher.contains(t);
    if (fromCatcher) { e.preventDefault(); setTimeout(releaseCatcher); }
    else if (t && t.closest && (t.closest('[data-f]') || t.closest('input, textarea, math-field, #mathdock, .sympick, [contenteditable]'))) return;
    const p = read(e.clipboardData);
    if (!p) return;
    e.preventDefault();
    const ren = adopt(p);
    const blocks = p.kind === 'blocks' ? freshBlocks(p.blocks, ren) : [L.newBlock('paragraph', { html: applyRen(p.html, ren) })];
    const anchor = multi.length ? multi[multi.length - 1] : App.sel;
    const f = anchor && !anchor.startsWith('__') ? L.find(App.doc, anchor) : null;
    if (f && f.block.type === 'paragraph' && L.isEmptyHtml(f.block.html)) insertBlocks(blocks, f);
    else if (f) { f.list.splice(f.index + 1, 0, ...blocks); finishInsert(blocks); }
    else insertBlocks(blocks, null);
  }
  function finishInsert(blocks) {
    const last = blocks[blocks.length - 1];
    App.sel = last.id; App.focusAfter = null;
    App.commit(); App.render();
    setMulti(blocks.map(b => b.id));
    L.toast(blocks.length + (blocks.length > 1 ? ' blocs collés' : ' bloc collé') + '. Ctrl+Z pour annuler.');
  }

  /* ---------- Zone invisible qui reçoit Ctrl+C / Ctrl+V quand aucun texte n'a le focus ----------
     (sans zone modifiable sous le curseur, le navigateur ne déclenche pas le collage) */
  let catcher = null, pendingCut = false;
  function useCatcher() {
    if (!catcher) {
      catcher = L.h('div', { contenteditable: 'true', 'aria-hidden': 'true', tabindex: '-1',
        style: { position: 'fixed', left: '-9999px', top: '0', width: '1px', height: '1px', overflow: 'hidden', opacity: '0' } });
      document.body.appendChild(catcher);
    }
    catcher.textContent = '​';
    catcher.focus({ preventScroll: true });
    const r = document.createRange(); r.selectNodeContents(catcher);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function releaseCatcher() { if (catcher) { catcher.textContent = ''; if (document.activeElement === catcher) catcher.blur(); } }

  /* ---------- Installation ---------- */
  function init() {
    const paper = L.$('#paper');
    // Après chaque nouveau rendu de la feuille, les blocs sélectionnés restent surlignés
    const render0 = App.render;
    App.render = function (...a) {
      const r = render0.apply(this, a);
      if (multi.length) setMulti(multi.filter(id => L.find(App.doc, id)));
      return r;
    };
    document.addEventListener('copy', e => onCopy(e, false));
    document.addEventListener('cut', e => onCopy(e, true));
    document.addEventListener('paste', pasteOutside);
    // Maj + clic : sélection de plusieurs blocs
    paper.addEventListener('mousedown', e => {
      const blk = e.target.closest('.blk');
      if (!e.shiftKey || !blk || blk.dataset.id.startsWith('__')) { if (!e.shiftKey) clearMulti(); return; }
      const af = fieldOf(document.activeElement);
      const anchor = multi.length ? multi[0] : (af ? af.closest('.blk')?.dataset.id : App.sel);
      if (!anchor || anchor === blk.dataset.id && !multi.length && af) return;   // Maj + clic dans le même texte : sélection de texte normale
      const ids = rangeBetween(anchor, blk.dataset.id);
      if (!ids.length) return;
      e.preventDefault(); e.stopPropagation();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      window.getSelection().removeAllRanges();
      App.select(ids[0]);
      setMulti(ids);
    }, true);
    // Raccourcis quand aucun texte n'est en cours d'édition (blocs sélectionnés, ou un bloc cliqué)
    document.addEventListener('keydown', e => {
      if (!App.doc || !L.$('#modal').hidden || L.$('#paper').offsetParent === null) return;
      const ae = document.activeElement;
      if (fieldOf(ae) || (ae && ae !== document.body && ae !== catcher && ae.matches && ae.matches('input, textarea, select, [contenteditable], math-field'))) return;
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      // Coller : après le bloc sélectionné (ou à la fin du document)
      if (mod && !e.shiftKey && !e.altKey && k === 'v') { useCatcher(); setTimeout(releaseCatcher, 400); return; }   // le collage natif part dans la zone invisible
      if (!multi.length) return;
      if (mod && (k === 'c' || k === 'x')) {
        e.preventDefault();
        pendingCut = k === 'x';
        useCatcher();
        try { document.execCommand('copy'); } finally { pendingCut = false; releaseCatcher(); }
      }
      else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); e.stopImmediatePropagation(); removeBlocks(multi.slice()); }
      else if (e.key === 'Escape') clearMulti();
    }, true);
  }

  return { init, read, pasteInField, clearMulti, selected: () => multi.slice(), select: setMulti, rangeBetween };
})();
