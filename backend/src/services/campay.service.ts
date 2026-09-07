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
  effectiveAmount: number;
}

export interface CampayPaymentLinkRequest {
  amount: number;
  description: string;
  externalReference: string;
  redirectUrl?: string;
}

export interface CampayPaymentLinkResponse {
  link: string;
  reference: string;
  effectiveAmount: number;
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
  private sandboxAmount: number = 10;

  constructor() {
    this.username = process.env.CAMPAY_USERNAME || '';
    this.password = process.env.CAMPAY_PASSWORD || '';
    this.environment = (process.env.CAMPAY_ENVIRONMENT === 'prod' ? 'prod' : 'demo');
    this.baseUrl = this.environment === 'prod'
      ? 'https://www.campay.net/api'
      : 'https://demo.campay.net/api';
    this.sandboxAmount = Number(process.env.CAMPAY_SANDBOX_AMOUNT || 10);
  }

  public isConfigured(): boolean {
    return Boolean(this.username && this.password);
  }

  public getEnvironment(): 'demo' | 'prod' {
    return this.environment;
  }

  /**
   * Calcule le montant effectif à débiter :
   * En mode sandbox (demo), force le montant à 10 FCFA (ou CAMPAY_SANDBOX_AMOUNT)
   * En mode production, utilise le montant réel du service.
   */
  public getEffectiveAmount(originalAmount: number): number {
    if (this.environment === 'demo') {
      return this.sandboxAmount; // 10 FCFA en mode bac à sable
    }
    return Math.max(1, Math.round(originalAmount));
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
      const expiresIn = data.expires_in || 3600;
      this.tokenExpiresAt = now + expiresIn * 1000;
      return this.cachedToken;
    } catch (err) {
      console.error('Exception lors de la récupération du token Campay:', err);
      return null;
    }
  }

  /**
   * Crée un lien de paiement pour rediriger l'utilisateur vers la passerelle hébergée Campay
   */
  public async getPaymentLink(params: CampayPaymentLinkRequest): Promise<CampayPaymentLinkResponse> {
    const effectiveAmount = this.getEffectiveAmount(params.amount);
    const token = await this.getAuthToken();

    // Mode simulation si les clés ne sont pas renseignées
    if (!token || !this.isConfigured()) {
      console.warn(`⚠️ Campay non configuré. Mode simulation lien de paiement (Montant: ${effectiveAmount} XAF).`);
      const mockRef = 'CAMPAY-SIM-' + Math.random().toString(36).slice(2, 9).toUpperCase();
      const redirect = params.redirectUrl || '';
      const separator = redirect.includes('?') ? '&' : '?';
      const simLink = redirect ? `${redirect}${separator}campay_status=SUCCESSFUL&reference=${mockRef}` : '';
      return {
        link: simLink || `https://demo.campay.net/pay/${mockRef}`,
        reference: mockRef,
        effectiveAmount,
      };
    }

    try {
      const payload: Record<string, any> = {
        amount: String(effectiveAmount),
        currency: 'XAF',
        description: params.description || 'Paiement Ticket HosQUEUE',
        external_reference: params.externalReference,
      };

      if (params.redirectUrl) {
        payload.redirect_url = params.redirectUrl;
      }

      const response = await fetch(`${this.baseUrl}/get_payment_link/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.detail || 'Échec de la génération du lien de paiement Campay');
      }

      // Extraction de la référence à partir du lien si nécessaire
      const linkParts = (data.link || '').split('/');
      const refFromLink = linkParts[linkParts.length - 1] || linkParts[linkParts.length - 2];
      const reference = data.reference || refFromLink || ('CAMPAY-' + Date.now());

      return {
        link: data.link,
        reference,
        effectiveAmount,
      };
    } catch (err: any) {
      console.error('Erreur getPaymentLink Campay:', err);
      throw err;
    }
  }

  /**
   * Initialise un paiement Mobile Money direct (Push USSD vers le mobile du patient)
   */
  public async collect(params: CampayCollectRequest): Promise<CampayCollectResponse> {
    const formattedPhone = this.formatPhoneNumber(params.phoneNumber);
    const effectiveAmount = this.getEffectiveAmount(params.amount);
    const token = await this.getAuthToken();

    // Mode simulation / fallback si les clés ne sont pas configurées
    if (!token || !this.isConfigured()) {
      console.warn(`⚠️ Campay non configuré. Mode simulation USSD activé (Montant: ${effectiveAmount} XAF).`);
      const mockRef = 'CAMPAY-SIM-' + Math.random().toString(36).slice(2, 9).toUpperCase();
      return {
        reference: mockRef,
        ussdCode: formattedPhone.startsWith('23767') || formattedPhone.startsWith('23768') || formattedPhone.startsWith('23765') ? '*126#' : '#150#',
        operator: formattedPhone.startsWith('23769') || formattedPhone.startsWith('237655') ? 'ORANGE' : 'MTN',
        status: 'PENDING',
        effectiveAmount,
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
          amount: String(effectiveAmount),
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
        effectiveAmount,
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
        amount: this.sandboxAmount,
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
