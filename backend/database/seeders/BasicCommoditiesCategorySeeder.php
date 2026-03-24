<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class BasicCommoditiesCategorySeeder extends Seeder
{
    public function run(): void
    {
        $rows = require database_path('data/basic_commodity_categories.php');

        foreach ($rows as $row) {
            Category::query()->updateOrCreate(
                ['slug' => $row['slug']],
                ['name' => $row['name']],
            );
        }
    }
}
