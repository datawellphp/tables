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

        // The schema-driven React component (D58), published into the host app
        // Breeze-style: the app owns the copy (and the shadcn/ui primitives it
        // imports from @/components/ui) and may edit it freely.
        $this->publishes([
            __DIR__.'/../resources/js' => resource_path('js/datawell'),
        ], ['tables', 'tables-frontend']);
    }
}
