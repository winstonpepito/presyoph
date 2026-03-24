<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug');
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique('slug');
        });

        Schema::create('establishments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('address_line')->nullable();
            $table->double('latitude')->nullable();
            $table->double('longitude')->nullable();
            $table->timestamps();
        });

        Schema::create('price_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('establishment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('anonymous')->default(false);
            $table->decimal('price_exact', 14, 4)->nullable();
            $table->decimal('price_min', 14, 4)->nullable();
            $table->decimal('price_max', 14, 4)->nullable();
            $table->string('currency', 8)->default('USD');
            $table->double('latitude');
            $table->double('longitude');
            $table->string('location_label')->nullable();
            $table->timestamps();
            $table->index(['product_id', 'created_at']);
            $table->index(['establishment_id', 'created_at']);
            $table->index(['latitude', 'longitude']);
        });

        Schema::create('follows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('follower_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('following_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['follower_id', 'following_id']);
            $table->index('following_id');
        });

        Schema::create('app_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->json('value');
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('banner_ads', function (Blueprint $table) {
            $table->id();
            $table->string('slot_key');
            $table->string('image_url', 2000);
            $table->string('href', 2000)->default('');
            $table->string('alt', 500)->default('');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('valid_from')->nullable();
            $table->timestamp('valid_to')->nullable();
            $table->timestamps();
            $table->index(['slot_key', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banner_ads');
        Schema::dropIfExists('app_settings');
        Schema::dropIfExists('follows');
        Schema::dropIfExists('price_posts');
        Schema::dropIfExists('establishments');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
    }
};
