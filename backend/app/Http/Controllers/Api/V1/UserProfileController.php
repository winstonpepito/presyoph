<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PricePostResource;
use App\Http\Support\OptionalSanctum;
use App\Models\Follow;
use App\Models\User;
use App\Services\BannerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserProfileController extends Controller
{
    /**
     * Search members by display name (signed-in users only).
     */
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q, 'UTF-8') < 2) {
            return response()->json(['users' => []]);
        }

        $limit = max(1, min(25, (int) ($request->query('limit', 15) ?: 15)));
        $term = mb_strtolower($q, 'UTF-8');
        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term);
        $pattern = '%'.$escaped.'%';

        $me = $request->user();

        $users = User::query()
            ->whereNotNull('name')
            ->where('name', '!=', '')
            ->whereRaw('LOWER(name) LIKE ? ESCAPE ?', [$pattern, '\\'])
            ->when($me, fn ($query) => $query->where('id', '!=', $me->id))
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'image']);

        $root = $request->root();

        return response()->json([
            'users' => $users->map(fn (User $u) => [
                'id' => (string) $u->id,
                'name' => $u->name,
                'image' => BannerService::publicImageUrl($u->image, $root),
            ])->values()->all(),
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $userId = (int) $id;
        $user = User::query()->find($userId);
        if (! $user) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $postsOffset = max(0, (int) $request->query('postsOffset', 0));
        $postsLimit = max(1, min(50, (int) ($request->query('postsLimit', 24) ?: 24)));

        $totalPosts = $user->pricePosts()->count();

        $posts = $user->pricePosts()
            ->with(['product.category', 'establishment', 'user:id,name,image'])
            ->orderByDesc('created_at')
            ->offset($postsOffset)
            ->limit($postsLimit)
            ->get();
        $returned = $posts->count();
        $hasMore = ($postsOffset + $returned) < $totalPosts;

        $followerCount = Follow::query()->where('following_id', $userId)->count();
        $followingCount = Follow::query()->where('follower_id', $userId)->count();

        $sessionUser = OptionalSanctum::user($request);
        $sessionId = $sessionUser?->id;
        $isFollowing = false;
        if ($sessionId) {
            $isFollowing = Follow::query()
                ->where('follower_id', $sessionId)
                ->where('following_id', $userId)
                ->exists();
        }

        $rawImg = $user->image;
        $root = $request->root();

        return response()->json([
            'user' => [
                'id' => (string) $user->id,
                'name' => $user->name,
                'image' => BannerService::publicImageUrl($rawImg, $root),
                'externalImageUrl' => ($rawImg !== null && $rawImg !== '' && preg_match('#^https?://#i', $rawImg))
                    ? $rawImg
                    : null,
            ],
            'followerCount' => $followerCount,
            'followingCount' => $followingCount,
            'isFollowing' => $isFollowing,
            'isSelf' => (int) $sessionId === $userId,
            'posts' => PricePostResource::collection($posts)->resolve(),
            'postsMeta' => [
                'offset' => $postsOffset,
                'limit' => $postsLimit,
                'total' => $totalPosts,
                'hasMore' => $hasMore,
            ],
        ]);
    }
}
