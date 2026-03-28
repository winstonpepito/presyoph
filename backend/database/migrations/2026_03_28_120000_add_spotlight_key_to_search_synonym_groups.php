<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('search_synonym_groups', 'spotlight_key')) {
            return;
        }
        Schema::table('search_synonym_groups', function (Blueprint $table) {
            $table->string('spotlight_key', 24)->nullable()->after('type');
            $table->index('spotlight_key');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('search_synonym_groups', 'spotlight_key')) {
            return;
        }
        Schema::table('search_synonym_groups', function (Blueprint $table) {
            $table->dropIndex(['spotlight_key']);
            $table->dropColumn('spotlight_key');
        });
    }
};
