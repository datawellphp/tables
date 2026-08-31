import {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    Columns3,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    RowActionsMenu,
    ServerActionDialog,
    type PendingAction,
} from './actions';
import { Cell } from './cells';
import { FilterBar } from './filters';
import { GroupView } from './group-view';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type {
    EntityRef,
    FilterCondition,
    QueryBody,
    QueryResult,
    Row,
    Schema,
    SchemaFilter,
    SortSpec,
} from './lib';
import { datawell, isWireError } from './lib';

type DataTableProps = {
    schema: Schema;
    parameters: Record<string, unknown>;
};

async function loadOptions(sourceKey: string): Promise<EntityRef[]> {
    const [schema, result] = await Promise.all([
        datawell.schema(sourceKey),
        datawell.query(sourceKey, { page: { size: 50 } }),
    ]);

    const labelKey = schema.source.representation.label;

    return result.rows.map((row) => {
        const raw = row[labelKey];
        const label =
            typeof raw === 'object' && raw !== null && 'label' in raw
                ? String((raw as EntityRef).label)
                : typeof raw === 'string'
                  ? raw
                  : String(row.id);

        return { id: row.id, label };
    });
}

export function DataTable({ schema, parameters }: DataTableProps) {
    const sourceKey = schema.source.key;

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [conditions, setConditions] = useState<FilterCondition[]>([]);
    const [sorts, setSorts] = useState<SortSpec[]>([]);
    const [pageMode, setPageMode] = useState<'cursor' | 'offset'>('cursor');
    const [pageSize, setPageSize] = useState(25);
    const [pageNumber, setPageNumber] = useState(1);
    const [cursors, setCursors] = useState<string[]>([]);
    const [hidden, setHidden] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Set<number | string>>(new Set());
    const [allMatching, setAllMatching] = useState(false);
    const [result, setResult] = useState<QueryResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string[] | null>(null);
    const [pending, setPending] = useState<PendingAction | null>(null);
    const [optionsByFilter, setOptionsByFilter] = useState<
        Record<string, EntityRef[]>
    >({});
    const requestedOptions = useRef(new Set<string>());
    const [refreshToken, setRefreshToken] = useState(0);
    const [view, setView] = useState<'rows' | 'buckets'>('rows');

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(search), 300);

        return () => clearTimeout(handle);
    }, [search]);

    const body: QueryBody = useMemo(
        () => ({
            ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
            ...(debouncedSearch !== '' ? { search: debouncedSearch } : {}),
            ...(conditions.length > 0 ? { filters: { conditions } } : {}),
            ...(sorts.length > 0 ? { sorts } : {}),
            page:
                pageMode === 'cursor'
                    ? {
                          size: pageSize,
                          ...(cursors.length > 0
                              ? { after: cursors[cursors.length - 1] }
                              : {}),
                      }
                    : { size: pageSize, number: pageNumber, withTotal: true },
        }),
        [
            parameters,
            debouncedSearch,
            conditions,
            sorts,
            pageMode,
            pageSize,
            pageNumber,
            cursors,
        ],
    );

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        datawell
            .query(sourceKey, body)
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

                if (isWireError(requestError)) {
                    setError(Object.values(requestError.errors).flat());
                } else {
                    setError(['The request failed.']);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [sourceKey, body, refreshToken]);

    const refresh = useCallback(() => {
        setSelected(new Set());
        setAllMatching(false);
        setRefreshToken((token) => token + 1);
    }, []);

    const resetPaging = () => {
        setCursors([]);
        setPageNumber(1);
        setSelected(new Set());
        setAllMatching(false);
    };

    const fields = schema.fields.filter((field) => !hidden.has(field.key));
    const rows = result?.rows ?? [];
    const meta = result?.meta;

    const sortFor = (key: string) =>
        sorts.find((sort) => sort.key === key)?.direction;

    const toggleSort = (key: string) => {
        const current = sortFor(key);
        resetPaging();

        if (current === undefined) {
            setSorts([{ key, direction: 'asc' }]);
        } else if (current === 'asc') {
            setSorts([{ key, direction: 'desc' }]);
        } else {
            setSorts([]);
        }
    };

    const ensureOptions = (filter: SchemaFilter) => {
        const field = schema.fields.find((item) => item.key === filter.key);

        if (!field || requestedOptions.current.has(filter.key)) {
            return;
        }

        requestedOptions.current.add(filter.key);

        if (field.options && field.options.strategy === 'inline') {
            setOptionsByFilter((previous) => ({
                ...previous,
                [filter.key]: (field.options as { values: EntityRef[] }).values,
            }));

            return;
        }

        const target =
            field.options && field.options.strategy === 'source'
                ? field.options.source
                : field.source;

        if (target === undefined) {
            return;
        }

        void loadOptions(target).then((options) =>
            setOptionsByFilter((previous) => ({
                ...previous,
                [filter.key]: options,
            })),
        );
    };

    const pageSelected =
        rows.length > 0 && rows.every((row) => selected.has(row.id));

    const togglePage = () => {
        if (pageSelected) {
            setSelected(new Set());
            setAllMatching(false);
        } else {
            setSelected(new Set(rows.map((row) => row.id)));
        }
    };

    const bulkActions = schema.actions.filter(
        (action) =>
            action.kind === 'server' &&
            (action.targets.includes('many') ||
                action.targets.includes('queryScope')),
    );

    const bulkTarget = (): PendingAction['target'] =>
        allMatching
            ? {
                  query: {
                      ...(conditions.length > 0
                          ? { filters: { conditions } }
                          : {}),
                      ...(debouncedSearch !== ''
                          ? { search: debouncedSearch }
                          : {}),
                  },
              }
            : { ids: [...selected] };

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    placeholder="Search…"
                    className="w-56"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        resetPaging();
                    }}
                />
                <FilterBar
                    filters={schema.filters}
                    conditions={conditions}
                    optionsByFilter={optionsByFilter}
                    onChange={(next) => {
                        setConditions(next);
                        resetPaging();
                    }}
                    onNeedOptions={ensureOptions}
                />
                <div className="ml-auto flex items-center gap-2">
                    {schema.fields.some((field) => field.groupable) && (
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={view}
                            onValueChange={(next) =>
                                next !== '' &&
                                setView(next as 'rows' | 'buckets')
                            }
                        >
                            <ToggleGroupItem value="rows">Rows</ToggleGroupItem>
                            <ToggleGroupItem value="buckets">
                                Buckets
                            </ToggleGroupItem>
                        </ToggleGroup>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Columns3 className="size-4" /> Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {schema.fields.map((field) => (
                                <DropdownMenuCheckboxItem
                                    key={field.key}
                                    checked={!hidden.has(field.key)}
                                    onCheckedChange={(checked) => {
                                        const next = new Set(hidden);

                                        if (checked) {
                                            next.delete(field.key);
                                        } else {
                                            next.add(field.key);
                                        }

                                        setHidden(next);
                                    }}
                                >
                                    {field.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {(selected.size > 0 || allMatching) && (
                <div className="bg-accent flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm">
                    <span>
                        {allMatching
                            ? 'Every row matching the current query'
                            : `${selected.size} selected`}
                    </span>
                    {!allMatching && pageSelected && meta?.hasMore && (
                        <Button
                            variant="link"
                            size="sm"
                            onClick={() => setAllMatching(true)}
                        >
                            Select all matching
                        </Button>
                    )}
                    {bulkActions.map((action) => {
                        const usable = allMatching
                            ? action.targets.includes('queryScope')
                            : action.targets.includes('many');

                        return (
                            <Button
                                key={action.key}
                                variant={
                                    action.destructive
                                        ? 'destructive'
                                        : 'outline'
                                }
                                size="sm"
                                disabled={!usable}
                                title={
                                    usable
                                        ? action.description
                                        : 'Not available for this selection'
                                }
                                onClick={() =>
                                    setPending({
                                        action,
                                        target: bulkTarget(),
                                    })
                                }
                            >
                                {action.label}
                            </Button>
                        );
                    })}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => {
                            setSelected(new Set());
                            setAllMatching(false);
                        }}
                    >
                        Clear
                    </Button>
                </div>
            )}

            {error && (
                <div className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
                    {error.map((message, index) => (
                        <div key={index}>{message}</div>
                    ))}
                </div>
            )}

            {view === 'buckets' && (
                <GroupView
                    schema={schema}
                    parameters={parameters}
                    conditions={conditions}
                    search={debouncedSearch}
                />
            )}

            {view === 'rows' && (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left">
                                <th className="w-10 px-3 py-2">
                                    <Checkbox
                                        checked={pageSelected}
                                        onCheckedChange={togglePage}
                                        aria-label="Select page"
                                    />
                                </th>
                                {fields.map((field) => (
                                    <th
                                        key={field.key}
                                        className="px-3 py-2 font-medium"
                                    >
                                        {field.sortable ? (
                                            <button
                                                className="flex items-center gap-1"
                                                onClick={() =>
                                                    toggleSort(field.key)
                                                }
                                            >
                                                {field.label}
                                                {sortFor(field.key) ===
                                                    'asc' && (
                                                    <ArrowUp className="size-3" />
                                                )}
                                                {sortFor(field.key) ===
                                                    'desc' && (
                                                    <ArrowDown className="size-3" />
                                                )}
                                            </button>
                                        ) : (
                                            field.label
                                        )}
                                    </th>
                                ))}
                                <th className="w-10 px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading && rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={fields.length + 2}
                                        className="px-3 py-4"
                                    >
                                        <Skeleton className="h-24 w-full" />
                                    </td>
                                </tr>
                            )}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={fields.length + 2}
                                        className="text-muted-foreground px-3 py-8 text-center"
                                    >
                                        No rows match.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row: Row) => (
                                <tr
                                    key={row.id}
                                    className="hover:bg-accent/40 border-b last:border-0"
                                >
                                    <td className="px-3 py-2">
                                        <Checkbox
                                            checked={selected.has(row.id)}
                                            onCheckedChange={(checked) => {
                                                const next = new Set(selected);

                                                if (checked) {
                                                    next.add(row.id);
                                                } else {
                                                    next.delete(row.id);
                                                    setAllMatching(false);
                                                }

                                                setSelected(next);
                                            }}
                                            aria-label={`Select row ${row.id}`}
                                        />
                                    </td>
                                    {fields.map((field) => (
                                        <td
                                            key={field.key}
                                            className="px-3 py-2 align-middle"
                                        >
                                            <Cell
                                                field={field}
                                                value={row[field.key]}
                                                context={{
                                                    sourceKey,
                                                    rowId: row.id,
                                                    parameters,
                                                }}
                                            />
                                        </td>
                                    ))}
                                    <td className="px-3 py-2 text-right">
                                        <RowActionsMenu
                                            row={row}
                                            actions={schema.actions}
                                            onServer={setPending}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {view === 'rows' && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Select
                        value={String(pageSize)}
                        onValueChange={(next) => {
                            setPageSize(Number(next));
                            resetPaging();
                        }}
                    >
                        <SelectTrigger className="w-24">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 25, 50, 100].map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size} rows
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={pageMode}
                        onValueChange={(next) => {
                            setPageMode(next as 'cursor' | 'offset');
                            resetPaging();
                        }}
                    >
                        <SelectTrigger className="w-28">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cursor">Cursor</SelectItem>
                            <SelectItem value="offset">Pages</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="text-muted-foreground ml-auto flex items-center gap-2">
                        {pageMode === 'offset' && meta?.total !== undefined && (
                            <span>
                                Page {meta.number} · {meta.total} rows
                            </span>
                        )}
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={
                                pageMode === 'cursor'
                                    ? cursors.length === 0
                                    : pageNumber <= 1
                            }
                            onClick={() => {
                                setSelected(new Set());
                                setAllMatching(false);

                                if (pageMode === 'cursor') {
                                    setCursors(cursors.slice(0, -1));
                                } else {
                                    setPageNumber(pageNumber - 1);
                                }
                            }}
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={!meta?.hasMore}
                            onClick={() => {
                                setSelected(new Set());
                                setAllMatching(false);

                                if (pageMode === 'cursor') {
                                    if (meta?.nextCursor) {
                                        setCursors([
                                            ...cursors,
                                            meta.nextCursor,
                                        ]);
                                    }
                                } else {
                                    setPageNumber(pageNumber + 1);
                                }
                            }}
                            aria-label="Next page"
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}

            {pending && (
                <ServerActionDialog
                    source={sourceKey}
                    pending={pending}
                    onDone={refresh}
                    onClose={() => setPending(null)}
                />
            )}
        </div>
    );
}
