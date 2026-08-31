import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import type {
    ActionReport,
    ActionTarget,
    Row,
    SchemaAction,
} from './lib';
import { datawell } from './lib';

export type PendingAction = {
    action: SchemaAction;
    target: ActionTarget;
};

function describeReport(report: ActionReport): string {
    const { counts } = report;
    const parts = [`${counts.succeeded} succeeded`];

    if (counts.failed > 0) {
        parts.push(`${counts.failed} failed`);
    }

    if (counts.skipped > 0) {
        parts.push(`${counts.skipped} skipped`);
    }

    return parts.join(', ');
}

async function awaitRun(report: ActionReport): Promise<ActionReport> {
    let current = report;

    while (current.runId && current.progress) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        current = await datawell.progress(current.runId);
    }

    return current;
}

export async function runServerAction(
    source: string,
    pending: PendingAction,
    parameters: Record<string, unknown>,
    input: Record<string, unknown>,
): Promise<ActionReport> {
    const initial = await datawell.act(source, {
        action: pending.action.key,
        parameters,
        target: pending.target,
        ...(Object.keys(input).length > 0 ? { input } : {}),
    });

    const report = await awaitRun(initial);
    const summary = describeReport(report);
    const message = report.message ? `${report.message} ${summary}` : summary;

    const detail = [...(report.failures ?? []), ...(report.skipped ?? [])]
        .slice(0, 5)
        .map((failure) => `#${failure.id}: ${failure.reason}`)
        .join('\n');

    if (report.counts.failed > 0) {
        toast.error(message, { description: detail || undefined });
    } else {
        toast.success(message, { description: detail || undefined });
    }

    return report;
}

type ActionDialogProps = {
    source: string;
    pending: PendingAction;
    onDone: () => void;
    onClose: () => void;
};

export function ServerActionDialog({
    source,
    pending,
    onDone,
    onClose,
}: ActionDialogProps) {
    const [input, setInput] = useState<Record<string, unknown>>({});
    const [busy, setBusy] = useState(false);
    const { action } = pending;

    const submit = async () => {
        setBusy(true);

        try {
            await runServerAction(source, pending, {}, input);
            onDone();
            onClose();
        } catch (error) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error
                    ? String((error as { message: unknown }).message)
                    : 'The action failed.';
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{action.label}</DialogTitle>
                    {action.description && (
                        <DialogDescription>
                            {action.description}
                        </DialogDescription>
                    )}
                </DialogHeader>

                {(action.parameters ?? []).map((parameter) => (
                    <div key={parameter.key} className="flex flex-col gap-1.5">
                        <Label>
                            {parameter.label}
                            {parameter.required ? ' *' : ''}
                        </Label>
                        <Input
                            onChange={(event) =>
                                setInput((previous) => ({
                                    ...previous,
                                    [parameter.key]: event.target.value,
                                }))
                            }
                        />
                    </div>
                ))}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        variant={action.destructive ? 'destructive' : 'default'}
                        onClick={() => void submit()}
                        disabled={busy}
                    >
                        {busy ? 'Running…' : action.label}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type RowActionsProps = {
    row: Row;
    actions: SchemaAction[];
    onServer: (pending: PendingAction) => void;
};

export function RowActionsMenu({ row, actions, onServer }: RowActionsProps) {
    const available = actions.filter(
        (action) =>
            action.targets.includes('single') && action.key in row.actions,
    );

    if (available.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Row actions">
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {available.map((action) => {
                    const resolution = row.actions[action.key];

                    if (action.kind === 'link') {
                        return (
                            <DropdownMenuItem key={action.key} asChild>
                                <a
                                    href={
                                        typeof resolution === 'string'
                                            ? resolution
                                            : '#'
                                    }
                                >
                                    {action.label}
                                </a>
                            </DropdownMenuItem>
                        );
                    }

                    if (action.kind === 'client') {
                        return (
                            <DropdownMenuItem
                                key={action.key}
                                onSelect={() =>
                                    toast.info(
                                        `${action.label}: ${JSON.stringify(resolution)}`,
                                    )
                                }
                            >
                                {action.label}
                            </DropdownMenuItem>
                        );
                    }

                    return (
                        <DropdownMenuItem
                            key={action.key}
                            variant={
                                action.destructive ? 'destructive' : 'default'
                            }
                            onSelect={() =>
                                onServer({
                                    action,
                                    target: { ids: [row.id] },
                                })
                            }
                        >
                            {action.label}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
