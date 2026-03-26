<?php

namespace App\Support;

final class TextCase
{
    /** Title case each word (UTF-8), e.g. "RICE PREMIUM" → "Rice Premium". */
    public static function titleCase(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        return mb_convert_case($value, MB_CASE_TITLE, 'UTF-8');
    }
}
