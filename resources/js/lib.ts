// Types for the Datawell wire contract (docs/datasource-examples.md; D05/D40/D44)
// and a tiny same-origin client for the datawell/tables endpoints.

export type SourceSummary = {
    key: string;
    name: string;
    description: string;
};

export type SharedProps = {
    name: string;
    auth: { user: { id: number; name: string; email: string } | null };
    sources: SourceSummary[];
    sidebarOpen: boolean;
    [key: string]: unknown;
};

export type EntityRef = {
    id: number | string;
    label: string;
    url?: string;
};

export type SchemaParameter = {
    key: string;
    label: string;
    type: string;
    required: boolean;
    rules?: string[];
    from?: { source: string };
};

export type FieldOptions =
    | { strategy: 'inline'; values: EntityRef[] }
    | { strategy: 'source'; source: string }
    | { strategy: 'selfFacet' };

export type SchemaField = {
    key: string;
    label: string;
    type: string;
    cardinality: 'single' | 'many';
    source?: string;
    sortable?: boolean;
    filterable?: boolean;
    searchable?: boolean;
    groupable?: boolean;
    nullable?: boolean;
    grains?: string[];
    aggregates?: string[];
    options?: FieldOptions;
};

export type SchemaFilter = {
    key: string;
    label: string;
    type: string;
    operators: string[];
};

export type ActionParameter = SchemaParameter;

export type SchemaAction = {
    key: string;
    label: string;
    kind: 'server' | 'link' | 'client';
    targets: ('single' | 'many' | 'queryScope' | 'standalone')[];
    destructive?: boolean;
    confirmation?: 'always' | 'whenDelegated' | 'never';
    humanOnly?: boolean;
    parameters?: ActionParameter[];
    description?: string;
};

export type Schema = {
    source: {
        key: string;
        name: string;
        description: string;
        timezone: string;
        representation: { id: string; label: string };
    };
    parameters: SchemaParameter[];
    fields: SchemaField[];
    filters: SchemaFilter[];
    sorts: { key: string; label: string }[];
    defaultSort: { key: string; direction: 'asc' | 'desc' }[];
    actions: SchemaAction[];
};

export type FilterCondition = {
    filter: string;
    operator: string;
    value?: unknown;
};

export type FilterGroup = {
    boolean?: 'and' | 'or';
    conditions: (FilterCondition | FilterGroup)[];
};

export type SortSpec = { key: string; direction: 'asc' | 'desc' };

export type PageSpec = {
    size?: number;
    number?: number;
    after?: string;
    withTotal?: boolean;
};

export type GroupSpec = { key: string; grain?: string };

export type AggregateSpec = { fn: string; field?: string };

export type QueryBody = {
    parameters?: Record<string, unknown>;
    search?: string;
    filters?: FilterGroup;
    sorts?: SortSpec[];
    groupBy?: GroupSpec[];
    aggregates?: AggregateSpec[];
    page?: PageSpec;
};

export type PageMeta = {
    mode: 'cursor' | 'offset';
    size: number;
    hasMore: boolean;
    number?: number;
    total?: number;
    nextCursor?: string | null;
};

// A row: id, optional url, per-row action map, then one entry per field.
export type RowActions = Record<
    string,
    true | string | Record<string, unknown>
>;

export type Row = {
    id: number | string;
    url?: string;
    actions: RowActions;
    [field: string]: unknown;
};

export type ManyValues = { items: EntityRef[]; total: number };

export type QueryResult = {
    rows: Row[];
    meta: PageMeta;
    applied: {
        filters?: FilterGroup;
        sorts?: SortSpec[];
        search?: string | null;
        [key: string]: unknown;
    };
};

// A bucket: one EntityRef per group dimension plus one number per aggregate.
export type Bucket = Record<string, EntityRef | number | null>;

export type BucketResult = {
    buckets: Bucket[];
    meta: { count: number; truncated: boolean };
    applied: Record<string, unknown>;
};

export type ActionTarget =
    | { ids: (number | string)[] }
    | {
          query: { filters?: FilterGroup; search?: string };
          except?: (number | string)[];
      };

export type ActionBody = {
    action: string;
    parameters?: Record<string, unknown>;
    target?: ActionTarget;
    input?: Record<string, unknown>;
};

export type ActionReport = {
    status: string;
    counts: {
        targeted: number;
        succeeded: number;
        failed: number;
        skipped: number;
    };
    failures?: { id: number | string; reason: string }[];
    truncated?: boolean;
    skipped?: { id: number | string; reason: string }[];
    message?: string;
    links?: { label: string; url: string }[];
    runId?: string;
    progress?: { processed: number; total: number };
};

export type WireError = {
    status: number;
    message: string;
    errors: Record<string, string[]>;
};

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...init,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    const body = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
    >;

    if (!response.ok) {
        throw {
            status: response.status,
            message:
                typeof body.message === 'string'
                    ? body.message
                    : 'Request failed.',
            errors: (body.errors ?? {}) as Record<string, string[]>,
        } satisfies WireError;
    }

    return body as T;
}

function queryString(params: Record<string, unknown>): string {
    const search = new URLSearchParams();

    const append = (prefix: string, value: unknown) => {
        if (value === undefined || value === null) {
            return;
        }

        if (typeof value === 'object') {
            for (const [key, nested] of Object.entries(
                value as Record<string, unknown>,
            )) {
                append(prefix === '' ? key : `${prefix}[${key}]`, nested);
            }

            return;
        }

        search.append(prefix, String(value as string | number | boolean));
    };

    append('', params);
    const encoded = search.toString();

    return encoded === '' ? '' : `?${encoded}`;
}

export const datawell = {
    schema: (source: string) =>
        request<Schema>(`/datawell/sources/${source}/schema`),

    query: (source: string, body: QueryBody) =>
        request<QueryResult>(`/datawell/sources/${source}/query`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // The same endpoint: a request with groupBy/aggregates returns buckets (D39).
    queryBuckets: (source: string, body: QueryBody) =>
        request<BucketResult>(`/datawell/sources/${source}/query`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    act: (source: string, body: ActionBody) =>
        request<ActionReport>(`/datawell/sources/${source}/actions`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    progress: (runId: string) =>
        request<ActionReport>(`/datawell/runs/${runId}`),

    lookup: (source: string, id: number | string, parameters = {}) =>
        request<EntityRef>(
            `/datawell/sources/${source}/entities/${id}${queryString({ parameters })}`,
        ),

    values: (
        source: string,
        id: number | string,
        field: string,
        page: PageSpec = {},
        parameters: Record<string, unknown> = {},
    ) =>
        request<QueryResult>(
            `/datawell/sources/${source}/entities/${id}/values/${field}${queryString({ page, parameters })}`,
        ),
};

export function asText(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value as string | number | boolean);
}

export function isWireError(error: unknown): error is WireError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        'errors' in error
    );
}
