export default function SimpleFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t border-border py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p className="text-sm text-muted-foreground">
          © {currentYear} KitRunner. Todos os direitos reservados.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          CNPJ: 55.108.434/0001-00
        </p>
      </div>
    </footer>
  );
}
