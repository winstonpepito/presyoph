<?php

namespace App\Support;

final class Slugify
{
    public static function slugify(string $text): string
    {
        $s = strtolower(trim($text));
        $s = preg_replace('/[^\w\s-]/', '', $s) ?? '';
        $s = preg_replace('/[\s_-]+/', '-', $s) ?? '';
        $s = trim($s, '-');

        return $s;
    }

    /** @param  callable(string): bool  $exists */
    public static function uniqueProductSlug(string $base, callable $exists): string
    {
        $slug = self::slugify($base) ?: 'product';
        $candidate = $slug;
        $n = 0;
        while ($exists($candidate)) {
            $n++;
            $candidate = $slug.'-'.$n;
        }

        return $candidate;
    }

    /** @param  callable(string): bool  $exists */
    public static function uniqueEstablishmentSlug(string $base, callable $exists): string
    {
        $slug = self::slugify($base) ?: 'establishment';
        $candidate = $slug;
        $n = 0;
        while ($exists($candidate)) {
            $n++;
            $candidate = $slug.'-'.$n;
        }

        return $candidate;
    }

    /** @param  callable(string): bool  $exists */
    public static function uniqueCategorySlug(string $base, callable $exists): string
    {
        $slug = self::slugify($base) ?: 'category';
        $candidate = $slug;
        $n = 0;
        while ($exists($candidate)) {
            $n++;
            $candidate = $slug.'-'.$n;
        }

        return $candidate;
    }
}
