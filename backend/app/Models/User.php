<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Notifications\Notifiable;
use NotificationChannels\WebPush\HasPushSubscriptions;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable, HasPushSubscriptions, SoftDeletes;

    protected $table = 'users';
    
    public $incrementing = false;
    protected $keyType = 'string';

    /**
     * Kolom yang aman diisi massal dari input pengguna.
     *
     * `role`, `status`, dan `google_id` SENGAJA tidak ada di sini: ketiganya
     * menentukan hak akses (eskalasi peran, lewati approval, pembajakan akun
     * lewat penautan OAuth). Endpoint yang memang berwenang mengubahnya harus
     * menyetel atribut itu secara eksplisit (`$user->role = ...`), sehingga
     * satu `fill()`/`update($request->all())` yang lalai tidak bisa menaikkan
     * hak akses secara diam-diam.
     */
    protected $fillable = [
        'id',
        'name',
        'email',
        'password_hash',
        'institution',
        'research_purpose',
        'region_id',
        'last_login_at'
    ];

    protected $hidden = ['password_hash'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_login_at' => 'datetime',
    ];

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }
}
