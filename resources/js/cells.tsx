import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import type { EntityRef, ManyValues, SchemaField } from './lib';
import { asText, datawell } from './lib';

export type CellContext = {
    sourceKey: string;
    rowId: number | string;
    parameters: Record<string, unknown>;
};

function Muted() {
    return <span className="text-muted-foreground">—</span>;
}

function Ref({ value }: { value: EntityRef }) {
    if (value.url) {
        return (
            <a
                href={value.url}
                className="text-primary underline-offset-2 hover:underline"
            >
                {value.label}
            </a>
        );
    }

    return <Badge variant="secondary">{value.label}</Badge>;
}

function ManyRefs({
    value,
    field,
    context,
}: {
    value: ManyValues;
    field: SchemaField;
    context?: CellContext;
}) {
    const [all, setAll] = useState<EntityRef[] | null>(null);
    const [loading, setLoading] = useState(false);
    const shown = value.items.slice(0, 3);
    const remainder = value.total - shown.length;
    const items = all ?? value.items;

    // Page the remainder through the values endpoint (D56).
    const loadAll = async () => {
        if (context === undefined || loading) {
            return;
        }

        setLoading(true);

        try {
            const collected = [...value.items];
            let after: string | undefined;

            for (let page = 0; page < 20; page++) {
                const result = await datawell.values(
                    context.sourceKey,
                    context.rowId,
                    field.key,
                    { size: 50, ...(after !== undefined ? { after } : {}) },
                    context.parameters,
                );
                collected.push(...(result.rows as unknown as EntityRef[]));

                if (!result.meta.hasMore || !result.meta.nextCursor) {
                    break;
                }

                after = result.meta.nextCursor;
            }

            // The first page overlaps the capped items; dedupe by id.
            const seen = new Set<string>();
            setAll(
                collected.filter((item) => {
                    if (seen.has(String(item.id))) {
                        return false;
                    }

                    seen.add(String(item.id));

                    return true;
                }),
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <span className="flex flex-wrap items-center gap-1">
            {shown.map((item) => (
                <Ref key={item.id} value={item} />
            ))}
            {remainder > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Badge className="cursor-pointer" variant="outline">
                            +{remainder}
                        </Badge>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-72 overflow-y-auto">
                        <DropdownMenuLabel>
                            {value.total} in total
                        </DropdownMenuLabel>
                        {items.map((item) => (
                            <div key={item.id} className="px-2 py-1 text-sm">
                                {item.label}
                            </div>
                        ))}
                        {all === null &&
                            value.total > value.items.length &&
                            context !== undefined && (
                                <button
                                    className="text-primary px-2 py-1 text-xs underline-offset-2 hover:underline"
                                    onClick={() => void loadAll()}
                                >
                                    {loading
                                        ? 'Loading…'
                                        : `Load all ${value.total}`}
                                </button>
                            )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </span>
    );
}

export function Cell({
    field,
    value,
    context,
}: {
    field: SchemaField;
    value: unknown;
    context?: CellContext;
}) {
    if (value === null || value === undefined) {
        return <Muted />;
    }

    if (field.type === 'relation') {
        if (field.cardinality === 'many') {
            return (
                <ManyRefs
                    value={value as ManyValues}
                    field={field}
                    context={context}
                />
            );
        }

        return <Ref value={value as EntityRef} />;
    }

    if (field.type === 'enum') {
        return <Badge variant="secondary">{(value as EntityRef).label}</Badge>;
    }

    if (field.type === 'boolean') {
        return value ? (
            <Check className="size-4 text-green-600" />
        ) : (
            <X className="text-muted-foreground size-4" />
        );
    }

    if (field.type === 'dateTime') {
        return (
            <span title={asText(value)}>
                {new Date(asText(value)).toLocaleString()}
            </span>
        );
    }

    if (field.type === 'number') {
        return <span className="tabular-nums">{asText(value)}</span>;
    }

    return <span>{asText(value)}</span>;
}
