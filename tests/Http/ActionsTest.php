<?php

declare(strict_types=1);

use Datawell\Tables\Tests\Fixtures\Models\User;

beforeEach(function (): void {
    $this->seedDatabase();
});

it('executes a synchronous action and returns the report', function (): void {
    $anna = User::query()->where('name', 'Anna')->firstOrFail();

    $this->actingAs($this->viewer())
        ->postJson('/datawell/sources/people/actions', [
            'action' => 'flag',
            'target' => ['ids' => [$anna->id]],
        ])
        ->assertOk()
        ->assertJson([
            'status' => 'completed',
            'counts' => ['targeted' => 1, 'succeeded' => 1, 'failed' => 0, 'skipped' => 0],
        ]);

    expect($anna->refresh()->email)->toBe('flagged@acme.test');
});

it('reads an unknown action as nonexistent via 422', function (): void {
    $this->actingAs($this->viewer())
        ->postJson('/datawell/sources/people/actions', [
            'action' => 'nope',
            'target' => ['ids' => [1]],
        ])
        ->assertUnprocessable()
        ->assertJsonPath('errors.action.0', 'Unknown action "nope".');
});

it('returns a run handle for a queued action and reports progress to its own user only', function (): void {
    $ids = User::query()->whereIn('name', ['Anna', 'Cara'])->pluck('id')->all();
    $user = $this->viewer();

    $report = $this->actingAs($user)
        ->postJson('/datawell/sources/people/actions', [
            'action' => 'deactivate',
            'target' => ['ids' => $ids],
        ])
        ->assertOk()
        ->json();

    // Cara is already inactive: ineligible, skipped at dispatch (D42).
    expect($report['runId'])->toBeString()
        ->and($report['counts'])->toBe(['targeted' => 2, 'succeeded' => 1, 'failed' => 0, 'skipped' => 1]);

    $this->actingAs($user)
        ->getJson('/datawell/runs/'.$report['runId'])
        ->assertOk()
        ->assertJsonPath('status', 'completed');

    // Someone else's run id reads as nonexistent (D18).
    $this->actingAs($this->privilegedViewer())
        ->getJson('/datawell/runs/'.$report['runId'])
        ->assertNotFound();
});
