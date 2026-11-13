// 各類型全點統計：把同一類型（裂痕、凋落…）的所有節點效果加總，顯示全點後的數值。
(() => {
  if (!T.types) return;
  const btn = document.createElement('button');
  btn.id = 'stbtn';
  btn.textContent = '全點統計';
  btn.title = '顯示／隱藏各類型全點後的效果總和';
  document.querySelector('header .zoom').append(btn);

  const box = document.createElement('aside');
  box.id = 'stats';
  box.className = 'hidden';
  box.innerHTML = '<div class="sh"><b>各類型全點統計</b><button id="stclose" title="關閉">×</button></div>' +
    '<p class="note">同一類型所有節點全點後的效果總和。點數只算該類型本身的節點，不含走到那裡的路徑；「擇一」的節點只能選其中一項，所以分開列出。</p>' +
    '<input id="stq" type="search" placeholder="篩選類型或效果" autocomplete="off"><div id="stlist"></div>';
  document.body.append(box);

  function sum(lines) {
    const groups = new Map();
    for (const s of lines) {
      const key = s.replace(NUM, '#');
      const nums = (s.match(NUM) || []).map(Number);
      const g = groups.get(key);
      if (!g) groups.set(key, { text: s, nums, count: 1, sum: summableIndexes(s) });
      else { g.count++; for (const i of g.sum) g.nums[i] += nums[i]; }
    }
    return [...groups.values()].map(g => {
      let i = 0;
      const text = g.count > 1 && g.sum.length
        ? g.text.replace(NUM, m => g.sum.includes(i) ? String(Math.round(g.nums[i++] * 100) / 100) : (i++, m))
        : g.text;
      return { text, count: g.count };
    }).sort((a, b) => a.text.localeCompare(b.text, 'zh-Hant'));
  }

  let built = false;
  function build() {
    built = true;
    const list = document.getElementById('stlist');
    T.types.forEach((name, t) => {
      const nodes = T.nodes.filter(n => n.t === t && n.k !== 'mastery');
      if (!nodes.length) return;
      const d = document.createElement('details');
      const sm = document.createElement('summary');
      sm.innerHTML = '<span class="tn"></span><span class="tc"></span>';
      sm.firstChild.textContent = name;
      sm.lastChild.textContent = nodes.length + ' 點';
      d.append(sm);

      const mark = document.createElement('button');
      mark.className = 'mark';
      mark.textContent = '在天賦樹上標示這些節點';
      mark.onclick = () => {
        matches = nodes; cursor = -1;
        document.getElementById('hits').textContent = name + '：' + nodes.length + ' 個';
        draw();
      };
      d.append(mark);

      const ul = document.createElement('ul');
      for (const e of sum(nodes.filter(n => !n.v).flatMap(n => n.s))) {
        const li = document.createElement('li');
        li.textContent = e.text;
        if (e.count > 1) { const k = document.createElement('span'); k.className = 'n'; k.textContent = '×' + e.count; li.append(k); }
        ul.append(li);
      }
      d.append(ul);

      for (const n of nodes.filter(n => n.v)) {
        const c = document.createElement('div');
        c.className = 'ch';
        const h = document.createElement('div');
        h.className = 'chn';
        h.textContent = n.n + '（擇一）';
        h.title = '在天賦樹上顯示';
        h.onclick = () => centerOn(n);
        c.append(h);
        for (const s of n.s) { const p = document.createElement('div'); p.className = 'chp'; p.textContent = s; c.append(p); }
        const ol = document.createElement('ul');
        for (const [label] of n.v) { const li = document.createElement('li'); li.textContent = label; ol.append(li); }
        c.append(ol);
        d.append(c);
      }
      d.dataset.text = (name + ' ' + d.textContent).toLowerCase();
      list.append(d);
    });
  }

  function toggleStats(on) {
    if (on && !built) build();
    box.classList.toggle('hidden', !on);
    btn.classList.toggle('on', on);
  }
  btn.onclick = () => toggleStats(box.classList.contains('hidden'));
  document.getElementById('stclose').onclick = () => toggleStats(false);
  document.getElementById('stq').addEventListener('input', e => {
    const w = e.target.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    for (const d of document.querySelectorAll('#stlist details'))
      d.style.display = w.every(x => d.dataset.text.includes(x)) ? '' : 'none';
  });
  document.getElementById('stq').addEventListener('keydown', e => e.stopPropagation());
})();
