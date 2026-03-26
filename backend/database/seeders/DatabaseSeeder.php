<?php

namespace Database\Seeders;

use App\Models\AppSetting;
use App\Models\Category;
use App\Models\Establishment;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL', 'admin@example.com');
        $password = env('ADMIN_PASSWORD', 'admin123');

        User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => 'Admin',
                'password' => Hash::make($password),
                'role' => 'ADMIN',
                'email_verified_at' => now(),
            ],
        );

        AppSetting::query()->updateOrInsert(
            ['key' => 'anonymous_posting_enabled'],
            ['value' => json_encode(true), 'updated_at' => now()],
        );

        AppSetting::query()->updateOrInsert(
            ['key' => 'banner_strategy_home_top'],
            ['value' => json_encode('ROTATE'), 'updated_at' => now()],
        );

        $this->call(BasicCommoditiesCategorySeeder::class);
        $this->call(ProductUnitSeeder::class);

        $dairyEggs = Category::query()->where('slug', 'dairy-eggs')->firstOrFail();
        $fuel = Category::query()->where('slug', 'fuel')->firstOrFail();

        Product::query()->updateOrCreate(
            ['slug' => 'whole-milk-1gal'],
            [
                'name' => 'Whole milk (1 gal)',
                'category_id' => $dairyEggs->id,
                'unit' => 'gal',
                'unit_quantity' => '1',
            ],
        );

        Product::query()->updateOrCreate(
            ['slug' => 'eggs-dozen-large'],
            [
                'name' => 'Eggs, large (dozen)',
                'category_id' => $dairyEggs->id,
                'unit' => 'dozen',
                'unit_quantity' => '1',
            ],
        );

        Product::query()->updateOrCreate(
            ['slug' => 'regular-unleaded-gallon'],
            [
                'name' => 'Regular unleaded (per gallon)',
                'category_id' => $fuel->id,
                'unit' => 'gal',
                'unit_quantity' => '1',
            ],
        );

        Establishment::query()->updateOrCreate(
            ['slug' => 'sample-market'],
            [
                'name' => 'Sample Market',
                'address_line' => '100 Main St',
                'latitude' => 40.7128,
                'longitude' => -74.006,
            ],
        );

        $this->call(CebuCitiesSeeder::class);
        $this->call(CommoditySearchSynonymSeeder::class);
    }
}
