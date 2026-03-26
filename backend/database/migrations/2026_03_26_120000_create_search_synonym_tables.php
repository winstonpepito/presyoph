<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('search_synonym_groups', function (Blueprint $table) {
            $table->id();
            $table->string('type', 16);
            $table->timestamps();
            $table->index('type');
        });

        Schema::create('search_synonym_terms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('search_synonym_group_id')->constrained('search_synonym_groups')->cascadeOnDelete();
            $table->string('term', 120);
            $table->timestamps();
            $table->index(['search_synonym_group_id', 'term']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('search_synonym_terms');
        Schema::dropIfExists('search_synonym_groups');
    }
};
