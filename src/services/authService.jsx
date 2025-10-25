/**
 * Serviço de autenticação Firebase
 */

import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';

import { firebaseConfig } from '../config/firebase.js';

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

class AuthService {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    
    // Escutar mudanças no estado de autenticação
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        this.currentUser = this.mapFirebaseUser(firebaseUser);
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
      role: 'comum'
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