<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;

it('publishes the frontend component sources under the tables-frontend tag', function (): void {
    $target = resource_path('js/datawell');
    File::deleteDirectory($target);

    $this->artisan('vendor:publish', ['--tag' => 'tables-frontend'])->assertSuccessful();

    expect(File::exists($target.'/data-table.tsx'))->toBeTrue()
        ->and(File::exists($target.'/lib.ts'))->toBeTrue()
        ->and(File::exists($target.'/group-view.tsx'))->toBeTrue();

    // The published copies import siblings relatively, never demo-app paths.
    expect(File::get($target.'/data-table.tsx'))
        ->toContain("from './cells'")
        ->not->toContain('@/components/datawell')
        ->not->toContain('@/lib/datawell');

    File::deleteDirectory($target);
});
