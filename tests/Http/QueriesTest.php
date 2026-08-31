<?php

declare(strict_types=1);

beforeEach(function (): void {
    $this->seedDatabase();
});

it('runs a query and returns rows, meta and the applied request', function (): void {
    $response = $this->actingAs($this->viewer())
        ->postJson('/datawell/sources/people/query', [
            'filters' => ['conditions' => [['filter' => 'active', 'operator' => 'is', 'value' => true]]],
        ])
        ->assertOk()
        ->json();

    expect(array_column($response['rows'], 'name'))->toBe(['Anna', 'Ben'])
        ->and($response['meta']['mode'])->toBe('cursor')
        ->and($response['applied']['filters']['conditions'])->toHaveCount(1);
});

it('rejects an invalid query with 422 and the error bag', function (): void {
    $this->actingAs($this->viewer())
        ->postJson('/datawell/sources/people/query', [
            'sorts' => [['key' => 'email', 'direction' => 'asc']],
        ])
        ->assertUnprocessable()
        ->assertJsonStructure(['message', 'errors']);
});

it('lets the route source key win over one smuggled into the body', function (): void {
    $this->actingAs($this->viewer())
        ->postJson('/datawell/sources/nope/query', ['source' => 'people'])
        ->assertNotFound();
});

it('validates a query without executing it', function (): void {
    $this->actingAs($this->viewer())
        ->postJson('/datawell/sources/people/validate', [
            'filters' => ['conditions' => [['filter' => 'active', 'operator' => 'is', 'value' => true]]],
        ])
        ->assertOk()
        ->assertJson(['passes' => true, 'errors' => []]);

    $response = $this->actingAs($this->viewer())
        ->postJson('/datawell/sources/people/validate', [
            'sorts' => [['key' => 'nope', 'direction' => 'asc']],
        ])
        ->assertOk()
        ->json();

    expect($response['passes'])->toBeFalse()
        ->and($response['errors'])->not->toBeEmpty();
});
