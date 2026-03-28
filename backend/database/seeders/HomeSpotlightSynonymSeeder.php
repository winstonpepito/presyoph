<?php

namespace Database\Seeders;

use App\Models\SearchSynonymGroup;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Assigns home spotlight synonym groups (gasoline, diesel, rice) for the three featured cards
 * on the default home feed. Idempotent: skips groups that already exist per spotlight key.
 */
class HomeSpotlightSynonymSeeder extends Seeder
{
    public function run(): void
    {
        $this->ensureGasoline();
        $this->ensureDiesel();
        $this->ensureRice();
    }

    private function ensureGasoline(): void
    {
        if (SearchSynonymGroup::query()->where('spotlight_key', 'gasoline')->exists()) {
            return;
        }

        $terms = [
            'gasoline', 'petrol', 'unleaded', 'regular gasoline', 'regular unleaded', 'premium gasoline',
            'premium gas', '91 octane', '95 octane', 'fuel gasoline',
        ];

        $this->createSpotlightGroup('gasoline', $terms);
    }

    private function ensureDiesel(): void
    {
        if (SearchSynonymGroup::query()->where('spotlight_key', 'diesel')->exists()) {
            return;
        }

        $terms = ['diesel', 'biodiesel', 'diesel fuel'];

        $this->createSpotlightGroup('diesel', $terms);
    }

    private function ensureRice(): void
    {
        if (SearchSynonymGroup::query()->where('spotlight_key', 'rice')->exists()) {
            return;
        }

        $existing = SearchSynonymGroup::query()
            ->where('type', SearchSynonymGroup::TYPE_PRODUCT)
            ->whereHas('terms', function ($q) {
                $q->whereRaw('LOWER(term) IN (?, ?)', ['bigas', 'rice']);
            })
            ->first();

        if ($existing !== null) {
            $existing->spotlight_key = 'rice';
            $existing->save();

            return;
        }

        $terms = [
            'bigas', 'bugas', 'rice', 'ganador', 'kanin', 'kan-on', 'sinandomeng', 'sinandomin',
            'dinorado', 'jasmine rice', 'malagkit', 'sticky rice', 'glutinous rice', 'brown rice', 'white rice',
            'fancy rice',
        ];

        $this->createSpotlightGroup('rice', $terms);
    }

    /**
     * @param  list<string>  $terms
     */
    private function createSpotlightGroup(string $key, array $terms): void
    {
        $clean = collect($terms)
            ->map(fn (string $t) => trim($t))
            ->filter()
            ->unique(fn (string $t) => mb_strtolower($t, 'UTF-8'))
            ->values()
            ->all();

        if ($clean === []) {
            return;
        }

        DB::transaction(function () use ($key, $clean) {
            $g = SearchSynonymGroup::query()->create([
                'type' => SearchSynonymGroup::TYPE_PRODUCT,
                'spotlight_key' => $key,
            ]);
            foreach ($clean as $t) {
                if (mb_strlen($t, 'UTF-8') > 120) {
                    $t = mb_substr($t, 0, 120, 'UTF-8');
                }
                $g->terms()->create(['term' => $t]);
            }
        });
    }
}
