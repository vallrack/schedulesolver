'use client'
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, LogOut, User } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';


const titleMap: { [key: string]: string } = {
  '/dashboard': 'Calendario',
  '/teachers': 'Gestión de Docentes',
  '/careers': 'Gestión de Carreras',
  '/courses': 'Cursos Programados',
  '/modules': 'Catálogo de Módulos',
  '/groups': 'Gestión de Grupos',
  '/classrooms': 'Gestión de Infraestructura',
  '/conflict-analyzer': 'Analizador de Conflictos con IA',
};


const getTitleFromPathname = (pathname: string) => {
  const rootPath = '/' + pathname.split('/')[1];
  return titleMap[rootPath] || 'Schedulesolver';
}

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const auth = useAuth();
    const { user } = useUser();
    const { toast } = useToast();
    const title = getTitleFromPathname(pathname);
    
    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('/');
            toast({
                title: 'Sesión Cerrada',
                description: 'Has cerrado sesión correctamente.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error al cerrar sesión',
                description: 'No se pudo cerrar la sesión. Por favor, inténtalo de nuevo.',
            });
        }
    }
    
    return (
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 sm:px-6 no-print">
            <SidebarTrigger />
            <div className="flex-1">
                <h1 className="text-xl font-semibold tracking-tight font-headline">{title}</h1>
            </div>
            <div className="flex items-center gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <Bell className="h-5 w-5" />
                            <span className="sr-only">Notificaciones</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Inasistencia: Juan Pérez</DropdownMenuItem>
                        <DropdownMenuItem>Cobertura necesaria: Álgebra</DropdownMenuItem>
                        <DropdownMenuItem>Horas extra aprobadas</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={user?.photoURL ?? ''} alt="Avatar" />
                                <AvatarFallback>
                                    <User className="h-5 w-5" />
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled>{user?.email}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Cerrar Sesión</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
