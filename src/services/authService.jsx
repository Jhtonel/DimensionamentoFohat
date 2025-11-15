/**
 * Serviço de autenticação Firebase
 */

import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';

import { firebaseConfig } from '../config/firebase.js';
import { supabase } from './supabaseClient.js';

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

class AuthService {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    this.secondaryApp = null;
    
    // Escutar mudanças no estado de autenticação
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        this.currentUser = this.mapFirebaseUser(firebaseUser);
        // Carregar role a partir do banco/localStorage e notificar novamente
        try {
          const role = await this.fetchUserRoleByEmail(this.currentUser.email);
          if (role) {
            this.currentUser = { ...this.currentUser, role };
          }
        } catch (e) {
          console.warn('Falha ao obter role do usuário:', e?.message || e);
        }
      } else {
        this.currentUser = null;
      }
      
      // Notificar listeners
      this.listeners.forEach(listener => listener(this.currentUser));
    });
  }

  /**
   * Busca dados do usuário no backend
   */
  // Constrói o usuário da aplicação a partir do usuário do Firebase
  mapFirebaseUser(firebaseUser) {
    const email = firebaseUser.email || '';
    const nomePadrao = email ? email.split('@')[0] : 'Usuário';
    return {
      uid: firebaseUser.uid,
      email,
      nome: firebaseUser.displayName || nomePadrao,
      role: 'vendedor' // papel padrão até buscarmos no banco
    };
  }

  /**
   * Login com email e senha
   */
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const mapped = this.mapFirebaseUser(userCredential.user);
      this.currentUser = mapped;
      return mapped;
    } catch (error) {
      console.error('❌ Erro no login:', error);
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      await signOut(auth);
      this.currentUser = null;
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    }
  }

  /**
   * Cria um usuário no Firebase Auth sem derrubar a sessão atual
   * Usa uma instância secundária do app para evitar trocar o auth ativo
   */
  async createFirebaseUser({ email, password, displayName }) {
    try {
      if (!this.secondaryApp) {
        this.secondaryApp = initializeApp(firebaseConfig, 'secondary');
      }
      const secondaryAuth = getAuth(this.secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const createdUser = userCredential.user;
      if (displayName) {
        try {
          await updateProfile(createdUser, { displayName });
        } catch (e) {
          console.warn('Não foi possível atualizar displayName do usuário recém-criado:', e);
        }
      }
      // Dispara e-mail de redefinição de senha para que o usuário defina uma senha própria
      try {
        await sendPasswordResetEmail(secondaryAuth, email);
      } catch (e) {
        console.warn('Falha ao enviar e-mail de redefinição de senha (o usuário ainda foi criado):', e);
      }
      // Mantém admin logado no app principal; encerra sessão secundária
      try {
        await signOut(secondaryAuth);
      } catch {}
      return { uid: createdUser.uid, email: createdUser.email };
    } catch (error) {
      console.error('❌ Erro ao criar usuário no Firebase:', error);
      throw new Error(this.getErrorMessage(error.code) || error.message);
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
   * Converte códigos de erro do Firebase para mensagens amigáveis
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
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  }

  /**
   * Busca a role do usuário por e-mail em ordem:
   * 1) Supabase (tabela 'usuarios')
   * 2) localStorage ('usuarios_local')
   * 3) fallback 'vendedor'
   */
  async fetchUserRoleByEmail(email) {
    if (!email) return 'vendedor';
    // Consultar role no backend Python
    try {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const serverUrl = `http://${hostname}:8000`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${serverUrl}/auth/role?email=${encodeURIComponent(email)}&t=${Date.now()}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const json = await resp.json();
        if (json?.role) return json.role;
      }
    } catch (e) {
      console.warn('Falha ao consultar role no backend, usando padrão vendedor:', e?.message || e);
    }
    return 'vendedor';
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