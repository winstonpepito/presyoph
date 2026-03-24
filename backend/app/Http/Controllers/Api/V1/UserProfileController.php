<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PricePostResource;
use App\Http\Support\OptionalSanctum;
use App\Models\Follow;
use App\Models\User;
use App\Services\BannerService;
use Illuminate\Http\Request;

class UserProfileController extends Controller
{
    public function show(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        $userId = (int) $id;
        $user = User::query()->find($userId);
        if (! $user) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $posts = $user->pricePosts()
            ->with(['product.category', 'establishment', 'user:id,name,image'])
            ->orderByDesc('created_at')
            ->limit(30)
            ->get();

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
        ]);
    }
}
