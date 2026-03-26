<?php

namespace Database\Seeders;

use App\Models\SearchSynonymGroup;
use App\Models\SearchSynonymTerm;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Pre-seeds product synonym groups for the home-page search filter (English, Bisaya/Cebuano, misspellings).
 * Skips entirely if a rice-related group already exists (idempotent).
 */
class CommoditySearchSynonymSeeder extends Seeder
{
    public function run(): void
    {
        if (SearchSynonymTerm::query()->whereRaw('LOWER(term) = ?', ['bigas'])->exists()) {
            return;
        }

        $groups = [
            // Rice & grains
            ['bigas', 'bugas', 'rice', 'kanin', 'kan-on', 'sinandomeng', 'sinandomin', 'dinorado', 'jasmine rice', 'malagkit', 'sticky rice', 'glutinous rice', 'brown rice', 'white rice', 'fancy rice'],
            // Fish — bangus / milkfish
            ['bangus', 'bangos', 'bangoes', 'milkfish'],
            // Fish — general
            ['isda', 'fish', 'isdaha'],
            // Eggs
            ['itlog', 'itlug', 'egg', 'eggs', 'chicken egg', 'balut'],
            // Sugar
            ['asukal', 'asukar', 'sugar', 'brown sugar', 'washed sugar', 'refined sugar', 'white sugar'],
            // Salt
            ['asin', 'salt', 'iodized salt', 'rock salt', 'sea salt'],
            // Cooking oil & fats
            ['mantika', 'lana', 'cooking oil', 'vegetable oil', 'palm oil', 'canola oil', 'sunflower oil', 'olive oil', 'margarine', 'butter'],
            // Bread & bakery
            ['tinapay', 'bread', 'pandesal', 'pan de sal', 'pandisal', 'monay', 'ensaymada', 'pan'],
            // Onions
            ['sibuyas', 'onion', 'onions', 'red onion', 'white onion', 'shallot'],
            // Garlic
            ['bawang', 'garlic'],
            // Tomatoes
            ['kamatis', 'tomato', 'tomatoes', 'cherry tomato'],
            // Potatoes & root crops
            ['patatas', 'potato', 'potatoes', 'kamote', 'sweet potato', 'ubi', 'purple yam', 'cassava', 'kamoteng kahoy'],
            // Leafy / common veg
            ['repolyo', 'repollo', 'cabbage', 'pechay', 'petsay', 'bok choy', 'kangkong', 'kangkung', 'water spinach', 'sitaw', 'string beans', 'green beans', 'okra', 'ladies finger', 'talong', 'eggplant', 'ampalaya', 'bitter gourd', 'kalabasa', 'squash', 'pumpkin', 'labanos', 'radish', 'singkamas', 'jicama', 'carrots', 'carrot'],
            // Chicken
            ['manok', 'chicken', 'chicken meat', 'whole chicken', 'dress chicken', 'lechon manok'],
            // Pork
            ['baboy', 'pork', 'liempo', 'pork belly', 'kasim', 'pork chop', 'pigue', 'menudo cut', 'adobo cut'],
            // Beef
            ['baka', 'beef', 'karne', 'karne nga baka', 'ground beef', 'burger patty'],
            // Shrimp & shellfish
            ['hipon', 'shrimp', 'prawn', 'suahe', 'alimango', 'crab', 'alimasag', 'mussel', 'tahong', 'shellfish'],
            // Squid & octopus
            ['pusit', 'squid', 'calamari', 'octopus', 'pugita'],
            // Noodles & pasta
            ['pansit', 'pancit', 'noodles', 'instant noodles', 'lucky me', 'payless', 'nissin', 'indomie', 'cup noodles', 'spaghetti', 'macaroni', 'pasta', 'sotanghon', 'bihon', 'misua'],
            // Coffee & tea
            ['kape', 'coffee', 'instant coffee', '3 in 1', 'barako', 'espresso', 'tsaa', 'tea', 'iced tea', 'milo', 'chocolate drink', 'cocoa'],
            // Water & drinks
            ['tubig', 'water', 'mineral water', 'distilled water', 'juice', 'softdrinks', 'soda', 'coke', 'sprite', 'royal'],
            // Canned fish / meat
            ['sardinas', 'sardines', 'corned beef', 'cornbeef', 'luncheon meat', 'spam', 'meat loaf', 'tuna', 'tuna flakes'],
            // Corn
            ['mais', 'corn', 'sweet corn', 'corn on cob', 'corn grits', 'cornmeal'],
            // Banana
            ['saging', 'banana', 'lacatan', 'latundan', 'saba', 'plantain', 'cardava'],
            // Coconut
            ['lubi', 'nyog', 'niyog', 'coconut', 'buko', 'gata', 'coconut milk', 'coconut cream', 'desiccated coconut'],
            // Cooking fuel
            ['lpg', 'gasul', 'gasoline', 'petrol', 'diesel', 'kerosene', 'gasera', 'fuel'],
            // Flour & baking
            ['harina', 'flour', 'all purpose flour', 'cake flour', 'bread flour', 'cornstarch', 'baking powder', 'yeast', 'shortening'],
            // Dried fish & preserved
            ['bulad', 'buwad', 'tuyo', 'dried fish', 'daing', 'danggit', 'tinapa', 'smoked fish'],
            // Tofu & soy
            ['tokwa', 'tofu', 'bean curd', 'soy sauce', 'toyo', 'suka', 'vinegar', 'patis', 'fish sauce', 'bagoong', 'shrimp paste'],
            // Milk & dairy
            ['gatas', 'milk', 'evaporated milk', 'condensed milk', 'powdered milk', 'cheese', 'keso', 'yogurt', 'butter milk'],
            // Household basics
            ['sabon', 'soap', 'laundry soap', 'detergent', 'surf', 'tide', 'bleach', 'chlorox', 'toilet paper', 'tissue', 'napkin'],
            ['posporo', 'matches', 'match', 'lighter'],
            ['kandila', 'candle', 'candles', 'vela'],
            ['baterya', 'battery', 'batteries', 'aa battery', 'aaa battery'],
            ['uling', 'charcoal', 'charcoal briquette', 'wood charcoal'],
        ];

        DB::transaction(function () use ($groups) {
            foreach ($groups as $terms) {
                $clean = collect($terms)
                    ->map(fn (string $t) => trim($t))
                    ->filter()
                    ->unique(fn (string $t) => mb_strtolower($t, 'UTF-8'))
                    ->values()
                    ->all();
                if (count($clean) < 2) {
                    continue;
                }
                $g = SearchSynonymGroup::query()->create(['type' => SearchSynonymGroup::TYPE_PRODUCT]);
                foreach ($clean as $t) {
                    if (mb_strlen($t, 'UTF-8') > 120) {
                        $t = mb_substr($t, 0, 120, 'UTF-8');
                    }
                    $g->terms()->create(['term' => $t]);
                }
            }
        });
    }
}
