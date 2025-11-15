import React, { useEffect, useState } from "react";
import { authService } from "@/services/authService.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [status, setStatus] = useState({ loading: true, ready: false, done: false, error: null });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oob = params.get("oobCode") || params.get("code");
    if (oob) {
      setCode(oob);
      authService.verifyResetCode(oob)
        .then((em) => {
          setEmail(em);
          setStatus({ loading: false, ready: true, done: false, error: null });
        })
        .catch((err) => {
          setStatus({ loading: false, ready: false, done: false, error: err.message });
        });
    } else {
      setStatus({ loading: false, ready: false, done: false, error: "Código inválido" });
    }
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setStatus(s => ({ ...s, error: "As senhas não conferem" }));
      return;
    }
    setStatus(s => ({ ...s, loading: true, error: null }));
    try {
      await authService.confirmReset(code, newPwd);
      setStatus({ loading: false, ready: false, done: true, error: null });
    } catch (err) {
      setStatus({ loading: false, ready: true, done: false, error: err.message });
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 space-y-4">
          <h1 className="text-2xl font-bold text-gray-800">Definir nova senha</h1>
          {status.loading && <p className="text-gray-600">Validando link...</p>}
          {!status.loading && status.ready && (
            <>
              <p className="text-gray-600">E-mail: <span className="font-semibold">{email}</span></p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label>Nova senha</Label>
                  <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Confirmar senha</Label>
                  <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required />
                </div>
                <Button disabled={status.loading} className="w-full">
                  {status.loading ? "Salvando..." : "Salvar senha"}
                </Button>
              </form>
            </>
          )}
          {status.done && <p className="text-green-600">Senha definida com sucesso. Você já pode fazer login.</p>}
          {status.error && <p className="text-red-600">{status.error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}


