# bmdinput

Extension untuk Microsoft Edge dan Google Chrome yang mengisi data **KIB-E (Aset Tetap Lainnya)** di <https://asetdisdik.id/kib-e> secara massal. Sumber datanya bisa invoice PDF SIPLah, file Excel/CSV, atau tempelan dari Excel.

Extension ini memakai form "Tambah Barang" milik situs: mengisi field, memilih kode barang, menekan **Save**, lalu membaca pesan Sukses/Error dari server. Karena itu validasi situs tetap berlaku.

## Pasang

1. Buka `edge://extensions` (Edge) atau `chrome://extensions` (Chrome).
2. Aktifkan **Developer mode**.
3. Klik **Load unpacked**, lalu pilih folder ini (`bmd-extension`).
4. Sematkan ikonnya di toolbar. Klik ikon untuk membuka panel samping.

## Cara pakai

1. Login ke asetdisdik.id dan buka halaman **Kartu Inventaris Barang KIB-E**. Indikator di kanan atas panel akan berubah hijau dan menampilkan nama sekolah.
2. **Tab Data**: impor invoice PDF SIPLah, Excel, atau CSV.
   - Dari PDF SIPLah, judul dibersihkan dari "Kelas VI SD/MI", kelasnya masuk ke kolom **Kelas**, dan total dicocokkan dengan grand total invoice.
   - Sel di pratinjau bisa diklik untuk diperbaiki, misalnya kelas yang belum terbaca.
   - **Unduh data (Excel)** mengubah PDF yang sudah diimpor menjadi file Excel berformat template. Edit di Excel, lalu impor lagi.
3. **Tab Pemetaan**:
   - Cari dan pilih **Kode Barang** (misalnya `buku pendidikan` → 1.3.5.01.01.04.008 Buku Pendidikan).
   - Periksa sumber setiap field. Default-nya: Triwulan = triwulan berjalan, Nomor Register = 0001, Tahun Pembelian = tahun ini, Kondisi = Baik, Asal = BOS.
   - Ruangan dari angka/romawi kelas ("6", "VI") otomatis dicocokkan ke opsi "Ruangan kelas 6".
   - Nomor Register mengikuti jumlah: nomor awal 0001 dengan jumlah 15 menjadi `0001-0015`, jumlah 1 tetap `0001`. Nilai yang sudah ditulis sebagai rentang dipakai apa adanya.
   - Kalau judul dan ruangan yang sama sudah ada di situs, nomor register melanjutkan nomor terakhirnya. Contoh: TW2 tercatat `0001-0002`, pembelian lagi di TW4 sebanyak 2 menjadi `0003-0004`. Nomor terakhir dibaca ulang dari situs tepat sebelum setiap entri disimpan. Fitur ini bisa dimatikan di tab Jalankan.
   - Centang **Pecah jumlah jadi entri terpisah** kalau tiap eksemplar perlu dicatat satu per satu.
4. **Tab Jalankan**:
   - **Isi form saja** mengisi form untuk entri pertama tanpa menyimpan. Pakai ini untuk mengecek hasilnya di halaman.
   - **Simpan 1 entri** menyimpan satu entri sebagai uji coba. Cek tabel KIB-E setelahnya.
   - **Mulai** menyimpan semua entri dalam rentang. Ada tombol Jeda dan Stop.
   - Sebelum menyimpan, extension membaca data KIB-E yang sudah ada di situs. Entri yang judul, ruangan, jumlah, harga, kode barang, triwulan, dan tahun pembeliannya sama ditandai *Sudah ada* dan dilewati. Buku yang sama tapi dibeli di triwulan lain dianggap pembelian baru. Tombol **Cek di situs** menjalankan pengecekan ini tanpa menyimpan.
   - Entri yang disimpan lewat extension diberi status *Tersimpan* dan juga dilewati kalau proses diulang.
   - **Unduh hasil** menyimpan laporan CSV berisi status dan pesan server per entri.

## Template Excel

Klik **Unduh template Excel** di tab Data saat halaman KIB-E terbuka. Daftar ruangan dan kode barang di template otomatis diambil dari akun sekolah yang sedang login.

- **Data**: isi mulai baris 2, satu baris untuk satu jenis barang. Lembar ini yang dibaca saat impor.
- **Petunjuk**: penjelasan setiap kolom. Keterangan yang sama muncul saat sel di lembar Data dipilih.
- **Contoh**: contoh pengisian.
- **Pilihan** dan **Kode Barang**: sumber dropdown untuk Kondisi, Ruangan, Asal Cara Perolehan, Triwulan, Tahun, dan Kode Barang. Daftarnya diambil dari situs.

Hanya **Judul Buku**, **Jumlah**, dan **Harga Satuan** yang wajib diisi. Kolom lain yang dibiarkan kosong memakai nilai default di tab Pemetaan. Judul kolom di baris 1 jangan diubah, karena extension memetakan kolom berdasarkan judulnya.

## Catatan

- Proses selalu berhenti kalau server tidak membalas dalam batas waktu. Status entrinya menjadi *Cek manual*. Lihat tabel di situs dulu sebelum mengulang, karena data mungkin sudah tersimpan.
- Field **Data Pendukung** (upload file) tidak diisi.
- Panel samping harus tetap terbuka selama proses berjalan.
- Data dan pengaturan disimpan lokal di browser (`chrome.storage.local`) dan tidak dikirim ke mana pun selain asetdisdik.id.

## Struktur

| File | Isi |
| --- | --- |
| `manifest.json` | Manifest V3; izin hanya untuk `https://asetdisdik.id/*` |
| `background.js` | Membuka panel samping saat ikon diklik |
| `panel/` | UI panel: impor data, pemetaan, dan proses input |
| `content/kibe-page.js` | Disuntikkan ke halaman KIB-E; memanggil `newKIB()`, `selectTextKode()`, `saveKIB()` |
| `lib/` | SheetJS 0.18.5 (Excel) dan pdf.js 4.10.38 (PDF), disertakan lokal |
| `store/` | Bahan listing Edge Add-ons / Chrome Web Store dan logo 300×300 |
| `pack.ps1` | Membuat ZIP untuk diunggah ke store (`dist/bmdinput-<versi>.zip`) |
