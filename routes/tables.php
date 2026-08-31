<?php

declare(strict_types=1);

use Datawell\Tables\Http\Controllers\ActionsController;
use Datawell\Tables\Http\Controllers\EntitiesController;
use Datawell\Tables\Http\Controllers\QueriesController;
use Datawell\Tables\Http\Controllers\SourcesController;
use Illuminate\Support\Facades\Route;

if (! config('tables.routes.enabled', true)) {
    return;
}

Route::group([
    'prefix' => config('tables.routes.prefix', 'datawell'),
    'as' => 'datawell.',
    'middleware' => config('tables.routes.middleware', ['web', 'auth']),
], function (): void {
    Route::get('sources', [SourcesController::class, 'index'])->name('sources');
    Route::get('sources/{source}/schema', [SourcesController::class, 'schema'])->name('schema');

    Route::post('sources/{source}/query', [QueriesController::class, 'run'])->name('query');
    Route::post('sources/{source}/validate', [QueriesController::class, 'validate'])->name('validate');

    Route::post('sources/{source}/actions', [ActionsController::class, 'act'])->name('actions');
    Route::get('runs/{run}', [ActionsController::class, 'progress'])->name('runs.progress');

    Route::get('sources/{source}/entities/{id}', [EntitiesController::class, 'lookup'])->name('lookup');
    Route::get('sources/{source}/entities/{id}/values/{field}', [EntitiesController::class, 'values'])->name('values');
});
