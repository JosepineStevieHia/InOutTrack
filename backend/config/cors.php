<?php

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing (CORS) - InOutTrack
|--------------------------------------------------------------------------
|
| Frontend Next.js (SPA) mengakses API Laravel dengan cookie (Sanctum).
| Karena credentials aktif, origin TIDAK boleh wildcard '*'. Origin yang
| diizinkan dibaca dari FRONTEND_URL (pisahkan dengan koma bila lebih dari satu).
|
*/

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', env('FRONTEND_URL', 'http://localhost:3000'))
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => [
        'Accept',
        'Content-Type',
        'Origin',
        'X-Requested-With',
        'X-XSRF-TOKEN',
    ],

    'exposed_headers' => [],

    'max_age' => 600,

    'supports_credentials' => true,

];
