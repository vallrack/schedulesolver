import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import AppLogo from "@/components/app-logo";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-2xl text-center shadow-2xl">
        <CardHeader className="p-8">
          <div className="flex justify-center mb-4">
            <AppLogo />
          </div>
          <CardTitle className="text-4xl md:text-5xl font-bold font-headline">
            Bienvenido a Schedulesolver
          </CardTitle>
          <CardDescription className="text-lg md:text-xl text-muted-foreground pt-2">
            La solución inteligente para la gestión de horarios académicos.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-0">
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
              <Link href="/register">Registrar Super Admin</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
