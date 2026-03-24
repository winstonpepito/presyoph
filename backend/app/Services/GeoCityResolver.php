<?php

namespace App\Services;

use App\Models\City;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeoCityResolver
{
    /**
     * @return array{city: ?City, source: 'nominatim'|'bbox'|'none'}
     */
    public function resolve(float $lat, float $lng): array
    {
        if (is_nan($lat) || is_nan($lng)) {
            return ['city' => null, 'source' => 'none'];
        }

        $fromNom = $this->matchFromNominatim($lat, $lng);
        if ($fromNom !== null) {
            return ['city' => $fromNom, 'source' => 'nominatim'];
        }

        $fromBbox = $this->matchFromBoundingBoxes($lat, $lng);
        if ($fromBbox !== null) {
            return ['city' => $fromBbox, 'source' => 'bbox'];
        }

        return ['city' => null, 'source' => 'none'];
    }

    private function matchFromNominatim(float $lat, float $lng): ?City
    {
        try {
            $response = Http::timeout(8)
                ->withHeaders([
                    'User-Agent' => 'PriceMonitorPH/1.0 (local price crowdsourcing; contact: admin@localhost)',
                ])
                ->get('https://nominatim.openstreetmap.org/reverse', [
                    'lat' => $lat,
                    'lon' => $lng,
                    'format' => 'json',
                    'addressdetails' => 1,
                ]);

            if (! $response->successful()) {
                return null;
            }

            $addr = $response->json('address');
            if (! is_array($addr)) {
                return null;
            }

            $parts = [
                $addr['city'] ?? null,
                $addr['town'] ?? null,
                $addr['municipality'] ?? null,
                $addr['city_district'] ?? null,
                $addr['county'] ?? null,
                $addr['state_district'] ?? null,
            ];
            $blob = mb_strtolower(implode(' ', array_filter(array_map('strval', $parts))));

            return $this->cityFromAddressBlob($blob);
        } catch (\Throwable $e) {
            Log::debug('GeoCityResolver Nominatim failed', ['e' => $e->getMessage()]);

            return null;
        }
    }

    private function cityFromAddressBlob(string $blob): ?City
    {
        if ($blob === '') {
            return null;
        }

        $cities = City::query()->orderBy('geo_priority')->orderBy('sort_order')->get();

        if (
            str_contains($blob, 'lapu-lapu')
            || str_contains($blob, 'lapu lapu')
            || preg_match('/\blapu[\s-]*lapu\b/u', $blob)
        ) {
            return $cities->firstWhere('slug', 'lapu-lapu-city');
        }
        if (str_contains($blob, 'mandaue')) {
            return $cities->firstWhere('slug', 'mandaue-city');
        }
        if (str_contains($blob, 'talisay')) {
            return $cities->firstWhere('slug', 'talisay-city');
        }
        if (str_contains($blob, 'cebu city')) {
            return $cities->firstWhere('slug', 'cebu-city');
        }

        return null;
    }

    private function matchFromBoundingBoxes(float $lat, float $lng): ?City
    {
        $candidates = City::query()
            ->whereNotNull('min_lat')
            ->whereNotNull('max_lat')
            ->whereNotNull('min_lng')
            ->whereNotNull('max_lng')
            ->orderBy('geo_priority')
            ->orderBy('sort_order')
            ->get();

        foreach ($candidates as $city) {
            if (
                $lat >= $city->min_lat && $lat <= $city->max_lat
                && $lng >= $city->min_lng && $lng <= $city->max_lng
            ) {
                return $city;
            }
        }

        return null;
    }
}
