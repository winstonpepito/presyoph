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

        return response()->json($this->posts->searchProductsAndCategories($q));
    }
}
