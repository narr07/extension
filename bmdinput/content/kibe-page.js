// Disuntikkan ke halaman https://asetdisdik.id/kib-e (MAIN world) oleh panel.
// Memakai fungsi bawaan halaman: newKIB(), selectTextKode(), saveKIB(),
// jQuery EasyUI ($('#fm').form(...), $.messager.show).
(function () {
  if (window.__bmdKibe && window.__bmdKibe.version === 7) return;

  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const lower = (s) => norm(s).toLowerCase();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = () => window.jQuery;

  const FORM_ID = 'fm';
  const form = () => document.getElementById(FORM_ID);
  const field = (name) => {
    const f = form();
    return f ? f.querySelector('[name="' + name + '"]') : null;
  };

  const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
  function toNumber(v) {
    const s = norm(v).toUpperCase();
    if (/^\d+$/.test(s)) return Number(s);
    if (ROMAN[s]) return ROMAN[s];
    const m = s.match(/KELAS\s*([IVX]+|\d+)\b/);
    if (m) return /^\d+$/.test(m[1]) ? Number(m[1]) : (ROMAN[m[1]] || null);
    return null;
  }

  function options(name) {
    const el = field(name);
    if (!el || el.tagName !== 'SELECT') return [];
    return Array.from(el.options).map((o) => ({ value: o.value, text: norm(o.text) }));
  }

  // Cari opsi <select> dari nilai data. Untuk Ruangan, angka/romawi ("6", "VI",
  // "Kelas VI") dicocokkan ke opsi bertuliskan "... kelas 6".
  function findOption(name, value, exact) {
    const el = field(name);
    if (!el) return null;
    const opts = Array.from(el.options).filter((o) => o.value !== '');
    const v = lower(value);
    if (!v) return null;
    if (exact) return opts.find((x) => x.value === String(value)) || null;
    let o = opts.find((x) => lower(x.text) === v) || opts.find((x) => lower(x.value) === v && name !== 'kode_ruang');
    if (o) return o;
    if (name === 'kode_ruang') {
      const n = toNumber(value);
      if (n != null) {
        const re = new RegExp('kelas\\s*' + n + '(?!\\d)', 'i');
        o = opts.find((x) => re.test(x.text));
        if (o) return o;
      }
      o = opts.find((x) => x.value === norm(value));
      if (o) return o;
    }
    return opts.find((x) => lower(x.text).includes(v)) || null;
  }

  function labelOf(el) {
    const item = el.closest('.fitem');
    const l = item && item.querySelector('label');
    return l ? norm(l.innerText).replace(/\*+\)?/g, '').trim() : el.name;
  }

  // ---------------------------------------------------- hasil $.messager
  let msgSeq = 0;
  let lastMsg = null;
  // Pembungkus $.messager.show dipasang sekali per halaman, tapi selalu meneruskan pesan ke
  // penangan versi skrip yang TERBARU (window.__bmdOnMessager). Tanpa ini, setelah extension
  // di-reload pesan Sukses masuk ke penangan versi lama dan panel menunggu sampai batas waktu.
  function onMessager(opts) {
    msgSeq++;
    lastMsg = { seq: msgSeq, title: norm(opts && opts.title), msg: norm(String((opts && opts.msg) || '').replace(/<[^>]+>/g, ' ')), at: Date.now() };
  }
  function hookMessager() {
    const jq = $();
    if (!jq || !jq.messager) return;
    window.__bmdOnMessager = onMessager;
    if (jq.messager.__bmdDispatch) return;
    const orig = jq.messager.show;
    jq.messager.show = function () {
      try { if (typeof window.__bmdOnMessager === 'function') window.__bmdOnMessager(arguments[0]); } catch (e) { /* abaikan */ }
      return orig.apply(this, arguments);
    };
    jq.messager.__bmdDispatch = true;
    jq.messager.__bmdHooked = true;
  }

  // ---------------------------------------------------- API
  function info() {
    const jq = $();
    const ok = !!(form() && jq && jq.fn && jq.fn.form && typeof window.newKIB === 'function' && typeof window.saveKIB === 'function');
    const dlg = document.getElementById('dlg');
    let dialogOpen = false;
    try { dialogOpen = !!(dlg && jq && !jq('#dlg').dialog('options').closed); } catch (e) { /* belum diinisialisasi */ }
    const tahunInv = (() => {
      const f = form();
      const item = f && f.querySelector('.fitem');
      return item ? norm(item.innerText).replace(/^Tahun Inventarisasi\s*/i, '') : '';
    })();
    const header = norm((document.body.innerText || '').slice(0, 400));
    const sekolah = (header.match(/Aset Pendidikan\s+(.+?)\s*\|/) || [])[1] || '';
    return {
      ok,
      url: location.href,
      sekolah,
      tahunInventarisasi: tahunInv,
      dialogOpen,
      options: {
        triwulan: options('triwulan'),
        kode_ruang: options('kode_ruang'),
        tahun_cetak_pembelian: options('tahun_cetak_pembelian'),
        asal_cara_perolehan: options('asal_cara_perolehan')
      }
    };
  }

  async function kodeList(args) {
    const q = (args && args.q) || '';
    const body = new URLSearchParams({ page: '1', rows: '1000' });
    if (q) body.set('nama_barang', q);
    const r = await fetch('mod/kib/e/get_e_kode.php', { method: 'POST', body, credentials: 'include' });
    if (!r.ok) throw new Error('Gagal memuat kode barang (HTTP ' + r.status + ')');
    const j = await r.json();
    return (j.rows || []).map((x) => ({
      id: x.id_kodebarang,
      golongan: x.golongan,
      bidang: x.bidang,
      kelompok: x.kelompok,
      sub_kelompok: x.sub_kelompok,
      subsub_kelompok: x.subsub_kelompok,
      uraian: x.uraian
    }));
  }

  function setText(name, value) {
    const el = field(name);
    if (!el) throw new Error('Field "' + name + '" tidak ada di form');
    $()(el).val(value == null ? '' : String(value)).trigger('input').trigger('change');
    return el;
  }

  // Isi form #fm untuk satu entri. Tidak menyimpan.
  function fill(entry) {
    const jq = $();
    const st = info();
    if (!st.ok) throw new Error('Halaman ini bukan halaman KIB-E (form Tambah Barang tidak ditemukan). Buka https://asetdisdik.id/kib-e lalu login.');
    hookMessager();

    // Buka dialog Tambah Barang (sekaligus menyetel default halaman), lalu kosongkan
    // supaya sisa isian entri sebelumnya tidak ikut tersimpan.
    window.newKIB();
    jq('#fm').form('clear');

    const notes = [];
    const v = entry.values || {};

    // Kode barang (sama seperti memilih lewat popup "Cari Barang")
    const k = entry.kode;
    if (!k || !k.id) throw new Error('Kode barang belum dipilih');
    if (typeof window.selectTextKode !== 'function') throw new Error('Fungsi selectTextKode tidak ada di halaman');
    window.selectTextKode(k.id, k.golongan, k.bidang, k.kelompok, k.sub_kelompok, k.subsub_kelompok, k.uraian);

    // Pilihan (select)
    for (const name of ['triwulan', 'kode_ruang', 'tahun_cetak_pembelian', 'asal_cara_perolehan']) {
      if (!(name in v)) continue;
      const raw = v[name];
      if (raw === '' || raw == null) continue;
      const opt = findOption(name, raw, (entry.exact || []).includes(name));
      if (!opt) throw new Error(labelOf(field(name)) + ': pilihan "' + raw + '" tidak ada');
      jq(field(name)).val(opt.value).trigger('change'); // asal_cara_perolehan memicu setJenis()
      notes.push(labelOf(field(name)) + '=' + norm(opt.text));
    }
    if (!('jenis_perolehan' in v)) {
      // setJenis dipanggil oleh onchange asal_cara_perolehan; pastikan terisi
      const asal = field('asal_cara_perolehan');
      if (asal && asal.value && typeof window.setJenis === 'function') {
        window.setJenis(document.getElementsByName('jenis_perolehan')[0], asal);
      }
    }

    // Teks biasa
    const TEXT = ['nomor_register', 'judul_buku_perpustakaan', 'judul_buku_spesifikasi', 'barang_kesenian_asaldaerah',
      'barang_kesenian_pencipta', 'barang_kesenian_bahan', 'htt_jenis', 'htt_ukuran', 'satuan', 'jenis_perolehan'];
    for (const name of TEXT) {
      if (name in v && v[name] !== '' && v[name] != null) setText(name, v[name]);
    }

    // Kondisi + jumlah + harga. Halaman menghitung jumlah_barang & harga lewat keyup.
    const kondisi = ['b', 'kb', 'rb'].includes(entry.kondisi) ? entry.kondisi : 'b';
    const jumlah = String(entry.jumlah || '1').replace(/[^\d]/g, '') || '1';
    ['b', 'kb', 'rb'].forEach((n) => { const el = field(n); if (el) el.value = ''; });
    const kEl = setText(kondisi, jumlah);
    jq(kEl).trigger('keyup');
    const harga = String(v.harga_satuan == null ? '' : v.harga_satuan).replace(/[^\d]/g, '');
    const hEl = setText('harga_satuan', harga);
    jq(hEl).trigger('keyup');
    // jaga-jaga kalau handler keyup halaman berubah
    const total = Number(jumlah) * Number(harga || 0);
    if (field('jumlah_barang') && !field('jumlah_barang').value) field('jumlah_barang').value = jumlah;
    if (field('harga') && String(field('harga').value) !== String(total)) field('harga').value = String(total);

    // Validasi bawaan EasyUI
    const valid = jq('#fm').form('validate');
    if (!valid) {
      const bad = Array.from(form().querySelectorAll('.validatebox-invalid')).map(labelOf);
      throw new Error('Form belum lengkap: ' + Array.from(new Set(bad)).join(', '));
    }
    return {
      ok: true,
      summary: norm(field('judul_buku_perpustakaan').value).slice(0, 70) + ' | ' + notes.join(', ') + ' | ' + kondisi + '=' + jumlah + ' | Rp ' + total
    };
  }

  // Ambil objek JSON dari balasan server, walau diselipi teks lain (mis. peringatan PHP).
  function parseReply(text) {
    const s = String(text == null ? '' : text);
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { /* bukan JSON murni */ }
    try { return (0, eval)('(' + s.slice(a, b + 1) + ')'); } catch (e) { return null; }
  }
  const snippet = (t) => norm(String(t || '').replace(/<[^>]+>/g, ' ')).slice(0, 160);

  async function countMatching(entry) {
    const r = await dupCheck({ entries: [entry] });
    return r.existing[r.sigs[0]] || 0;
  }

  // Tekan Save lalu pastikan hasilnya dari tiga sumber, berurutan:
  // 1) pesan $.messager dari situs, 2) balasan mentah save_kib.php,
  // 3) hitung ulang data di situs (bertambah = tersimpan).
  async function save(args) {
    const timeout = (args && args.timeout) || 20000;
    const entry = args && args.entry;
    hookMessager();
    const before = msgSeq;
    if (!$()('#fm').form('validate')) throw new Error('Form tidak valid, tidak disimpan');
    let countBefore = null;
    if (entry) { try { countBefore = await countMatching(entry); } catch (e) { countBefore = null; } }

    // Tangkap balasan save_kib.php. EasyUI di situs ini mengirim form lewat iframe
    // tersembunyi (id "easyui_frame_..."); versi lain memakai XMLHttpRequest. Awasi keduanya.
    const cap = { done: false, status: 0, text: '' };
    const watchFrame = (fr) => {
      fr.addEventListener('load', () => {
        try {
          const href = String(fr.contentWindow.location.href);
          if (!/save_kib/i.test(href)) return; // muatan awal about:blank
          const d = fr.contentDocument;
          const pre = d.querySelector('body > pre');
          cap.text = pre ? pre.textContent : (d.body ? d.body.innerText || d.body.textContent : '');
        } catch (e) { cap.text = ''; }
        cap.done = true;
      });
    };
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) => m.addedNodes.forEach((n) => {
        if (n.tagName === 'IFRAME' && /^easyui_frame_/.test(n.id || '')) watchFrame(n);
      }));
    });
    mo.observe(document.body, { childList: true });
    const P = XMLHttpRequest.prototype;
    const origOpen = P.open;
    const origSend = P.send;
    P.open = function (method, url) {
      this.__bmdSave = /save_kib/i.test(String(url));
      return origOpen.apply(this, arguments);
    };
    P.send = function () {
      if (this.__bmdSave) {
        this.addEventListener('loadend', () => { cap.done = true; cap.status = this.status; cap.text = this.responseText; });
      }
      return origSend.apply(this, arguments);
    };

    let msg = null;
    try {
      window.saveKIB();
      const end = Date.now() + timeout;
      let replyAt = 0;
      while (Date.now() < end) {
        if (msgSeq > before && lastMsg) { msg = lastMsg; break; }
        if (cap.done && !replyAt) replyAt = Date.now();
        if (replyAt && Date.now() - replyAt > 1500) break; // balasan sudah datang, pesan situs tidak muncul
        await sleep(150);
      }
    } finally {
      mo.disconnect();
      P.open = origOpen;
      P.send = origSend;
    }

    if (msg) {
      const success = /sukses|success|berhasil/i.test(msg.title) || (/berhasil|sukses/i.test(msg.msg) && !/error|gagal/i.test(msg.title));
      return { ok: success, title: msg.title, msg: msg.msg, via: 'pesan situs' };
    }

    const reply = cap.done ? parseReply(cap.text) : null;
    if (reply && typeof reply.success !== 'undefined') {
      const success = !!reply.success && reply.success !== 'false' && reply.success !== '0';
      // situs tidak sempat memperbarui tabelnya karena gagal membaca balasan; perbarui di sini
      if (success) { try { $()('#tt').datagrid('reload'); $()('#fm').form('clear'); } catch (e) { /* abaikan */ } }
      return { ok: success, title: success ? 'Sukses' : 'Error', msg: norm(reply.msg || '') || (success ? 'Tersimpan' : 'Gagal'), via: 'balasan server' };
    }

    // Pastikan langsung dari data situs
    if (countBefore != null) {
      for (let i = 0; i < 3; i++) {
        await sleep(700);
        let after = null;
        try { after = await countMatching(entry); } catch (e) { after = null; }
        if (after != null && after > countBefore) {
          try { $()('#tt').datagrid('reload'); $()('#fm').form('clear'); } catch (e) { /* abaikan */ }
          return { ok: true, title: 'Sukses', msg: 'Tersimpan (dipastikan dari data di situs)', via: 'cek data', raw: cap.done ? snippet(cap.text) : '' };
        }
        if (!cap.done) break; // belum ada balasan sama sekali: jangan menunggu lebih lama
      }
      if (cap.done) {
        return { ok: false, title: 'Error', msg: 'Server membalas tapi data tidak bertambah. Balasan: ' + (snippet(cap.text) || '(kosong, HTTP ' + cap.status + ')'), via: 'cek data' };
      }
    }
    return { ok: false, timeout: true, msg: 'Tidak ada balasan dari server dalam ' + Math.round(timeout / 1000) + ' detik. Cek tabel di halaman sebelum mengulang baris ini.' };
  }

  // Bandingkan entri dengan data KIB-E yang sudah ada di situs.
  // Tanda tangan: judul | ruangan | harga satuan | jumlah | kode barang | triwulan | tahun pembelian.
  // Triwulan & tahun ikut dibandingkan: buku yang sama dibeli lagi di triwulan lain = pembelian baru.
  // Situs menyimpan judul dengan entitas HTML ("PAI &amp; Budi Pekerti"); samakan dulu.
  const decodeHtml = (s) => String(s == null ? '' : s).replace(/&(amp|lt|gt|quot|#39|#039|apos);/g, (m, k) =>
    ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#039': "'", apos: "'" })[k]);
  const sigOf = (judul, ruang, harga, jumlah, kodeId, triwulan, tahun) => [lower(decodeHtml(judul)), String(ruang || ''), String(harga || '').replace(/\D/g, ''),
    String(jumlah || '').replace(/\D/g, ''), String(kodeId || ''), String(triwulan || ''), String(tahun || '')].join('|');

  // Kunci nomor register: judul + ruangan. Nomor register melanjutkan nomor terakhir
  // barang dengan judul & ruangan yang sama (beli lagi di triwulan lain -> 0003-0004).
  const regKeyOf = (judul, ruang) => lower(decodeHtml(judul)) + '|' + String(ruang || '');
  // "0001-0002" -> 2, "001-005" -> 5, "0001" -> 1, kosong -> 0
  const regEnd = (s) => {
    const nums = String(s || '').match(/\d+/g);
    return nums ? Math.max.apply(null, nums.map(Number)) : 0;
  };

  async function fetchRows() {
    const body = new URLSearchParams({ page: '1', rows: '100000' });
    const r = await fetch('mod/kib/e/get_e.php', { method: 'POST', body, credentials: 'include' });
    if (!r.ok) throw new Error('Gagal membaca data KIB-E (HTTP ' + r.status + ')');
    const j = await r.json();
    return { rows: j.rows || [], total: Number(j.total) || (j.rows || []).length };
  }

  // nilai <select> seperti yang akan tersimpan (sama dengan cara fill() memilih opsi)
  function optValOf(e, name) {
    const v = (e && e.values) || {};
    if (!v[name]) return '';
    const o = findOption(name, v[name], (e.exact || []).includes(name));
    return o ? o.value : '?' + v[name];
  }

  function regMaxOf(rows) {
    const max = {};
    rows.forEach((x) => {
      const k = regKeyOf(x.judul_buku_perpustakaan, x.kode_ruang);
      max[k] = Math.max(max[k] || 0, regEnd(x.nomor_register));
    });
    return max;
  }

  async function dupCheck(args) {
    const { rows, total } = await fetchRows();
    const existing = {};
    rows.forEach((x) => {
      const s = sigOf(x.judul_buku_perpustakaan, x.kode_ruang, x.harga_satuan, x.jumlah_barang, x.id_kodebarang, x.triwulan, x.tahun_cetak_pembelian);
      existing[s] = (existing[s] || 0) + 1;
    });
    const entries = (args && args.entries) || [];
    const sigs = entries.map((e) => {
      if (!e) return null;
      const v = e.values || {};
      return sigOf(v.judul_buku_perpustakaan, optValOf(e, 'kode_ruang'), v.harga_satuan, e.jumlah, e.kode && e.kode.id,
        optValOf(e, 'triwulan'), optValOf(e, 'tahun_cetak_pembelian'));
    });
    const regKeys = entries.map((e) => (e ? regKeyOf(e.values.judul_buku_perpustakaan, optValOf(e, 'kode_ruang')) : null));
    return { sigs, existing, regKeys, regMax: regMaxOf(rows), total, loaded: rows.length };
  }

  // Nomor register terakhir di situs untuk judul & ruangan entri ini (0 kalau belum ada).
  async function lastRegister(args) {
    const e = args && args.entry;
    const { rows } = await fetchRows();
    const key = regKeyOf(e.values.judul_buku_perpustakaan, optValOf(e, 'kode_ruang'));
    return { max: regMaxOf(rows)[key] || 0, key };
  }

  function closeDialog() {
    try { $()('#dlg').dialog('close'); } catch (e) { /* abaikan */ }
    return { ok: true };
  }

  function reloadGrid() {
    try { $()('#tt').datagrid('reload'); } catch (e) { /* abaikan */ }
    return { ok: true };
  }

  window.__bmdKibe = { version: 7, info, kodeList, fill, save, dupCheck, lastRegister, closeDialog, reloadGrid };
})();
