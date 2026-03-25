<?php

namespace App\Services;

use App\Models\BannerAd;
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage;

class BannerService
{
    public function __construct(
        private SettingsService $settings,
    ) {}

    /**
     * @param  string|null  $publicOrigin  e.g. $request->getSchemeAndHttpHost() for banner image URLs (https + host as the client sees it).
     * @return array{strategy: 'STATIC'|'ROTATE', items: list<array{id: string, imageUrl: string, href: string, alt: string}>}
     */
    public function resolveForSlot(string $slotKey, ?Carbon $now = null, ?string $publicOrigin = null): array
    {
        $now = $now ?? Carbon::now();
        $strategy = $this->settings->bannerStrategy($slotKey);
        $rows = BannerAd::query()
            ->where('slot_key', $slotKey)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        $active = $rows->filter(function (BannerAd $r) use ($now) {
            if ($r->valid_from && $now->lt($r->valid_from)) {
                return false;
            }
            if ($r->valid_to && $now->gt($r->valid_to)) {
                return false;
            }

            return true;
        });

        $items = $active->map(fn (BannerAd $r) => [
            'id' => (string) $r->id,
            'imageUrl' => self::spaStorageOrAbsoluteUrl($r->image_url, $publicOrigin),
            'href' => $r->href ?? '',
            'alt' => $r->alt ?? '',
        ])->values()->all();

        if ($strategy === 'STATIC' && count($items) > 0) {
            return ['strategy' => 'STATIC', 'items' => [array_values($items)[0]]];
        }

        return ['strategy' => 'ROTATE', 'items' => $items];
    }

    /**
     * Full URL for SPA <img src>. Prefer $publicOrigin from the incoming request (correct https + host
     * behind reverse proxies). Falls back to asset(). Legacy absolute http(s) URLs unchanged.
     */
    public static function spaStorageOrAbsoluteUrl(?string $stored, ?string $publicOrigin = null): string
    {
        if ($stored === null || $stored === '') {
            return '';
        }
        if (preg_match('#^https?://#i', $stored)) {
            return $stored;
        }

        $path = self::normalizePublicDiskPath($stored);
        if ($publicOrigin !== null && $publicOrigin !== '') {
            return rtrim($publicOrigin, '/').'/storage/'.$path;
        }

        return asset('storage/'.$path);
    }

    /**
     * Stored value is either a legacy absolute URL or a path on the public disk (e.g. banner-uploads/…).
     *
     * @param  string|null  $publicUrlRoot  e.g. request root URL so /storage/… matches the host:port hitting the API (avoids broken links when APP_URL omits the dev server port).
     */
    public static function publicImageUrl(?string $stored, ?string $publicUrlRoot = null): string
    {
        if ($stored === null || $stored === '') {
            return '';
        }
        if (preg_match('#^https?://#i', $stored)) {
            return $stored;
        }

        $path = self::normalizePublicDiskPath($stored);
        if ($publicUrlRoot !== null && $publicUrlRoot !== '') {
            return rtrim($publicUrlRoot, '/').'/storage/'.$path;
        }

        return Storage::disk('public')->url($path);
    }

    private static function normalizePublicDiskPath(string $stored): string
    {
        $path = str_replace('\\', '/', ltrim($stored, '/'));
        if (str_starts_with($path, 'storage/')) {
            $path = substr($path, strlen('storage/'));
        }

        return $path;
    }
}
