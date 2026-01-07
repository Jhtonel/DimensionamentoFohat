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
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';

import { firebaseConfig } from '../config/firebase.js';
import { supabase } from './supabaseClient.js';
import { getBackendUrl } from "./backendUrl.js";

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
        // Primeiro cria o usuário mapeado
        const mappedUser = this.mapFirebaseUser(firebaseUser);
        
        // Carregar role e cargo a partir do backend ANTES de notificar
        try {
          const userData = await this.fetchUserDataByEmail(mappedUser.email);
          this.currentUser = { 
            ...mappedUser, 
            role: userData?.role || 'vendedor',
            cargo: userData?.cargo || '',
            nome: userData?.nome || mappedUser.nome
          };
        } catch (e) {
          console.warn('Falha ao obter dados do usuário, usando padrão:', e?.message || e);
          this.currentUser = { ...mappedUser, role: 'vendedor' };
        }
      } else {
        this.currentUser = null;
      }
      
      // Notificar listeners DEPOIS de carregar a role
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
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const actionCodeSettings = {
          url: `${origin}/reset-password`,
          handleCodeInApp: false
        };
        await sendPasswordResetEmail(secondaryAuth, email, actionCodeSettings);
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
   * Envia e-mail de recuperação/definição de senha
   */
  async sendResetEmail(email) {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const actionCodeSettings = {
        url: `${origin}/reset-password`,
        handleCodeInApp: false
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      return true;
    } catch (e) {
      console.error('Erro ao enviar e-mail de redefinição:', e);
      throw new Error(this.getErrorMessage(e.code) || e.message);
    }
  }

  async verifyResetCode(code) {
    try {
      const email = await verifyPasswordResetCode(auth, code);
      return email;
    } catch (e) {
      throw new Error(this.getErrorMessage(e.code) || e.message);
    }
  }

  async confirmReset(code, newPassword) {
    try {
      await confirmPasswordReset(auth, code, newPassword);
      return true;
    } catch (e) {
      throw new Error(this.getErrorMessage(e.code) || e.message);
    }
  }

  /**
   * Troca de senha para usuário logado
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user?.email) throw new Error('Usuário não autenticado');
      // Reautenticar (necessário em muitos casos)
      if (currentPassword) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }
      await updatePassword(user, newPassword);
      return true;
    } catch (e) {
      console.error('Erro ao alterar senha:', e);
      throw new Error(this.getErrorMessage(e.code) || e.message);
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
   * Busca dados do usuário (role, cargo, nome) pelo email
   */
  async fetchUserDataByEmail(email) {
    if (!email) return { role: 'vendedor', cargo: '', nome: '' };
    // Consultar dados no backend Python
    try {
      const serverUrl = getBackendUrl();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${serverUrl}/auth/role?email=${encodeURIComponent(email)}&t=${Date.now()}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const json = await resp.json();
        return {
          role: json?.role || 'vendedor',
          cargo: json?.cargo || '',
          nome: json?.nome || ''
        };
      }
    } catch (e) {
      console.warn('Falha ao consultar dados do usuário no backend:', e?.message || e);
    }
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