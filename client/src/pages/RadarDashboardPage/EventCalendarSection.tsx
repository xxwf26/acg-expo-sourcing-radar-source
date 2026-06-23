import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import type { IEvent } from '@/api/types';

export default function EventCalendarSection({ events }: { events: IEvent[] }) {
  return (
    <div className="space-y-3">
      {events.map((event) => (
        <article key={event.id} className="flex gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="text-lg font-bold leading-none">{event.month}</span>
            <span className="mt-1 text-xs font-medium">{event.short}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">{event.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {event.date} · {event.city} · {event.venue}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {event.status && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  {event.status}
                </Badge>
              )}
              {(event.tags || []).map((t) => (
                <Badge key={t} variant="secondary" className="font-normal">
                  {t}
                </Badge>
              ))}
            </div>
            {event.note && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{event.note}</p>
            )}
            {event.links && event.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {event.links.map(([label, url]) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-info hover:bg-accent"
                  >
                    {label}
                    <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
