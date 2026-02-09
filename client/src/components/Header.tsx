import { Menu, User, X, LogOut, UserCircle, Trophy, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAthleteAuth } from "@/contexts/AthleteAuthContext";

export default function Header() {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { athlete, isLoading, logout } = useAthleteAuth();

  const navItems = [
    { path: "/", label: "Eventos" },
    { path: "/resultados", label: "Resultados" },
    { path: "/minhas-inscricoes", label: "Minhas Inscrições" },
  ];

  const isActive = (path: string) => location === path;

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity rounded-md px-3 py-2">
            <img 
              src="/assets/logo.png" 
              alt="KitRunner" 
              className="h-8 md:h-10 w-auto"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button
                  variant="ghost"
                  className={`text-foreground hover:text-primary hover:bg-primary/5 ${
                    isActive(item.path) ? "text-primary bg-primary/5" : ""
                  }`}
                  data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.label}
                </Button>
              </Link>
            ))}

            {!isLoading && athlete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-foreground hover:text-primary hover:bg-primary/5"
                    data-testid="button-user-menu"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{athlete.nome}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {athlete.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setLocation("/minha-conta")}
                    className="cursor-pointer"
                    data-testid="menu-minha-conta"
                  >
                    <UserCircle className="mr-2 h-4 w-4" />
                    Minha Conta
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocation("/minhas-inscricoes")}
                    className="cursor-pointer"
                    data-testid="menu-minhas-inscricoes"
                  >
                    <Trophy className="mr-2 h-4 w-4" />
                    Minhas Inscrições
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                    data-testid="menu-sair"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : !isLoading ? (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-foreground hover:text-primary"
                    data-testid="button-login"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Entrar
                  </Button>
                </Link>
                <Link href="/cadastro">
                  <Button
                    variant="default"
                    size="sm"
                    data-testid="button-cadastro"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Cadastrar
                  </Button>
                </Link>
              </div>
            ) : null}
          </nav>

          <Button
            size="icon"
            variant="ghost"
            className="md:hidden text-foreground hover:text-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2 border-t border-border pt-4">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-foreground hover:text-primary hover:bg-primary/5 ${
                    isActive(item.path) ? "text-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
            
            {!isLoading && athlete ? (
              <>
                <div className="border-t border-border pt-2 mt-2">
                  <div className="px-4 py-2 text-muted-foreground text-sm">
                    {athlete.nome}
                  </div>
                </div>
                <Link href="/minha-conta">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-foreground hover:text-primary hover:bg-primary/5"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="link-mobile-minha-conta"
                  >
                    <UserCircle className="h-5 w-5 mr-2" />
                    Minha Conta
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:bg-destructive/5"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  data-testid="button-mobile-sair"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  Sair
                </Button>
              </>
            ) : !isLoading ? (
              <>
                <div className="border-t border-border pt-2 mt-2" />
                <Link href="/login">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-foreground hover:text-primary hover:bg-primary/5"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="button-mobile-login"
                  >
                    <LogIn className="h-5 w-5 mr-2" />
                    Entrar
                  </Button>
                </Link>
                <Link href="/cadastro">
                  <Button
                    variant="default"
                    className="w-full justify-start"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="button-mobile-cadastro"
                  >
                    <UserPlus className="h-5 w-5 mr-2" />
                    Cadastrar
                  </Button>
                </Link>
              </>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}
