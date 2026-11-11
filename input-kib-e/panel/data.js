// Pembacaan data (PDF invoice SIPLah, Excel, CSV, tempelan) dan utilitas nilai.
/* global XLSX */
(function () {
  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  // ------------------------------------------------------------ CSV/TSV
  function detectDelimiter(text) {
    const first = text.split(/\r?\n/).slice(0, 5).join('\n');
    const counts = { '\t': 0, ';': 0, ',': 0, '|': 0 };
    let inQ = false;
    for (const ch of first) {
      if (ch === '"') inQ = !inQ;
      else if (!inQ && ch in counts) counts[ch]++;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : ',';
  }

  function parseDelimited(text, delim) {
    text = text.replace(/^﻿/, '');
    delim = delim || detectDelimiter(text);
    const rows = [];
    let row = [];
    let cell = '';
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
        } else cell += ch;
      } else if (ch === '"' && cell === '') {
        inQ = true;
      } else if (ch === delim) {
        row.push(cell); cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function toTable(matrix) {
    const clean = matrix.filter((r) => r.some((c) => norm(c) !== ''));
    if (!clean.length) return { headers: [], rows: [] };
    const seen = {};
    const headers = clean[0].map((h, i) => {
      let name = norm(h) || 'Kolom ' + (i + 1);
      if (seen[name]) { seen[name]++; name = name + ' (' + seen[name] + ')'; } else seen[name] = 1;
      return name;
    });
    const rows = clean.slice(1).map((r) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i] == null ? '' : String(r[i]).trim(); });
      return o;
    });
    return { headers, rows };
  }

  // ------------------------------------------------------------ Excel
  function readWorkbook(buf) {
    return XLSX.read(buf, { type: 'array', cellDates: false });
  }
  function sheetToTable(wb, name) {
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false });
    return toTable(matrix);
  }

  // ------------------------------------------------------------ angka
  // "Rp. 49,500" / "Rp 49.500" / "49500,00" -> "49500"
  function money(v) {
    let s = String(v == null ? '' : v).replace(/[^\d.,]/g, '');
    if (!s) return '';
    const seps = s.match(/[.,]/g) || [];
    if (/[.,]\d{1,2}$/.test(s) && (seps.length > 1 || !/[.,]\d{3}$/.test(s))) s = s.replace(/[.,]\d{1,2}$/, '');
    return s.replace(/[^\d]/g, '');
  }

  const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
  const KLS = '(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I|1[0-2]|[1-9])';
  const JENJANG_RE = /\s*\b(SD\/MI|SMP\/MTs|SMA\/MA|SMK\/MAK|SD|MI|SMP|MTs)\s*$/i;
  const toKelas = (k) => (/^\d+$/.test(k) ? String(Number(k)) : String(ROMAN[k.toUpperCase()] || ''));

  // Kelas dari nama barang: "... Kelas VI SD/MI" atau akhiran "... Matematika I".
  function kelasOf(name) {
    const s = String(name);
    let m = s.match(new RegExp('\\bKelas\\s+' + KLS + '\\b', 'i'));
    if (m) return toKelas(m[1]);
    m = s.replace(JENJANG_RE, '').match(new RegExp('\\s' + KLS + '$'));
    if (m) return toKelas(m[1]);
    // Buku TKA (Tes Kemampuan Akademik) jenjang SD/MI dipakai siswa kelas 6
    if (/\bTKA\b|tes kemampuan akademik/i.test(s) && /\bSD\b|SD\/MI|\bMI\b/i.test(s)) return '6';
    return '';
  }
  // "Tumaritis Pendamping Belajar Seni Rupa Kelas VI SD/MI" -> "Tumaritis Pendamping Belajar Seni Rupa"
  function judulTanpaKelas(name) {
    let s = String(name).replace(new RegExp('\\s*\\bKelas\\s+' + KLS + '\\b.*$', 'i'), '');
    s = s.replace(JENJANG_RE, '');
    s = s.replace(new RegExp('\\s' + KLS + '$'), '');
    return norm(s);
  }

  // ------------------------------------------------------------ PDF SIPLah
  async function pdfLines(buf) {
    const pdfjs = await import(chrome.runtime.getURL('lib/pdf.min.mjs'));
    pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
    const out = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const lines = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const y = it.transform[5];
        let line = lines.find((l) => Math.abs(l.y - y) < 3);
        if (!line) { line = { y, items: [] }; lines.push(line); }
        line.items.push({ x: it.transform[4], s: it.str });
      }
      lines.sort((a, b) => b.y - a.y);
      for (const l of lines) out.push(norm(l.items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ')));
    }
    return out;
  }

  // Baris barang di invoice SIPLah:
  //   "1 Buku Teks Pendamping Rp. 49,500 Rp. 0 15 15 Rp. 742,500"
  //   (lanjutan nama barang di baris berikutnya, lalu "15 X Rp. 49,500", "= Rp. 742,500")
  const ITEM_RE = /^(\d{1,4})\s+(.+?)\s+Rp\.?\s*([\d.,]+)(?:\s+Rp\.?\s*[\d.,]+)?\s+(\d+)(?:\s+(\d+))?\s+Rp\.?\s*([\d.,]+)$/i;
  const END_RE = /^(\d+\s*X\s*Rp|=\s*Rp|https?:\/\/|Halaman\b|No\s+Barang|sebelum PPN|Pesan\s+Terima|Sub\s*Total|Total\b|Ongkos|PPN\b|Biaya)/i;

  function parseSiplah(lines) {
    const items = [];
    let cur = null;
    let collecting = false;
    let meta = {};
    for (const line of lines) {
      if (!meta.nomor) { const m = line.match(/NO:\s*(\S+)/); if (m) meta.nomor = m[1]; }
      if (!meta.tanggal) { const m = line.match(/Tanggal Dokumen\s*:\s*([\d/.-]+)/i); if (m) meta.tanggal = m[1]; }
      if (!meta.penyedia) { const m = line.match(/Nama Penyedia:\s*(.+?)(\s+Nama Perwakilan|$)/i); if (m) meta.penyedia = norm(m[1]); }
      if (!meta.satdik) { const m = line.match(/Nama Satdik:\s*(.+)$/i); if (m) meta.satdik = norm(m[1]); }
      const m = line.match(ITEM_RE);
      if (m) {
        cur = { no: m[1], name: [m[2]], harga: money(m[3]), pesan: m[4], terima: m[5] || m[4], total: money(m[6]) };
        items.push(cur);
        collecting = true;
        continue;
      }
      if (!cur || !collecting) continue;
      if (END_RE.test(line)) { collecting = false; continue; }
      cur.name.push(line);
    }
    const headers = ['No', 'Nama Barang (Invoice)', 'Judul Buku', 'Kelas', 'Harga Satuan', 'Jumlah', 'Total'];
    const rows = items.map((it) => {
      const full = norm(it.name.join(' '));
      return {
        'No': it.no,
        'Nama Barang (Invoice)': full,
        'Judul Buku': judulTanpaKelas(full),
        'Kelas': kelasOf(full),
        'Harga Satuan': it.harga,
        'Jumlah': it.terima,
        'Total': it.total
      };
    });
    return { headers, rows, meta };
  }

  async function readPdf(buf) {
    const lines = await pdfLines(buf);
    const t = parseSiplah(lines);
    if (!t.rows.length) {
      const err = new Error('Daftar barang di PDF ini tidak dikenali. Saat ini yang didukung adalah invoice/proforma SIPLah. Untuk format lain, salin datanya ke Excel lalu impor.');
      err.lines = lines.slice(0, 60);
      throw err;
    }
    return t;
  }

  // ------------------------------------------------------------ ekspor
  function toCSV(headers, rows) {
    const esc = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + [headers.map(esc).join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\r\n');
  }

  // ------------------------------------------------------------ template Excel
  // Kolom template sengaja dinamai sama dengan tebakan pemetaan di panel,
  // supaya setelah diimpor langsung terpetakan otomatis.
  const TEMPLATE_COLUMNS = [
    { h: 'Judul Buku', w: 46, wajib: 'Ya', isi: 'Judul buku, atau merk/nama barang untuk aset selain buku. Tanpa "Kelas ..." karena kelas diisi di kolom Kelas / Ruangan.', contoh: 'Tumaritis Pendamping Belajar Matematika' },
    { h: 'Kelas / Ruangan', w: 18, list: 'ruang', wajib: 'Tidak', isi: 'Angka kelas (1–6), angka romawi (VI), atau nama ruangan persis seperti di daftar. Kosongkan kalau tidak ada.', contoh: '6' },
    { h: 'Jumlah', w: 9, wajib: 'Ya', isi: 'Banyaknya barang (angka).', contoh: '2' },
    { h: 'Harga Satuan', w: 14, fmt: '#,##0', wajib: 'Ya', isi: 'Harga per barang dalam rupiah. Boleh pakai titik/koma ribuan atau "Rp".', contoh: '49500' },
    { h: 'Kondisi', w: 12, list: 'kondisi', wajib: 'Tidak', isi: 'Baik, Hilang, atau Rusak Berat. Kosong = memakai pilihan di panel (default Baik).', contoh: 'Baik' },
    { h: 'Tahun Pembelian', w: 10, list: 'tahun', wajib: 'Tidak', isi: 'Tahun 4 digit. Kosong = memakai pilihan di panel (default tahun ini).', contoh: '' },
    { h: 'Asal Cara Perolehan', w: 22, list: 'asal', wajib: 'Tidak', isi: 'Sumber dana. Kosong = memakai pilihan di panel (default BOS).', contoh: 'BOS' },
    { h: 'Triwulan', w: 12, list: 'triwulan', wajib: 'Tidak', isi: 'Triwulan 1–4. Kosong = memakai pilihan di panel (default triwulan berjalan).', contoh: '' },
    { h: 'Nomor Register', w: 10, text: true, wajib: 'Tidak', isi: 'Nomor awal; otomatis jadi rentang sesuai Jumlah (0001 + jumlah 15 = 0001-0015, jumlah 1 = 0001). Boleh juga ditulis langsung, mis. 0016-0030. Kosong = 0001.', contoh: '0001' },
    { h: 'Kode Barang', w: 30, list: 'kode', wajib: 'Tidak', isi: 'Uraian atau kode lengkap dari lembar "Kode Barang". Kosong = memakai kode barang yang dipilih di panel.', contoh: 'Buku Pendidikan' },
    { h: 'Spesifikasi Buku', w: 24, wajib: 'Tidak', isi: 'Penerbit, pengarang, ISBN, dan sebagainya.', contoh: '' },
    { h: 'Satuan', w: 10, wajib: 'Tidak', isi: 'Misalnya Eksemplar, Buah, Ekor.', contoh: 'Eksemplar' },
    { h: 'Asal Barang Kesenian', w: 18, wajib: 'Tidak', isi: 'Khusus barang kesenian.', contoh: '' },
    { h: 'Pencipta Barang Kesenian', w: 18, wajib: 'Tidak', isi: 'Khusus barang kesenian.', contoh: '' },
    { h: 'Bahan Barang Kesenian', w: 18, wajib: 'Tidak', isi: 'Khusus barang kesenian.', contoh: '' },
    { h: 'Jenis Hewan/Tumbuhan', w: 18, wajib: 'Tidak', isi: 'Khusus hewan/ternak/tumbuhan.', contoh: '' },
    { h: 'Ukuran Hewan/Tumbuhan', w: 16, wajib: 'Tidak', isi: 'Khusus hewan/ternak/tumbuhan.', contoh: '' }
  ];
  const TEMPLATE_ROWS = 1000;

  const colName = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // opts: { ruang:[teks], asal:[teks], tahun:[teks], kode:[{uraian,kode,id}], sekolah }
  function buildTemplate(opts) {
    const now = new Date();
    const year = now.getFullYear();
    const lists = {
      kondisi: ['Baik', 'Hilang', 'Rusak Berat'],
      triwulan: ['Triwulan 1', 'Triwulan 2', 'Triwulan 3', 'Triwulan 4'],
      asal: opts.asal && opts.asal.length ? opts.asal : ['BOS', 'DAK', 'APBD PROVINSI', 'APBD KABUPATEN', 'BLOCKGRANT', 'KOMITE', 'HIBAH', 'MUTASI ANTAR SKPD'],
      tahun: opts.tahun && opts.tahun.length ? opts.tahun : Array.from({ length: year - 1989 }, (_, i) => String(year - i)),
      ruang: opts.ruang && opts.ruang.length ? opts.ruang : ['1', '2', '3', '4', '5', '6']
    };
    const kode = (opts.kode || []).filter((k) => k.uraian);

    const wb = XLSX.utils.book_new();
    wb.Props = { Title: 'Template Input KIB-E', Subject: 'Data aset KIB-E untuk extension Input KIB-E' };

    // --- Data (lembar pertama: yang dibaca saat impor). opts.rows = [{Judul Buku: ..}] opsional.
    const extra = opts.extra || [];
    const allCols = TEMPLATE_COLUMNS.concat(extra.map((h) => ({ h, w: 40 })));
    const ws = XLSX.utils.aoa_to_sheet([allCols.map((c) => c.h)]);
    const NUMERIC = { 'Jumlah': 1, 'Harga Satuan': 1 };
    (opts.rows || []).forEach((row, r) => {
      allCols.forEach((c, i) => {
        const v = row[c.h];
        if (v === undefined || v === null || v === '') return;
        const ref = colName(i) + (r + 2);
        if (NUMERIC[c.h] && /^\d+$/.test(String(v))) ws[ref] = { t: 'n', v: Number(v), z: c.fmt };
        else ws[ref] = { t: 's', v: String(v), z: c.text ? '@' : undefined };
      });
    });
    TEMPLATE_COLUMNS.forEach((c, i) => {
      if (!c.text) return;
      for (let r = 1; r <= TEMPLATE_ROWS; r++) {
        const ref = colName(i) + (r + 1);
        if (!ws[ref]) ws[ref] = { t: 's', v: '', z: '@' };
      }
    });
    ws['!ref'] = 'A1:' + colName(allCols.length - 1) + (TEMPLATE_ROWS + 1);
    ws['!cols'] = allCols.map((c) => ({ wch: c.w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // --- Petunjuk
    const pet = [
      ['Template Input KIB-E' + (opts.sekolah ? ' · ' + opts.sekolah : '')],
      ['1. Isi lembar "Data" mulai baris 2, satu baris untuk satu jenis barang. Jangan ubah judul kolom di baris 1.'],
      ['2. Kolom yang kosong memakai nilai default yang diatur di tab Pemetaan pada panel extension.'],
      ['3. Simpan file, lalu di panel extension buka tab Data, klik "Impor PDF / Excel / CSV", dan pilih file ini.'],
      ['4. Periksa tab Pemetaan, lalu di tab Jalankan coba "Isi form saja" atau "Simpan 1 entri" sebelum "Mulai".'],
      [''],
      ['Kolom', 'Wajib', 'Keterangan', 'Contoh']
    ];
    TEMPLATE_COLUMNS.forEach((c) => pet.push([c.h, c.wajib, c.isi, c.contoh]));
    const wsP = XLSX.utils.aoa_to_sheet(pet);
    wsP['!cols'] = [{ wch: 24 }, { wch: 7 }, { wch: 90 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, wsP, 'Petunjuk');

    // --- Contoh
    const contoh = [TEMPLATE_COLUMNS.map((c) => c.h),
      ['Tumaritis Pendamping Belajar Matematika', '6', 2, 49500, 'Baik', String(year), 'BOS', '', '0001', 'Buku Pendidikan', '', 'Eksemplar'],
      ['Harmoni Pendamping Belajar Bahasa Inggris', 'V', 2, 49500, 'Baik', String(year), 'BOS', '', '0001', '', '', 'Eksemplar'],
      ['Kamus Besar Bahasa Indonesia', lists.ruang.find((r) => /perpus/i.test(r)) || '', 1, 250000, '', '', '', '', '', '', 'Balai Pustaka, Ed. 5', 'Eksemplar']];
    const wsC = XLSX.utils.aoa_to_sheet(contoh);
    wsC['!cols'] = TEMPLATE_COLUMNS.map((c) => ({ wch: c.w }));
    XLSX.utils.book_append_sheet(wb, wsC, 'Contoh');

    // --- Pilihan (sumber dropdown)
    const keys = ['kondisi', 'asal', 'triwulan', 'ruang', 'tahun'];
    const heads = ['Kondisi', 'Asal Cara Perolehan', 'Triwulan', 'Kelas / Ruangan', 'Tahun Pembelian'];
    const maxLen = Math.max(...keys.map((k) => lists[k].length));
    const pil = [heads];
    for (let i = 0; i < maxLen; i++) pil.push(keys.map((k) => lists[k][i] || ''));
    const wsL = XLSX.utils.aoa_to_sheet(pil);
    wsL['!cols'] = heads.map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(wb, wsL, 'Pilihan');
    const listRef = {};
    keys.forEach((k, i) => { listRef[k] = 'Pilihan!$' + colName(i) + '$2:$' + colName(i) + '$' + (lists[k].length + 1); });

    // --- Kode Barang
    if (kode.length) {
      const wsK = XLSX.utils.aoa_to_sheet([['Uraian', 'Kode Lengkap', 'ID'], ...kode.map((k) => [k.uraian, k.kode, k.id])]);
      wsK['!cols'] = [{ wch: 50 }, { wch: 22 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, wsK, 'Kode Barang');
      listRef.kode = "'Kode Barang'!$A$2:$A$" + (kode.length + 1);
    }

    // --- Dropdown & petunjuk sel (data validation) disisipkan langsung ke XML lembar Data
    const dv = [];
    TEMPLATE_COLUMNS.forEach((c, i) => {
      const sq = colName(i) + '2:' + colName(i) + (TEMPLATE_ROWS + 1);
      const prompt = ' showInputMessage="1" promptTitle="' + xmlEsc(c.h.slice(0, 32)) + '" prompt="' + xmlEsc(c.isi.slice(0, 250)) + '"';
      if (c.list && listRef[c.list]) {
        // Ruangan & Kode boleh diketik bebas (angka kelas/kode lengkap), yang lain diberi peringatan
        const strict = c.list === 'ruang' || c.list === 'kode' ? ' showErrorMessage="0"' : ' showErrorMessage="1" errorStyle="warning" errorTitle="Nilai tidak ada di daftar" error="Pilih dari daftar, atau lanjutkan kalau yakin nilainya benar."';
        dv.push('<dataValidation type="list" allowBlank="1"' + prompt + strict + ' sqref="' + sq + '"><formula1>' + xmlEsc(listRef[c.list]) + '</formula1></dataValidation>');
      } else {
        dv.push('<dataValidation allowBlank="1"' + prompt + ' sqref="' + sq + '"/>');
      }
    });

    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true });
    const cfb = XLSX.CFB.read(new Uint8Array(out), { type: 'array' });
    const idx = cfb.FullPaths.findIndex((p) => /\/xl\/worksheets\/sheet1\.xml$/.test(p));
    if (idx < 0) return out;
    const entry = cfb.FileIndex[idx];
    let xml = new TextDecoder().decode(entry.content);
    const block = '<dataValidations count="' + dv.length + '">' + dv.join('') + '</dataValidations>';
    xml = /<\/mergeCells>/.test(xml) ? xml.replace('</mergeCells>', '</mergeCells>' + block) : xml.replace('</sheetData>', '</sheetData>' + block);
    // bekukan baris judul
    xml = xml.replace(/<sheetView([^>]*)\/>/, '<sheetView$1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>');
    const bytes = new TextEncoder().encode(xml);
    entry.content = bytes;
    entry.size = bytes.length;
    return XLSX.CFB.write(cfb, { fileType: 'zip', type: 'array', compression: true });
  }

  window.BmdData = { parseDelimited, toTable, readWorkbook, sheetToTable, readPdf, parseSiplah, money, kelasOf, judulTanpaKelas, toCSV, norm, buildTemplate, TEMPLATE_COLUMNS };
})();
