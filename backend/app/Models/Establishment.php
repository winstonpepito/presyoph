<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Establishment extends Model
{
    protected $fillable = ['name', 'slug', 'address_line', 'barangay', 'city', 'latitude', 'longitude'];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function pricePosts(): HasMany
    {
        return $this->hasMany(PricePost::class);
    }
}
