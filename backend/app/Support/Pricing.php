<?php

namespace App\Support;

final class Pricing
{
    /** Comparable value for sorting "best" (lowest) price */
    public static function comparablePrice(?string $priceExact, ?string $priceMin, ?string $priceMax): float
    {
        if ($priceExact !== null && $priceExact !== '') {
            return (float) $priceExact;
        }
        if ($priceMin !== null && $priceMin !== '') {
            return (float) $priceMin;
        }
        if ($priceMax !== null && $priceMax !== '') {
            return (float) $priceMax;
        }

        return INF;
    }
}
