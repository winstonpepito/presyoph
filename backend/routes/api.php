<?php

use App\Http\Controllers\Api\Admin\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\V1\BannerController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CategoryDetailController;
use App\Http\Controllers\Api\V1\EstablishmentDetailController;
use App\Http\Controllers\Api\V1\FollowController;
use App\Http\Controllers\Api\V1\GeoResolveController;
use App\Http\Controllers\Api\V1\LocationsController;
use App\Http\Controllers\Api\V1\MetaController;
use App\Http\Controllers\Api\V1\PostController;
use App\Http\Controllers\Api\V1\ProductDetailController;
use App\Http\Controllers\Api\V1\SearchController;
use App\Http\Controllers\Api\V1\UserProfileController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Support\Facades\Route;

/*
| Same-domain hosting: nginx often sends only /api/* to Laravel; SPA handles /. These routes
| live under /api so Google OAuth works without a separate /auth location.
*/
Route::middleware('web')->group(function () {
    Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect'])->name('auth.google.redirect');
    Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])->name('auth.google.callback');
});

Route::prefix('auth')->group(function () {
    Route::get('/providers', [AuthController::class, 'providers']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    Route::get('/user', [AuthController::class, 'user'])->middleware('auth:sanctum');
    Route::patch('/profile', [AuthController::class, 'updateProfile'])->middleware('auth:sanctum');
});

Route::prefix('v1')->group(function () {
    Route::get('/locations', LocationsController::class);
    Route::post('/geo/resolve-city', GeoResolveController::class);
    Route::get('/meta', MetaController::class);
    Route::get('/posts', [PostController::class, 'index']);
    Route::post('/posts', [PostController::class, 'store']);
    Route::patch('/posts/{post}', [PostController::class, 'update'])->middleware('auth:sanctum');
    Route::delete('/posts/{post}', [PostController::class, 'destroy'])->middleware('auth:sanctum');
    Route::get('/search', SearchController::class);
    Route::get('/banners', BannerController::class);
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/categories/{slug}', [CategoryDetailController::class, 'show']);
    Route::get('/products/{slug}', [ProductDetailController::class, 'show']);
    Route::get('/establishments/{slug}', [EstablishmentDetailController::class, 'show']);
    Route::get('/users/search', [UserProfileController::class, 'search'])->middleware('auth:sanctum');
    Route::get('/users/{id}/profile', [UserProfileController::class, 'show']);

    Route::get('/following', [FollowController::class, 'index'])->middleware('auth:sanctum');
    Route::post('/follow/{userId}', [FollowController::class, 'store'])->middleware('auth:sanctum');
    Route::delete('/follow/{userId}', [FollowController::class, 'destroy'])->middleware('auth:sanctum');
});

Route::prefix('admin')->middleware(['auth:sanctum', EnsureUserIsAdmin::class])->group(function () {
    Route::get('/state', [AdminController::class, 'state']);
    Route::post('/anonymous/flip', [AdminController::class, 'flipAnonymous']);
    Route::post('/banner-strategy/home-top', [AdminController::class, 'setHomeTopStrategy']);
    Route::post('/banners', [AdminController::class, 'createBanner']);
    Route::patch('/banners/{id}', [AdminController::class, 'toggleBanner']);
    Route::delete('/banners/{id}', [AdminController::class, 'deleteBanner']);
    Route::post('/barangays', [AdminController::class, 'storeBarangay']);
    Route::delete('/barangays/{id}', [AdminController::class, 'deleteBarangay']);
    Route::post('/categories', [AdminController::class, 'storeCategory']);
    Route::patch('/categories/{id}', [AdminController::class, 'updateCategory']);
    Route::delete('/categories/{id}', [AdminController::class, 'deleteCategory']);
    Route::post('/product-units', [AdminController::class, 'storeProductUnit']);
    Route::patch('/product-units/{id}', [AdminController::class, 'updateProductUnit']);
    Route::delete('/product-units/{id}', [AdminController::class, 'deleteProductUnit']);
    Route::post('/search-synonym-groups', [AdminController::class, 'storeSearchSynonymGroup']);
    Route::patch('/search-synonym-groups/{id}', [AdminController::class, 'updateSearchSynonymGroup']);
    Route::delete('/search-synonym-groups/{id}', [AdminController::class, 'deleteSearchSynonymGroup']);
});
