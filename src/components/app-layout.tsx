'use client';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import Header from '@/components/header';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    
    if (!authLoading && user && firestore) {
      const checkAndCreateUserProfile = async () => {
        setProfileLoading(true);
        const userDocRef = doc(firestore, 'users', user.uid);
        try {
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
                if (user.uid === 'UF3lSy66XzM43d4fTlle8T8mrQp2') {
                    await setDoc(userDocRef, {
                        name: user.displayName || user.email || 'Super Admin',
                        email: user.email,
                        role: 'super_admin',
                    });
                }
                // For other users, a profile with a default role could be created here.
                // For now, we only handle the specified super admin.
            }
        } catch(e) {
            console.error("Error checking or creating user profile:", e);
        } finally {
            setProfileLoading(false);
        }
      };
      checkAndCreateUserProfile();
    } else if (!authLoading) {
      // If there's no user and auth is not loading, we're done.
      setProfileLoading(false);
    }
  }, [user, authLoading, router, firestore]);

  const loading = authLoading || profileLoading;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
        <Sidebar>
            <AppSidebar />
        </Sidebar>
        <SidebarInset>
            <Header />
            <div className="p-4 sm:p-6 lg:p-8">
                {children}
            </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
