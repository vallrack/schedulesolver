'use client'
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';

const titleMap: { [key: string]: string } = {
  '/dashboard': 'Dashboard',
  '/teachers': 'Gestión de Docentes',
  '/courses': 'Catálogo de Materias',
  '/classrooms': 'Gestión de Infraestructura',
  '/conflict-analyzer': 'Analizador de Conflictos con IA',
};


const getTitleFromPathname = (pathname: string) => {
  const rootPath = '/' + pathname.split('/')[1];
  return titleMap[rootPath] || 'Schedulesolver';
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
