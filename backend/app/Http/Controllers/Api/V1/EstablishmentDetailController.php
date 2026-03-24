<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PricePostResource;
use App\Models\Establishment;
use App\Services\PostQueryService;
use Illuminate\Http\Request;

class EstablishmentDetailController extends Controller
{
    public function __construct(
        private PostQueryService $posts,
    ) {}

    public function show(Request $request, string $slug): \Illuminate\Http\JsonResponse
    {
        $est = Establishment::query()->where('slug', $slug)->first();
        if (! $est) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $lat = $request->query('lat');
        $lng = $request->query('lng');
        $radiusKm = (float) ($request->query('radiusKm', 100) ?: 100) ?: 100;
        $latN = $lat !== null && $lat !== '' ? (float) $lat : null;
        $lngN = $lng !== null && $lng !== '' ? (float) $lng : null;

        $list = $this->posts->postsForEstablishment($est->id, $latN, $lngN, $radiusKm, 40);

        return response()->json([
            'establishment' => [
                'id' => (string) $est->id,
                'name' => $est->name,
                'slug' => $est->slug,
                'addressLine' => $est->address_line,
                'barangay' => $est->barangay,
                'city' => $est->city,
            ],
            'posts' => PricePostResource::collection($list)->resolve(),
        ]);
    }
}
