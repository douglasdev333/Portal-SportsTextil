import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAthleteAuth } from "@/contexts/AthleteAuthContext";
import { CalendarCheck } from "lucide-react";

const estadosBrasil = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const escolaridades = [
  "Ensino Fundamental",
  "Ensino Médio",
  "Ensino Superior",
  "Pós-graduação",
  "Mestrado",
  "Doutorado"
];

export default function CadastroPage() {
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [escolaridade, setEscolaridade] = useState("");
  const [profissao, setProfissao] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { register } = useAthleteAuth();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const redirectTo = searchParams.get("redirect") || "/";
  const isInscricaoFlow = redirectTo.includes("/inscricao/");

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

  const validateCPF = (cpf: string): boolean => {
    const numbers = cpf.replace(/\D/g, '');
    
    if (numbers.length !== 11) return false;
    
    if (/^(\d)\1{10}$/.test(numbers)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers[9])) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numbers[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers[10])) return false;
    
    return true;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
  };

  const formatTelefone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length <= 10) {
        return numbers
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      }
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return telefone;
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatTelefone(e.target.value));
  };

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 8) {
      return numbers.replace(/(\d{5})(\d)/, '$1-$2');
    }
    return cep;
  };

  const handleCEPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCep(formatCEP(e.target.value));
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

  const handleDataNascimentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataNascimento(formatDataNascimento(e.target.value));
  };

  const parseDataNascimentoToISO = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length === 8) {
      const day = numbers.slice(0, 2);
      const month = numbers.slice(2, 4);
      const year = numbers.slice(4, 8);
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const validateDataNascimento = (value: string): { valid: boolean; error?: string } => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length !== 8) {
      return { valid: false, error: 'Data incompleta' };
    }
    
    const day = parseInt(numbers.slice(0, 2), 10);
    const month = parseInt(numbers.slice(2, 4), 10);
    const year = parseInt(numbers.slice(4, 8), 10);
    const currentYear = new Date().getFullYear();
    
    if (day < 1 || day > 31) {
      return { valid: false, error: 'Dia deve ser entre 1 e 31' };
    }
    
    if (month < 1 || month > 12) {
      return { valid: false, error: 'Mês deve ser entre 1 e 12' };
    }
    
    if (year < 1900 || year > currentYear) {
      return { valid: false, error: `Ano deve ser entre 1900 e ${currentYear}` };
    }
    
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (isLeapYear) daysInMonth[1] = 29;
    
    if (day > daysInMonth[month - 1]) {
      return { valid: false, error: `Este mês tem no máximo ${daysInMonth[month - 1]} dias` };
    }
    
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cpf || !nome || !dataNascimento || !sexo || !email || !telefone || !estado || !cidade) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!validateCPF(cpf)) {
      toast({
        title: "CPF inválido",
        description: "Por favor, insira um CPF válido.",
        variant: "destructive",
      });
      return;
    }

    const dateValidation = validateDataNascimento(dataNascimento);
    if (!dateValidation.valid) {
      toast({
        title: "Data de nascimento inválida",
        description: dateValidation.error,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await register({
        cpf: cpf.replace(/\D/g, ''),
        nome,
        dataNascimento: parseDataNascimentoToISO(dataNascimento),
        sexo,
        email,
        telefone: telefone.replace(/\D/g, ''),
        estado,
        cidade,
        cep: cep.replace(/\D/g, '') || undefined,
        rua: rua || undefined,
        numero: numero || undefined,
        complemento: complemento || undefined,
        escolaridade: escolaridade || undefined,
        profissao: profissao || undefined,
      });

      if (!result || !result.success) {
        toast({
          title: "Erro no cadastro",
          description: result?.error || "Ocorreu um erro ao realizar o cadastro.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Cadastro realizado!",
        description: isInscricaoFlow 
          ? "Sua conta foi criada. Continuando sua inscrição..." 
          : "Sua conta foi criada com sucesso.",
      });

      setIsLoading(false);
      setTimeout(() => {
        setLocation(redirectTo);
      }, 100);
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao conectar com o servidor.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        {isInscricaoFlow && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3">
            <CalendarCheck className="h-5 w-5 text-primary flex-shrink-0" />
            <p className="text-sm text-foreground">
              Crie sua conta para continuar com a inscrição. Após o cadastro, você será direcionado automaticamente.
            </p>
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Cadastro de Atleta</CardTitle>
            <CardDescription>
              {isInscricaoFlow 
                ? "Preencha o formulário abaixo para criar sua conta e continuar a inscrição"
                : "Preencha o formulário abaixo para criar sua conta"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b pb-2">
                  Dados Pessoais
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="cpf">
                    CPF <span className="text-accent">*</span>
                  </Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCPFChange}
                    maxLength={14}
                    required
                    data-testid="input-cpf"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome">
                    Nome Completo <span className="text-accent">*</span>
                  </Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    data-testid="input-nome"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataNascimento">
                      Data de Nascimento <span className="text-accent">*</span>
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
                      data-testid="input-data-nascimento"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sexo">
                      Sexo <span className="text-accent">*</span>
                    </Label>
                    <Select value={sexo} onValueChange={setSexo} required>
                      <SelectTrigger id="sexo" data-testid="select-sexo">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-semibold text-foreground border-b pb-2">
                  Contato
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    E-mail <span className="text-accent">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">
                    Telefone <span className="text-accent">*</span>
                  </Label>
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={telefone}
                    onChange={handleTelefoneChange}
                    maxLength={15}
                    required
                    data-testid="input-telefone"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-semibold text-foreground border-b pb-2">
                  Endereço
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      type="text"
                      placeholder="00000-000"
                      value={cep}
                      onChange={handleCEPChange}
                      maxLength={9}
                      data-testid="input-cep"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado">
                      Estado <span className="text-accent">*</span>
                    </Label>
                    <Select value={estado} onValueChange={setEstado} required>
                      <SelectTrigger id="estado" data-testid="select-estado">
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {estadosBrasil.map((est) => (
                          <SelectItem key={est} value={est}>
                            {est}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cidade">
                    Cidade <span className="text-accent">*</span>
                  </Label>
                  <Input
                    id="cidade"
                    type="text"
                    placeholder="Sua cidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    required
                    data-testid="input-cidade"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rua">Rua/Logradouro</Label>
                  <Input
                    id="rua"
                    type="text"
                    placeholder="Nome da rua"
                    value={rua}
                    onChange={(e) => setRua(e.target.value)}
                    data-testid="input-rua"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      type="text"
                      placeholder="123"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      data-testid="input-numero"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input
                      id="complemento"
                      type="text"
                      placeholder="Apto, Bloco, etc."
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      data-testid="input-complemento"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-semibold text-foreground border-b pb-2">
                  Informações Adicionais
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="escolaridade">Escolaridade</Label>
                  <Select value={escolaridade} onValueChange={setEscolaridade}>
                    <SelectTrigger id="escolaridade" data-testid="select-escolaridade">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {escolaridades.map((esc) => (
                        <SelectItem key={esc} value={esc}>
                          {esc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profissao">Profissão</Label>
                  <Input
                    id="profissao"
                    type="text"
                    placeholder="Sua profissão"
                    value={profissao}
                    onChange={(e) => setProfissao(e.target.value)}
                    data-testid="input-profissao"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <Button
                  type="submit"
                  variant="secondary"
                  className="flex-1"
                  disabled={isLoading}
                  data-testid="button-submit"
                >
                  {isLoading ? "Cadastrando..." : "Completar Cadastro"}
                </Button>
                <Link href="/login">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    data-testid="button-back-login"
                  >
                    Voltar ao Login
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
