<?php

declare(strict_types=1);

namespace Datawell\Tables\Http\Controllers;

use Datawell\DataSource;
use Datawell\Registry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SourcesController extends Controller
{
    public function __construct(protected Registry $registry) {}

    /**
     * Every source this user may know exists (D18): key, name, description.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->user($request);

        return $this->respond(fn (): array => [
            'sources' => array_map(static fn (DataSource $source): array => [
                'key' => $source->key(),
                'name' => $source->name(),
                'description' => $source->description(),
            ], $this->registry->availableFor($user)),
        ]);
    }

    /**
     * The published contract, as this user (D17): hidden fields simply absent.
     */
    public function schema(Request $request, string $source): JsonResponse
    {
        $user = $this->user($request);

        return $this->respond(fn (): array => $this->registry->findFor($source, $user)->describe($user)->toArray());
    }
}
