<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PricePostResource;
use App\Models\Product;
use App\Services\PostQueryService;
use Illuminate\Http\Request;

class ProductDetailController extends Controller
{
    public function __construct(
        private PostQueryService $posts,
    ) {}

    public function show(Request $request, string $slug): \Illuminate\Http\JsonResponse
    {
        $product = Product::query()->where('slug', $slug)->with('category')->first();
        if (! $product) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $lat = $request->query('lat');
        $lng = $request->query('lng');
        $radiusKm = (float) ($request->query('radiusKm', 100) ?: 100) ?: 100;
        $latN = $lat !== null && $lat !== '' ? (float) $lat : null;
        $lngN = $lng !== null && $lng !== '' ? (float) $lng : null;

        $result = $this->posts->bestPricesForProduct($product->id, $latN, $lngN, $radiusKm, 40);

        return response()->json([
            'product' => [
                'id' => (string) $product->id,
                'name' => $product->name,
                'brand' => $product->brand !== null && $product->brand !== '' ? $product->brand : null,
                'slug' => $product->slug,
                'unit' => $product->unit,
                'unitQuantity' => $product->unit_quantity !== null && $product->unit_quantity !== ''
                    ? (string) $product->unit_quantity
                    : null,
                'category' => $product->category ? [
                    'id' => (string) $product->category->id,
                    'name' => $product->category->name,
                    'slug' => $product->category->slug,
                ] : null,
            ],
            'posts' => PricePostResource::collection($result['items'])->resolve(),
        ]);
    }
}
