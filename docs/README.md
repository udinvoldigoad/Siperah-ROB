# Dokumentasi SIPERAH-RoB

Dokumen dikelompokkan per tujuan. Nama berkas memakai huruf kecil dan tanda
hubung (`kebab-case`); akronim resmi dokumen (PRD, SKPL, ERD, UAT) dipertahankan.

## 📚 `academic/` — Deliverable formal tugas akhir
| Berkas | Isi |
| :--- | :--- |
| [prd.md](academic/prd.md) | Product Requirements Document |
| [skpl.docx](academic/skpl.docx) | Spesifikasi Kebutuhan Perangkat Lunak (dokumen sumber) |
| [skpl-traceability-matrix.md](academic/skpl-traceability-matrix.md) | Matriks ketertelusuran kebutuhan → UI/API/test |
| [erd.md](academic/erd.md) | Entity-Relationship Diagram |
| [architecture.md](academic/architecture.md) | Arsitektur sistem |
| [uat-results.md](academic/uat-results.md) | Hasil User Acceptance Testing |

## ⚙️ `operations/` — Panduan produksi & teknis
| Berkas | Isi |
| :--- | :--- |
| [deployment.md](operations/deployment.md) | Prosedur deploy Hostinger + Supabase + rollback |
| [admin-runbook.md](operations/admin-runbook.md) | Penanganan insiden (API/DB down, dsb.) |
| [backup-database.md](operations/backup-database.md) | Backup & restore database produksi |
| [secret-rotation.md](operations/secret-rotation.md) | Prosedur rotasi secret |
| [api-contract.md](operations/api-contract.md) | Kontrak & stabilitas API publik `/api/v1/*` |
| [user-guide.md](operations/user-guide.md) | Panduan pengguna per peran |

## 🤖 `machine-learning/` — Metodologi & pipeline ML
| Berkas | Isi |
| :--- | :--- |
| [explanation.md](machine-learning/explanation.md) | Penjelasan prediksi machine learning |
| [roadmap.md](machine-learning/roadmap.md) | Roadmap pengembangan ML |
| [data-collection.md](machine-learning/data-collection.md) | Skrip pengambilan data |

## 📝 `review/` — Tinjauan kualitas
| Berkas | Isi |
| :--- | :--- |
| [copywriting.md](review/copywriting.md) | Tinjauan konsistensi copywriting & istilah |

## 🗒️ `internal/` — Catatan kerja
Bukan bagian dari dokumen yang diserahkan; disimpan sebagai arsip proses.

| Berkas | Isi |
| :--- | :--- |
| [task-checklist.md](internal/task-checklist.md) | Daftar tugas pengembangan |
| [pre-handover.md](internal/pre-handover.md) | Urutan tugas pra-serah-terima |
| [initial-mockup.md](internal/initial-mockup.md) | Mockup awal dari dosen |
