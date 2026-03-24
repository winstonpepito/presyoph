<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\GeoCityResolver;
use Illuminate\Http\Request;

class GeoResolveController extends Controller
{
    public function __invoke(Request $request, GeoCityResolver $resolver): \Illuminate\Http\JsonResponse
    {
        $v = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $lat = (float) $v['latitude'];
        $lng = (float) $v['longitude'];

        $result = $resolver->resolve($lat, $lng);
        $city = $result['city'];

        return response()->json([
            'matched' => $city !== null,
            'citySlug' => $city?->slug,
            'cityName' => $city?->name,
            'source' => $result['source'],
        ]);
    }
}
