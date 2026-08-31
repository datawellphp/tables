<?php

declare(strict_types=1);

namespace Datawell\Tables\Http\Controllers;

use Datawell\Executor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EntitiesController extends Controller
{
    public function __construct(protected Executor $executor) {}

    /**
     * One entity's reference through the source's scoped query (D34):
     * out of the caller's world reads as nonexistent.
     */
    public function lookup(Request $request, string $source, string $id): JsonResponse
    {
        $user = $this->user($request);

        return $this->respond(fn (): ?array => $this->executor
            ->lookup($source, $id, $user, $this->queryObject($request, 'parameters'))
            ?->toArray());
    }

    /**
     * The remainder of a many-valued field beyond the row cap (D56), paged.
     */
    public function values(Request $request, string $source, string $id, string $field): JsonResponse
    {
        $user = $this->user($request);

        return $this->respond(fn (): ?array => $this->executor
            ->values($source, $id, $field, $user, $this->queryObject($request, 'parameters'), $this->page($request))
            ?->toArray());
    }

    /**
     * The page object arrives through the query string, where every scalar is a
     * string; size and number are numbers on the wire (D39), so restore them.
     *
     * @return array<string, mixed>
     */
    protected function page(Request $request): array
    {
        $page = $this->queryObject($request, 'page');

        foreach (['size', 'number'] as $key) {
            if (isset($page[$key]) && is_string($page[$key]) && ctype_digit($page[$key])) {
                $page[$key] = (int) $page[$key];
            }
        }

        if (isset($page['withTotal']) && is_string($page['withTotal'])) {
            $page['withTotal'] = filter_var($page['withTotal'], FILTER_VALIDATE_BOOL);
        }

        return $page;
    }
}
