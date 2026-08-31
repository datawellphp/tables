import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { EntityRef, FilterCondition, SchemaFilter } from './lib';
import { asText } from './lib';

const NO_VALUE_OPERATORS = new Set(['isEmpty', 'isNotEmpty']);
const LIST_OPERATORS = new Set(['in', 'notIn', 'hasAny', 'hasAll', 'hasNone']);
// D52: operators whose value may be a relative date object instead of an absolute one.
const RELATIVE_OPERATORS = new Set(['on', 'before', 'after']);

type RelativeValue = {
    relative: 'this' | 'last' | 'next' | 'ago' | 'fromNow' | 'now' | 'today';
    n?: number;
    unit?: string;
};

const RELATIVE_KINDS: { id: RelativeValue['relative']; label: string }[] = [
    { id: 'today', label: 'today' },
    { id: 'now', label: 'now' },
    { id: 'this', label: 'this…' },
    { id: 'last', label: 'last n…' },
    { id: 'next', label: 'next n…' },
    { id: 'ago', label: 'n ago' },
    { id: 'fromNow', label: 'n from now' },
];

const UNITS = ['days', 'weeks', 'months', 'quarters', 'years'];

function isRelative(value: unknown): value is RelativeValue {
    return typeof value === 'object' && value !== null && 'relative' in value;
}

function relativeLabel(value: RelativeValue): string {
    if (value.relative === 'today' || value.relative === 'now') {
        return value.relative;
    }

    if (value.relative === 'this') {
        return `this ${value.unit ?? 'month'}`;
    }

    const n = value.n ?? 1;
    const unit = value.unit ?? 'days';

    if (value.relative === 'ago') {
        return `${n} ${unit} ago`;
    }

    if (value.relative === 'fromNow') {
        return `${n} ${unit} from now`;
    }

    return `${value.relative} ${n} ${unit}`;
}

function buildRelative(
    kind: RelativeValue['relative'],
    n: number,
    unit: string,
): RelativeValue {
    if (kind === 'today' || kind === 'now') {
        return { relative: kind };
    }

    if (kind === 'this') {
        // Complete-unit periods take a singular unit (D52).
        return { relative: kind, unit: unit.replace(/s$/, '') };
    }

    return { relative: kind, n, unit };
}

function operatorLabel(operator: string): string {
    const labels: Record<string, string> = {
        equals: 'equals',
        notEquals: 'does not equal',
        contains: 'contains',
        startsWith: 'starts with',
        endsWith: 'ends with',
        isEmpty: 'is empty',
        isNotEmpty: 'is not empty',
        gt: '>',
        gte: '≥',
        lt: '<',
        lte: '≤',
        between: 'between',
        in: 'is any of',
        notIn: 'is none of',
        hasAny: 'has any of',
        hasAll: 'has all of',
        hasNone: 'has none of',
        is: 'is',
        on: 'on',
        before: 'before',
        after: 'after',
    };

    return labels[operator] ?? operator;
}

function summarize(condition: FilterCondition): string {
    if (NO_VALUE_OPERATORS.has(condition.operator)) {
        return '';
    }

    const value = condition.value;

    if (Array.isArray(value)) {
        return value
            .map((item) =>
                typeof item === 'object' && item !== null && 'label' in item
                    ? String((item as EntityRef).label)
                    : String(item),
            )
            .join(', ');
    }

    if (isRelative(value)) {
        return relativeLabel(value);
    }

    if (typeof value === 'object' && value !== null) {
        const range = value as { from?: unknown; to?: unknown };

        return `${asText(range.from)} – ${asText(range.to)}`;
    }

    return asText(value);
}

type EditorProps = {
    filter: SchemaFilter;
    condition: FilterCondition;
    options: EntityRef[] | null;
    onApply: (condition: FilterCondition) => void;
    onClose: () => void;
};

function valueInputType(type: string): string {
    if (type === 'number') {
        return 'number';
    }

    if (type === 'date') {
        return 'date';
    }

    if (type === 'dateTime') {
        return 'datetime-local';
    }

    return 'text';
}

function coerce(type: string, raw: string): unknown {
    if (type === 'number') {
        return raw === '' ? null : Number(raw);
    }

    return raw;
}

function FilterEditor({
    filter,
    condition,
    options,
    onApply,
    onClose,
}: EditorProps) {
    const [operator, setOperator] = useState(condition.operator);
    const [value, setValue] = useState<unknown>(condition.value);
    const [valueMode, setValueMode] = useState<'absolute' | 'relative'>(
        isRelative(condition.value) ? 'relative' : 'absolute',
    );
    const initial = isRelative(condition.value) ? condition.value : null;
    const [relKind, setRelKind] = useState<RelativeValue['relative']>(
        initial?.relative ?? 'last',
    );
    const [relN, setRelN] = useState(initial?.n ?? 7);
    const [relUnit, setRelUnit] = useState(initial?.unit ?? 'days');

    const needsValue = !NO_VALUE_OPERATORS.has(operator);
    const isList = LIST_OPERATORS.has(operator);
    const isBetween = operator === 'between';
    const inputType = valueInputType(filter.type);
    const canRelative =
        (filter.type === 'date' || filter.type === 'dateTime') &&
        RELATIVE_OPERATORS.has(operator);
    const useRelative = canRelative && valueMode === 'relative';

    const selectedIds = new Set(
        Array.isArray(value) ? value.map((item) => String(item)) : [],
    );

    const toggleId = (id: string | number) => {
        const next = new Set(selectedIds);

        if (next.has(String(id))) {
            next.delete(String(id));
        } else {
            next.add(String(id));
        }

        setValue(
            [...next].map((item) =>
                inputType === 'number' ? Number(item) : item,
            ),
        );
    };

    const range = (value ?? {}) as { from?: unknown; to?: unknown };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{filter.label}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label>Operator</Label>
                        <Select value={operator} onValueChange={setOperator}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {filter.operators.map((op) => (
                                    <SelectItem key={op} value={op}>
                                        {operatorLabel(op)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {needsValue && filter.type === 'boolean' && (
                        <Select
                            value={value === false ? 'false' : 'true'}
                            onValueChange={(next) => setValue(next === 'true')}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="true">True</SelectItem>
                                <SelectItem value="false">False</SelectItem>
                            </SelectContent>
                        </Select>
                    )}

                    {needsValue && isList && options !== null && (
                        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border p-2">
                            {options.map((option) => (
                                <label
                                    key={option.id}
                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={selectedIds.has(
                                            String(option.id),
                                        )}
                                        onCheckedChange={() =>
                                            toggleId(option.id)
                                        }
                                    />
                                    {option.label}
                                </label>
                            ))}
                            {options.length === 0 && (
                                <span className="text-muted-foreground text-sm">
                                    No values.
                                </span>
                            )}
                        </div>
                    )}

                    {needsValue && isList && options === null && (
                        <div className="flex flex-col gap-1.5">
                            <Label>Values (comma-separated)</Label>
                            <Input
                                defaultValue={
                                    Array.isArray(value) ? value.join(', ') : ''
                                }
                                onChange={(event) =>
                                    setValue(
                                        event.target.value
                                            .split(',')
                                            .map((item) => item.trim())
                                            .filter((item) => item !== ''),
                                    )
                                }
                            />
                        </div>
                    )}

                    {needsValue && canRelative && (
                        <div className="flex flex-col gap-1.5">
                            <Label>Value type</Label>
                            <Select
                                value={valueMode}
                                onValueChange={(next) =>
                                    setValueMode(
                                        next as 'absolute' | 'relative',
                                    )
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="absolute">
                                        Absolute date
                                    </SelectItem>
                                    <SelectItem value="relative">
                                        Relative
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {needsValue && useRelative && (
                        <div className="flex items-end gap-2">
                            <div className="flex flex-1 flex-col gap-1.5">
                                <Label>Relative</Label>
                                <Select
                                    value={relKind}
                                    onValueChange={(next) =>
                                        setRelKind(
                                            next as RelativeValue['relative'],
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {RELATIVE_KINDS.map((kind) => (
                                            <SelectItem
                                                key={kind.id}
                                                value={kind.id}
                                            >
                                                {kind.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {relKind !== 'today' &&
                                relKind !== 'now' &&
                                relKind !== 'this' && (
                                    <div className="flex w-16 flex-col gap-1.5">
                                        <Label>n</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={relN}
                                            onChange={(event) =>
                                                setRelN(
                                                    Number(
                                                        event.target.value,
                                                    ) || 1,
                                                )
                                            }
                                        />
                                    </div>
                                )}
                            {relKind !== 'today' && relKind !== 'now' && (
                                <div className="flex w-28 flex-col gap-1.5">
                                    <Label>Unit</Label>
                                    <Select
                                        value={relUnit}
                                        onValueChange={setRelUnit}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {UNITS.map((unit) => (
                                                <SelectItem
                                                    key={unit}
                                                    value={unit}
                                                >
                                                    {unit}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}

                    {needsValue &&
                        !isList &&
                        !isBetween &&
                        !useRelative &&
                        filter.type !== 'boolean' && (
                            <div className="flex flex-col gap-1.5">
                                <Label>Value</Label>
                                <Input
                                    type={inputType}
                                    defaultValue={asText(value)}
                                    onChange={(event) =>
                                        setValue(
                                            coerce(
                                                filter.type,
                                                event.target.value,
                                            ),
                                        )
                                    }
                                />
                            </div>
                        )}

                    {needsValue && isBetween && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1.5">
                                <Label>From</Label>
                                <Input
                                    type={inputType}
                                    defaultValue={asText(range.from)}
                                    onChange={(event) =>
                                        setValue({
                                            ...range,
                                            from: coerce(
                                                filter.type,
                                                event.target.value,
                                            ),
                                        })
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>To</Label>
                                <Input
                                    type={inputType}
                                    defaultValue={asText(range.to)}
                                    onChange={(event) =>
                                        setValue({
                                            ...range,
                                            to: coerce(
                                                filter.type,
                                                event.target.value,
                                            ),
                                        })
                                    }
                                />
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        onClick={() =>
                            onApply({
                                filter: filter.key,
                                operator,
                                ...(NO_VALUE_OPERATORS.has(operator)
                                    ? {}
                                    : {
                                          value: useRelative
                                              ? buildRelative(
                                                    relKind,
                                                    relN,
                                                    relUnit,
                                                )
                                              : value,
                                      }),
                            })
                        }
                    >
                        Apply
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type FilterBarProps = {
    filters: SchemaFilter[];
    conditions: FilterCondition[];
    optionsByFilter: Record<string, EntityRef[]>;
    onChange: (conditions: FilterCondition[]) => void;
    onNeedOptions: (filter: SchemaFilter) => void;
};

export function FilterBar({
    filters,
    conditions,
    optionsByFilter,
    onChange,
    onNeedOptions,
}: FilterBarProps) {
    const [editing, setEditing] = useState<number | null>(null);

    const editingCondition = editing === null ? null : conditions[editing];
    const editingFilter =
        editingCondition === null
            ? null
            : (filters.find(
                  (filter) => filter.key === editingCondition.filter,
              ) ?? null);

    const addFilter = (filter: SchemaFilter) => {
        onNeedOptions(filter);
        const condition: FilterCondition = {
            filter: filter.key,
            operator: filter.operators[0],
        };
        onChange([...conditions, condition]);
        setEditing(conditions.length);
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {conditions.map((condition, index) => {
                const filter = filters.find(
                    (item) => item.key === condition.filter,
                );

                return (
                    <Badge
                        key={`${condition.filter}-${index}`}
                        variant="outline"
                        className="cursor-pointer gap-1 py-1"
                        onClick={() => {
                            if (filter) {
                                onNeedOptions(filter);
                            }
                            setEditing(index);
                        }}
                    >
                        <span className="font-medium">
                            {filter?.label ?? condition.filter}
                        </span>
                        <span className="text-muted-foreground">
                            {operatorLabel(condition.operator)}
                        </span>
                        <span>{summarize(condition)}</span>
                        <button
                            aria-label="Remove filter"
                            onClick={(event) => {
                                event.stopPropagation();
                                onChange(
                                    conditions.filter((_, i) => i !== index),
                                );
                            }}
                        >
                            <X className="size-3" />
                        </button>
                    </Badge>
                );
            })}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                        <Plus className="size-4" /> Filter
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {filters.map((filter) => (
                        <DropdownMenuItem
                            key={filter.key}
                            onSelect={() => addFilter(filter)}
                        >
                            {filter.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {editing !== null && editingFilter && editingCondition && (
                <FilterEditor
                    filter={editingFilter}
                    condition={editingCondition}
                    options={optionsByFilter[editingFilter.key] ?? null}
                    onApply={(next) => {
                        onChange(
                            conditions.map((condition, index) =>
                                index === editing ? next : condition,
                            ),
                        );
                        setEditing(null);
                    }}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
}
