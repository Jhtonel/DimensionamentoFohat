import React, { useState } from "react";
import { authService } from "@/services/authService.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePassword() {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [status, setStatus] = useState({ loading: false, ok: false, error: null });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setStatus({ loading: false, ok: false, error: "As senhas não conferem" });
      return;
    }
    setStatus({ loading: true, ok: false, error: null });
    try {
      await authService.changePassword(currentPwd, newPwd);
      setStatus({ loading: false, ok: true, error: null });
    } catch (err) {
      setStatus({ loading: false, ok: false, error: err.message });
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 space-y-4">
          <h1 className="text-2xl font-bold text-gray-800">Alterar senha</h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Senha atual</Label>
              <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Confirmar senha</Label>
              <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required />
            </div>
            <Button disabled={status.loading} className="w-full">
              {status.loading ? "Salvando..." : "Salvar"}
            </Button>
          </form>
          {status.ok && <p className="text-green-600">Senha alterada com sucesso.</p>}
          {status.error && <p className="text-red-600">{status.error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}


