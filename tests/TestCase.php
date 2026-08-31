<?php

declare(strict_types=1);

namespace Datawell\Tables\Tests;

use Datawell\DatawellServiceProvider;
use Datawell\Tables\TablesServiceProvider;
use Datawell\Tables\Tests\Fixtures\Models\User;
use Datawell\Tables\Tests\Fixtures\Sources\People;
use Datawell\Tables\Tests\Fixtures\Sources\Tags;
use Illuminate\Support\Facades\Gate;
use Orchestra\Testbench\TestCase as Orchestra;

abstract class TestCase extends Orchestra
{
    protected function getPackageProviders($app): array
    {
        return [
            DatawellServiceProvider::class,
            TablesServiceProvider::class,
        ];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('datawell.sources', [People::class, Tags::class]);
        $app['config']->set('datawell.lint.enabled', true);
        $app['config']->set('app.timezone', 'UTC');
        $app['config']->set('app.key', 'base64:'.base64_encode(random_bytes(32)));
        // Bus batches bookkeep on the default connection, not the queue's own.
        $app['config']->set('queue.batching.database', null);
    }

    protected function setUp(): void
    {
        parent::setUp();

        Gate::define('view-contact-details', fn (User $user): bool => $user->hasAbility('view-contact-details'));
    }

    protected function seedDatabase(): void
    {
        $schema = require __DIR__.'/Fixtures/Database/schema.php';
        $schema->create();
        $schema->seed();
    }

    /**
     * A signed-in person who may not see contact details.
     */
    protected function viewer(): User
    {
        return User::query()->create([
            'name' => 'Viewer',
            'email' => 'viewer@acme.test',
            'workspace_id' => 2,
            'abilities' => [],
        ]);
    }

    /**
     * A signed-in person who may see everything the fixtures gate.
     */
    protected function privilegedViewer(): User
    {
        return User::query()->create([
            'name' => 'Privileged',
            'email' => 'privileged@acme.test',
            'workspace_id' => 2,
            'abilities' => ['view-contact-details'],
        ]);
    }
}
