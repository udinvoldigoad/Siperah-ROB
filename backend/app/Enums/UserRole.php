<?php

namespace App\Enums;

/**
 * Peran pengguna, dipetakan satu-ke-satu ke enum Postgres `user_role`
 * (`warga`, `peneliti`, `admin`).
 *
 * Titik otorisasi (ReportAccessService, middleware, controller) wajib
 * membandingkan via konstanta ini — `->value` — supaya salah ketik literal
 * string (yang pernah mengubah `'bpbd_provinsi', 'admin'` menjadi
 * `'peneliti', 'admin'` saat peran disederhanakan 5→3) gagal saat runtime
 * alih-alih jatuh senyap ke cabang default.
 */
enum UserRole: string
{
    case Warga = 'warga';
    case Peneliti = 'peneliti';
    case Admin = 'admin';
}
