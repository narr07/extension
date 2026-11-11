/* global BmdData, XLSX */
(function () {
  'use strict';

  const D = window.BmdData;
  const $ = (id) => document.getElementById(id);
  const norm = D.norm;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const SITE = 'https://asetdisdik.id/';
  const KIBE_URL = 'https://asetdisdik.id/kib-e';
  const STORE_KEY = 'bmdKibe';

  const now = new Date();
  const QUARTER = String(Math.floor(now.getMonth() / 3) + 1);
  const YEAR = String(now.getFullYear());

  // ------------------------------------------------------------ field form KIB-E
  // type: text | select | money | number | kondisi
  const FIELDS = [
    { key: 'triwulan', label: 'Triwulan', type: 'select', required: true, guess: [/^triwulan$/i, /triwulan|^tw$/i], def: { mode: 'fixed', value: QUARTER } },
    { key: 'kode_ruang', label: 'Ruangan', type: 'select', guess: [/^kelas$/i, /ruang|kelas/i], def: { mode: 'fixed', value: '' } },
    { key: 'nomor_register', label: 'Nomor Register', type: 'text', required: true, hint: 'Otomatis mengikuti jumlah: 0001 + jumlah 15 → 0001-0015.', guess: [/register|no\.?\s*reg/i], def: { mode: 'fixed', value: '0001' } },
    { key: 'judul_buku_perpustakaan', label: 'Judul Buku / Merk Alat', type: 'text', required: true, guess: [/^judul buku$/i, /judul|merk/i, /nama barang|uraian/i], def: { mode: 'fixed', value: '' } },
    { key: 'judul_buku_spesifikasi', label: 'Spesifikasi Buku', type: 'text', guess: [/spesifikasi|penerbit|pengarang/i], def: { mode: 'none' } },
    { key: 'barang_kesenian_asaldaerah', label: 'Asal Barang Kesenian', type: 'text', guess: [/asal (barang )?kesenian|asal daerah/i], def: { mode: 'none' } },
    { key: 'barang_kesenian_pencipta', label: 'Pencipta Barang Kesenian', type: 'text', guess: [/pencipta/i], def: { mode: 'none' } },
    { key: 'barang_kesenian_bahan', label: 'Bahan Barang Kesenian', type: 'text', guess: [/^bahan/i], def: { mode: 'none' } },
    { key: 'htt_jenis', label: 'Jenis Hewan/Ternak/Tumbuhan', type: 'text', guess: [/jenis hewan|tumbuhan|ternak/i], def: { mode: 'none' } },
    { key: 'htt_ukuran', label: 'Ukuran Hewan/Ternak/Tumbuhan', type: 'text', guess: [/^ukuran/i], def: { mode: 'none' } },
    { key: 'tahun_cetak_pembelian', label: 'Tahun Pembelian', type: 'select', required: true, guess: [/tahun (cetak|pembelian|beli)/i, /^tahun$/i], def: { mode: 'fixed', value: YEAR } },
    { key: 'kondisi', label: 'Kondisi', type: 'kondisi', required: true, guess: [/kondisi|keadaan/i], def: { mode: 'fixed', value: 'b' } },
    { key: 'jumlah', label: 'Jumlah Barang', type: 'number', required: true, guess: [/^jumlah$/i, /jumlah|qty|kuantitas|terima|banyak/i], def: { mode: 'fixed', value: '1' } },
    { key: 'satuan', label: 'Satuan', type: 'text', guess: [/^satuan$|^unit$/i], def: { mode: 'none' } },
    { key: 'asal_cara_perolehan', label: 'Asal Cara Perolehan', type: 'select', required: true, guess: [/asal cara|cara perolehan|sumber dana/i], def: { mode: 'fixed', value: 'BOS' } },
    { key: 'harga_satuan', label: 'Harga Satuan', type: 'money', required: true, guess: [/^harga satuan$/i, /harga satuan|harga/i], def: { mode: 'fixed', value: '' } }
  ];
  const KONDISI = [{ value: 'b', text: 'Baik' }, { value: 'kb', text: 'Hilang' }, { value: 'rb', text: 'Rusak berat' }];
  const FALLBACK_OPTIONS = {
    triwulan: [1, 2, 3, 4].map((n) => ({ value: String(n), text: 'Triwulan ' + n })),
    asal_cara_perolehan: ['BOS', 'DAK', 'APBD PROVINSI', 'APBD KABUPATEN', 'BLOCKGRANT', 'KOMITE', 'HIBAH', 'MUTASI ANTAR SKPD'].map((v) => ({ value: v, text: v })),
    tahun_cetak_pembelian: Array.from({ length: 40 }, (_, i) => String(now.getFullYear() - i)).map((v) => ({ value: v, text: v })),
    kode_ruang: []
  };

  // ------------------------------------------------------------ state
  let state = {
    data: null, // {headers, rows, source:{type,name,meta}}
    mapping: null,
    settings: { rowFrom: 1, rowTo: '', rowDelay: 800, timeout: 20000, onError: 'stop', skipDone: true },
    status: {}, // entryKey -> {state, msg, at}
    log: [],
    pageOptions: null,
    tab: 'data'
  };

  function defaultMapping() {
    const fields = {};
    FIELDS.forEach((f) => { fields[f.key] = Object.assign({ column: '', touched: false }, f.def); });
    return { fields, kode: { mode: 'fixed', item: null, column: '' }, split: false };
  }

  // Simpan di microtask (bukan setTimeout): timer bisa dibekukan browser saat panel/tab
  // di latar belakang, sehingga status "Tersimpan" bisa hilang dan memicu input ganda.
  let savePending = false;
  function persist() {
    if (savePending) return;
    savePending = true;
    queueMicrotask(() => {
      savePending = false;
      chrome.storage.local.set({ [STORE_KEY]: state }).catch((e) => console.error('Gagal menyimpan state', e));
    });
  }

  async function load() {
    try {
      const got = await chrome.storage.local.get(STORE_KEY);
      if (got && got[STORE_KEY]) state = Object.assign(state, got[STORE_KEY]);
    } catch (e) { console.error(e); }
    if (!state.mapping) state.mapping = defaultMapping();
    // field baru di versi berikutnya
    FIELDS.forEach((f) => {
      if (!state.mapping.fields[f.key]) state.mapping.fields[f.key] = Object.assign({ column: '', touched: false }, f.def);
    });
  }

  // ------------------------------------------------------------ log
  function log(level, msg) {
    state.log.push({ t: Date.now(), level, msg });
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
    renderLog();
    persist();
  }
  function renderLog() {
    const ul = $('log');
    ul.textContent = '';
    state.log.slice(-200).reverse().forEach((l) => {
      const li = document.createElement('li');
      li.className = l.level;
      const t = new Date(l.t);
      const time = document.createElement('time');
      time.textContent = t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      li.append(time, document.createTextNode(' ' + l.msg));
      ul.appendChild(li);
    });
  }

  // ------------------------------------------------------------ dialog konfirmasi
  function confirmBox(message, okText) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'confirm';
      const p = document.createElement('p');
      p.textContent = message;
      const row = document.createElement('div');
      row.className = 'row gap end';
      const cancel = document.createElement('button');
      cancel.className = 'btn ghost'; cancel.type = 'button'; cancel.textContent = 'Batal';
      const ok = document.createElement('button');
      ok.className = 'btn primary'; ok.type = 'button'; ok.textContent = okText || 'Lanjut';
      row.append(cancel, ok);
      dlg.append(p, row);
      document.body.appendChild(dlg);
      const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
      cancel.onclick = () => done(false);
      ok.onclick = () => done(true);
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
      dlg.showModal();
      ok.focus();
    });
  }

  // ------------------------------------------------------------ tab & halaman
  let targetTabId = null;

  async function findTab() {
    try {
      const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (active && active.url && active.url.startsWith(SITE)) return active;
    } catch (e) { /* abaikan */ }
    const tabs = await chrome.tabs.query({ url: SITE + '*' });
    if (!tabs.length) return null;
    return tabs.find((t) => /\/kib-e/.test(t.url || '')) || tabs.find((t) => t.active) || tabs[0];
  }

  // Panggil fungsi di halaman KIB-E. Selalu selesai dalam batas waktu: kalau halaman dimuat
  // ulang atau tab ditidurkan browser, janji executeScript bisa tidak pernah selesai.
  function callPage(tabId, fn, args, limitMs) {
    const ms = limitMs || 30000;
    let timer;
    const limit = new Promise((resolve) => {
      timer = setTimeout(() => resolve({
        ok: false,
        timeout: true,
        error: 'Halaman KIB-E tidak merespons dalam ' + Math.round(ms / 1000) + ' detik. Pastikan tab KIB-E terbuka dan tidak sedang dimuat ulang.'
      }), ms);
    });
    return Promise.race([callPageRaw(tabId, fn, args), limit]).finally(() => clearTimeout(timer));
  }

  async function callPageRaw(tabId, fn, args) {
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['content/kibe-page.js'] });
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [fn, args == null ? null : args],
      func: async (fn, args) => {
        try {
          if (!window.__bmdKibe) return { ok: false, error: 'Skrip extension belum termuat di halaman' };
          const r = await window.__bmdKibe[fn](args);
          return { ok: true, r };
        } catch (e) {
          return { ok: false, error: String((e && e.message) || e) };
        }
      }
    });
    if (!res) return { ok: false, error: 'Halaman tidak merespons' };
    return res.result || { ok: false, error: 'Halaman tidak merespons' };
  }

  let pageInfo = null;
  async function checkConnection(quiet) {
    const conn = $('conn');
    const text = $('connText');
    let tab = null;
    try { tab = await findTab(); } catch (e) { /* abaikan */ }
    if (!tab) {
      conn.dataset.state = 'off';
      text.textContent = 'Buka asetdisdik.id';
      pageInfo = null;
      return null;
    }
    try {
      const res = await callPage(tab.id, 'info');
      if (res.ok && res.r.ok) {
        pageInfo = res.r;
        targetTabId = tab.id;
        conn.dataset.state = 'on';
        text.textContent = (pageInfo.sekolah || 'Terhubung') + ' · KIB-E';
        conn.title = 'Terhubung ke ' + pageInfo.url + (pageInfo.tahunInventarisasi ? ' (Tahun Inventarisasi ' + pageInfo.tahunInventarisasi + ')' : '');
        const opts = pageInfo.options;
        if (opts && opts.kode_ruang && opts.kode_ruang.length) {
          const changed = JSON.stringify(state.pageOptions) !== JSON.stringify(opts);
          state.pageOptions = opts;
          if (changed) { persist(); renderMapping(); }
        }
        return tab;
      }
      conn.dataset.state = 'warn';
      text.textContent = 'Buka halaman KIB-E';
      conn.title = 'Tab asetdisdik.id ditemukan, tapi bukan halaman KIB-E atau belum login.';
      pageInfo = null;
      return null;
    } catch (e) {
      conn.dataset.state = 'warn';
      text.textContent = 'Muat ulang tab';
      conn.title = String(e.message || e);
      if (!quiet) log('warn', 'Tidak bisa mengakses tab: ' + (e.message || e));
      pageInfo = null;
      return null;
    }
  }

  $('conn').addEventListener('click', async () => {
    const tab = await checkConnection(false);
    if (!tab) {
      const any = await findTab();
      if (any) await chrome.tabs.update(any.id, { url: KIBE_URL, active: true });
      else await chrome.tabs.create({ url: KIBE_URL });
      setTimeout(() => checkConnection(true), 2500);
    }
  });

  // ------------------------------------------------------------ tab panel
  function showTab(name) {
    state.tab = name;
    document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    if (name === 'run') renderEntries();
    persist();
  }
  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ------------------------------------------------------------ DATA
  function setData(table, source) {
    state.data = { headers: table.headers, rows: table.rows, source };
    state.status = {};
    state.regPreview = {};
    autoMap(table.headers);
    renderData();
    renderMapping();
    persist();
    log('info', 'Data dimuat: ' + table.rows.length + ' baris dari ' + (source.name || source.type));
  }

  $('fileInput').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    const name = file.name;
    const ext = name.split('.').pop().toLowerCase();
    $('sheetPick').classList.add('hidden');
    try {
      if (ext === 'pdf') {
        const t = await D.readPdf(await file.arrayBuffer());
        setData(t, { type: 'pdf', name, meta: t.meta });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const wb = D.readWorkbook(await file.arrayBuffer());
        const sel = $('sheetSelect');
        sel.textContent = '';
        wb.SheetNames.forEach((n) => sel.add(new Option(n, n)));
        if (wb.SheetNames.length > 1) {
          $('sheetPick').classList.remove('hidden');
          sel.onchange = () => setData(D.sheetToTable(wb, sel.value), { type: 'excel', name: name + ' › ' + sel.value });
        }
        setData(D.sheetToTable(wb, wb.SheetNames[0]), { type: 'excel', name: name + (wb.SheetNames.length > 1 ? ' › ' + wb.SheetNames[0] : '') });
      } else {
        const text = await file.text();
        setData(D.toTable(D.parseDelimited(text)), { type: 'csv', name });
      }
    } catch (e) {
      console.error(e, e.lines);
      log('error', 'Gagal membaca ' + name + ': ' + (e.message || e));
      alertInline(e.message || String(e));
    }
  });

  function alertInline(msg) {
    const meta = $('dataMeta');
    meta.classList.remove('hidden');
    meta.className = 'meta error';
    meta.textContent = msg;
  }

  $('btnPaste').addEventListener('click', () => { $('pasteBox').classList.remove('hidden'); $('pasteArea').focus(); });
  $('btnPasteCancel').addEventListener('click', () => $('pasteBox').classList.add('hidden'));
  $('btnPasteApply').addEventListener('click', () => {
    const text = $('pasteArea').value;
    if (!text.trim()) return;
    const t = D.toTable(D.parseDelimited(text, text.includes('\t') ? '\t' : undefined));
    if (!t.rows.length) { alertInline('Tidak ada baris data. Pastikan baris judul kolom ikut disalin.'); return; }
    setData(t, { type: 'paste', name: 'Tempelan' });
    $('pasteArea').value = '';
    $('pasteBox').classList.add('hidden');
  });

  const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  // Daftar Ruangan/Asal/Tahun dan kode barang dari halaman (kalau terhubung) untuk dropdown template
  async function templateOptions() {
    const tab = await checkConnection(true);
    const po = state.pageOptions || {};
    const texts = (k) => (po[k] || []).filter((o) => o.value !== '').map((o) => o.text);
    let kode = [];
    if (tab) {
      const res = await callPage(tab.id, 'kodeList', { q: '' });
      if (res.ok) {
        kodeCache = res.r;
        kode = res.r.filter((k) => !String(k.subsub_kelompok).includes('*')).map((k) => ({ uraian: norm(k.uraian), kode: kodeCode(k), id: k.id }));
      }
    }
    return {
      connected: !!tab,
      ruang: texts('kode_ruang'),
      asal: texts('asal_cara_perolehan'),
      tahun: texts('tahun_cetak_pembelian').sort((a, b) => b.localeCompare(a)),
      kode,
      sekolah: pageInfo && pageInfo.sekolah
    };
  }

  async function withBusy(btn, label, fn) {
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
    try { await fn(); } catch (e) { console.error(e); log('error', (e && e.message) || String(e)); } finally { btn.disabled = false; btn.textContent = old; }
  }

  $('btnTemplate').addEventListener('click', () => withBusy($('btnTemplate'), 'Menyiapkan…', async () => {
    const opts = await templateOptions();
    download('template-kib-e.xlsx', D.buildTemplate(opts), XLSX_TYPE);
    log('info', 'Template Excel diunduh' + (opts.connected ? ' (berisi daftar ruangan dan kode barang dari situs).' : '. Buka halaman KIB-E dulu supaya daftar ruangan dan kode barang ikut terisi.'));
  }));

  // Unduh data yang sedang dimuat. Data dari PDF SIPLah diubah ke format template.
  $('btnDownloadData').addEventListener('click', () => withBusy($('btnDownloadData'), 'Menyiapkan…', async () => {
    if (!state.data) return;
    const { headers, rows, source } = state.data;
    const base = (source.name || 'data').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
    if (source.type === 'pdf') {
      const opts = await templateOptions();
      const kodeDefault = state.mapping.kode.item ? norm(state.mapping.kode.item.uraian) : '';
      opts.rows = rows.map((r) => ({
        'Judul Buku': r['Judul Buku'],
        'Kelas / Ruangan': r['Kelas'],
        'Jumlah': r['Jumlah'],
        'Harga Satuan': r['Harga Satuan'],
        'Kode Barang': kodeDefault,
        'Nama di Invoice': r['Nama Barang (Invoice)'],
        'Total di Invoice': r['Total']
      }));
      opts.extra = ['Nama di Invoice', 'Total di Invoice'];
      download('KIB-E ' + base + '.xlsx', D.buildTemplate(opts), XLSX_TYPE);
    } else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, { header: headers }), 'Data');
      download('KIB-E ' + base + '.xlsx', XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true }), XLSX_TYPE);
    }
  }));

  $('btnClearData').addEventListener('click', async () => {
    if (!state.data) return;
    if (!(await confirmBox('Hapus data yang sedang dimuat beserta status hasil input?', 'Hapus'))) return;
    state.data = null;
    state.status = {};
    state.regPreview = {};
    renderData();
    renderMapping();
    persist();
  });

  function download(name, content, type) {
    const blob = new Blob([content], { type: typeof content === 'string' ? type + ';charset=utf-8' : type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function rupiah(n) {
    return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  }

  function renderData() {
    const wrap = $('dataTable');
    wrap.textContent = '';
    const meta = $('dataMeta');
    if (!state.data || !state.data.rows.length) {
      $('dataInfo').textContent = 'Belum ada data';
      meta.classList.add('hidden');
      wrap.innerHTML = '<p class="empty">Impor invoice PDF SIPLah, file Excel/CSV, atau tempel dari Excel.</p>';
      return;
    }
    const { headers, rows, source } = state.data;
    $('dataInfo').textContent = rows.length + ' baris';
    meta.className = 'meta';
    meta.classList.remove('hidden');
    const parts = [source.name];
    if (source.meta) {
      if (source.meta.nomor) parts.push('No. ' + source.meta.nomor);
      if (source.meta.tanggal) parts.push(source.meta.tanggal);
      if (source.meta.penyedia) parts.push(source.meta.penyedia);
    }
    if (headers.includes('Total')) {
      const sum = rows.reduce((a, r) => a + Number(D.money(r.Total) || 0), 0);
      const qty = rows.reduce((a, r) => a + Number(String(r.Jumlah || '').replace(/\D/g, '') || 0), 0);
      parts.push(qty + ' eksemplar · total ' + rupiah(sum));
    }
    meta.textContent = parts.join(' · ');

    const table = document.createElement('table');
    const thead = table.createTHead().insertRow();
    ['#', ...headers].forEach((h) => { const th = document.createElement('th'); th.textContent = h; thead.appendChild(th); });
    const tb = table.createTBody();
    rows.forEach((r, i) => {
      const tr = tb.insertRow();
      const n = tr.insertCell();
      n.textContent = i + 1;
      n.className = 'num';
      headers.forEach((h) => {
        const td = tr.insertCell();
        td.textContent = r[h];
        td.contentEditable = 'plaintext-only';
        td.spellcheck = false;
        td.addEventListener('blur', () => {
          const v = norm(td.textContent);
          if (v !== r[h]) { r[h] = v; persist(); }
        });
        td.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); td.blur(); } });
      });
    });
    wrap.appendChild(table);
  }

  // ------------------------------------------------------------ PEMETAAN
  function autoMap(headers) {
    const used = new Set();
    const m = state.mapping;
    FIELDS.forEach((f) => {
      const cur = m.fields[f.key];
      const validCol = cur.mode === 'column' && headers.includes(cur.column);
      if (cur.touched && (cur.mode !== 'column' || validCol)) { if (validCol) used.add(cur.column); return; }
      let found = '';
      for (const re of f.guess || []) {
        found = headers.find((h) => !used.has(h) && re.test(h)) || '';
        if (found) break;
      }
      if (found) {
        used.add(found);
        const fallback = cur.mode === 'column' ? cur.value : (cur.value || (f.def.mode === 'fixed' ? f.def.value : ''));
        m.fields[f.key] = { mode: 'column', column: found, value: fallback || '', touched: false };
      } else if (cur.mode === 'column') {
        m.fields[f.key] = Object.assign({ column: '', touched: false }, f.def);
      }
    });
    // Kolom Kode Barang dipakai kalau ada isinya; sel kosong memakai kode pilihan panel
    const kodeCol = headers.find((h) => /^kode barang$|^kode$|kode barang/i.test(h));
    const rows = state.data ? state.data.rows : [];
    if (kodeCol && rows.some((r) => norm(r[kodeCol]))) { m.kode.mode = 'column'; m.kode.column = kodeCol; }
    else if (m.kode.mode === 'column' && !headers.includes(m.kode.column)) { m.kode.mode = 'fixed'; m.kode.column = ''; }
    else if (m.kode.mode === 'column' && kodeCol === m.kode.column) { m.kode.mode = 'fixed'; }
  }

  function optionsFor(key) {
    if (key === 'kondisi') return KONDISI;
    const po = state.pageOptions && state.pageOptions[key];
    const list = po && po.length ? po : FALLBACK_OPTIONS[key] || [];
    return list.filter((o) => o.value !== '');
  }

  function valueWidget(f, cfg, isFallback) {
    let el;
    if (f.type === 'select' || f.type === 'kondisi') {
      el = document.createElement('select');
      el.add(new Option(isFallback ? (f.required ? 'jika kosong: error' : 'jika kosong: biarkan kosong') : '— pilih —', ''));
      optionsFor(f.key).forEach((o) => el.add(new Option(o.text, o.value)));
      if (cfg.value && !Array.from(el.options).some((o) => o.value === cfg.value)) el.add(new Option(cfg.value, cfg.value));
      el.value = cfg.value || '';
    } else {
      el = document.createElement('input');
      el.type = 'text';
      el.value = cfg.value || '';
      el.placeholder = f.key === 'nomor_register' ? 'nomor awal, mis. 0001' : (isFallback ? 'jika kosong…' : 'nilai');
      if (f.type === 'money' || f.type === 'number') el.inputMode = 'numeric';
    }
    el.addEventListener('change', () => { cfg.value = el.value; cfg.touched = true; persist(); });
    return el;
  }

  function renderMapping() {
    const box = $('mapFields');
    box.textContent = '';
    const headers = state.data ? state.data.headers : [];
    FIELDS.forEach((f) => {
      const cfg = state.mapping.fields[f.key];
      const row = document.createElement('div');
      row.className = 'maprow';
      const lab = document.createElement('label');
      lab.textContent = f.label;
      if (f.required) { const s = document.createElement('span'); s.className = 'req'; s.textContent = ' *'; lab.appendChild(s); }
      const ctl = document.createElement('div');
      ctl.className = 'mapctl';

      const mode = document.createElement('select');
      mode.className = 'mode';
      mode.add(new Option('Nilai tetap', 'fixed'));
      headers.forEach((h) => mode.add(new Option('Kolom: ' + h, 'col:' + h)));
      if (!f.required) mode.add(new Option('Kosongkan', 'none'));
      mode.value = cfg.mode === 'column' ? 'col:' + cfg.column : (cfg.mode === 'seq' ? 'fixed' : cfg.mode);
      if (mode.selectedIndex < 0) mode.value = 'fixed';
      mode.addEventListener('change', () => {
        const v = mode.value;
        if (v.startsWith('col:')) { cfg.mode = 'column'; cfg.column = v.slice(4); } else { cfg.mode = v; }
        cfg.touched = true;
        persist();
        renderMapping();
      });
      ctl.appendChild(mode);
      if (cfg.mode === 'fixed' || cfg.mode === 'seq') ctl.appendChild(valueWidget(f, cfg, false));
      else if (cfg.mode === 'column') ctl.appendChild(valueWidget(f, cfg, true));
      if (f.hint) { const h = document.createElement('small'); h.className = 'muted'; h.textContent = f.hint; ctl.appendChild(h); }

      row.append(lab, ctl);
      box.appendChild(row);
    });
    $('splitCopies').checked = !!state.mapping.split;
    renderKode();
  }

  $('splitCopies').addEventListener('change', (e) => { state.mapping.split = e.target.checked; state.regPreview = {}; persist(); renderEntries(); });
  $('btnRefreshOptions').addEventListener('click', async () => {
    const t = await checkConnection(false);
    if (t) log('info', 'Pilihan Ruangan/Triwulan/Tahun/Asal dimuat dari halaman.');
    else log('warn', 'Buka halaman KIB-E dulu untuk memuat pilihan.');
    renderMapping();
  });

  // ---- kode barang
  function kodeText(k) {
    return [k.golongan, k.bidang, k.kelompok, k.sub_kelompok, k.subsub_kelompok].join('.') + ' · ' + k.uraian;
  }
  function renderKode() {
    const k = state.mapping.kode;
    $('kodeMode').value = k.mode;
    $('kodeColumnBox').classList.toggle('hidden', k.mode !== 'column');
    $('kodeFixedLabel').textContent = k.mode === 'column' ? 'Kode default untuk sel yang kosong' : 'Kode untuk semua baris';
    const sel = $('kodeColumn');
    sel.textContent = '';
    sel.add(new Option('— pilih kolom —', ''));
    (state.data ? state.data.headers : []).forEach((h) => sel.add(new Option(h, h)));
    sel.value = k.column || '';
    const pill = $('kodePill');
    if (k.mode === 'fixed' && k.item) { pill.textContent = kodeText(k.item); pill.className = 'pill ok'; }
    else if (k.mode === 'column' && k.column) { pill.textContent = 'Kolom: ' + k.column + (k.item ? ' · default ' + k.item.uraian : ''); pill.className = 'pill ok'; }
    else { pill.textContent = 'Belum dipilih'; pill.className = 'pill warn'; }
  }
  $('kodeMode').addEventListener('change', (e) => { state.mapping.kode.mode = e.target.value; persist(); renderKode(); });
  $('kodeColumn').addEventListener('change', (e) => { state.mapping.kode.column = e.target.value; persist(); renderKode(); });

  async function searchKode() {
    const q = $('kodeSearch').value.trim();
    const ul = $('kodeResults');
    ul.innerHTML = '<li class="muted">Mencari…</li>';
    const tab = await checkConnection(true);
    if (!tab) { ul.innerHTML = '<li class="muted">Buka dan login ke halaman KIB-E dulu.</li>'; return; }
    const res = await callPage(tab.id, 'kodeList', { q });
    ul.textContent = '';
    if (!res.ok) { ul.innerHTML = ''; const li = document.createElement('li'); li.className = 'error'; li.textContent = res.error; ul.appendChild(li); return; }
    const list = res.r.filter((k) => !String(k.subsub_kelompok).includes('*')).slice(0, 60);
    if (!list.length) { ul.innerHTML = '<li class="muted">Tidak ada hasil.</li>'; return; }
    list.forEach((k) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = kodeText(k);
      if (state.mapping.kode.item && state.mapping.kode.item.id === k.id) b.classList.add('sel');
      b.addEventListener('click', () => {
        state.mapping.kode.item = k;
        persist();
        renderKode();
        ul.querySelectorAll('button').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }
  $('btnKodeSearch').addEventListener('click', searchKode);
  $('kodeSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchKode(); } });

  // ------------------------------------------------------------ ENTRI
  function buildEntries() {
    if (!state.data) return [];
    const out = [];
    const jm = state.mapping.fields.jumlah;
    state.data.rows.forEach((row, i) => {
      let copies = 1;
      if (state.mapping.split) {
        const raw = jm.mode === 'column' ? (row[jm.column] || jm.value) : jm.value;
        copies = Math.max(1, Math.min(500, parseInt(String(raw).replace(/\D/g, ''), 10) || 1));
      }
      for (let c = 0; c < copies; c++) {
        out.push({ key: state.mapping.split ? i + '.' + c : String(i), rowIndex: i, copy: c, copies, row });
      }
    });
    return out;
  }

  function kondisiCode(v) {
    const s = norm(v).toLowerCase();
    if (!s) return '';
    if (s === 'b' || s === 'kb' || s === 'rb') return s;
    if (/rusak/.test(s)) return 'rb';
    if (/hilang/.test(s)) return 'kb';
    if (/baik/.test(s)) return 'b';
    return null;
  }

  let kodeCache = null;
  function kodeCode(k) {
    return [k.golongan, k.bidang, k.kelompok, k.sub_kelompok, k.subsub_kelompok].join('.');
  }
  // Cari kode barang dari ID, kode lengkap, atau uraian. Hasil {kode} atau {error}.
  function findKode(v) {
    const s = norm(v).toLowerCase();
    const list = kodeCache || [];
    let k = list.find((x) => String(x.id) === s) || list.find((x) => kodeCode(x).toLowerCase() === s);
    if (k) return { kode: k };
    const byName = list.filter((x) => norm(x.uraian).toLowerCase() === s);
    const leaf = byName.filter((x) => !String(x.subsub_kelompok).includes('*'));
    const pick = leaf.length ? leaf : byName;
    if (pick.length === 1) return { kode: pick[0] };
    if (pick.length > 1) return { error: 'Kode barang "' + norm(v) + '" ada ' + pick.length + ', tulis kode lengkapnya (mis. ' + kodeCode(pick[0]) + ')' };
    return { error: 'Kode barang "' + norm(v) + '" tidak ditemukan' };
  }

  // Nomor register mengikuti jumlah: awal "0001" + jumlah 15 -> "0001-0015", jumlah 1 -> "0001".
  // Kalau jumlah dipecah per eksemplar: 0001, 0002, ... Nilai yang sudah berupa rentang/teks dipakai apa adanya.
  const regWidth = (s) => (s.length >= 3 ? s.length : 4); // "1" dari Excel (nol depan hilang) -> 0001
  function makeRegister(start, width, n) {
    const pad = (x) => String(x).padStart(width, '0');
    return n > 1 ? pad(start) + '-' + pad(start + n - 1) : pad(start);
  }
  function registerRange(v, jumlah, entry) {
    const s = norm(v);
    if (!/^\d+$/.test(s)) return s;
    const start = parseInt(s, 10);
    if (state.mapping.split) return makeRegister(start + entry.copy, regWidth(s), 1);
    return makeRegister(start, regWidth(s), parseInt(jumlah, 10) || 1);
  }
  // Lanjutkan dari nomor terakhir di situs: mulai = max(nomor awal, terakhir + 1)
  function continuedRegister(r, siteMax) {
    const s = r.regRaw;
    const start = Math.max(parseInt(s, 10) || 1, (siteMax || 0) + 1);
    return makeRegister(start, regWidth(s), state.mapping.split ? 1 : (parseInt(r.jumlah, 10) || 1));
  }
  const regContinue = () => state.settings.continueRegister !== false;

  function resolveEntry(entry, ordinal) {
    const values = {};
    const exact = []; // field select yang nilainya berasal dari dropdown panel (value opsi persis)
    const errors = [];
    let kondisi = 'b';
    let jumlah = '1';
    FIELDS.forEach((f) => {
      const cfg = state.mapping.fields[f.key];
      let v = '';
      if (cfg.mode === 'column') {
        v = norm(entry.row[cfg.column]);
        if (!v) { v = norm(cfg.value); if (v && f.type === 'select') exact.push(f.key); }
      } else if (cfg.mode === 'fixed' || cfg.mode === 'seq') { // 'seq' = versi lama, kini sama dengan nilai tetap
        v = norm(cfg.value);
        if (v && f.type === 'select') exact.push(f.key);
      }
      if (f.type === 'money') v = D.money(v);
      if (f.key === 'kondisi') {
        const k = kondisiCode(v);
        if (k === null) errors.push('Kondisi "' + v + '" tidak dikenal');
        else if (k) kondisi = k;
        return;
      }
      if (f.key === 'jumlah') {
        jumlah = state.mapping.split ? '1' : (String(v).replace(/\D/g, '') || '');
        if (!jumlah || jumlah === '0') errors.push('Jumlah kosong');
        return;
      }
      if (f.required && !v) errors.push(f.label + ' kosong');
      if (cfg.mode !== 'none') values[f.key] = v;
    });
    const regRaw = norm(values.nomor_register || '');
    const regAuto = /^\d+$/.test(regRaw); // nomor awal saja (bukan rentang/teks yang ditulis langsung)
    if (values.nomor_register) values.nomor_register = registerRange(values.nomor_register, jumlah, entry);
    if (regAuto && regContinue() && state.regPreview && state.regPreview[entry.key]) values.nomor_register = state.regPreview[entry.key];
    let kode = null;
    const km = state.mapping.kode;
    const cell = km.mode === 'column' && km.column ? norm(entry.row[km.column]) : '';
    if (cell) {
      if (kodeCache) {
        const f = findKode(cell);
        if (f.kode) kode = f.kode; else errors.push(f.error);
      } else {
        kode = { pending: cell }; // dicek setelah daftar kode dimuat dari halaman
      }
    } else {
      kode = km.item;
      if (!kode) errors.push(km.mode === 'column' ? 'Kode barang kosong dan belum ada kode default di tab Pemetaan' : 'Kode barang belum dipilih (tab Pemetaan)');
    }
    return { values, exact, kode, kondisi, jumlah, errors, regRaw, regAuto };
  }

  const STATUS_LABEL = { ok: 'Tersimpan', exists: 'Sudah ada', error: 'Gagal', unknown: 'Cek manual', filled: 'Terisi', running: 'Proses…' };
  const isDone = (key) => ['ok', 'exists'].includes((state.status[key] || {}).state);

  function renderEntries() {
    const entries = buildEntries();
    $('entryInfo').textContent = entries.length + ' entri';
    const done = entries.filter((e) => isDone(e.key)).length;
    if (!running) updateProgress(done, entries.length, done ? done + ' dari ' + entries.length + ' entri sudah tersimpan.' : 'Siap.');
    const wrap = $('entryTable');
    wrap.textContent = '';
    if (!entries.length) { wrap.innerHTML = '<p class="empty">Belum ada data.</p>'; return; }
    const table = document.createElement('table');
    const h = table.createTHead().insertRow();
    ['#', 'Judul', 'Ruang', 'Jml', 'Register', 'Harga', 'Status'].forEach((t) => { const th = document.createElement('th'); th.textContent = t; h.appendChild(th); });
    const tb = table.createTBody();
    entries.forEach((e, i) => {
      const r = resolveEntry(e, i);
      const tr = tb.insertRow();
      tr.id = 'entry-' + e.key.replace('.', '-');
      const st = state.status[e.key];
      const cells = [
        String(i + 1),
        (r.values.judul_buku_perpustakaan || '') + (e.copies > 1 ? ' (' + (e.copy + 1) + '/' + e.copies + ')' : ''),
        roomText(r.values.kode_ruang),
        r.jumlah,
        r.values.nomor_register || '',
        r.values.harga_satuan ? Number(r.values.harga_satuan).toLocaleString('id-ID') : '',
        st ? STATUS_LABEL[st.state] || st.state : (r.errors.length ? 'Perlu dicek' : '')
      ];
      cells.forEach((c, ci) => {
        const td = tr.insertCell();
        td.textContent = c;
        if (ci === 0) td.className = 'num';
        if (ci === 4) td.className = 'nowrap';
        if (ci === cells.length - 1) {
          td.className = 'status ' + (st ? st.state : (r.errors.length ? 'warn' : ''));
          td.title = st ? st.msg || '' : r.errors.join('; ');
        }
      });
    });
    wrap.appendChild(table);
  }

  function roomText(v) {
    if (!v) return '';
    const opts = optionsFor('kode_ruang');
    const n = /^\d+$/.test(v) ? Number(v) : null;
    const o = opts.find((x) => x.text.toLowerCase() === String(v).toLowerCase())
      || (n != null ? opts.find((x) => new RegExp('kelas\\s*' + n + '(?!\\d)', 'i').test(x.text)) : null)
      || opts.find((x) => x.value === v);
    return o ? o.text : v;
  }

  function updateProgress(done, total, text) {
    $('progBar').style.width = total ? Math.round((done / total) * 100) + '%' : '0';
    if (text) $('progText').textContent = text;
  }

  function setStatus(key, st, msg) {
    state.status[key] = { state: st, msg: msg || '', at: Date.now() };
    persist();
    const tr = $('entry-' + key.replace('.', '-'));
    if (tr) {
      const td = tr.cells[tr.cells.length - 1];
      td.textContent = STATUS_LABEL[st] || st;
      td.className = 'status ' + st;
      td.title = msg || '';
      if (st === 'running') tr.scrollIntoView({ block: 'nearest' });
    }
  }

  // ------------------------------------------------------------ JALANKAN
  let running = false;
  let paused = false;
  let stopRequested = false;

  function readSettings() {
    const s = state.settings;
    s.rowFrom = Math.max(1, parseInt($('rowFrom').value, 10) || 1);
    s.rowTo = $('rowTo').value ? Math.max(1, parseInt($('rowTo').value, 10)) : '';
    s.rowDelay = Math.max(0, parseInt($('rowDelay').value, 10) || 0);
    s.timeout = Math.max(3000, parseInt($('timeout').value, 10) || 20000);
    s.onError = $('onError').value;
    s.skipDone = $('skipDone').checked;
    s.skipExisting = $('skipExisting').checked;
    s.continueRegister = $('continueRegister').checked;
    persist();
    return s;
  }
  function applySettings() {
    const s = state.settings;
    $('rowFrom').value = s.rowFrom || 1;
    $('rowTo').value = s.rowTo || '';
    $('rowDelay').value = s.rowDelay;
    $('timeout').value = s.timeout;
    $('onError').value = s.onError;
    $('skipDone').checked = s.skipDone !== false;
    $('skipExisting').checked = s.skipExisting !== false;
    $('continueRegister').checked = s.continueRegister !== false;
  }
  ['rowFrom', 'rowTo', 'rowDelay', 'timeout', 'onError', 'skipDone', 'skipExisting', 'continueRegister'].forEach((id) => $(id).addEventListener('change', readSettings));
  $('continueRegister').addEventListener('change', () => renderEntries());

  function setRunning(on) {
    running = on;
    $('btnStart').disabled = on;
    $('btnTest').disabled = on;
    $('btnFillOnly').disabled = on;
    $('btnCheckSite').disabled = on;
    $('btnPause').disabled = !on;
    $('btnStop').disabled = !on;
    $('btnPause').textContent = 'Jeda';
    document.body.classList.toggle('is-running', on);
  }

  $('btnPause').addEventListener('click', () => {
    paused = !paused;
    $('btnPause').textContent = paused ? 'Lanjutkan' : 'Jeda';
    log('info', paused ? 'Dijeda.' : 'Dilanjutkan.');
  });
  $('btnStop').addEventListener('click', () => { stopRequested = true; paused = false; log('warn', 'Berhenti setelah entri yang sedang diproses.'); });

  async function preflight() {
    if (!state.data || !state.data.rows.length) { log('error', 'Belum ada data. Impor dulu di tab Data.'); showTab('data'); return null; }
    const km = state.mapping.kode;
    if (km.mode === 'fixed' && !km.item) { log('error', 'Pilih Kode Barang dulu di tab Pemetaan.'); showTab('map'); return null; }
    if (km.mode === 'column' && !km.column) { log('error', 'Pilih kolom Kode Barang di tab Pemetaan.'); showTab('map'); return null; }
    const tab = await checkConnection(false);
    if (!tab) { log('error', 'Halaman KIB-E belum terbuka atau belum login. Klik indikator di kanan atas untuk membukanya.'); return null; }
    if (km.mode === 'column') {
      const res = await callPage(tab.id, 'kodeList', { q: '' });
      if (!res.ok) { log('error', 'Gagal memuat daftar kode barang: ' + res.error); return null; }
      kodeCache = res.r;
    }
    return tab;
  }

  // Tandai entri yang datanya sudah ada di KIB-E situs (judul, ruangan, harga, jumlah, kode sama).
  // Setiap data di situs hanya "dipakai" sekali, jadi entri kembar (pecah per eksemplar) tetap dihitung benar.
  async function markExisting(tabId) {
    const all = buildEntries();
    const resolved = all.map((e, i) => {
      const r = resolveEntry(e, i);
      return r.errors.length || !r.kode || !r.kode.id ? null : { values: r.values, exact: r.exact, kode: { id: r.kode.id }, jumlah: r.jumlah };
    });
    const res = await callPage(tabId, 'dupCheck', { entries: resolved });
    if (!res.ok) throw new Error('Gagal mengecek data di situs: ' + res.error);
    const { sigs, existing, total, loaded } = res.r;
    if (loaded < total) log('warn', 'Situs hanya mengirim ' + loaded + ' dari ' + total + ' data, pengecekan data ganda mungkin tidak lengkap.');
    const avail = Object.assign({}, existing);
    // entri yang disimpan lewat extension sudah ada di situs: pakai jatahnya lebih dulu
    // Entri "Tersimpan" yang datanya sudah tidak ada di situs (dihapus) direset supaya bisa diinput lagi.
    const reverted = [];
    all.forEach((e, i) => {
      if ((state.status[e.key] || {}).state !== 'ok' || !sigs[i]) return;
      if (avail[sigs[i]] > 0) avail[sigs[i]]--;
      else { delete state.status[e.key]; reverted.push(i + 1); }
    });
    if (reverted.length) log('warn', reverted.length + ' entri berstatus Tersimpan tapi tidak ditemukan lagi di situs (mungkin dihapus), statusnya direset: #' + reverted.join(', #'));
    let found = 0;
    all.forEach((e, i) => {
      const st = (state.status[e.key] || {}).state;
      if (st === 'ok') return;
      if (sigs[i] && avail[sigs[i]] > 0) {
        avail[sigs[i]]--;
        found++;
        if (st !== 'exists') state.status[e.key] = { state: 'exists', msg: 'Data yang sama sudah ada di KIB-E situs', at: Date.now() };
      } else if (st === 'exists') {
        delete state.status[e.key];
      }
    });
    // Pratinjau nomor register yang melanjutkan data situs (entri berurutan dengan judul &
    // ruangan sama saling melanjutkan). Saat proses berjalan, nomor diambil ulang per entri.
    state.regPreview = {};
    if (regContinue()) {
      const regMax = Object.assign({}, res.r.regMax || {});
      all.forEach((e, i) => {
        if (isDone(e.key)) return; // sudah ada di situs, sudah terhitung di regMax
        const k = res.r.regKeys && res.r.regKeys[i];
        if (!k) return;
        const r = resolveEntry(e, i);
        if (!r.regAuto) return;
        const val = continuedRegister(r, regMax[k]);
        state.regPreview[e.key] = val;
        regMax[k] = regEndOf(val);
      });
    }
    persist();
    renderEntries();
    return { found, total };
  }

  const regEndOf = (s) => {
    const nums = String(s || '').match(/\d+/g);
    return nums ? Math.max.apply(null, nums.map(Number)) : 0;
  };

  function setRegisterCell(key, val) {
    const tr = $('entry-' + key.replace('.', '-'));
    if (tr && tr.cells[4]) tr.cells[4].textContent = val;
  }

  $('btnCheckSite').addEventListener('click', () => withBusy($('btnCheckSite'), 'Mengecek…', async () => {
    const tab = await preflight();
    if (!tab) return;
    const r = await markExisting(tab.id);
    log(r.found ? 'warn' : 'ok', r.found ? r.found + ' entri sudah ada di KIB-E situs dan akan dilewati.' : 'Belum ada entri yang sama di KIB-E situs (' + r.total + ' data dicek).');
  }));

  async function run(kind) {
    if (running) return;
    const s = readSettings();
    const tab = await preflight();
    if (!tab) return;
    if (s.skipExisting) {
      try {
        const r = await markExisting(tab.id);
        if (r.found) log('warn', r.found + ' entri sudah ada di KIB-E situs, dilewati.');
      } catch (err) {
        log('error', String(err.message || err) + ' Proses dibatalkan supaya tidak ada data ganda.');
        return;
      }
    }
    const all = buildEntries();
    const from = s.rowFrom - 1;
    const to = s.rowTo ? Math.min(all.length, s.rowTo) : all.length;
    let list = all.map((e, i) => ({ e, i })).slice(from, to);
    if (s.skipDone) list = list.filter((x) => (state.status[x.e.key] || {}).state !== 'ok');
    if (s.skipExisting) list = list.filter((x) => (state.status[x.e.key] || {}).state !== 'exists');
    if (kind !== 'all') list = list.slice(0, 1);
    if (!list.length) { log('warn', 'Tidak ada entri yang perlu diproses di rentang ini.'); return; }

    if (kind === 'all') {
      const ok = await confirmBox('Simpan ' + list.length + ' entri ke KIB-E ' + (pageInfo && pageInfo.sekolah ? pageInfo.sekolah : '') + '? Data akan langsung masuk ke asetdisdik.id.', 'Simpan semua');
      if (!ok) return;
    }

    showTab('run');
    setRunning(true);
    paused = false;
    stopRequested = false;
    const tabId = tab.id;
    let okCount = 0;
    let errCount = 0;
    log('info', (kind === 'fill' ? 'Isi form' : 'Mulai') + ': ' + list.length + ' entri (mulai entri ' + (list[0].i + 1) + ').');

    for (let n = 0; n < list.length; n++) {
      const { e, i } = list[n];
      while (paused && !stopRequested) await sleep(200);
      if (stopRequested) break;
      updateProgress(n, list.length, 'Entri ' + (i + 1) + ' (' + (n + 1) + '/' + list.length + ')…');
      setStatus(e.key, 'running');
      const r = resolveEntry(e, i);
      const label = '#' + (i + 1) + ' ' + (r.values.judul_buku_perpustakaan || '').slice(0, 50);
      if (r.errors.length) {
        setStatus(e.key, 'error', r.errors.join('; '));
        log('error', label + ': ' + r.errors.join('; '));
        errCount++;
        if (s.onError === 'stop') break;
        continue;
      }
      if (r.regAuto && regContinue()) {
        const lr = await callPage(tabId, 'lastRegister', { entry: { values: r.values, exact: r.exact } });
        if (!lr.ok) {
          setStatus(e.key, 'error', 'Gagal membaca nomor register terakhir: ' + lr.error);
          log('error', label + ': gagal membaca nomor register terakhir: ' + lr.error);
          errCount++;
          if (s.onError === 'stop') break;
          continue;
        }
        r.values.nomor_register = continuedRegister(r, lr.r.max);
        state.regPreview = state.regPreview || {};
        state.regPreview[e.key] = r.values.nomor_register;
        setRegisterCell(e.key, r.values.nomor_register);
      }
      let res;
      try {
        res = await callPage(tabId, 'fill', { values: r.values, exact: r.exact, kode: r.kode, kondisi: r.kondisi, jumlah: r.jumlah });
      } catch (err) {
        res = { ok: false, error: String(err.message || err) };
      }
      if (!res.ok) {
        setStatus(e.key, 'error', res.error);
        log('error', label + ': ' + res.error);
        errCount++;
        if (s.onError === 'stop') break;
        continue;
      }
      if (kind === 'fill') {
        setStatus(e.key, 'filled', res.r.summary);
        log('info', label + ': form terisi. Periksa di halaman, lalu klik Save sendiri atau pakai tombol "Simpan 1 entri".');
        break;
      }
      let sv;
      try {
        const check = { values: r.values, exact: r.exact, kode: { id: r.kode.id }, jumlah: r.jumlah };
        sv = await callPage(tabId, 'save', { timeout: s.timeout, entry: check }, s.timeout + 25000);
      } catch (err) {
        sv = { ok: false, error: String(err.message || err) };
      }
      if (!sv.ok) {
        setStatus(e.key, 'unknown', sv.error);
        log('error', label + ': ' + sv.error + ' Proses dihentikan supaya tidak ada data ganda.');
        errCount++;
        break;
      }
      const out = sv.r;
      if (out.ok) {
        setStatus(e.key, 'ok', out.msg);
        log('ok', label + ': ' + (out.msg || 'Tersimpan') + (out.via && out.via !== 'pesan situs' ? ' [dari ' + out.via + ']' : ''));
        if (out.raw) log('warn', 'Balasan server tidak terbaca oleh situs: ' + out.raw);
        okCount++;
      } else if (out.timeout) {
        setStatus(e.key, 'unknown', out.msg);
        log('error', label + ': ' + out.msg);
        errCount++;
        break; // jangan lanjut: bisa jadi tersimpan, cek dulu
      } else {
        setStatus(e.key, 'error', (out.title ? out.title + ': ' : '') + out.msg);
        log('error', label + ': ' + (out.title ? out.title + ': ' : '') + out.msg);
        errCount++;
        if (s.onError === 'stop') break;
      }
      if (n < list.length - 1 && s.rowDelay) await sleep(s.rowDelay);
    }

    // Situs membiarkan dialog "Tambah Barang" terbuka setelah Save. Tutup kalau semua
    // berhasil; kalau ada gagal, biarkan terbuka supaya isiannya bisa diperiksa.
    if (kind !== 'fill' && okCount > 0 && errCount === 0) {
      await callPage(tabId, 'closeDialog', null, 5000);
    }
    setRunning(false);
    const done = buildEntries().filter((x) => isDone(x.key)).length;
    const total = buildEntries().length;
    if (kind === 'fill') {
      updateProgress(done, total, errCount ? 'Gagal mengisi form. Lihat log.' : 'Form terisi di halaman, belum disimpan. Total tersimpan ' + done + '/' + total + '.');
    } else {
      updateProgress(done, total, (stopRequested ? 'Dihentikan. ' : 'Selesai. ') + okCount + ' tersimpan, ' + errCount + ' gagal. Total tersimpan ' + done + '/' + total + '.');
      log(errCount ? 'warn' : 'ok', 'Selesai: ' + okCount + ' tersimpan, ' + errCount + ' gagal.');
    }
  }

  $('btnStart').addEventListener('click', () => run('all'));
  $('btnTest').addEventListener('click', () => run('one'));
  $('btnFillOnly').addEventListener('click', () => run('fill'));

  $('btnResetStatus').addEventListener('click', async () => {
    if (!(await confirmBox('Reset status semua entri? Entri yang sudah tersimpan akan dianggap belum, sehingga bisa terinput dua kali kalau dijalankan lagi.', 'Reset'))) return;
    state.status = {};
    persist();
    renderEntries();
  });

  $('btnExportResult').addEventListener('click', () => {
    const entries = buildEntries();
    if (!entries.length) return;
    const headers = ['No Entri', 'Baris Data', 'Judul', 'Ruang', 'Jumlah', 'Nomor Register', 'Harga Satuan', 'Status', 'Pesan', 'Waktu'];
    const rows = entries.map((e, i) => {
      const r = resolveEntry(e, i);
      const st = state.status[e.key] || {};
      return {
        'No Entri': i + 1,
        'Baris Data': e.rowIndex + 1,
        'Judul': r.values.judul_buku_perpustakaan || '',
        'Ruang': roomText(r.values.kode_ruang),
        'Jumlah': r.jumlah,
        'Nomor Register': r.values.nomor_register || '',
        'Harga Satuan': r.values.harga_satuan || '',
        'Status': st.state ? STATUS_LABEL[st.state] || st.state : 'Belum',
        'Pesan': st.msg || '',
        'Waktu': st.at ? new Date(st.at).toLocaleString('id-ID') : ''
      };
    });
    download('hasil-bmdinput.csv', D.toCSV(headers, rows), 'text/csv');
  });

  $('btnClearLog').addEventListener('click', () => { state.log = []; renderLog(); persist(); });

  // Akses diagnosa dari DevTools panel (tidak dipakai oleh UI)
  window.__bmdPanel = { buildEntries, resolveEntry, getState: () => state };

  // ------------------------------------------------------------ mulai
  (async function init() {
    await load();
    applySettings();
    renderData();
    renderMapping();
    renderLog();
    showTab(state.tab || 'data');
    await checkConnection(true);
    setInterval(() => { if (!running) checkConnection(true); }, 6000);
    chrome.tabs.onUpdated.addListener((id, info) => {
      if (info.status === 'complete' && !running) checkConnection(true);
    });
    chrome.tabs.onActivated.addListener(() => { if (!running) checkConnection(true); });
  })();
})();
