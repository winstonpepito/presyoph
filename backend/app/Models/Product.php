<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = ['name', 'brand', 'slug', 'category_id', 'unit', 'unit_quantity'];

    protected function casts(): array
    {
        return [
            'unit_quantity' => 'string',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function pricePosts(): HasMany
    {
        return $this->hasMany(PricePost::class);
    }
}
