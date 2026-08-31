<?php

declare(strict_types=1);

namespace Datawell\Tables\Tests\Fixtures\Sources;

use Datawell\Attributes\Model;
use Datawell\DataSource;
use Datawell\Fields\TextField;
use Datawell\Params;
use Datawell\Representation;
use Datawell\Tables\Tests\Fixtures\Models\Tag;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;

#[Model(Tag::class)]
class Tags extends DataSource
{
    public function key(): string
    {
        return 'tags';
    }

    public function description(): string
    {
        return 'Labels that can be attached to people.';
    }

    public function representation(): Representation
    {
        return Representation::make(label: 'name');
    }

    public function query(Params $params): EloquentBuilder|QueryBuilder
    {
        return Tag::query();
    }

    public function fields(): array
    {
        return [
            TextField::make('name')->sortable()->filterable()->searchable(),
        ];
    }
}
