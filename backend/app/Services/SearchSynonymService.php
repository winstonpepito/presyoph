<?php

namespace App\Services;

use App\Models\SearchSynonymGroup;

class SearchSynonymService
{
    /**
     * Expand a user search string using admin synonym groups. Includes the normalized query plus
     * all terms from any group where the query matches a term (substring, either direction).
     *
     * @return list<string> lowercase non-empty strings
     */
    public function expandTerms(string $keyword, string $type): array
    {
        $q = mb_strtolower(trim($keyword), 'UTF-8');
        if ($q === '') {
            return [];
        }

        $expanded = collect([$q]);

        $groups = SearchSynonymGroup::query()
            ->where('type', $type)
            ->with('terms')
            ->get();

        foreach ($groups as $group) {
            $terms = $group->terms->pluck('term')->map(fn ($t) => mb_strtolower(trim((string) $t), 'UTF-8'))->filter();
            if ($terms->isEmpty()) {
                continue;
            }
            $hit = false;
            foreach ($terms as $t) {
                if ($t === '') {
                    continue;
                }
                if (str_contains($q, $t) || str_contains($t, $q)) {
                    $hit = true;
                    break;
                }
            }
            if ($hit) {
                foreach ($terms as $t) {
                    if ($t !== '') {
                        $expanded->push($t);
                    }
                }
            }
        }

        return $expanded->unique()->values()->all();
    }
}
