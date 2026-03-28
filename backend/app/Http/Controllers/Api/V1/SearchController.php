<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\PostQueryService;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __construct(
        private PostQueryService $posts,
    ) {}

    public function __invoke(Request $request): \Illuminate\Http\JsonResponse
    {
        $q = (string) $request->query('q', '');

        $page = [
            'categoriesOffset' => $this->parseOffset($request->query('categoriesOffset')),
            'categoriesLimit' => $this->parseLimit($request->query('categoriesLimit'), 15),
            'productsOffset' => $this->parseOffset($request->query('productsOffset')),
            'productsLimit' => $this->parseLimit($request->query('productsLimit'), 20),
            'establishmentsOffset' => $this->parseOffset($request->query('establishmentsOffset')),
            'establishmentsLimit' => $this->parseLimit($request->query('establishmentsLimit'), 15),
        ];

        return response()->json($this->posts->searchProductsAndCategories($q, $page));
    }

    private function parseOffset(mixed $raw): int
    {
        if ($raw === null || $raw === '') {
            return 0;
        }

        return max(0, (int) $raw);
    }

    private function parseLimit(mixed $raw, int $default): int
    {
        if ($raw === null || $raw === '') {
            return max(0, min(50, $default));
        }

        return max(0, min(50, (int) $raw));
    }
}
