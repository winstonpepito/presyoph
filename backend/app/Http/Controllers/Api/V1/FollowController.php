<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Follow;
use App\Models\User;
use App\Services\BannerService;
use Illuminate\Http\Request;

class FollowController extends Controller
{
    public function index(Request $request): \Illuminate\Http\JsonResponse
    {
        $followerId = (int) $request->user()->getKey();
        $root = $request->root();

        $users = User::query()
            ->select('users.id', 'users.name', 'users.image')
            ->join('follows', 'users.id', '=', 'follows.following_id')
            ->where('follows.follower_id', $followerId)
            ->orderByDesc('follows.id')
            ->get();

        return response()->json([
            'users' => $users->map(fn (User $u) => [
                'id' => (string) $u->id,
                'name' => $u->name,
                'image' => BannerService::publicImageUrl($u->image, $root),
            ])->values()->all(),
        ]);
    }

    public function store(Request $request, string $userId): \Illuminate\Http\JsonResponse
    {
        $followerId = (int) $request->user()->getKey();
        $followingId = (int) $userId;
        if ($followerId === $followingId) {
            return response()->json(['error' => 'You cannot follow yourself.'], 422);
        }
        if (! User::query()->whereKey($followingId)->exists()) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        Follow::query()->firstOrCreate([
            'follower_id' => $followerId,
            'following_id' => $followingId,
        ]);

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request, string $userId): \Illuminate\Http\JsonResponse
    {
        $followerId = (int) $request->user()->getKey();
        Follow::query()
            ->where('follower_id', $followerId)
            ->where('following_id', (int) $userId)
            ->delete();

        return response()->json(['ok' => true]);
    }
}
