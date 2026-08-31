<?php

declare(strict_types=1);

namespace Datawell\Tables\Tests\Fixtures\Sources;

use Datawell\Actions\ActionContext;
use Datawell\Actions\ServerAction;
use Datawell\Attributes\Model;
use Datawell\DataSource;
use Datawell\Enums\ActionTarget;
use Datawell\Fields\BooleanField;
use Datawell\Fields\NumberField;
use Datawell\Fields\RelationField;
use Datawell\Fields\TextField;
use Datawell\Params;
use Datawell\Representation;
use Datawell\Tables\Tests\Fixtures\Models\User;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;

#[Model(User::class)]
class People extends DataSource
{
    public function key(): string
    {
        return 'people';
    }

    public function description(): string
    {
        return 'People in the workspace: name, contact email and activity.';
    }

    public function representation(): Representation
    {
        return Representation::make(label: 'name')->url(fn (User $user): string => "/people/{$user->id}");
    }

    public function query(Params $params): EloquentBuilder|QueryBuilder
    {
        return User::query()->where('workspace_id', 1);
    }

    public function fields(): array
    {
        return [
            TextField::make('name')->sortable()->filterable()->searchable(),
            TextField::make('email')->filterable()->searchable()->nullable()->visibleWhen('view-contact-details'),
            BooleanField::make('active')->filterable(),
            RelationField::make('tags', from: 'tags')->references('tags')->filterable(),
            NumberField::make('tags_count')->countOf('tags')->sortable(),
        ];
    }

    public function defaultSort(): array
    {
        return ['name' => 'asc'];
    }

    public function actions(): array
    {
        return [
            ServerAction::make('flag')->targets(ActionTarget::Single, ActionTarget::Many)
                ->description('Mark this person for review.')
                ->handle(static function ($rows, $input, ActionContext $context): void {
                    foreach ($rows as $person) {
                        $person->update(['email' => 'flagged@acme.test']);
                    }
                }),
            ServerAction::make('deactivate')->targets(ActionTarget::Single, ActionTarget::Many)
                ->description('Deactivate this person.')
                ->queued()
                ->authorize(fn (Authenticatable $actor, User $row): bool => $row->active)
                ->handle(static function ($rows, $input, ActionContext $context): void {
                    foreach ($rows as $person) {
                        $person->update(['active' => false]);
                    }
                }),
        ];
    }
}
