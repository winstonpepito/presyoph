<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;

class CategoryController extends Controller
{
    public function index(): \Illuminate\Http\JsonResponse
    {
        $rows = Category::query()->orderBy('name')->get(['id', 'name']);

        return response()->json([
            'categories' => $rows->map(fn (Category $c) => [
                'id' => (string) $c->id,
                'name' => $c->name,
            ])->all(),
        ]);
    }
}
