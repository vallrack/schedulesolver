import { CalendarCheck2 } from 'lucide-react';

export default function AppLogo() {
  return (
    <div className="flex items-center gap-2 p-2">
      <CalendarCheck2 className="h-8 w-8 text-primary" />
      <h2 className="text-xl font-bold tracking-tighter font-headline text-foreground group-data-[collapsible=icon]:hidden">
        Schedulesolver
      </h2>
    </div>
  );
}
