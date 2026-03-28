<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BannerAd;
use App\Models\Barangay;
use App\Models\Category;
use App\Models\PricePost;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\SearchSynonymGroup;
use App\Models\User;
use App\Services\SettingsService;
use App\Support\Slugify;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function __construct(
        private SettingsService $settings,
    ) {}

    public function state(): JsonResponse
    {
        $anonymousEnabled = $this->settings->anonymousPostingEnabled();
        $strategy = $this->settings->bannerStrategy('home_top');
        $banners = BannerAd::query()
            ->where('slot_key', 'home_top')
            ->orderBy('sort_order')
            ->get();

        $categories = Category::query()
            ->orderBy('name')
            ->get();

        $productUnits = ProductUnit::query()
            ->orderBy('sort_order')
            ->orderBy('code')
            ->get();

        $searchSynonymGroups = SearchSynonymGroup::query()
            ->with('terms')
            ->orderBy('id')
            ->get();

        $today = now()->startOfDay();

        return response()->json([
            'stats' => [
                'totalProducts' => Product::query()->count(),
                'totalUsers' => User::query()->count(),
                'productsAddedToday' => Product::query()->where('created_at', '>=', $today)->count(),
            ],
            'anonymousEnabled' => $anonymousEnabled,
            'homeTopStrategy' => $strategy,
            'banners' => $banners->map(fn (BannerAd $b) => [
                'id' => (string) $b->id,
                'isActive' => (bool) $b->is_active,
                'slotKey' => $b->slot_key,
            ])->all(),
            'categories' => $categories->map(fn (Category $c) => [
                'id' => (string) $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
            ])->all(),
            'productUnits' => $productUnits->map(fn (ProductUnit $u) => [
                'id' => (string) $u->id,
                'code' => $u->code,
                'label' => $u->label,
                'sortOrder' => (int) $u->sort_order,
            ])->all(),
            'searchSynonymGroups' => $searchSynonymGroups->map(fn (SearchSynonymGroup $g) => [
                'id' => (string) $g->id,
                'type' => $g->type,
                'spotlightKey' => $g->spotlight_key,
                'terms' => $g->terms->pluck('term')->map(fn ($t) => (string) $t)->values()->all(),
            ])->all(),
        ]);
    }

    public function flipAnonymous(): JsonResponse
    {
        $enabled = $this->settings->anonymousPostingEnabled();
        $this->settings->setAnonymousPostingEnabled(! $enabled);

        return response()->json(['ok' => true, 'anonymousEnabled' => ! $enabled]);
    }

    public function setHomeTopStrategy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'strategy' => ['required', 'in:STATIC,ROTATE'],
        ]);
        $this->settings->setBannerStrategy('home_top', $data['strategy']);

        return response()->json(['ok' => true]);
    }

    public function createBanner(Request $request): JsonResponse
    {
        // Multipart fields often arrive as "" (API group has no ConvertEmptyStringsToNull).
        $request->merge([
            'href' => $this->nullIfEmptyString($request->input('href')),
            'alt' => $this->nullIfEmptyString($request->input('alt')),
            'validFrom' => $this->nullIfEmptyString($request->input('validFrom')),
            'validTo' => $this->nullIfEmptyString($request->input('validTo')),
            'sortOrder' => $this->nullIfEmptyString($request->input('sortOrder')),
        ]);

        $v = $request->validate([
            'slotKey' => ['required', 'string', 'max:64'],
            // Use mimetypes (file content), not the `image` rule (extension-based guessExtension often fails for
            // camera uploads with odd/missing filenames).
            'image' => ['required', 'file', 'max:5120', 'mimetypes:image/jpeg,image/png,image/gif,image/webp'],
            'href' => ['nullable', 'string', 'max:2000'],
            'alt' => ['nullable', 'string', 'max:300'],
            'sortOrder' => ['nullable', 'integer'],
            'validFrom' => ['nullable', 'date'],
            'validTo' => ['nullable', 'date'],
        ]);

        try {
            $path = $request->file('image')->store('banner-uploads', 'public');
            if ($path === false || $path === '') {
                throw new \RuntimeException('Storage returned an empty path.');
            }
        } catch (\Throwable $e) {
            Log::error('Banner image store failed', [
                'message' => $e->getMessage(),
                'exception' => $e::class,
            ]);

            return response()->json([
                'message' => 'Could not save the image. Check PHP upload limits (upload_max_filesize, post_max_size), web server body size, and storage/app/public permissions.',
            ], 500);
        }

        BannerAd::query()->create([
            'slot_key' => $v['slotKey'],
            'image_url' => $path,
            'href' => $v['href'] ?? '',
            'alt' => $v['alt'] ?? '',
            'sort_order' => $v['sortOrder'] ?? 0,
            'valid_from' => isset($v['validFrom']) ? $v['validFrom'] : null,
            'valid_to' => isset($v['validTo']) ? $v['validTo'] : null,
        ]);

        return response()->json(['ok' => true]);
    }

    private function nullIfEmptyString(mixed $value): mixed
    {
        return $value === '' ? null : $value;
    }

    public function toggleBanner(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'isActive' => ['required', 'boolean'],
        ]);
        $b = BannerAd::query()->findOrFail((int) $id);
        $b->is_active = $data['isActive'];
        $b->save();

        return response()->json(['ok' => true]);
    }

    public function deleteBanner(string $id): JsonResponse
    {
        $b = BannerAd::query()->find((int) $id);
        if ($b) {
            $stored = $b->image_url ?? '';
            if ($stored !== '' && ! preg_match('#^https?://#i', $stored)) {
                Storage::disk('public')->delete($stored);
            }
            $b->delete();
        }

        return response()->json(['ok' => true]);
    }

    public function storeBarangay(Request $request): JsonResponse
    {
        $v = $request->validate([
            'cityId' => ['required', 'string', 'exists:cities,id'],
            'name' => [
                'required',
                'string',
                'max:200',
                Rule::unique('barangays', 'name')->where(
                    fn ($q) => $q->where('city_id', (int) $request->input('cityId')),
                ),
            ],
        ]);

        $cityId = (int) $v['cityId'];
        $name = trim($v['name']);
        Barangay::query()->create([
            'city_id' => $cityId,
            'name' => $name,
            'sort_order' => (int) (Barangay::query()->where('city_id', $cityId)->max('sort_order') ?? 0) + 1,
        ]);

        return response()->json(['ok' => true]);
    }

    public function deleteBarangay(string $id): JsonResponse
    {
        Barangay::query()->whereKey((int) $id)->delete();

        return response()->json(['ok' => true]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:120'],
        ]);
        $name = trim($v['name']);
        $slug = Slugify::uniqueCategorySlug(
            $name,
            fn (string $s) => Category::query()->where('slug', $s)->exists(),
        );
        Category::query()->create([
            'name' => $name,
            'slug' => $slug,
        ]);

        return response()->json(['ok' => true]);
    }

    public function updateCategory(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:120'],
        ]);
        $cat = Category::query()->findOrFail((int) $id);
        $name = trim($v['name']);
        if ($name === $cat->name) {
            return response()->json(['ok' => true]);
        }
        $slug = Slugify::uniqueCategorySlug(
            $name,
            fn (string $s) => Category::query()->where('slug', $s)->where('id', '!=', $cat->id)->exists(),
        );
        $cat->update([
            'name' => $name,
            'slug' => $slug,
        ]);

        return response()->json(['ok' => true]);
    }

    public function deleteCategory(string $id): JsonResponse
    {
        $cid = (int) $id;
        if (Product::query()->where('category_id', $cid)->exists()) {
            return response()->json([
                'error' => 'This category still has products. Reassign or remove those products first.',
            ], 422);
        }
        Category::query()->whereKey($cid)->delete();

        return response()->json(['ok' => true]);
    }

    public function storeProductUnit(Request $request): JsonResponse
    {
        $v = $request->validate([
            'code' => [
                'required',
                'string',
                'max:32',
                'regex:/^[a-zA-Z][a-zA-Z0-9_-]{0,30}$/',
                Rule::unique('product_units', 'code'),
            ],
            'label' => ['required', 'string', 'max:120'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:32767'],
        ]);
        $maxOrder = (int) (ProductUnit::query()->max('sort_order') ?? 0);
        $sort = isset($v['sortOrder']) ? (int) $v['sortOrder'] : $maxOrder + 10;
        ProductUnit::query()->create([
            'code' => $v['code'],
            'label' => trim($v['label']),
            'sort_order' => $sort,
        ]);

        return response()->json(['ok' => true]);
    }

    public function updateProductUnit(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'label' => ['sometimes', 'required', 'string', 'max:120'],
            'sortOrder' => ['sometimes', 'required', 'integer', 'min:0', 'max:32767'],
        ]);
        $u = ProductUnit::query()->findOrFail((int) $id);
        if (array_key_exists('label', $v)) {
            $u->label = trim($v['label']);
        }
        if (array_key_exists('sortOrder', $v)) {
            $u->sort_order = (int) $v['sortOrder'];
        }
        $u->save();

        return response()->json(['ok' => true]);
    }

    public function deleteProductUnit(string $id): JsonResponse
    {
        $u = ProductUnit::query()->findOrFail((int) $id);
        if (ProductUnit::query()->count() <= 1) {
            return response()->json(['error' => 'At least one unit must remain.'], 422);
        }
        if (Product::query()->where('unit', $u->code)->exists()
            || PricePost::query()->where('unit', $u->code)->exists()) {
            return response()->json([
                'error' => 'This unit is still used on products or price posts.',
            ], 422);
        }
        $u->delete();

        return response()->json(['ok' => true]);
    }

    public function storeSearchSynonymGroup(Request $request): JsonResponse
    {
        $v = $request->validate([
            'type' => ['required', 'in:product,area'],
            'terms' => ['required', 'array', 'min:1', 'max:40'],
            'terms.*' => ['required', 'string', 'max:120'],
            'spotlightKey' => ['sometimes', 'nullable', 'string', Rule::in(SearchSynonymGroup::SPOTLIGHT_KEYS)],
        ]);
        $terms = collect($v['terms'])->map(fn ($t) => trim((string) $t))->filter()->unique()->values()->all();
        if ($terms === []) {
            return response()->json(['error' => 'Add at least one non-empty term.'], 422);
        }

        $spotlightKey = $v['spotlightKey'] ?? null;
        if ($spotlightKey !== null && $v['type'] !== SearchSynonymGroup::TYPE_PRODUCT) {
            return response()->json(['error' => 'Home spotlight applies only to product synonym groups.'], 422);
        }

        DB::transaction(function () use ($v, $terms, $spotlightKey) {
            $g = SearchSynonymGroup::query()->create([
                'type' => $v['type'],
                'spotlight_key' => $spotlightKey,
            ]);
            foreach ($terms as $t) {
                $g->terms()->create(['term' => $t]);
            }
        });

        return response()->json(['ok' => true]);
    }

    public function updateSearchSynonymGroup(Request $request, string $id): JsonResponse
    {
        $g = SearchSynonymGroup::query()->findOrFail((int) $id);
        $v = $request->validate([
            'terms' => ['required', 'array', 'min:1', 'max:40'],
            'terms.*' => ['required', 'string', 'max:120'],
            'spotlightKey' => ['sometimes', 'nullable', 'string', Rule::in(SearchSynonymGroup::SPOTLIGHT_KEYS)],
        ]);
        $terms = collect($v['terms'])->map(fn ($t) => trim((string) $t))->filter()->unique()->values()->all();
        if ($terms === []) {
            return response()->json(['error' => 'Add at least one non-empty term.'], 422);
        }

        $spotlightKey = array_key_exists('spotlightKey', $v) ? ($v['spotlightKey'] ?? null) : $g->spotlight_key;
        if ($spotlightKey !== null && $g->type !== SearchSynonymGroup::TYPE_PRODUCT) {
            return response()->json(['error' => 'Home spotlight applies only to product synonym groups.'], 422);
        }

        DB::transaction(function () use ($g, $terms, $spotlightKey) {
            $g->spotlight_key = $spotlightKey;
            $g->save();
            $g->terms()->delete();
            foreach ($terms as $t) {
                $g->terms()->create(['term' => $t]);
            }
        });

        return response()->json(['ok' => true]);
    }

    public function deleteSearchSynonymGroup(string $id): JsonResponse
    {
        SearchSynonymGroup::query()->whereKey((int) $id)->delete();

        return response()->json(['ok' => true]);
    }
}
