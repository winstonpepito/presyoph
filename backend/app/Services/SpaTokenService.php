<?php

namespace App\Services;

use App\Models\User;

/**
 * Issues Sanctum personal access tokens for the SPA with configurable lifetime.
 */
final class SpaTokenService
{
    public function issue(User $user, bool $remember = true): string
    {
        $days = $remember
            ? max(1, (int) config('sanctum.remember_token_days', 365))
            : max(1, (int) config('sanctum.ephemeral_token_days', 7));
        $expiresAt = now()->addDays($days);

        return $user->createToken('spa', ['*'], $expiresAt)->plainTextToken;
    }
}
