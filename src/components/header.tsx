'use client'
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';

const getTitleFromPathname = (pathname: string) => {
  if (pathname === '/') return 'Dashboard';
  const parts = pathname.split('/').filter(Boolean);
  const title = parts[parts.length - 1];
  return title.charAt(0).toUpperCase() + title.slice(1).replace('-', ' ');
}

export default function Header() {
    const pathname = usePathname();
    const title = getTitleFromPathname(pathname);
    
    return (
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 sm:px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1">
                <h1 className="text-xl font-semibold tracking-tight font-headline">{title}</h1>
            </div>
        </header>
    )
}
