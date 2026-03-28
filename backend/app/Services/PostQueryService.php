<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Establishment;
use App\Models\PricePost;
use App\Models\Product;
use App\Models\SearchSynonymGroup;
use App\Support\Geo;
use App\Support\Pricing;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class PostQueryService
{
    /** Max rows considered per entity type before sort + slice (search pagination). */
    private const SEARCH_CATALOG_CAP = 400;

    /** Recent posts pulled from DB before geo/area filter and sort (home feed pagination). */
    private const HOME_FEED_POOL_CAP = 500;

    public function __construct(
        private SearchSynonymService $searchSynonyms,
    ) {}

    private function baseWith(): array
    {
        return [
            'product.category',
            'establishment',
            'user:id,name,image',
        ];
    }

    /**
     * @param  list<int>|null  $followingUserIds
     * @return array{items: Collection<int, PricePost>, total: int}
     */
    public function listRecentPosts(
        ?float $lat,
        ?float $lng,
        float $radiusKm = 50,
        int $limit = 50,
        ?array $followingUserIds = null,
        ?string $keyword = null,
        ?string $areaKeyword = null,
        int $offset = 0,
    ): array {
        if ($followingUserIds !== null) {
            if ($followingUserIds === []) {
                return ['items' => collect(), 'total' => 0];
            }

            return $this->listPostsFromFollowedUsers($followingUserIds, $limit, $keyword, $areaKeyword, $offset);
        }

        $term = $keyword !== null ? trim($keyword) : '';
        $productNeedles = $term !== ''
            ? $this->searchSynonyms->expandTerms($term, SearchSynonymGroup::TYPE_PRODUCT)
            : [];
        $hasProductFilter = $productNeedles !== [];

        $areaNeedles = $this->resolveAreaSearchNeedles($areaKeyword);

        $posts = PricePost::query()
            ->with($this->baseWith())
            ->when($hasProductFilter, function (Builder $query) use ($productNeedles) {
                $this->applyProductNeedlesToPricePostQuery($query, $productNeedles);
            })
            ->orderByDesc('created_at')
            ->limit(self::HOME_FEED_POOL_CAP)
            ->get();

        $filtered = $posts;
        if ($lat !== null && $lng !== null && ! is_nan($lat) && ! is_nan($lng)) {
            $filtered = $filtered->filter(function (PricePost $p) use ($lat, $lng, $radiusKm) {
                return Geo::distanceKm($lat, $lng, (float) $p->latitude, (float) $p->longitude) <= $radiusKm;
            });
        }

        if ($areaNeedles !== []) {
            $filtered = $filtered->filter(function (PricePost $p) use ($areaNeedles) {
                return $this->establishmentMatchesAreaNeedles($p->establishment, $areaNeedles);
            });
        }

        // Keyword / filter: newest first, then cheapest. Default feed: cheapest first, then newest.
        $sorted = $filtered->sortBy(function (PricePost $p) use ($hasProductFilter) {
            $amount = Pricing::comparablePrice(
                $p->price_exact !== null ? (string) $p->price_exact : null,
                $p->price_min !== null ? (string) $p->price_min : null,
                $p->price_max !== null ? (string) $p->price_max : null,
            );
            $recency = -($p->created_at?->timestamp ?? 0);

            return $hasProductFilter ? [$recency, $amount] : [$amount, $recency];
        })->values();

        $total = $sorted->count();
        $page = $sorted->slice($offset, $limit)->values();

        return ['items' => $page, 'total' => $total];
    }

    /**
     * @return list<string>
     */
    private function resolveAreaSearchNeedles(?string $areaKeyword): array
    {
        if ($areaKeyword === null) {
            return [];
        }
        $raw = trim($areaKeyword);
        if ($raw === '') {
            return [];
        }
        if (mb_strtolower($raw, 'UTF-8') === 'current location') {
            return [];
        }

        return $this->searchSynonyms->expandTerms($raw, SearchSynonymGroup::TYPE_AREA);
    }

    /**
     * @param  list<string>  $needles
     * @return list<string>
     */
    private function normalizeSearchNeedles(array $needles): array
    {
        $clean = [];
        foreach ($needles as $raw) {
            $n = mb_strtolower(trim((string) $raw), 'UTF-8');
            if ($n !== '') {
                $clean[] = $n;
            }
        }

        return $clean;
    }

    /**
     * Match products whose name, brand, or category name contains any needle (substring, case-insensitive).
     * Used by the home feed and the /search catalog.
     *
     * @param  list<string>  $needles
     */
    private function applyProductNeedlesToProductBuilder(Builder $productQuery, array $needles): void
    {
        $clean = $this->normalizeSearchNeedles($needles);
        if ($clean === []) {
            return;
        }

        $productQuery->where(function (Builder $wrap) use ($clean) {
            foreach ($clean as $i => $n) {
                $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $n).'%';
                $group = function (Builder $inner) use ($like) {
                    $inner->whereRaw('LOWER(products.name) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(COALESCE(products.brand, \'\')) LIKE ?', [$like])
                        ->orWhereHas('category', function (Builder $cq) use ($like) {
                            $cq->whereRaw('LOWER(categories.name) LIKE ?', [$like]);
                        });
                };
                if ($i === 0) {
                    $wrap->where($group);
                } else {
                    $wrap->orWhere($group);
                }
            }
        });
    }

    /**
     * Categories whose name matches any needle (same expansion as home product filter).
     *
     * @param  list<string>  $needles
     */
    private function applyCategoryNameNeedlesToQuery(Builder $categoryQuery, array $needles): void
    {
        $clean = $this->normalizeSearchNeedles($needles);
        if ($clean === []) {
            return;
        }

        $categoryQuery->where(function (Builder $wrap) use ($clean) {
            foreach ($clean as $i => $n) {
                $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $n).'%';
                if ($i === 0) {
                    $wrap->whereRaw('LOWER(categories.name) LIKE ?', [$like]);
                } else {
                    $wrap->orWhereRaw('LOWER(categories.name) LIKE ?', [$like]);
                }
            }
        });
    }

    /**
     * @param  list<string>  $needles
     */
    private function applyProductNeedlesToPricePostQuery(Builder $query, array $needles): void
    {
        $query->whereHas('product', function (Builder $pq) use ($needles) {
            $this->applyProductNeedlesToProductBuilder($pq, $needles);
        });
    }

    /**
     * @param  list<string>  $needles
     */
    private function establishmentMatchesAreaNeedles(?Establishment $est, array $needles): bool
    {
        if ($est === null) {
            return false;
        }
        $hay = mb_strtolower(
            trim(
                ($est->name ?? '').' '.
                ($est->city ?? '').' '.
                ($est->barangay ?? '').' '.
                ($est->address_line ?? ''),
            ),
            'UTF-8',
        );
        foreach ($needles as $n) {
            $n = mb_strtolower(trim((string) $n), 'UTF-8');
            if ($n !== '' && str_contains($hay, $n)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Recent posts from specific users (following feed). No geo radius — shows posts anywhere so followers can see activity.
     *
     * @param  list<int>  $followingUserIds
     * @return array{items: Collection<int, PricePost>, total: int}
     */
    private function listPostsFromFollowedUsers(
        array $followingUserIds,
        int $limit,
        ?string $keyword,
        ?string $areaKeyword = null,
        int $offset = 0,
    ): array {
        $term = $keyword !== null ? trim($keyword) : '';
        $productNeedles = $term !== ''
            ? $this->searchSynonyms->expandTerms($term, SearchSynonymGroup::TYPE_PRODUCT)
            : [];
        $hasProductFilter = $productNeedles !== [];
        $areaNeedles = $this->resolveAreaSearchNeedles($areaKeyword);

        $ids = array_values(array_unique(array_map(intval(...), $followingUserIds)));

        $posts = PricePost::query()
            ->with($this->baseWith())
            ->whereIn('user_id', $ids)
            ->when($hasProductFilter, function (Builder $query) use ($productNeedles) {
                $this->applyProductNeedlesToPricePostQuery($query, $productNeedles);
            })
            ->orderByDesc('created_at')
            ->limit(self::HOME_FEED_POOL_CAP)
            ->get();

        if ($areaNeedles !== []) {
            $posts = $posts->filter(function (PricePost $p) use ($areaNeedles) {
                return $this->establishmentMatchesAreaNeedles($p->establishment, $areaNeedles);
            })->values();
        }

        $sorted = ! $hasProductFilter
            ? $posts->values()
            : $posts
                ->sortBy(function (PricePost $p) {
                    $amount = Pricing::comparablePrice(
                        $p->price_exact !== null ? (string) $p->price_exact : null,
                        $p->price_min !== null ? (string) $p->price_min : null,
                        $p->price_max !== null ? (string) $p->price_max : null,
                    );
                    $recency = -($p->created_at?->timestamp ?? 0);

                    return [$recency, $amount];
                })
                ->values();

        $total = $sorted->count();
        $page = $sorted->slice($offset, $limit)->values();

        return ['items' => $page, 'total' => $total];
    }

    /**
     * @return array{items: Collection<int, PricePost>, total: int}
     */
    public function bestPricesForProduct(
        int $productId,
        ?float $lat,
        ?float $lng,
        float $radiusKm = 100,
        int $limit = 30,
        int $offset = 0,
    ): array {
        $posts = PricePost::query()
            ->where('product_id', $productId)
            ->with($this->baseWith())
            ->get();

        return $this->filterRadiusSortBest($posts, $lat, $lng, $radiusKm, $limit, $offset);
    }

    /**
     * @return array{items: Collection<int, PricePost>, total: int}
     */
    public function bestPricesForCategory(
        int $categoryId,
        ?float $lat,
        ?float $lng,
        float $radiusKm = 100,
        int $limit = 40,
        int $offset = 0,
    ): array {
        $posts = PricePost::query()
            ->whereHas('product', fn (Builder $q) => $q->where('category_id', $categoryId))
            ->with($this->baseWith())
            ->get();

        return $this->filterRadiusSortBest($posts, $lat, $lng, $radiusKm, $limit, $offset);
    }

    /**
     * @return Collection<int, PricePost>
     */
    public function postsForEstablishment(
        int $establishmentId,
        ?float $lat,
        ?float $lng,
        float $radiusKm = 100,
        int $limit = 40,
    ): Collection {
        $posts = PricePost::query()
            ->where('establishment_id', $establishmentId)
            ->with($this->baseWith())
            ->orderByDesc('created_at')
            ->limit($limit * 2)
            ->get();

        if ($lat === null || $lng === null) {
            return $posts->take($limit)->values();
        }

        $filtered = $posts->filter(function (PricePost $p) use ($lat, $lng, $radiusKm) {
            return Geo::distanceKm($lat, $lng, (float) $p->latitude, (float) $p->longitude) <= $radiusKm;
        });

        return $filtered->take($limit)->values();
    }

    /**
     * @param  Collection<int, PricePost>  $posts
     * @return array{items: Collection<int, PricePost>, total: int}
     */
    private function filterRadiusSortBest(
        Collection $posts,
        ?float $lat,
        ?float $lng,
        float $radiusKm,
        int $limit,
        int $offset = 0,
    ): array {
        if ($lat !== null && $lng !== null) {
            $posts = $posts->filter(function (PricePost $p) use ($lat, $lng, $radiusKm) {
                return Geo::distanceKm($lat, $lng, (float) $p->latitude, (float) $p->longitude) <= $radiusKm;
            });
        }
        $sorted = $posts->sortBy(function (PricePost $p) {
            return Pricing::comparablePrice(
                $p->price_exact !== null ? (string) $p->price_exact : null,
                $p->price_min !== null ? (string) $p->price_min : null,
                $p->price_max !== null ? (string) $p->price_max : null,
            );
        })->values();

        $total = $sorted->count();
        $page = $sorted->slice($offset, $limit)->values();

        return ['items' => $page, 'total' => $total];
    }

    /**
     * Lowest comparable price, then newest (same tie-break as search product rows).
     *
     * @param  Collection<int, PricePost>  $posts
     */
    private function pickRepresentativePricePost(Collection $posts): ?PricePost
    {
        if ($posts->isEmpty()) {
            return null;
        }

        return $posts->sortBy(function (PricePost $post) {
            return [
                Pricing::comparablePrice(
                    $post->price_exact !== null ? (string) $post->price_exact : null,
                    $post->price_min !== null ? (string) $post->price_min : null,
                    $post->price_max !== null ? (string) $post->price_max : null,
                ),
                -($post->created_at?->timestamp ?? 0),
            ];
        })->first();
    }

    /**
     * @return array{
     *     brand: ?string,
     *     productName: ?string,
     *     productSlug: ?string,
     *     unit: ?string,
     *     unitQuantity: ?string,
     *     priceExact: ?string,
     *     priceMin: ?string,
     *     priceMax: ?string,
     *     establishment: array<string, mixed>|null
     * }
     */
    private function searchSampleFromPricePost(?PricePost $post): array
    {
        if ($post === null) {
            return [
                'brand' => null,
                'productName' => null,
                'productSlug' => null,
                'unit' => null,
                'unitQuantity' => null,
                'priceExact' => null,
                'priceMin' => null,
                'priceMax' => null,
                'establishment' => null,
            ];
        }

        $pr = $post->product;
        $est = $post->establishment;
        $unit = $post->unit ?? $pr->unit;
        $uq = $post->unit_quantity ?? $pr->unit_quantity;

        return [
            'brand' => $pr->brand !== null && $pr->brand !== '' ? $pr->brand : null,
            'productName' => $pr->name,
            'productSlug' => $pr->slug,
            'unit' => $unit,
            'unitQuantity' => $uq !== null && $uq !== '' ? (string) $uq : null,
            'priceExact' => $post->price_exact !== null ? (string) $post->price_exact : null,
            'priceMin' => $post->price_min !== null ? (string) $post->price_min : null,
            'priceMax' => $post->price_max !== null ? (string) $post->price_max : null,
            'establishment' => $est !== null ? [
                'id' => (string) $est->id,
                'name' => $est->name,
                'slug' => $est->slug,
                'addressLine' => $est->address_line,
                'barangay' => $est->barangay,
                'city' => $est->city,
            ] : null,
        ];
    }

    /**
     * @param  array{
     *     categoriesOffset?: int,
     *     categoriesLimit?: int,
     *     productsOffset?: int,
     *     productsLimit?: int,
     *     establishmentsOffset?: int,
     *     establishmentsLimit?: int,
     * }  $page
     * @return array{categories: array, products: array, establishments: array, meta: array<string, mixed>}
     */
    public function searchProductsAndCategories(string $q, array $page = []): array
    {
        $co = max(0, (int) ($page['categoriesOffset'] ?? 0));
        $cl = max(0, min(50, (int) ($page['categoriesLimit'] ?? 15)));
        $po = max(0, (int) ($page['productsOffset'] ?? 0));
        $pl = max(0, min(50, (int) ($page['productsLimit'] ?? 20)));
        $eo = max(0, (int) ($page['establishmentsOffset'] ?? 0));
        $el = max(0, min(50, (int) ($page['establishmentsLimit'] ?? 15)));

        $emptyMeta = fn (int $off, int $lim) => [
            'total' => 0,
            'offset' => $off,
            'limit' => $lim,
            'hasMore' => false,
        ];

        $term = trim($q);
        if ($term === '') {
            return [
                'categories' => [],
                'products' => [],
                'establishments' => [],
                'meta' => [
                    'categories' => $emptyMeta($co, $cl),
                    'products' => $emptyMeta($po, $pl),
                    'establishments' => $emptyMeta($eo, $el),
                ],
            ];
        }

        $productNeedles = $this->searchSynonyms->expandTerms($term, SearchSynonymGroup::TYPE_PRODUCT);

        $categories = Category::query()
            ->where(function (Builder $cq) use ($productNeedles) {
                $this->applyCategoryNameNeedlesToQuery($cq, $productNeedles);
            })
            ->limit(self::SEARCH_CATALOG_CAP)
            ->get();

        $products = Product::query()
            ->with('category')
            ->where(function (Builder $pq) use ($productNeedles) {
                $this->applyProductNeedlesToProductBuilder($pq, $productNeedles);
            })
            ->limit(self::SEARCH_CATALOG_CAP)
            ->get();

        $productIds = $products->pluck('id')->all();
        $cheapestByProductId = [];
        $latestTsByProductId = [];
        /** @var array<int, PricePost|null> */
        $bestPostByProductId = [];
        if ($productIds !== []) {
            $priceRows = PricePost::query()
                ->with('establishment')
                ->whereIn('product_id', $productIds)
                ->get(['product_id', 'price_exact', 'price_min', 'price_max', 'created_at', 'establishment_id']);
            foreach ($priceRows->groupBy('product_id') as $pid => $rows) {
                $pidInt = (int) $pid;
                $cheapestByProductId[$pidInt] = $rows
                    ->map(fn (PricePost $row) => Pricing::comparablePrice(
                        $row->price_exact !== null ? (string) $row->price_exact : null,
                        $row->price_min !== null ? (string) $row->price_min : null,
                        $row->price_max !== null ? (string) $row->price_max : null,
                    ))
                    ->min();
                $latestTsByProductId[$pidInt] = $rows
                    ->map(fn (PricePost $row) => $row->created_at?->timestamp ?? 0)
                    ->max() ?? 0;
                $bestPostByProductId[$pidInt] = $this->pickRepresentativePricePost($rows);
            }
        }
        $products = $products->sortBy(function (Product $p) use ($cheapestByProductId, $latestTsByProductId) {
            $low = $cheapestByProductId[$p->id] ?? INF;
            $latest = $latestTsByProductId[$p->id] ?? 0;

            return [-$latest, $low, strtolower($p->name)];
        })->values();

        $establishments = Establishment::query()
            ->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($term).'%'])
            ->limit(self::SEARCH_CATALOG_CAP)
            ->get();

        $categoryIds = $categories->pluck('id')->all();
        $latestTsByCategoryId = [];
        if ($categoryIds !== []) {
            $rows = PricePost::query()
                ->join('products', 'products.id', '=', 'price_posts.product_id')
                ->whereIn('products.category_id', $categoryIds)
                ->groupBy('products.category_id')
                ->selectRaw('products.category_id as category_id, MAX(price_posts.created_at) as latest_at')
                ->get();
            foreach ($rows as $row) {
                $latestTsByCategoryId[(int) $row->category_id] = $row->latest_at
                    ? (int) Carbon::parse($row->latest_at)->timestamp
                    : 0;
            }
        }
        $categories = $categories->sortBy(function (Category $c) use ($latestTsByCategoryId) {
            $latest = $latestTsByCategoryId[$c->id] ?? 0;

            return [-$latest, strtolower($c->name)];
        })->values();

        /** @var array<int, PricePost|null> */
        $bestPostByCategoryId = [];
        if ($categoryIds !== []) {
            $catPosts = PricePost::query()
                ->with(['product', 'establishment'])
                ->whereHas('product', function (Builder $q) use ($categoryIds) {
                    $q->whereIn('category_id', $categoryIds);
                })
                ->get();
            foreach ($catPosts->groupBy(fn (PricePost $p) => (int) $p->product->category_id) as $cid => $rows) {
                $bestPostByCategoryId[(int) $cid] = $this->pickRepresentativePricePost($rows);
            }
        }

        $establishmentIds = $establishments->pluck('id')->all();
        $latestTsByEstablishmentId = [];
        if ($establishmentIds !== []) {
            $rows = PricePost::query()
                ->whereIn('establishment_id', $establishmentIds)
                ->groupBy('establishment_id')
                ->selectRaw('establishment_id, MAX(created_at) as latest_at')
                ->get();
            foreach ($rows as $row) {
                $latestTsByEstablishmentId[(int) $row->establishment_id] = $row->latest_at
                    ? (int) Carbon::parse($row->latest_at)->timestamp
                    : 0;
            }
        }

        /** @var array<int, PricePost|null> */
        $bestPostByEstablishmentId = [];
        if ($establishmentIds !== []) {
            $estPosts = PricePost::query()
                ->with(['product', 'establishment'])
                ->whereIn('establishment_id', $establishmentIds)
                ->get();
            foreach ($estPosts->groupBy('establishment_id') as $eid => $rows) {
                $bestPostByEstablishmentId[(int) $eid] = $this->pickRepresentativePricePost($rows);
            }
        }

        $establishments = $establishments->sortBy(function (Establishment $e) use ($latestTsByEstablishmentId) {
            $latest = $latestTsByEstablishmentId[$e->id] ?? 0;

            return [-$latest, strtolower($e->name)];
        })->values();

        $categoryPayloads = $categories->map(fn (Category $c) => array_merge([
            'id' => (string) $c->id,
            'name' => $c->name,
            'slug' => $c->slug,
        ], $this->searchSampleFromPricePost($bestPostByCategoryId[$c->id] ?? null)))->values()->all();

        $productPayloads = $products->map(function (Product $p) use ($bestPostByProductId) {
            $rep = $bestPostByProductId[$p->id] ?? null;
            $est = $rep?->establishment;

            return [
                'id' => (string) $p->id,
                'name' => $p->name,
                'brand' => $p->brand !== null && $p->brand !== '' ? $p->brand : null,
                'slug' => $p->slug,
                'unit' => $p->unit,
                'unitQuantity' => $p->unit_quantity !== null && $p->unit_quantity !== ''
                    ? (string) $p->unit_quantity
                    : null,
                'category' => $p->category ? [
                    'id' => (string) $p->category->id,
                    'name' => $p->category->name,
                    'slug' => $p->category->slug,
                ] : null,
                'priceExact' => $rep !== null && $rep->price_exact !== null ? (string) $rep->price_exact : null,
                'priceMin' => $rep !== null && $rep->price_min !== null ? (string) $rep->price_min : null,
                'priceMax' => $rep !== null && $rep->price_max !== null ? (string) $rep->price_max : null,
                'establishment' => $est !== null ? [
                    'id' => (string) $est->id,
                    'name' => $est->name,
                    'slug' => $est->slug,
                    'addressLine' => $est->address_line,
                    'barangay' => $est->barangay,
                    'city' => $est->city,
                ] : null,
            ];
        })->values()->all();

        $establishmentPayloads = $establishments->map(fn (Establishment $e) => array_merge([
            'id' => (string) $e->id,
            'name' => $e->name,
            'slug' => $e->slug,
            'addressLine' => $e->address_line,
            'barangay' => $e->barangay,
            'city' => $e->city,
        ], $this->searchSampleFromPricePost($bestPostByEstablishmentId[$e->id] ?? null)))->values()->all();

        $catTotal = count($categoryPayloads);
        $prodTotal = count($productPayloads);
        $estTotal = count($establishmentPayloads);

        $catSlice = $cl > 0 ? array_slice($categoryPayloads, $co, $cl) : [];
        $prodSlice = $pl > 0 ? array_slice($productPayloads, $po, $pl) : [];
        $estSlice = $el > 0 ? array_slice($establishmentPayloads, $eo, $el) : [];

        $sliceMeta = function (int $total, int $offset, int $limit, int $returned): array {
            $hasMore = $limit > 0
                ? ($offset + $returned < $total)
                : ($offset < $total);

            return [
                'total' => $total,
                'offset' => $offset,
                'limit' => $limit,
                'hasMore' => $hasMore,
            ];
        };

        return [
            'categories' => $catSlice,
            'products' => $prodSlice,
            'establishments' => $estSlice,
            'meta' => [
                'categories' => $sliceMeta($catTotal, $co, $cl, count($catSlice)),
                'products' => $sliceMeta($prodTotal, $po, $pl, count($prodSlice)),
                'establishments' => $sliceMeta($estTotal, $eo, $el, count($estSlice)),
            ],
        ];
    }
}
