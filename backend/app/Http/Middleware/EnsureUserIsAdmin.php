<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || ($user->role ?? 'USER') !== 'ADMIN') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return $next($request);
    }
}
