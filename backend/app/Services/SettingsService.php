<?php

namespace App\Services;

use App\Models\AppSetting;

class SettingsService
{
    public function anonymousPostingEnabled(): bool
    {
        $row = AppSetting::query()->where('key', 'anonymous_posting_enabled')->first();
        if (! $row) {
            return true;
        }
        $v = $row->value;

        return filter_var($v, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $v;
    }

    public function setAnonymousPostingEnabled(bool $enabled): void
    {
        AppSetting::query()->updateOrInsert(
            ['key' => 'anonymous_posting_enabled'],
            ['value' => json_encode($enabled), 'updated_at' => now()],
        );
    }

    /** @return 'STATIC'|'ROTATE' */
    public function bannerStrategy(string $slotKey): string
    {
        $key = 'banner_strategy_'.$slotKey;
        $row = AppSetting::query()->where('key', $key)->first();
        $v = $row?->value;
        if ($v === 'STATIC' || $v === 'ROTATE') {
            return $v;
        }

        return 'ROTATE';
    }

    /** @param  'STATIC'|'ROTATE'  $strategy */
    public function setBannerStrategy(string $slotKey, string $strategy): void
    {
        $key = 'banner_strategy_'.$slotKey;
        AppSetting::query()->updateOrInsert(
            ['key' => $key],
            ['value' => json_encode($strategy), 'updated_at' => now()],
        );
    }
}
