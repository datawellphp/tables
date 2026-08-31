<?php

declare(strict_types=1);

beforeEach(function (): void {
    $this->seedDatabase();
});

it('requires an authenticated user on every endpoint', function (): void {
    $this->getJson('/datawell/sources')->assertUnauthorized();
    $this->postJson('/datawell/sources/people/query')->assertUnauthorized();
});

it('lists the sources available to the user', function (): void {
    $this->actingAs($this->viewer())
        ->getJson('/datawell/sources')
        ->assertOk()
        ->assertJson(['sources' => [
            ['key' => 'people', 'name' => 'People', 'description' => 'People in the workspace: name, contact email and activity.'],
            ['key' => 'tags', 'name' => 'Tags', 'description' => 'Labels that can be attached to people.'],
        ]]);
});

it('publishes a source schema as the acting user', function (): void {
    $schema = $this->actingAs($this->viewer())
        ->getJson('/datawell/sources/people/schema')
        ->assertOk()
        ->json();

    expect($schema['source']['key'])->toBe('people')
        ->and(array_column($schema['fields'], 'key'))->toBe(['name', 'active', 'tags', 'tags_count']);

    // The gated field appears only for a user who may see it (D17).
    $schema = $this->actingAs($this->privilegedViewer())
        ->getJson('/datawell/sources/people/schema')
        ->assertOk()
        ->json();

    expect(array_column($schema['fields'], 'key'))->toContain('email');
});

it('reads an unknown source as nonexistent', function (): void {
    $this->actingAs($this->viewer())
        ->getJson('/datawell/sources/nope/schema')
        ->assertNotFound()
        ->assertJson(['message' => 'Not found.']);
});
