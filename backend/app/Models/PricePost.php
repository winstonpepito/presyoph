<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PricePost extends Model
{
    protected $fillable = [
        'product_id',
        'establishment_id',
        'user_id',
        'anonymous',
        'price_exact',
        'price_min',
        'price_max',
        'latitude',
        'longitude',
        'location_label',
        'unit',
        'unit_quantity',
    ];

    protected function casts(): array
    {
        return [
            'anonymous' => 'boolean',
            'latitude' => 'float',
            'longitude' => 'float',
            'unit_quantity' => 'string',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function establishment(): BelongsTo
    {
        return $this->belongsTo(Establishment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
