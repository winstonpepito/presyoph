<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\SettingsService;
use App\Models\ProductUnit;

class MetaController extends Controller
{
    public function __invoke(SettingsService $settings): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'anonymousPostingEnabled' => $settings->anonymousPostingEnabled(),
            'productUnits' => ProductUnit::optionsPayload(),
        ]);
    }
}
