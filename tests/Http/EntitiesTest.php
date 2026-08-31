<?php

declare(strict_types=1);

use Datawell\Tables\Tests\Fixtures\Models\User;

beforeEach(function (): void {
    $this->seedDatabase();
});

it('looks up one entity through the scoped query', function (): void {
    $anna = User::query()->where('name', 'Anna')->firstOrFail();

    $this->actingAs($this->viewer())
        ->getJson('/datawell/sources/people/entities/'.$anna->id)
        ->assertOk()
        ->assertJson(['id' => $anna->id, 'label' => 'Anna', 'url' => "/people/{$anna->id}"]);
});

it('reads an out-of-scope entity as nonexistent', function (): void {
    // The viewer itself lives in workspace 2, outside the source's scope.
    $viewer = $this->viewer();

    $this->actingAs($viewer)
        ->getJson('/datawell/sources/people/entities/'.$viewer->id)
        ->assertNotFound();
});

it('pages the remainder of a many-valued field', function (): void {
    $anna = User::query()->where('name', 'Anna')->firstOrFail();

    $response = $this->actingAs($this->viewer())
        ->getJson('/datawell/sources/people/entities/'.$anna->id.'/values/tags?page[size]=1&page[number]=1&page[withTotal]=true')
        ->assertOk()
        ->json();

    expect($response['rows'])->toHaveCount(1)
        ->and($response['rows'][0]['label'])->toBe('Urgent')
        ->and($response['meta']['total'])->toBe(2)
        ->and($response['meta']['hasMore'])->toBeTrue();
});

it('rejects values over a field that is not a many relation', function (): void {
    $anna = User::query()->where('name', 'Anna')->firstOrFail();

    $this->actingAs($this->viewer())
        ->getJson('/datawell/sources/people/entities/'.$anna->id.'/values/name')
        ->assertUnprocessable();
});

it('rejects a malformed query-string object', function (): void {
    $this->actingAs($this->viewer())
        ->getJson('/datawell/sources/people/entities/1?parameters=nope')
        ->assertUnprocessable();
});
