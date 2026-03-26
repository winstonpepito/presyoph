<?php

namespace App\Support;

final class TextCase
{
    /** First character uppercase, remaining letters lowercase (UTF-8). */
    public static function sentenceCase(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        $lower = mb_strtolower($value, 'UTF-8');

        return mb_strtoupper(mb_substr($lower, 0, 1, 'UTF-8'), 'UTF-8').mb_substr($lower, 1, null, 'UTF-8');
    }
}
