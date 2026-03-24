<?php

namespace App\Http\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

final class OptionalSanctum
{
    public static function user(Request $request): ?User
    {
        $token = $request->bearerToken();
        if (! $token) {
            return null;
        }
        $pat = PersonalAccessToken::findToken($token);

        return $pat?->tokenable instanceof User ? $pat->tokenable : null;
    }
}
