<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PricePostResource;
use App\Models\Category;
use App\Models\Product;
use App\Services\PostQueryService;
use Illuminate\Http\Request;

class CategoryDetailController extends Controller
{
    public function __construct(
        private PostQueryService $posts,
    ) {}

    public function show(Request $request, string $slug): \Illuminate\Http\JsonResponse
    {
        $category = Category::query()->where('slug', $slug)->first();
        if (! $category) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $lat = $request->query('lat');
        $lng = $request->query('lng');
        $radiusKm = (float) ($request->query('radiusKm', 100) ?: 100) ?: 100;
        $latN = $lat !== null && $lat !== '' ? (float) $lat : null;
        $lngN = $lng !== null && $lng !== '' ? (float) $lng : null;

        $result = $this->posts->bestPricesForCategory($category->id, $latN, $lngN, $radiusKm, 48);
        $products = Product::query()
            ->where('category_id', $category->id)
            ->orderBy('name')
            ->get(['id', 'name', 'brand', 'slug', 'unit', 'unit_quantity']);

        return response()->json([
            'category' => [
                'id' => (string) $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
            ],
            'products' => $products->map(fn (Product $p) => [
                'id' => (string) $p->id,
                'name' => $p->name,
                'brand' => $p->brand !== null && $p->brand !== '' ? $p->brand : null,
                'slug' => $p->slug,
                'unit' => $p->unit,
                'unitQuantity' => $p->unit_quantity !== null && $p->unit_quantity !== ''
                    ? (string) $p->unit_quantity
                    : null,
            ])->all(),
            'posts' => PricePostResource::collection($result['items'])->resolve(),
        ]);
    }
}
