<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BannerAd extends Model
{
    protected $fillable = [
        'slot_key',
        'image_url',
        'href',
        'alt',
        'sort_order',
        'is_active',
        'valid_from',
        'valid_to',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'valid_from' => 'datetime',
            'valid_to' => 'datetime',
        ];
    }
}
