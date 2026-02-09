import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAthleteAuth } from "@/contexts/AthleteAuthContext";

export default function LoginPage() {
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { login, athlete } = useAthleteAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  
  // Priorizar: 1) query param redirect, 2) sessionStorage (salvo quando sessão expira), 3) home
  const savedRedirect = sessionStorage.getItem("redirectAfterLogin");
  const redirectTo = searchParams.get("redirect") || savedRedirect || "/";

  useEffect(() => {
    if (athlete) {
      // Limpar o redirect salvo após usar
      sessionStorage.removeItem("redirectAfterLogin");
      setLocation(redirectTo);
    }
  }, [athlete, redirectTo, setLocation]);

  if (athlete) {
    return null;
  }

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2');
    }
    return cpf;
  };

  const formatDataNascimento = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 8) {
      return numbers
        .replace(/(\d{2})(\d)/, '$1/$2')
        .replace(/(\d{2})(\d)/, '$1/$2');
    }
    return numbers.slice(0, 8)
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})(\d)/, '$1/$2');
  };

  const convertToISO = (dataBR: string): string => {
    const numbers = dataBR.replace(/\D/g, '');
    if (numbers.length === 8) {
      const dia = numbers.slice(0, 2);
      const mes = numbers.slice(2, 4);
      const ano = numbers.slice(4, 8);
      return `${ano}-${mes}-${dia}`;
    }
    return '';
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
  };

  const handleDataNascimentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataNascimento(formatDataNascimento(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cpf || !dataNascimento) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o CPF e a data de nascimento.",
        variant: "destructive"
      });
      return;
    }

    const dataISO = convertToISO(dataNascimento);
    if (!dataISO) {
      toast({
        title: "Data inválida",
        description: "Preencha a data no formato DD/MM/AAAA.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    const result = await login(cpf, dataISO);
    
    setIsLoading(false);
    
    if (result.success) {
      toast({
        title: "Login realizado!",
        description: "Você será redirecionado em instantes.",
      });
      setLocation(redirectTo);
    } else {
      toast({
        title: "Erro no login",
        description: result.error || "Verifique suas credenciais e tente novamente.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-16">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="md:block space-y-6">
            <div className="text-center md:text-left">
              <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2 md:mb-3">
                Acesse sua Conta
              </h1>
              <p className="text-sm md:text-lg text-muted-foreground">
                Gerencie suas inscrições e acompanhe eventos
              </p>
            </div>

            <div className="hidden md:block space-y-4 pt-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <LogIn className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Acesso Rápido</h3>
                  <p className="text-sm text-muted-foreground">
                    Use seu CPF e data de nascimento para entrar de forma segura
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Primeira Vez?</h3>
                  <p className="text-sm text-muted-foreground">
                    Crie sua conta em minutos e comece a se inscrever em eventos
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Entrar</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="cpf" className="text-sm font-medium">
                      CPF
                    </Label>
                    <Input
                      id="cpf"
                      type="text"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={handleCPFChange}
                      maxLength={14}
                      required
                      disabled={isLoading}
                      data-testid="input-cpf"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dataNascimento" className="text-sm font-medium">
                      Data de Nascimento
                    </Label>
                    <Input
                      id="dataNascimento"
                      type="text"
                      inputMode="numeric"
                      placeholder="DD/MM/AAAA"
                      value={dataNascimento}
                      onChange={handleDataNascimentoChange}
                      maxLength={10}
                      required
                      disabled={isLoading}
                      data-testid="input-data-nascimento"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full font-semibold"
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground pt-[5px] pb-[5px]">
                        Não tem conta?
                      </span>
                    </div>
                  </div>

                  <Link href={`/cadastro${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`} data-testid="link-cadastro">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full font-semibold"
                      disabled={isLoading}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Criar Conta
                    </Button>
                  </Link>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
