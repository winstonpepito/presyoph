<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ProductUnit;
use App\Models\SearchSynonymGroup;
use App\Services\SettingsService;

class MetaController extends Controller
{
    public function __invoke(SettingsService $settings): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'anonymousPostingEnabled' => $settings->anonymousPostingEnabled(),
            'productUnits' => ProductUnit::optionsPayload(),
            'spotlightProductTerms' => $this->spotlightProductTerms(),
        ]);
    }

    /**
     * Merged lowercase terms per home spotlight slot from admin synonym groups with spotlight_key set.
     *
     * @return array{gasoline: list<string>, diesel: list<string>, rice: list<string>}
     */
    private function spotlightProductTerms(): array
    {
        $keys = SearchSynonymGroup::SPOTLIGHT_KEYS;
        $out = array_fill_keys($keys, []);
        $groups = SearchSynonymGroup::query()
            ->where('type', SearchSynonymGroup::TYPE_PRODUCT)
            ->whereIn('spotlight_key', $keys)
            ->with('terms')
            ->get();

        foreach ($groups as $g) {
            $k = $g->spotlight_key;
            if ($k === null || ! isset($out[$k])) {
                continue;
            }
            foreach ($g->terms as $t) {
                $term = mb_strtolower(trim((string) $t->term), 'UTF-8');
                if ($term !== '') {
                    $out[$k][] = $term;
                }
            }
        }

        foreach ($keys as $k) {
            $out[$k] = array_values(array_unique($out[$k]));
        }

        return $out;
    }
}
