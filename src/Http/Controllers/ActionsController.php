<?php

declare(strict_types=1);

namespace Datawell\Tables\Http\Controllers;

use Datawell\Executor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActionsController extends Controller
{
    public function __construct(protected Executor $executor) {}

    /**
     * Execute an action (D40 wire shape in the body; the source comes from the URL).
     * The response is the one report shape (D44), whether the run was sync or queued.
     */
    public function act(Request $request, string $source): JsonResponse
    {
        $user = $this->user($request);

        return $this->respond(fn (): array => $this->executor
            ->act(array_replace($request->all(), ['source' => $source]), $user)
            ->toArray());
    }

    /**
     * A queued run's progress, or its final report once finished (D44, D45).
     * Anyone else's run id reads as nonexistent (D18).
     */
    public function progress(Request $request, string $run): JsonResponse
    {
        $user = $this->user($request);

        return $this->respond(fn (): ?array => $this->executor->progress($run, $user)?->toArray());
    }
}
