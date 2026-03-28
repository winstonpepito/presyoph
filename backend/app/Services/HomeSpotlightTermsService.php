<?php

namespace App\Services;

use App\Models\SearchSynonymGroup;

/**
 * Merged product needles per home spotlight slot (admin synonym groups + fallback).
 */
final class HomeSpotlightTermsService
{
    /**
     * @return array{gasoline: list<string>, diesel: list<string>, rice: list<string>}
     */
    public function mergedNeedlesPerSlot(): array
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

        $allEmpty = true;
        foreach ($keys as $k) {
            if ($out[$k] !== []) {
                $allEmpty = false;
                break;
            }
        }

        if ($allEmpty) {
            return $this->defaultNeedlesFallback();
        }

        return $out;
    }

    /**
     * @return array{gasoline: list<string>, diesel: list<string>, rice: list<string>}
     */
    private function defaultNeedlesFallback(): array
    {
        $gas = ['gasoline', 'petrol', 'unleaded', 'regular gasoline', 'regular unleaded', 'premium gasoline',
            'premium gas', '91 octane', '95 octane', 'fuel gasoline'];
        $die = ['diesel', 'biodiesel', 'diesel fuel'];
        $rice = ['bigas', 'bugas', 'rice', 'ganador', 'kanin', 'kan-on', 'sinandomeng', 'sinandomin',
            'dinorado', 'jasmine rice', 'malagkit', 'sticky rice', 'glutinous rice', 'brown rice', 'white rice',
            'fancy rice'];

        $norm = fn (array $raw): array => array_values(array_unique(array_map(
            fn (string $t) => mb_strtolower(trim($t), 'UTF-8'),
            $raw,
        )));

        return [
            'gasoline' => $norm($gas),
            'diesel' => $norm($die),
            'rice' => $norm($rice),
        ];
    }
}
