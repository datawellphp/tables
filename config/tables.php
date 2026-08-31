<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Routes
    |--------------------------------------------------------------------------
    |
    | The JSON endpoints the table UI talks to — a thin layer over the core
    | executor, always on the Direct channel. Point `middleware` at whatever
    | authenticates people in your app; every endpoint requires a user.
    |
    */

    'routes' => [
        'enabled' => true,
        'prefix' => 'datawell',
        'middleware' => ['web', 'auth'],
    ],

];
