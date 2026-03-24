<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductUnit extends Model
{
    protected $fillable = ['code', 'label', 'sort_order'];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return list<array{code: string, label: string}>
     */
    public static function optionsPayload(): array
    {
        return static::query()
            ->orderBy('sort_order')
            ->orderBy('code')
            ->get(['code', 'label'])
            ->map(fn (ProductUnit $u) => [
                'code' => $u->code,
                'label' => $u->label,
            ])
            ->all();
    }

    /** @return list<string> */
    public static function allCodes(): array
    {
        return static::query()->orderBy('sort_order')->orderBy('code')->pluck('code')->all();
    }
}
