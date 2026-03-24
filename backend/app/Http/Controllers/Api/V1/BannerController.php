<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\BannerService;
use Illuminate\Http\Request;

class BannerController extends Controller
{
    public function __construct(
        private BannerService $banners,
    ) {}

    public function __invoke(Request $request): \Illuminate\Http\JsonResponse
    {
        $slot = (string) $request->query('slot', 'home_top');

        return response()->json($this->banners->resolveForSlot($slot, null, $request->root()));
    }
}
