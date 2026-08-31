<?php

declare(strict_types=1);

namespace Datawell\Tables\Http\Controllers;

use Datawell\Executor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QueriesController extends Controller
{
    public function __construct(protected Executor $executor) {}

    /**
     * Execute a query (D05 wire shape in the body; the source comes from the URL).
     */
    public function run(Request $request, string $source): JsonResponse
    {
        $user = $this->user($request);

        return $this->respond(fn (): array => $this->executor
            ->run(array_replace($request->all(), ['source' => $source]), $user)
            ->toArray());
    }

    /**
     * Dry-run validation (D38): pass/fail plus every error, nothing executed.
     */
    public function validate(Request $request, string $source): JsonResponse
    {
        $user = $this->user($request);

        return $this->respond(function () use ($request, $source, $user): array {
            $report = $this->executor->validate(array_replace($request->all(), ['source' => $source]), $user);

            return ['passes' => $report->passes(), 'errors' => (object) $report->errors];
        });
    }
}
