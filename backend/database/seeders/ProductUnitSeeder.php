<?php

namespace Database\Seeders;

use App\Models\ProductUnit;
use Illuminate\Database\Seeder;

class ProductUnitSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['code' => 'pcs', 'label' => 'Piece(s) / each'],
            ['code' => 'L', 'label' => 'Liter (L)'],
            ['code' => 'mL', 'label' => 'Milliliter (mL)'],
            ['code' => 'kL', 'label' => 'Kiloliter (kL)'],
            ['code' => 'kg', 'label' => 'Kilogram (kg)'],
            ['code' => 'g', 'label' => 'Gram (g)'],
            ['code' => 'gal', 'label' => 'US gallon'],
            ['code' => 'floz', 'label' => 'Fluid ounce (US)'],
            ['code' => 'oz', 'label' => 'Ounce (oz, weight)'],
            ['code' => 'dozen', 'label' => 'Dozen'],
            ['code' => 'bundle', 'label' => 'Bundle'],
        ];

        foreach ($rows as $i => $row) {
            ProductUnit::query()->updateOrCreate(
                ['code' => $row['code']],
                ['label' => $row['label'], 'sort_order' => $i * 10],
            );
        }
    }
}
