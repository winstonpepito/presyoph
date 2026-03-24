<?php

namespace App\Http\Resources;

use App\Models\PricePost;
use App\Services\BannerService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PricePost */
class PricePostResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var PricePost $p */
        $p = $this->resource;

        $effUnit = $p->unit ?? $p->product->unit;
        $effQty = $p->unit_quantity ?? $p->product->unit_quantity;

        return [
            'id' => (string) $p->id,
            'createdAt' => $p->created_at?->toIso8601String(),
            'anonymous' => (bool) $p->anonymous,
            'unit' => $effUnit,
            'unitQuantity' => $effQty !== null && $effQty !== '' ? (string) $effQty : null,
            'priceExact' => $p->price_exact !== null ? (string) $p->price_exact : null,
            'priceMin' => $p->price_min !== null ? (string) $p->price_min : null,
            'priceMax' => $p->price_max !== null ? (string) $p->price_max : null,
            'latitude' => (float) $p->latitude,
            'longitude' => (float) $p->longitude,
            'locationLabel' => $p->location_label,
            'product' => [
                'id' => (string) $p->product->id,
                'name' => $p->product->name,
                'brand' => $p->product->brand !== null && $p->product->brand !== '' ? $p->product->brand : null,
                'slug' => $p->product->slug,
                'unit' => $p->product->unit,
                'unitQuantity' => $p->product->unit_quantity !== null && $p->product->unit_quantity !== ''
                    ? (string) $p->product->unit_quantity
                    : null,
                'category' => $p->product->category ? [
                    'id' => (string) $p->product->category->id,
                    'name' => $p->product->category->name,
                    'slug' => $p->product->category->slug,
                ] : null,
            ],
            'establishment' => [
                'id' => (string) $p->establishment->id,
                'name' => $p->establishment->name,
                'slug' => $p->establishment->slug,
                'addressLine' => $p->establishment->address_line,
                'barangay' => $p->establishment->barangay,
                'city' => $p->establishment->city,
            ],
            'user' => $p->anonymous ? null : ($p->user ? [
                'id' => (string) $p->user->id,
                'name' => $p->user->name,
                'image' => BannerService::publicImageUrl($p->user->image, $request->root()),
            ] : null),
        ];
    }
}
