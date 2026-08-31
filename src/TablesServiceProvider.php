<?php

declare(strict_types=1);

namespace Datawell\Tables;

use Illuminate\Support\ServiceProvider;

class TablesServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/tables.php', 'tables');
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__.'/../routes/tables.php');

        if (! $this->app->runningInConsole()) {
            return;
        }

        $this->publishes([
            __DIR__.'/../config/tables.php' => config_path('tables.php'),
        ], ['tables', 'tables-config']);
    }
}
