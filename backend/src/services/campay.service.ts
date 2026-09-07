import dotenv from 'dotenv';

dotenv.config();

export interface CampayCollectRequest {
  amount: number;
  phoneNumber: string;
  description: string;
  externalReference: string;
}

export interface CampayCollectResponse {
  reference: string;
  ussdCode?: string;
  operator?: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
}

export interface CampayTransactionStatus {
  reference: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amount?: number;
  currency?: string;
  operator?: string;
  code?: string;
  operatorReference?: string;
}

export class CampayService {
  private username: string;
  private password: string;
  private environment: 'demo' | 'prod';
  private baseUrl: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.username = process.env.CAMPAY_USERNAME || '';
    this.password = process.env.CAMPAY_PASSWORD || '';
    this.environment = (process.env.CAMPAY_ENVIRONMENT === 'prod' ? 'prod' : 'demo');
    this.baseUrl = this.environment === 'prod'
      ? 'https://www.campay.net/api'
      : 'https://demo.campay.net/api';
  }

  public isConfigured(): boolean {
    return Boolean(this.username && this.password);
  }

  /**
   * Formate le numéro de téléphone au format camerounais attendu par Campay (ex: 2376XXXXXXXX)
   */
  public formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('237') && cleaned.length === 12) {
      return cleaned;
    }
    if (cleaned.length === 9 && (cleaned.startsWith('6') || cleaned.startsWith('2'))) {
      return `237${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Obtient ou renouvelle le jeton d'authentification API Campay
   */
  public async getAuthToken(): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    try {
      const response = await fetch(`${this.baseUrl}/token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur authentification Campay:', response.status, errorText);
        return null;
      }

      const data = (await response.json()) as { token: string; expires_in?: number };
      this.cachedToken = data.token;
      // Expire par défaut dans 1 heure (3600s) si non précisé
      const expiresIn = data.expires_in || 3600;
      this.tokenExpiresAt = now + expiresIn * 1000;
      return this.cachedToken;
    } catch (err) {
      console.error('Exception lors de la récupération du token Campay:', err);
      return null;
    }
  }

  /**
   * Initialise un paiement Mobile Money (Push USSD vers le mobile du patient)
   */
  public async collect(params: CampayCollectRequest): Promise<CampayCollectResponse> {
    const formattedPhone = this.formatPhoneNumber(params.phoneNumber);
    const token = await this.getAuthToken();

    // Mode simulation / fallback si les clés ne sont pas configurées
    if (!token || !this.isConfigured()) {
      console.warn('⚠️ Campay non configuré ou token indisponible. Mode simulation activé.');
      const mockRef = 'CAMPAY-SIM-' + Math.random().toString(36).slice(2, 9).toUpperCase();
      return {
        reference: mockRef,
        ussdCode: formattedPhone.startsWith('23767') || formattedPhone.startsWith('23768') || formattedPhone.startsWith('23765') ? '*126#' : '#150#',
        operator: formattedPhone.startsWith('23769') || formattedPhone.startsWith('237655') ? 'ORANGE' : 'MTN',
        status: 'PENDING',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/collect/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: String(Math.round(params.amount)),
          currency: 'XAF',
          from: formattedPhone,
          description: params.description || 'Paiement Ticket HosQUEUE',
          external_reference: params.externalReference,
        }),
      });

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.detail || 'Échec de l\'initialisation du paiement Campay');
      }

      return {
        reference: data.reference,
        ussdCode: data.ussd_code,
        operator: data.operator,
        status: 'PENDING',
      };
    } catch (err: any) {
      console.error('Erreur collect Campay:', err);
      throw err;
    }
  }

  /**
   * Vérifie le statut d'une transaction auprès de Campay
   */
  public async checkTransactionStatus(reference: string): Promise<CampayTransactionStatus> {
    // Si transaction simulée
    if (reference.startsWith('CAMPAY-SIM-') || !this.isConfigured()) {
      return {
        reference,
        status: 'SUCCESSFUL',
        amount: 1000,
        currency: 'XAF',
        operator: 'MOBILE_MONEY',
      };
    }

    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Impossible d\'obtenir le jeton Campay');
    }

    try {
      const response = await fetch(`${this.baseUrl}/transaction/${reference}/`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.detail || 'Erreur lors de la vérification de la transaction');
      }

      return {
        reference: data.reference || reference,
        status: data.status, // 'SUCCESSFUL' | 'PENDING' | 'FAILED'
        amount: Number(data.amount),
        currency: data.currency,
        operator: data.operator,
        code: data.code,
        operatorReference: data.operator_reference,
      };
    } catch (err: any) {
      console.error(`Erreur vérification transaction Campay (${reference}):`, err);
      throw err;
    }
  }
}

export const campayService = new CampayService();
