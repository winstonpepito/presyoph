<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('unit', 32)->nullable();
            $table->decimal('unit_quantity', 16, 6)->nullable();
        });

        Schema::table('price_posts', function (Blueprint $table) {
            $table->string('unit', 32)->nullable();
            $table->decimal('unit_quantity', 16, 6)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('price_posts', function (Blueprint $table) {
            $table->dropColumn(['unit', 'unit_quantity']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['unit', 'unit_quantity']);
        });
    }
};
