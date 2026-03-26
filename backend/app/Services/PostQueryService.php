<?php

namespace App\Services;

use App\Models\PricePost;
use App\Models\Product;
use App\Models\Category;
use App\Models\Establishment;
use App\Support\Geo;
use App\Support\Pricing;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class PostQueryService
{
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
     * @return Collection<int, PricePost>
     */
    public function listRecentPosts(
        ?float $lat,
        ?float $lng,
        float $radiusKm = 50,
        int $limit = 50,
        ?array $followingUserIds = null,
        ?string $keyword = null,
    ): Collection {
        if ($followingUserIds !== null) {
            if ($followingUserIds === []) {
                return collect();
            }

            return $this->listPostsFromFollowedUsers($followingUserIds, $limit, $keyword);
        }

        $take = $limit * 3;
        $term = $keyword !== null ? trim($keyword) : '';

        $posts = PricePost::query()
            ->with($this->baseWith())
            ->when($term !== '', function (Builder $query) use ($term) {
                $like = '%'.strtolower($term).'%';
                $query->whereHas('product', function (Builder $pq) use ($like) {
                    $pq->where(function (Builder $inner) use ($like) {
                        $inner->whereRaw('LOWER(products.name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(COALESCE(products.brand, \'\')) LIKE ?', [$like])
                            ->orWhereHas('category', function (Builder $cq) use ($like) {
                                $cq->whereRaw('LOWER(categories.name) LIKE ?', [$like]);
                            });
                    });
                });
            })
            ->orderByDesc('created_at')
            ->limit($take)
            ->get();

        $filtered = $posts;
        if ($lat !== null && $lng !== null && ! is_nan($lat) && ! is_nan($lng)) {
            $filtered = $filtered->filter(function (PricePost $p) use ($lat, $lng, $radiusKm) {
                return Geo::distanceKm($lat, $lng, (float) $p->latitude, (float) $p->longitude) <= $radiusKm;
            });
        }

        // Keyword / filter: newest first, then cheapest. Default feed: cheapest first, then newest.
        $sorted = $filtered->sortBy(function (PricePost $p) use ($term) {
            $amount = Pricing::comparablePrice(
                $p->price_exact !== null ? (string) $p->price_exact : null,
                $p->price_min !== null ? (string) $p->price_min : null,
                $p->price_max !== null ? (string) $p->price_max : null,
            );
            $recency = -($p->created_at?->timestamp ?? 0);

            return $term !== '' ? [$recency, $amount] : [$amount, $recency];
        })->values();

        return $sorted->take($limit)->values();
    }

    /**
     * Recent posts from specific users (following feed). No geo radius — shows posts anywhere so followers can see activity.
     *
     * @param  list<int>  $followingUserIds
     * @return Collection<int, PricePost>
     */
    private function listPostsFromFollowedUsers(array $followingUserIds, int $limit, ?string $keyword): Collection
    {
        $term = $keyword !== null ? trim($keyword) : '';
        $ids = array_values(array_unique(array_map(intval(...), $followingUserIds)));
        $cap = min(max($limit, 1), 100);

        $posts = PricePost::query()
            ->with($this->baseWith())
            ->whereIn('user_id', $ids)
            ->when($term !== '', function (Builder $query) use ($term) {
                $like = '%'.strtolower($term).'%';
                $query->whereHas('product', function (Builder $pq) use ($like) {
                    $pq->where(function (Builder $inner) use ($like) {
                        $inner->whereRaw('LOWER(products.name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(COALESCE(products.brand, \'\')) LIKE ?', [$like])
                            ->orWhereHas('category', function (Builder $cq) use ($like) {
                                $cq->whereRaw('LOWER(categories.name) LIKE ?', [$like]);
                            });
                    });
                });
            })
            ->orderByDesc('created_at')
            ->limit($cap)
            ->get();

        if ($term === '') {
            return $posts->values();
        }

        return $posts
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
    }

    /**
     * @return Collection<int, PricePost>
     */
    public function bestPricesForProduct(
        int $productId,
        ?float $lat,
        ?float $lng,
        float $radiusKm = 100,
        int $limit = 30,
    ): Collection {
        $posts = PricePost::query()
            ->where('product_id', $productId)
            ->with($this->baseWith())
            ->get();

        return $this->filterRadiusSortBest($posts, $lat, $lng, $radiusKm, $limit);
    }

    /**
     * @return Collection<int, PricePost>
     */
    public function bestPricesForCategory(
        int $categoryId,
        ?float $lat,
        ?float $lng,
        float $radiusKm = 100,
        int $limit = 40,
    ): Collection {
        $posts = PricePost::query()
            ->whereHas('product', fn (Builder $q) => $q->where('category_id', $categoryId))
            ->with($this->baseWith())
            ->get();

        return $this->filterRadiusSortBest($posts, $lat, $lng, $radiusKm, $limit);
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
     * @return Collection<int, PricePost>
     */
    private function filterRadiusSortBest(
        Collection $posts,
        ?float $lat,
        ?float $lng,
        float $radiusKm,
        int $limit,
    ): Collection {
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

        return $sorted->take($limit)->values();
    }

    /**
     * @return array{categories: array, products: array, establishments: array}
     */
    public function searchProductsAndCategories(string $q): array
    {
        $term = trim($q);
        if ($term === '') {
            return ['categories' => [], 'products' => [], 'establishments' => []];
        }

        $categories = Category::query()
            ->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($term).'%'])
            ->limit(15)
            ->get();

        $like = '%'.strtolower($term).'%';
        $products = Product::query()
            ->with('category')
            ->where(function (Builder $q) use ($like) {
                $q->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(COALESCE(brand, \'\')) LIKE ?', [$like]);
            })
            ->limit(20)
            ->get();

        $productIds = $products->pluck('id')->all();
        $cheapestByProductId = [];
        $latestTsByProductId = [];
        if ($productIds !== []) {
            $priceRows = PricePost::query()
                ->whereIn('product_id', $productIds)
                ->get(['product_id', 'price_exact', 'price_min', 'price_max', 'created_at']);
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
            }
        }
        $products = $products->sortBy(function (Product $p) use ($cheapestByProductId, $latestTsByProductId) {
            $low = $cheapestByProductId[$p->id] ?? INF;
            $latest = $latestTsByProductId[$p->id] ?? 0;

            return [-$latest, $low, strtolower($p->name)];
        })->values();

        $establishments = Establishment::query()
            ->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($term).'%'])
            ->limit(15)
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
        $establishments = $establishments->sortBy(function (Establishment $e) use ($latestTsByEstablishmentId) {
            $latest = $latestTsByEstablishmentId[$e->id] ?? 0;

            return [-$latest, strtolower($e->name)];
        })->values();

        return [
            'categories' => $categories->map(fn (Category $c) => [
                'id' => (string) $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
            ])->all(),
            'products' => $products->map(fn (Product $p) => [
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
            ])->all(),
            'establishments' => $establishments->map(fn (Establishment $e) => [
                'id' => (string) $e->id,
                'name' => $e->name,
                'slug' => $e->slug,
            ])->all(),
        ];
    }
}
