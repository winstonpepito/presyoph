<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\City;

class LocationsController extends Controller
{
    public function __invoke(): \Illuminate\Http\JsonResponse
    {
        $cities = City::query()
            ->with(['barangays' => fn ($q) => $q->orderBy('sort_order')->orderBy('name')])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $default = $cities->firstWhere('is_default', true) ?? $cities->first();

        return response()->json([
            'defaultCitySlug' => $default?->slug,
            'cities' => $cities->map(fn (City $c) => [
                'id' => (string) $c->id,
                'slug' => $c->slug,
                'name' => $c->name,
                'barangays' => $c->barangays->map(fn ($b) => [
                    'id' => (string) $b->id,
                    'name' => $b->name,
                ])->all(),
            ])->all(),
        ]);
    }
}
