<?php

namespace Database\Seeders;

use App\Models\Barangay;
use App\Models\City;
use Illuminate\Database\Seeder;

class CebuCitiesSeeder extends Seeder
{
    public function run(): void
    {
        /** @var array<string, list<string>> $barangaysBySlug */
        $barangaysBySlug = require __DIR__.'/../data/cebu_metro_barangays.php';

        $lapu = City::query()->updateOrCreate(
            ['slug' => 'lapu-lapu-city'],
            [
                'name' => 'Lapu-Lapu City',
                'sort_order' => 10,
                'is_default' => false,
                'geo_priority' => 1,
                'min_lat' => 10.22,
                'max_lat' => 10.36,
                'min_lng' => 123.92,
                'max_lng' => 124.05,
            ],
        );

        $mandaue = City::query()->updateOrCreate(
            ['slug' => 'mandaue-city'],
            [
                'name' => 'Mandaue City',
                'sort_order' => 20,
                'is_default' => false,
                'geo_priority' => 2,
                'min_lat' => 10.30,
                'max_lat' => 10.38,
                'min_lng' => 123.90,
                'max_lng' => 123.97,
            ],
        );

        $talisay = City::query()->updateOrCreate(
            ['slug' => 'talisay-city'],
            [
                'name' => 'Talisay City',
                'sort_order' => 30,
                'is_default' => false,
                'geo_priority' => 3,
                'min_lat' => 10.21,
                'max_lat' => 10.32,
                'min_lng' => 123.80,
                'max_lng' => 123.90,
            ],
        );

        $cebu = City::query()->updateOrCreate(
            ['slug' => 'cebu-city'],
            [
                'name' => 'Cebu City',
                'sort_order' => 40,
                'is_default' => true,
                'geo_priority' => 4,
                'min_lat' => 10.22,
                'max_lat' => 10.45,
                'min_lng' => 123.75,
                'max_lng' => 123.95,
            ],
        );

        $this->seedBarangays($cebu, $barangaysBySlug['cebu-city']);
        $this->seedBarangays($mandaue, $barangaysBySlug['mandaue-city']);
        $this->seedBarangays($talisay, $barangaysBySlug['talisay-city']);
        $this->seedBarangays($lapu, $barangaysBySlug['lapu-lapu-city']);
    }

    /**
     * @param  list<string>  $names
     */
    private function seedBarangays(City $city, array $names): void
    {
        $wanted = [];
        foreach ($names as $name) {
            $n = trim($name);
            if ($n !== '') {
                $wanted[] = $n;
            }
        }
        $wanted = array_values(array_unique($wanted));

        Barangay::query()->where('city_id', $city->id)->whereNotIn('name', $wanted)->delete();

        foreach ($wanted as $i => $name) {
            Barangay::query()->updateOrCreate(
                ['city_id' => $city->id, 'name' => $name],
                ['sort_order' => $i],
            );
        }
    }
}
