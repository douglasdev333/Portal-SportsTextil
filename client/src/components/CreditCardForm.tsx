import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CreditCard, Lock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface CreditCardFormProps {
  amount: number;
  onSubmit: (data: {
    token: string;
    paymentMethodId: string;
    issuerId: string;
    installments: number;
    payerIdentification: {
      type: string;
      number: string;
    };
    cardholderName: string;
    deviceId?: string;
  }) => void;
  isProcessing: boolean;
  publicKey: string;
}

interface Installment {
  installments: number;
  recommended_message: string;
  installment_amount: number;
  total_amount: number;
}

export default function CreditCardForm({ amount, onSubmit, isProcessing, publicKey }: CreditCardFormProps) {
  const { toast } = useToast();
  const [mpLoaded, setMpLoaded] = useState(false);
  const [mp, setMp] = useState<any>(null);
  const [cardForm, setCardForm] = useState<any>(null);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState<number>(1);
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expirationMonth, setExpirationMonth] = useState("");
  const [expirationYear, setExpirationYear] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [identificationType, setIdentificationType] = useState("CPF");
  const [identificationNumber, setIdentificationNumber] = useState("");
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [issuerId, setIssuerId] = useState<string>("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;

    const existingScript = document.getElementById("mercadopago-sdk");
    if (existingScript) {
      if (window.MercadoPago) {
        const mpInstance = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        setMp(mpInstance);
        setMpLoaded(true);
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "mercadopago-sdk";
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => {
      if (window.MercadoPago) {
        const mpInstance = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        setMp(mpInstance);
        setMpLoaded(true);
      }
    };
    script.onerror = () => {
      setFormError("Erro ao carregar SDK de pagamento. Tente recarregar a página.");
    };
    document.body.appendChild(script);

    return () => {};
  }, [publicKey]);

  const getInstallments = useCallback(async (bin: string) => {
    if (!mp || bin.length < 6) return;
    
    setIsLoadingInstallments(true);
    try {
      const paymentMethods = await mp.getPaymentMethods({ bin });
      if (paymentMethods.results && paymentMethods.results.length > 0) {
        const pm = paymentMethods.results[0];
        setCardBrand(pm.id);
        setPaymentMethodId(pm.id);
        setIssuerId(pm.issuer?.id?.toString() || "");
        
        const installmentOptions = await mp.getInstallments({
          amount: amount.toString(),
          bin,
        });
        
        if (installmentOptions && installmentOptions.length > 0) {
          const payerCosts = installmentOptions[0].payer_costs || [];
          setInstallments(payerCosts.map((cost: any) => ({
            installments: cost.installments,
            recommended_message: cost.recommended_message,
            installment_amount: cost.installment_amount,
            total_amount: cost.total_amount,
          })));
        }
      }
    } catch (error) {
      console.error("Erro ao buscar parcelas:", error);
    } finally {
      setIsLoadingInstallments(false);
    }
  }, [mp, amount]);

  useEffect(() => {
    const cleanNumber = cardNumber.replace(/\s/g, "");
    if (cleanNumber.length >= 6) {
      getInstallments(cleanNumber.substring(0, 6));
    } else {
      setInstallments([]);
      setCardBrand(null);
    }
  }, [cardNumber, getInstallments]);

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 19);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(" ") : cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardNumber(formatCardNumber(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir submissões duplicadas
    if (isProcessing) {
      return;
    }
    
    setFormError(null);

    if (!mp) {
      setFormError("SDK de pagamento não carregado. Tente recarregar a página.");
      return;
    }

    const cleanCardNumber = cardNumber.replace(/\s/g, "");
    if (cleanCardNumber.length < 13) {
      setFormError("Número do cartão inválido");
      return;
    }

    if (!cardholderName.trim()) {
      setFormError("Nome do titular é obrigatório");
      return;
    }

    if (!expirationMonth || !expirationYear) {
      setFormError("Data de validade é obrigatória");
      return;
    }

    if (securityCode.length < 3) {
      setFormError("CVV inválido");
      return;
    }

    if (!identificationNumber || identificationNumber.replace(/\D/g, "").length < 11) {
      setFormError("CPF inválido");
      return;
    }

    try {
      const tokenData = {
        cardNumber: cleanCardNumber,
        cardholderName: cardholderName.toUpperCase(),
        cardExpirationMonth: expirationMonth,
        cardExpirationYear: expirationYear,
        securityCode,
        identificationType,
        identificationNumber: identificationNumber.replace(/\D/g, ""),
      };

      const response = await mp.createCardToken(tokenData);

      if (response.error) {
        throw new Error(response.error);
      }

      // Capturar Device ID do Mercado Pago para antifraude
      // O SDK pode armazenar em um input hidden ou via método
      let deviceId: string | undefined;
      const deviceIdInput = document.getElementById("mercadopago-device-id") as HTMLInputElement;
      if (deviceIdInput?.value) {
        deviceId = deviceIdInput.value;
      } else if ((mp as any).getDeviceId) {
        // Alguns SDKs têm método direto
        deviceId = (mp as any).getDeviceId();
      } else {
        // Fallback: tentar pegar do DOM por outros seletores
        const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
        hiddenInputs.forEach((input: Element) => {
          const el = input as HTMLInputElement;
          if (el.name?.includes('device') || el.id?.includes('device')) {
            deviceId = el.value;
          }
        });
      }

      console.log('[CreditCardForm] Device ID capturado:', deviceId ? `${deviceId.substring(0, 20)}...` : 'não encontrado');

      onSubmit({
        token: response.id,
        paymentMethodId: paymentMethodId,
        issuerId: issuerId,
        installments: selectedInstallment,
        payerIdentification: {
          type: identificationType,
          number: identificationNumber.replace(/\D/g, ""),
        },
        cardholderName: cardholderName.toUpperCase(),
        deviceId,
      });
    } catch (error: any) {
      console.error("Erro ao tokenizar cartão:", error);
      const errorMessage = error.message || "Erro ao processar cartão. Verifique os dados e tente novamente.";
      setFormError(errorMessage);
      toast({
        title: "Erro no cartão",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const month = (i + 1).toString().padStart(2, "0");
    return { value: month, label: month };
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => {
    const year = (currentYear + i).toString();
    return { value: year.slice(-2), label: year };
  });

  if (!mpLoaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Carregando formulário de pagamento...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{formError}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="cardNumber">Número do Cartão</Label>
        <div className="relative">
          <Input
            id="cardNumber"
            type="text"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={handleCardNumberChange}
            className="pl-10"
            data-testid="input-card-number"
          />
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {cardBrand && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary uppercase">
              {cardBrand}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cardholderName">Nome no Cartão</Label>
        <Input
          id="cardholderName"
          type="text"
          placeholder="NOME COMO ESTÁ NO CARTÃO"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
          data-testid="input-cardholder-name"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Mês</Label>
          <Select value={expirationMonth} onValueChange={setExpirationMonth}>
            <SelectTrigger data-testid="select-expiration-month">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Ano</Label>
          <Select value={expirationYear} onValueChange={setExpirationYear}>
            <SelectTrigger data-testid="select-expiration-year">
              <SelectValue placeholder="AA" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.value} value={y.value}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="securityCode">CVV</Label>
          <div className="relative">
            <Input
              id="securityCode"
              type="text"
              inputMode="numeric"
              placeholder="123"
              maxLength={4}
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="pl-8"
              data-testid="input-security-code"
            />
            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cpf">CPF do Titular</Label>
        <Input
          id="cpf"
          type="text"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={identificationNumber}
          onChange={(e) => setIdentificationNumber(formatCPF(e.target.value))}
          data-testid="input-cpf-card"
        />
      </div>

      {installments.length > 0 && (
        <div className="space-y-2">
          <Label>Parcelas</Label>
          <Select 
            value={selectedInstallment.toString()} 
            onValueChange={(v) => setSelectedInstallment(parseInt(v))}
          >
            <SelectTrigger data-testid="select-installments">
              <SelectValue placeholder="Selecione as parcelas" />
            </SelectTrigger>
            <SelectContent>
              {installments.map((inst) => (
                <SelectItem key={inst.installments} value={inst.installments.toString()}>
                  {inst.recommended_message}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoadingInstallments && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando opções de parcelamento...</span>
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isProcessing || !cardNumber || !cardholderName || !expirationMonth || !expirationYear || !securityCode}
        data-testid="button-pay-card"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processando pagamento...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Pagar R$ {amount.toFixed(2).replace(".", ",")}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Pagamento processado com segurança pelo Mercado Pago
      </p>
    </form>
  );
}
