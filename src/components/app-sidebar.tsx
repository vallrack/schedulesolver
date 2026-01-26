'use client'
import { usePathname } from 'next/navigation';
import { SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import AppLogo from '@/components/app-logo';
import { LayoutDashboard, Users, Book, School, Puzzle } from 'lucide-react';

const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/teachers', label: 'Docentes', icon: Users },
    { href: '/courses', label: 'Módulos', icon: Book },
    { href: '/classrooms', label: 'Aulas', icon: School },
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
