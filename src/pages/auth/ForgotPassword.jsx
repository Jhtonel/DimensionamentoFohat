import React, { useState } from "react";
import { authService } from "@/services/authService.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ loading: false, sent: false, error: null });

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, sent: false, error: null });
    try {
      await authService.sendResetEmail(email);
      setStatus({ loading: false, sent: true, error: null });
    } catch (err) {
      setStatus({ loading: false, sent: false, error: err.message });
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 space-y-4">
          <h1 className="text-2xl font-bold text-gray-800">Recuperar / Criar Senha</h1>
          <p className="text-gray-600">Informe seu e-mail para receber o link de definição/redefinição de senha.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button disabled={status.loading} className="w-full">
              {status.loading ? "Enviando..." : "Enviar e-mail"}
            </Button>
          </form>
          {status.sent && <p className="text-green-600">E-mail enviado! Verifique sua caixa de entrada.</p>}
          {status.error && <p className="text-red-600">{status.error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}


