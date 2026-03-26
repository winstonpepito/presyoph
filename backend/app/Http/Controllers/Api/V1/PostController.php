<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PricePostResource;
use App\Models\Establishment;
use App\Models\PricePost;
use App\Models\Product;
use App\Models\User;
use App\Http\Support\OptionalSanctum;
use App\Services\PostQueryService;
use App\Services\SettingsService;
use App\Models\ProductUnit;
use App\Support\Slugify;
use App\Support\TextCase;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PostController extends Controller
{
    public function __construct(
        private PostQueryService $posts,
        private SettingsService $settings,
    ) {}

    public function index(Request $request): \Illuminate\Http\JsonResponse
    {
        $lat = $request->query('lat');
        $lng = $request->query('lng');
        $radiusKm = (float) ($request->query('radiusKm', 50) ?: 50) ?: 50;
        $productSlug = $request->query('productSlug');
        $categorySlug = $request->query('categorySlug');
        $following = $request->query('following') === '1';
        $limit = min((int) ($request->query('limit', 40) ?: 40) ?: 40, 100);
        $qRaw = $request->query('q');
        $qTrimmed = is_string($qRaw) ? trim($qRaw) : '';
        $keyword = $qTrimmed !== '' ? Str::limit($qTrimmed, 200, '') : null;

        $latN = $lat !== null && $lat !== '' ? (float) $lat : null;
        $lngN = $lng !== null && $lng !== '' ? (float) $lng : null;

        if ($productSlug) {
            $product = Product::query()->where('slug', $productSlug)->first();
            if (! $product) {
                return response()->json(['posts' => []]);
            }
            $list = $this->posts->bestPricesForProduct($product->id, $latN, $lngN, $radiusKm, $limit);
        } elseif ($categorySlug) {
            $cat = \App\Models\Category::query()->where('slug', $categorySlug)->first();
            if (! $cat) {
                return response()->json(['posts' => []]);
            }
            $list = $this->posts->bestPricesForCategory($cat->id, $latN, $lngN, $radiusKm, $limit);
        } else {
            $followingUserIds = null;
            if ($following) {
                $uid = $this->optionalSanctumUserId($request);
                if ($uid) {
                    $followingUserIds = \App\Models\Follow::query()
                        ->where('follower_id', $uid)
                        ->pluck('following_id')
                        ->all();
                } else {
                    $followingUserIds = [];
                }
            }
            $list = $this->posts->listRecentPosts($latN, $lngN, $radiusKm, $limit, $followingUserIds, $keyword);
        }

        return response()->json([
            'posts' => PricePostResource::collection($list)->resolve(),
        ]);
    }

    public function store(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->all();
        if (($data['categoryId'] ?? null) === '' || ($data['categoryId'] ?? null) === null) {
            $data['categoryId'] = null;
        }
        $request->merge($data);

        $unitCodes = ProductUnit::allCodes();
        if ($unitCodes === []) {
            return response()->json(['error' => 'No product units configured. Add units in admin.'], 503);
        }

        $validated = $request->validate([
            'categoryId' => ['sometimes', 'nullable', 'string', 'exists:categories,id'],
            'productName' => ['required', 'string', 'max:200'],
            'establishmentName' => ['required', 'string', 'max:200'],
            'establishmentAddress' => ['nullable', 'string', 'max:500'],
            'establishmentBarangay' => ['nullable', 'string', 'max:200'],
            'establishmentCity' => ['nullable', 'string', 'max:200'],
            'priceMode' => ['required', 'in:exact,range'],
            'priceExact' => ['nullable', 'string'],
            'priceMin' => ['nullable', 'string'],
            'priceMax' => ['nullable', 'string'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'locationLabel' => ['nullable', 'string', 'max:300'],
            'anonymous' => ['sometimes', 'boolean'],
            'unit' => ['sometimes', 'nullable', 'string', Rule::in($unitCodes)],
            'unitQuantity' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'productBrand' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $anonAllowed = $this->settings->anonymousPostingEnabled();
        $authUser = OptionalSanctum::user($request);
        $requestedAnonymous = filter_var($request->input('anonymous', false), FILTER_VALIDATE_BOOLEAN);

        if ($authUser === null) {
            if (! $anonAllowed) {
                return response()->json(['error' => 'Anonymous posting is disabled. Sign in to post with your profile.'], 401);
            }
            $anonymous = true;
        } else {
            if ($requestedAnonymous && ! $anonAllowed) {
                return response()->json(['error' => 'Anonymous posting is disabled by an administrator.'], 422);
            }
            $anonymous = $requestedAnonymous && $anonAllowed;
        }

        if ($validated['priceMode'] === 'exact') {
            $n = (float) ($validated['priceExact'] ?? '');
            if ($validated['priceExact'] === null || $validated['priceExact'] === '' || $n < 0 || is_nan($n)) {
                return response()->json(['error' => 'Valid exact price required'], 422);
            }
        } else {
            $min = (float) ($validated['priceMin'] ?? '');
            $max = (float) ($validated['priceMax'] ?? '');
            if (
                $validated['priceMin'] === null || $validated['priceMin'] === ''
                || $validated['priceMax'] === null || $validated['priceMax'] === ''
                || $min < 0 || $max < 0 || $min > $max || is_nan($min) || is_nan($max)
            ) {
                return response()->json(['error' => 'Valid min/max range required'], 422);
            }
        }

        $categoryId = isset($validated['categoryId']) && $validated['categoryId'] !== null && $validated['categoryId'] !== ''
            ? (int) $validated['categoryId']
            : null;
        $unit = isset($validated['unit']) && $validated['unit'] !== '' && $validated['unit'] !== null
            ? $validated['unit']
            : 'pcs';
        $unitQtyStr = isset($validated['unitQuantity']) && $validated['unitQuantity'] !== '' && $validated['unitQuantity'] !== null
            ? (string) $validated['unitQuantity']
            : '1';

        $brandTrim = isset($validated['productBrand']) ? trim((string) $validated['productBrand']) : '';
        $brand = $brandTrim !== '' ? TextCase::sentenceCase($brandTrim) : null;

        $productName = TextCase::sentenceCase($validated['productName']);
        $establishmentName = TextCase::sentenceCase($validated['establishmentName']);

        $baseSlug = Slugify::slugify($productName);
        if ($brand !== null) {
            $brandSlug = Slugify::slugify($brand);
            if ($brandSlug !== '') {
                $baseSlug = $baseSlug.'-'.$brandSlug;
            }
        }
        $slug = Slugify::uniqueProductSlug($baseSlug, fn (string $s) => Product::query()->where('slug', $s)->exists());

        $product = Product::query()->updateOrCreate(
            ['slug' => $slug],
            [
                'name' => $productName,
                'brand' => $brand,
                'category_id' => $categoryId,
                'unit' => $unit,
                'unit_quantity' => $unitQtyStr,
            ],
        );

        $estSlug = Slugify::uniqueEstablishmentSlug(
            Slugify::slugify($establishmentName),
            fn (string $s) => Establishment::query()->where('slug', $s)->exists(),
        );

        $establishment = Establishment::query()->updateOrCreate(
            ['slug' => $estSlug],
            [
                'name' => $establishmentName,
                'address_line' => isset($validated['establishmentAddress']) ? trim((string) $validated['establishmentAddress']) ?: null : null,
                'barangay' => isset($validated['establishmentBarangay']) ? trim((string) $validated['establishmentBarangay']) ?: null : null,
                'city' => isset($validated['establishmentCity']) ? trim((string) $validated['establishmentCity']) ?: null : null,
                'latitude' => (float) $validated['latitude'],
                'longitude' => (float) $validated['longitude'],
            ],
        );

        $userId = $anonymous ? null : $authUser->id;

        $row = new PricePost([
            'product_id' => $product->id,
            'establishment_id' => $establishment->id,
            'user_id' => $userId,
            'anonymous' => $anonymous,
            'latitude' => (float) $validated['latitude'],
            'longitude' => (float) $validated['longitude'],
            'location_label' => isset($validated['locationLabel']) ? trim((string) $validated['locationLabel']) ?: null : null,
            'price_exact' => null,
            'price_min' => null,
            'price_max' => null,
            'unit' => $unit,
            'unit_quantity' => $unitQtyStr,
        ]);

        if ($validated['priceMode'] === 'exact') {
            $row->price_exact = $validated['priceExact'];
        } else {
            $row->price_min = $validated['priceMin'];
            $row->price_max = $validated['priceMax'];
        }
        $row->save();

        return response()->json(['ok' => true]);
    }

    public function update(Request $request, PricePost $post): \Illuminate\Http\JsonResponse
    {
        $post->load(['product.category', 'establishment']);
        $auth = $request->user();
        if (! $this->userCanManagePricePost($auth, $post)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $request->all();
        if (($data['categoryId'] ?? null) === '' || ($data['categoryId'] ?? null) === null) {
            $data['categoryId'] = null;
        }
        $request->merge($data);

        $unitCodes = ProductUnit::allCodes();
        if ($unitCodes === []) {
            return response()->json(['error' => 'No product units configured. Add units in admin.'], 503);
        }

        $validated = $request->validate([
            'categoryId' => ['sometimes', 'nullable', 'string', 'exists:categories,id'],
            'productName' => ['required', 'string', 'max:200'],
            'establishmentName' => ['required', 'string', 'max:200'],
            'establishmentAddress' => ['nullable', 'string', 'max:500'],
            'establishmentBarangay' => ['nullable', 'string', 'max:200'],
            'establishmentCity' => ['nullable', 'string', 'max:200'],
            'priceMode' => ['required', 'in:exact,range'],
            'priceExact' => ['nullable', 'string'],
            'priceMin' => ['nullable', 'string'],
            'priceMax' => ['nullable', 'string'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'locationLabel' => ['nullable', 'string', 'max:300'],
            'unit' => ['sometimes', 'nullable', 'string', Rule::in($unitCodes)],
            'unitQuantity' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'productBrand' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        if ($validated['priceMode'] === 'exact') {
            $n = (float) ($validated['priceExact'] ?? '');
            if ($validated['priceExact'] === null || $validated['priceExact'] === '' || $n < 0 || is_nan($n)) {
                return response()->json(['error' => 'Valid exact price required'], 422);
            }
        } else {
            $min = (float) ($validated['priceMin'] ?? '');
            $max = (float) ($validated['priceMax'] ?? '');
            if (
                $validated['priceMin'] === null || $validated['priceMin'] === ''
                || $validated['priceMax'] === null || $validated['priceMax'] === ''
                || $min < 0 || $max < 0 || $min > $max || is_nan($min) || is_nan($max)
            ) {
                return response()->json(['error' => 'Valid min/max range required'], 422);
            }
        }

        $categoryId = isset($validated['categoryId']) && $validated['categoryId'] !== null && $validated['categoryId'] !== ''
            ? (int) $validated['categoryId']
            : null;
        $unit = isset($validated['unit']) && $validated['unit'] !== '' && $validated['unit'] !== null
            ? $validated['unit']
            : 'pcs';
        $unitQtyStr = isset($validated['unitQuantity']) && $validated['unitQuantity'] !== '' && $validated['unitQuantity'] !== null
            ? (string) $validated['unitQuantity']
            : '1';

        $brandTrim = isset($validated['productBrand']) ? trim((string) $validated['productBrand']) : '';
        $brand = $brandTrim !== '' ? TextCase::sentenceCase($brandTrim) : null;

        $productName = TextCase::sentenceCase($validated['productName']);
        $establishmentName = TextCase::sentenceCase($validated['establishmentName']);

        $product = $post->product;
        $baseSlug = Slugify::slugify($productName);
        if ($brand !== null) {
            $brandSlug = Slugify::slugify($brand);
            if ($brandSlug !== '') {
                $baseSlug = $baseSlug.'-'.$brandSlug;
            }
        }
        $pid = $product->id;
        $slug = Slugify::uniqueProductSlug($baseSlug, fn (string $s) => Product::query()->where('slug', $s)->where('id', '!=', $pid)->exists());

        $product->update([
            'slug' => $slug,
            'name' => $productName,
            'brand' => $brand,
            'category_id' => $categoryId,
            'unit' => $unit,
            'unit_quantity' => $unitQtyStr,
        ]);

        $establishment = $post->establishment;
        $eid = $establishment->id;
        $estSlug = Slugify::uniqueEstablishmentSlug(
            Slugify::slugify($establishmentName),
            fn (string $s) => Establishment::query()->where('slug', $s)->where('id', '!=', $eid)->exists(),
        );

        $establishment->update([
            'slug' => $estSlug,
            'name' => $establishmentName,
            'address_line' => isset($validated['establishmentAddress']) ? trim((string) $validated['establishmentAddress']) ?: null : null,
            'barangay' => isset($validated['establishmentBarangay']) ? trim((string) $validated['establishmentBarangay']) ?: null : null,
            'city' => isset($validated['establishmentCity']) ? trim((string) $validated['establishmentCity']) ?: null : null,
            'latitude' => (float) $validated['latitude'],
            'longitude' => (float) $validated['longitude'],
        ]);

        $post->latitude = (float) $validated['latitude'];
        $post->longitude = (float) $validated['longitude'];
        $post->location_label = isset($validated['locationLabel']) ? trim((string) $validated['locationLabel']) ?: null : null;
        $post->unit = $unit;
        $post->unit_quantity = $unitQtyStr;
        $post->price_exact = null;
        $post->price_min = null;
        $post->price_max = null;
        if ($validated['priceMode'] === 'exact') {
            $post->price_exact = $validated['priceExact'];
        } else {
            $post->price_min = $validated['priceMin'];
            $post->price_max = $validated['priceMax'];
        }
        $post->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request, PricePost $post): \Illuminate\Http\JsonResponse
    {
        $auth = $request->user();
        if (! $this->userCanManagePricePost($auth, $post)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }
        $post->delete();

        return response()->json(['ok' => true]);
    }

    private function userCanManagePricePost(?User $auth, PricePost $post): bool
    {
        if ($auth === null) {
            return false;
        }
        if (($auth->role ?? 'USER') === 'ADMIN') {
            return true;
        }
        if ($post->user_id === null) {
            return false;
        }

        return (int) $post->user_id === (int) $auth->id;
    }

    private function optionalSanctumUserId(Request $request): ?int
    {
        $u = OptionalSanctum::user($request);

        return $u ? (int) $u->getKey() : null;
    }
}
