'use client'
import { usePathname } from 'next/navigation';
import { SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import AppLogo from '@/components/app-logo';
import { UserCog, School, Puzzle, GraduationCap, Group, Package, CalendarClock, CalendarDays, Users } from 'lucide-react';

const menuItems = [
    { href: '/dashboard', label: 'Calendario', icon: CalendarDays },
    { href: '/teachers', label: 'Docentes', icon: Users },
    { href: '/careers', label: 'Carreras', icon: GraduationCap },
    { href: '/groups', label: 'Grupos', icon: Group },
    { href: '/modules', label: 'Módulos', icon: Package },
    { href: '/courses', label: 'Cursos Programados', icon: CalendarClock },
    { href: '/classrooms', label: 'Aulas', icon: School },
    { href: '/users', label: 'Usuarios', icon: UserCog },
    { href: '/conflict-analyzer', label: 'Analizador de Conflictos', icon: Puzzle },
]

export default function AppSidebar() {
    const pathname = usePathname();
    return (
        <>
            <SidebarHeader>
                <AppLogo />
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {menuItems.map(item => (
                        <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                <a href={item.href}>
                                    <item.icon />
                                    <span>{item.label}</span>
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
        </>
    )
}
