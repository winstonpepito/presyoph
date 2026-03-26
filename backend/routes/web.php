<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (app()->isLocal()) {
        return redirect()->away(config('app.frontend_url'));
    }

    return view('welcome');
});
