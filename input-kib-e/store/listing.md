# Bahan listing Microsoft Edge Add-ons

## Nama
Input Aset KIB-E

## Kategori
Productivity

## Deskripsi singkat (≤ 132 karakter)
Input data aset KIB-E di asetdisdik.id secara massal dari invoice PDF SIPLah atau file Excel.

## Deskripsi (bahasa Indonesia)
Input Aset KIB-E membantu operator sekolah mengisi Kartu Inventaris Barang E (Aset Tetap Lainnya, misalnya buku) di asetdisdik.id tanpa mengetik satu per satu.

Fitur:
- Impor invoice/proforma PDF SIPLah secara langsung. Judul, kelas, harga, dan jumlah terbaca otomatis.
- Impor dari Excel atau CSV, dengan template Excel berdropdown yang bisa diunduh.
- Ruangan dicocokkan otomatis dari kelas (VI → ruangan kelas 6).
- Nomor register mengikuti jumlah (0001-0015) dan melanjutkan nomor terakhir untuk judul dan ruangan yang sama.
- Mengecek data yang sudah ada di situs sebelum menyimpan, supaya tidak ada input ganda.
- Ada tombol uji (isi form saja, simpan 1 entri), jeda/stop, dan laporan hasil dalam CSV.

Cara pakai: login ke asetdisdik.id, buka halaman KIB-E, klik ikon extension untuk membuka panel samping, impor data, periksa pemetaan, lalu jalankan.

Privasi: semua data diproses di browser Anda. Extension hanya berkomunikasi dengan asetdisdik.id, dan tidak mengirim data ke pengembang atau pihak lain.

Extension ini bukan aplikasi resmi Dinas Pendidikan dan tidak berafiliasi dengan pengelola asetdisdik.id.

## Jawaban formulir privasi
- Apakah extension mengumpulkan/mengirim data pribadi ke pengembang? Tidak.
- Data disimpan di mana? `chrome.storage.local` di browser pengguna (data impor, pemetaan, status, log).
- Izin:
  - `storage`: menyimpan data impor dan pengaturan secara lokal.
  - `sidePanel`: menampilkan panel kerja di samping halaman.
  - `scripting` + akses host `https://asetdisdik.id/*`: mengisi form "Tambah Barang" dan membaca data KIB-E di situs tersebut.

## Chrome Web Store: tab "Privacy practices"
- **Single purpose:** Mengisi form KIB-E (Aset Tetap Lainnya) di asetdisdik.id secara massal dari data invoice SIPLah, Excel, atau CSV milik pengguna.
- **Justifikasi `storage`:** Menyimpan data yang diimpor, pemetaan kolom, status input, dan log secara lokal, supaya proses bisa dilanjutkan dan entri yang sudah tersimpan tidak diinput dua kali.
- **Justifikasi `sidePanel`:** Panel kerja (impor data, pemetaan, progres) tampil di samping halaman KIB-E selama proses input.
- **Justifikasi `scripting`:** Menyuntikkan skrip ke halaman KIB-E untuk mengisi form "Tambah Barang", menekan Save, dan membaca data KIB-E yang sudah ada untuk mencegah input ganda.
- **Justifikasi host `https://asetdisdik.id/*`:** Extension hanya bekerja di situs ini.
- **Remote code:** No. Semua kode, termasuk SheetJS dan pdf.js, disertakan di dalam paket.
- **Data usage:** jangan centang kategori apa pun karena tidak ada data yang dikumpulkan pengembang. Centang ketiga pernyataan sertifikasi (tidak menjual data, tidak dipakai untuk tujuan lain, tidak untuk menilai kelayakan kredit).

## Catatan untuk tim sertifikasi (Notes for certification)
This extension only works on https://asetdisdik.id/kib-e, which requires a school operator account (Indonesian government asset system), so reviewers cannot log in.
The extension does not run on any other site. All processing is local; it only talks to asetdisdik.id using the user's own session.
Without login you can still test: open the side panel, import a SIPLah invoice PDF or the Excel template (button "Unduh template Excel"), and check the Data and Pemetaan tabs.
The connection indicator will show "Buka asetdisdik.id" because there is no logged-in session.
Third-party libraries are bundled unmodified: SheetJS xlsx 0.18.5 (lib/xlsx.full.min.js) and pdf.js 4.10.38 (lib/pdf.min.mjs, lib/pdf.worker.min.mjs).
