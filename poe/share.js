// Short tree links: "#t=<code>", next to the original "#s=id,id:choice,..." form.
//
// Picked nodes are always linked to the start, so the code doesn't list ids: it walks
// the tree from the start (breadth-first, each node's neighbours by ascending id) and
// stores one bit per node the walk reaches, 1 = picked (the walk goes on through it),
// 0 = not picked. A picked multiple-choice node is followed by its choice (0 = not
// chosen yet, i + 1 = choice i) in as few bits as its number of choices needs.
// Trailing 0 bits are dropped (missing bits read as 0), and the bits are written six
// to a character (base64url).
//
// Those bits only mean something on the tree they were made on, so the code starts
// with a 24-bit checksum of the plain selection (the sorted "id" / "id:choice" list,
// i.e. what the long form says). A code read on another version of the tree, or
// mistyped or cut short, fails the check and is refused instead of showing some
// other tree (false match: about 1 in 16 million).
//
// A graph is { start, edges: [[a, b], ...], v: { id: number of choices } }: the
// current tree's, or an older version's kept by build_atlas.py.
const Share = (() => {
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const SUM = 4; // checksum characters (24 bits)
  const width = k => Math.ceil(Math.log2(k + 1)); // bits for a value in 0..k

  const adjacency = new WeakMap();
  function walk(g, step) {
    let adj = adjacency.get(g);
    if (!adj) {
      adj = new Map();
      for (const [a, b] of g.edges) {
        if (!adj.has(a)) adj.set(a, []);
        if (!adj.has(b)) adj.set(b, []);
        adj.get(a).push(b);
        adj.get(b).push(a);
      }
      for (const list of adj.values()) list.sort((a, b) => a - b);
      adjacency.set(g, adj);
    }
    const seen = new Set([g.start]), queue = [g.start];
    for (let i = 0; i < queue.length; i++)
      for (const id of adj.get(queue[i]) || [])
        if (!seen.has(id)) { seen.add(id); if (step(id)) queue.push(id); }
  }

  // [[id, choice or undefined], ...] -> 4 characters
  function checksum(items) {
    const s = items.slice().sort((a, b) => a[0] - b[0])
      .map(([id, c]) => c === undefined ? id : id + ':' + c).join(',');
    let h = 0x811c9dc5; // FNV-1a
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    h = ((h >>> 24) ^ h) & 0xffffff;
    let out = '';
    for (let i = 0; i < SUM; i++) out += B64[(h >>> (6 * (SUM - 1 - i))) & 63];
    return out;
  }

  // picked: Map id -> choice index (undefined if none). Returns '' for an empty tree.
  function encode(g, picked) {
    const bits = [], items = [];
    walk(g, id => {
      const on = picked.has(id);
      bits.push(on ? 1 : 0);
      if (on) {
        const k = g.v[id];
        let c = picked.get(id);
        if (!k || !(c >= 0 && c < k)) c = undefined;
        items.push([id, c]);
        if (k) for (let x = c === undefined ? 0 : c + 1, b = width(k) - 1; b >= 0; b--) bits.push((x >> b) & 1);
      }
      return on;
    });
    if (!items.length) return '';
    while (bits.length && !bits[bits.length - 1]) bits.pop();
    let out = checksum(items);
    for (let i = 0; i < bits.length; i += 6) {
      let x = 0;
      for (let j = 0; j < 6; j++) x = x * 2 + (bits[i + j] || 0);
      out += B64[x];
    }
    return out;
  }

  // code -> [[id, choice or undefined], ...], or null if it isn't a tree of this graph
  function decode(g, code) {
    if (code.length < SUM || /[^\w-]/.test(code)) return null;
    const bits = [];
    for (const ch of code.slice(SUM)) {
      const x = B64.indexOf(ch);
      for (let b = 5; b >= 0; b--) bits.push((x >> b) & 1);
    }
    let pos = 0, bad = false;
    const read = n => { let x = 0; while (n--) x = x * 2 + (bits[pos++] || 0); return x; };
    const items = [];
    walk(g, id => {
      if (!read(1)) return false;
      const k = g.v[id];
      const x = k ? read(width(k)) : 0;
      if (x > k) bad = true;
      items.push([id, x ? x - 1 : undefined]);
      return true;
    });
    // set bits the walk never read: not a code this graph makes
    if (bad || !items.length || bits.indexOf(1, pos) >= 0) return null;
    return checksum(items) === code.slice(0, SUM) ? items : null;
  }

  return { encode, decode };
})();
