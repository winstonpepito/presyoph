<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class City extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'sort_order',
        'is_default',
        'geo_priority',
        'min_lat',
        'max_lat',
        'min_lng',
        'max_lng',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'min_lat' => 'float',
            'max_lat' => 'float',
            'min_lng' => 'float',
            'max_lng' => 'float',
        ];
    }

    public function barangays(): HasMany
    {
        return $this->hasMany(Barangay::class)->orderBy('sort_order')->orderBy('name');
    }
}
