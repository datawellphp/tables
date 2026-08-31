import { useEffect, useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type {
    AggregateSpec,
    Bucket,
    BucketResult,
    EntityRef,
    FilterCondition,
    QueryBody,
    Schema,
} from './lib';
import { datawell, isWireError } from './lib';

type GroupViewProps = {
    schema: Schema;
    parameters: Record<string, unknown>;
    conditions: FilterCondition[];
    search: string;
};

const GRAIN_LABELS: Record<string, string> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
    quarter: 'Quarter',
    year: 'Year',
};

function aggregateKey(aggregate: AggregateSpec): string {
    return aggregate.field === undefined
        ? aggregate.fn
        : `${aggregate.fn}_${aggregate.field}`;
}

function aggregateLabel(aggregate: AggregateSpec, schema: Schema): string {
    if (aggregate.field === undefined) {
        return 'Count';
    }

    const field = schema.fields.find((item) => item.key === aggregate.field);

    return `${aggregate.fn.toUpperCase()} of ${field?.label ?? aggregate.field}`;
}

export function GroupView({
    schema,
    parameters,
    conditions,
    search,
}: GroupViewProps) {
    const groupable = schema.fields.filter((field) => field.groupable);
    const measurable = schema.fields.filter(
        (field) => (field.aggregates ?? []).length > 0,
    );

    const [dimension, setDimension] = useState(groupable[0]?.key ?? '');
    const [grain, setGrain] = useState<string | undefined>(undefined);
    const [measures, setMeasures] = useState<AggregateSpec[]>([]);
    const [result, setResult] = useState<BucketResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string[] | null>(null);

    const field = schema.fields.find((item) => item.key === dimension);
    const grains = field?.grains ?? [];
    const effectiveGrain = grains.length > 0 ? (grain ?? grains[0]) : undefined;

    const body: QueryBody = useMemo(
        () => ({
            ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
            ...(search !== '' ? { search } : {}),
            ...(conditions.length > 0 ? { filters: { conditions } } : {}),
            groupBy: [
                {
                    key: dimension,
                    ...(effectiveGrain !== undefined
                        ? { grain: effectiveGrain }
                        : {}),
                },
            ],
            aggregates: [{ fn: 'count' }, ...measures],
        }),
        [parameters, search, conditions, dimension, effectiveGrain, measures],
    );

    useEffect(() => {
        if (dimension === '') {
            return;
        }

        let cancelled = false;
        setLoading(true);

        datawell
            .queryBuckets(schema.source.key, body)
            .then((next) => {
                if (!cancelled) {
                    setResult(next);
                    setError(null);
                }
            })
            .catch((requestError: unknown) => {
                if (cancelled) {
                    return;
                }

                setError(
                    isWireError(requestError)
                        ? Object.values(requestError.errors).flat()
                        : ['The request failed.'],
                );
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [schema.source.key, body, dimension]);

    if (groupable.length === 0) {
        return (
            <div className="text-muted-foreground rounded-md border p-6 text-sm">
                This source publishes no groupable fields.
            </div>
        );
    }

    const aggregates: AggregateSpec[] = [{ fn: 'count' }, ...measures];
    const buckets = result?.buckets ?? [];
    const counts = buckets.map((bucket) => Number(bucket.count ?? 0));
    const maxCount = Math.max(1, ...counts);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label>Group by</Label>
                    <Select
                        value={dimension}
                        onValueChange={(next) => {
                            setDimension(next);
                            setGrain(undefined);
                        }}
                    >
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {groupable.map((item) => (
                                <SelectItem key={item.key} value={item.key}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {grains.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <Label>Grain</Label>
                        <Select value={effectiveGrain} onValueChange={setGrain}>
                            <SelectTrigger className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {grains.map((item) => (
                                    <SelectItem key={item} value={item}>
                                        {GRAIN_LABELS[item] ?? item}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {measurable.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <Label>Measures</Label>
                        <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
                            {measurable.flatMap((item) =>
                                (item.aggregates ?? []).map((fn) => {
                                    const spec: AggregateSpec = {
                                        fn,
                                        field: item.key,
                                    };
                                    const active = measures.some(
                                        (measure) =>
                                            aggregateKey(measure) ===
                                            aggregateKey(spec),
                                    );

                                    return (
                                        <label
                                            key={aggregateKey(spec)}
                                            className="flex cursor-pointer items-center gap-1.5 text-sm"
                                        >
                                            <Checkbox
                                                checked={active}
                                                onCheckedChange={(checked) =>
                                                    setMeasures(
                                                        checked
                                                            ? [
                                                                  ...measures,
                                                                  spec,
                                                              ]
                                                            : measures.filter(
                                                                  (measure) =>
                                                                      aggregateKey(
                                                                          measure,
                                                                      ) !==
                                                                      aggregateKey(
                                                                          spec,
                                                                      ),
                                                              ),
                                                    )
                                                }
                                            />
                                            {aggregateLabel(spec, schema)}
                                        </label>
                                    );
                                }),
                            )}
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
                    {error.map((message, index) => (
                        <div key={index}>{message}</div>
                    ))}
                </div>
            )}

            <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b text-left">
                            <th className="px-3 py-2 font-medium">
                                {field?.label ?? dimension}
                            </th>
                            {aggregates.map((aggregate) => (
                                <th
                                    key={aggregateKey(aggregate)}
                                    className="px-3 py-2 text-right font-medium"
                                >
                                    {aggregateLabel(aggregate, schema)}
                                </th>
                            ))}
                            <th className="w-1/3 px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {loading && buckets.length === 0 && (
                            <tr>
                                <td
                                    colSpan={aggregates.length + 2}
                                    className="px-3 py-4"
                                >
                                    <Skeleton className="h-16 w-full" />
                                </td>
                            </tr>
                        )}
                        {!loading && buckets.length === 0 && (
                            <tr>
                                <td
                                    colSpan={aggregates.length + 2}
                                    className="text-muted-foreground px-3 py-8 text-center"
                                >
                                    No buckets.
                                </td>
                            </tr>
                        )}
                        {buckets.map((bucket: Bucket, index) => {
                            const ref = bucket[dimension] as EntityRef | null;
                            const count = Number(bucket.count ?? 0);

                            return (
                                <tr
                                    key={ref?.id ?? `null-${index}`}
                                    className="border-b last:border-0"
                                >
                                    <td className="px-3 py-2">
                                        {ref === null ? (
                                            <span className="text-muted-foreground">
                                                (none)
                                            </span>
                                        ) : (
                                            ref.label
                                        )}
                                    </td>
                                    {aggregates.map((aggregate) => {
                                        const value =
                                            bucket[aggregateKey(aggregate)];

                                        return (
                                            <td
                                                key={aggregateKey(aggregate)}
                                                className="px-3 py-2 text-right tabular-nums"
                                            >
                                                {value === null ||
                                                value === undefined
                                                    ? '—'
                                                    : String(
                                                          value as
                                                              | number
                                                              | string,
                                                      )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-3 py-2">
                                        <div
                                            className="bg-primary/60 h-2 rounded"
                                            style={{
                                                width: `${Math.max(2, Math.round((count / maxCount) * 100))}%`,
                                            }}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {result?.meta.truncated && (
                <div className="text-muted-foreground text-xs">
                    Bucket list truncated at the server cap.
                </div>
            )}
        </div>
    );
}
