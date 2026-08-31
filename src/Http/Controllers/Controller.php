<?php

declare(strict_types=1);

namespace Datawell\Tables\Http\Controllers;

use Datawell\Exceptions\SourceNotFoundException;
use Datawell\Validation\ValidationException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The shared response discipline: core exceptions map onto HTTP the way the
 * decision log reads them — validation failures are 422s with the error bag,
 * and anything unknown, hidden, or out of scope is an indistinguishable 404 (D18).
 */
abstract class Controller
{
    /**
     * @param  callable(): mixed  $callback
     */
    protected function respond(callable $callback): JsonResponse
    {
        try {
            $payload = $callback();
        } catch (ValidationException $exception) {
            return new JsonResponse([
                'message' => $exception->getMessage(),
                'errors' => $exception->errors(),
            ], 422);
        } catch (SourceNotFoundException) {
            return $this->notFound();
        }

        return $payload === null ? $this->notFound() : new JsonResponse($payload);
    }

    protected function notFound(): JsonResponse
    {
        return new JsonResponse(['message' => 'Not found.'], 404);
    }

    protected function user(Request $request): Authenticatable
    {
        return $request->user() ?? abort(401);
    }

    /**
     * A named object from the query string: absent reads as empty, anything
     * that is not an object is a request error.
     *
     * @return array<string, mixed>
     */
    protected function queryObject(Request $request, string $key): array
    {
        $value = $request->query($key);

        if ($value === null) {
            return [];
        }

        if (! is_array($value)) {
            throw ValidationException::withErrors([$key => [sprintf('%s must be an object.', ucfirst($key))]]);
        }

        return $value;
    }
}
