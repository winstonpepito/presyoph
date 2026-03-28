<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default map coordinates when latitude/longitude are not provided
    |--------------------------------------------------------------------------
    |
    | Used when the user cannot or does not use GPS. Approximate Cebu City.
    |
    */

    'default_latitude' => (float) env('DEFAULT_POST_LATITUDE', 10.3157),

    'default_longitude' => (float) env('DEFAULT_POST_LONGITUDE', 123.8854),

];
