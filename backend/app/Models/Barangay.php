<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Barangay extends Model
{
    protected $fillable = ['city_id', 'name', 'sort_order'];

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }
}
