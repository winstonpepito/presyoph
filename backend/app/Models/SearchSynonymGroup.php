<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SearchSynonymGroup extends Model
{
    public const TYPE_PRODUCT = 'product';

    public const TYPE_AREA = 'area';

    protected $fillable = ['type'];

    public function terms(): HasMany
    {
        return $this->hasMany(SearchSynonymTerm::class);
    }
}
