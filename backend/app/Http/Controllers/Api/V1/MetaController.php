<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ProductUnit;
use App\Services\HomeSpotlightTermsService;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;

class MetaController extends Controller
{
    public function __construct(
        private HomeSpotlightTermsService $spotlightTerms,
    ) {}

    public function __invoke(SettingsService $settings): JsonResponse
    {
        return response()->json([
            'anonymousPostingEnabled' => $settings->anonymousPostingEnabled(),
            'productUnits' => ProductUnit::optionsPayload(),
            'spotlightProductTerms' => $this->spotlightTerms->mergedNeedlesPerSlot(),
        ]);
    }
}
