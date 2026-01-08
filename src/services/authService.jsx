/**
 * Serviço de autenticação (Postgres + JWT via backend)
 */

import { useState, useEffect } from 'react';
import { getBackendUrl } from "./backendUrl.js";

const TOKEN_KEY = 'app_jwt_token';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.listeners = [];

    // Hidratar sessão a partir do token salvo
    this._hydrateFromToken();
  }

  async _hydrateFromToken() {
    const token = this._getToken();
    if (!token) {
      this.currentUser = null;
      this.listeners.forEach(listener => listener(this.currentUser));
      return;
    }
    try {
      const serverUrl = getBackendUrl();
      const resp = await fetch(`${serverUrl}/auth/me?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) throw new Error('Sessão inválida');
      const json = await resp.json();
      if (json?.success && json?.user) {
        this.currentUser = { ...json.user };
      } else {
        throw new Error('Sessão inválida');
      }
    } catch (e) {
      this._clearToken();
      this.currentUser = null;
    } finally {
      this.listeners.forEach(listener => listener(this.currentUser));
    }
  }

  _getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  }

  _setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  }

  _clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  /**
   * Login com email e senha
   */
  async login(email, password) {
    try {
      const serverUrl = getBackendUrl();
      const resp = await fetch(`${serverUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) {
        throw new Error(json?.message || 'Credenciais inválidas');
      }
      const token = String(json?.token || '');
      if (!token) throw new Error('Token não recebido');
      this._setToken(token);
      this.currentUser = json?.user || { email };
      this.listeners.forEach(listener => listener(this.currentUser));
      return this.currentUser;
    } catch (error) {
      console.error('❌ Erro no login:', error);
      throw new Error(error?.message || 'Erro de autenticação');
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      // best-effort: limpar token
      this._clearToken();
      this.currentUser = null;
      this.listeners.forEach(listener => listener(this.currentUser));
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    }
  }

  // Criação de usuários é via painel Admin (Postgres) no backend.

  /**
   * Envia e-mail de recuperação/definição de senha
   */
  async sendResetEmail(email) {
    throw new Error('Recuperação de senha automática está desativada. Solicite ao administrador a redefinição.');
  }

  async verifyResetCode(code) {
    throw new Error('Fluxo de reset via link está desativado.');
  }

  async confirmReset(code, newPassword) {
    throw new Error('Fluxo de reset via link está desativado.');
  }

  /**
   * Troca de senha para usuário logado
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const token = this._getToken();
      if (!token) throw new Error('Usuário não autenticado');
      const serverUrl = getBackendUrl();
      const resp = await fetch(`${serverUrl}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) {
        throw new Error(json?.message || 'Não foi possível alterar a senha');
      }
      return true;
    } catch (e) {
      console.error('Erro ao alterar senha:', e);
      throw new Error(e?.message || 'Erro ao alterar senha');
    }
  }

  /**
   * Retorna usuário atual
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Verifica se usuário está logado
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * Verifica se usuário é admin
   */
  isAdmin() {
    return this.currentUser?.role === 'admin';
  }

  /**
   * Escuta mudanças no estado de autenticação
   */
  onAuthStateChange(callback) {
    this.listeners.push(callback);
    
    // Retorna função para remover listener
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Converte códigos de erro (legado) para mensagens amigáveis
   */
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'Usuário não encontrado',
      'auth/wrong-password': 'Senha incorreta',
      'auth/invalid-email': 'Email inválido',
      'auth/user-disabled': 'Usuário desabilitado',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet',
      'auth/invalid-credential': 'Credenciais inválidas'
    };

    return errorMessages[errorCode] || 'Erro de autenticação';
  }

  /**
   * Obtém token de autenticação para usar nas requisições
   */
  async getAuthToken() {
    const token = this._getToken();
    return token || null;
  }

  /**
   * Busca dados do usuário (role, cargo, nome) pelo email
   */
  async fetchUserDataByEmail(email) {
    // Não usado no auth do Postgres; manter compatibilidade mínima
    return { role: 'vendedor', cargo: '', nome: '' };
  }
  
  /**
   * Mantido para compatibilidade
   */
  async fetchUserRoleByEmail(email) {
    const data = await this.fetchUserDataByEmail(email);
    return data.role;
  }

  /**
   * Verifica se o usuário possui alguma role exigida
   */
  hasRole(required) {
    const r = this.currentUser?.role;
    if (!required) return true;
    if (Array.isArray(required)) return required.includes(r);
    return r === required;
  }
}

// Instância singleton
export const authService = new AuthService();

// Hook para usar em componentes React
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    // Inicializa imediatamente com o estado atual (evita ficar em "Verificando acesso...")
    const current = authService.getCurrentUser();
    if (current !== undefined) {
      setUser(current);
      setLoading(false);
    }

    return unsubscribe;
  }, []);

  return {
    user,
    loading,
    login: authService.login.bind(authService),
    logout: authService.logout.bind(authService),
    isAuthenticated: authService.isAuthenticated.bind(authService),
    isAdmin: authService.isAdmin.bind(authService),
    getAuthToken: authService.getAuthToken.bind(authService)
  };
};

export default authService;