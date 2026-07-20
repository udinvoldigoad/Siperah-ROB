<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Notifications\Notifiable;
use NotificationChannels\WebPush\HasPushSubscriptions;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable, HasPushSubscriptions;

    protected $table = 'users';
    
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'email',
        'google_id',
        'password_hash',
        'phone_number',
        'role',
        'institution',
        'region_id',
        'status',
        'last_login_at'
    ];

    protected $hidden = ['password_hash'];

    protected $casts = [
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
