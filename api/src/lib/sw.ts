import type { Env } from './env';

interface SwAuthResponse {
  data: { token: string; expires_in: number; tokeny_type: string };
  status: 'success' | 'error';
  message?: string;
}

interface SwIssueResponse {
  data: {
    cadenaOriginalSAT: string;
    noCertificadoSAT: string;
    noCertificadoCFDI: string;
    uuid: string;
    selloSAT: string;
    selloCFDI: string;
    fechaTimbrado: string;
    qrCode: string;
    cfdi: string;
  } | null;
  status: 'success' | 'error';
  message?: string;
  messageDetail?: string;
}

interface SwCancelResponse {
  data: {
    acuse: string;
    uuid: Record<string, string>;
  } | null;
  status: 'success' | 'error';
  message?: string;
  messageDetail?: string;
}

interface SwXmlResponse {
  data: {
    records: {
      urlXml?: string;
      urlPdf?: string;
      uuid?: string;
    }[];
  } | null;
  status: 'success' | 'error';
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export function createSwClient(env: Env) {
  const servicesUrl = env.SW_API_URL;
  const dataUrl = env.SW_DATA_URL;

  async function getToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return cachedToken.token;
    }

    const res = await fetch(`${servicesUrl}/v2/security/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: env.SW_USER,
        password: env.SW_PASSWORD,
      }),
    });

    if (!res.ok) {
      throw new Error('SW: No fue posible autenticar con el servicio de facturación');
    }

    const body = (await res.json()) as SwAuthResponse;
    if (body.status !== 'success' || !body.data?.token) {
      throw new Error('SW: Autenticación fallida');
    }

    cachedToken = {
      token: body.data.token,
      expiresAt: Date.now() + 55 * 60 * 1000, // refresh 5 min before expiry
    };

    return cachedToken.token;
  }

  return {
    async issueInvoice(cfdiJson: CfdiJson): Promise<SwIssueResponse> {
      const token = await getToken();

      const res = await fetch(`${servicesUrl}/v4/cfdi33/issue/json/v4`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/jsontoxml',
        },
        body: JSON.stringify(cfdiJson),
      });

      const body = (await res.json()) as SwIssueResponse;

      if (body.status !== 'success' || !body.data) {
        const detail = body.messageDetail ? ` — ${body.messageDetail}` : '';
        throw new Error(`SW: ${body.message || 'Error al timbrar'}${detail}`);
      }

      return body;
    },

    async cancelInvoice(uuid: string, rfc: string, motivo: string = '02'): Promise<SwCancelResponse> {
      const token = await getToken();

      const res = await fetch(`${servicesUrl}/cfdi33/cancel/${rfc}/${uuid}/${motivo}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const body = (await res.json()) as SwCancelResponse;

      if (body.status !== 'success') {
        throw new Error(`SW Cancel: ${body.message || 'Error al cancelar'}`);
      }

      return body;
    },

    async getXmlByUuid(uuid: string): Promise<{ urlXml?: string; urlPdf?: string } | null> {
      const token = await getToken();

      const res = await fetch(`${dataUrl}/datawarehouse/v1/live/${uuid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = (await res.json()) as SwXmlResponse;

      if (body.status !== 'success' || !body.data?.records?.length) {
        return null;
      }

      return body.data.records[0];
    },

    async downloadXml(uuid: string): Promise<string> {
      const record = await this.getXmlByUuid(uuid);
      if (!record?.urlXml) {
        throw new Error('XML no disponible para este UUID');
      }

      const res = await fetch(record.urlXml);
      if (!res.ok) throw new Error('No fue posible descargar el XML');
      return res.text();
    },

    async generatePdf(xmlContent: string): Promise<Uint8Array> {
      const token = await getToken();

      const res = await fetch(`${dataUrl}/pdf/v1/api/GeneratePdf`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          xmlContent,
          templateId: 'cfdi40',
        }),
      });

      if (!res.ok) {
        throw new Error('No fue posible generar el PDF');
      }

      const body = (await res.json()) as { data?: { contentB64?: string }; status: string; message?: string };

      if (body.status !== 'success' || !body.data?.contentB64) {
        throw new Error(body.message || 'Error al generar PDF');
      }

      // Decode base64 to binary
      const binary = atob(body.data.contentB64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    },
  };
}

// CFDI 4.0 JSON structure for SW issue endpoint
export interface CfdiJson {
  Version: '4.0';
  FormaPago: string;
  Serie?: string;
  Folio?: string;
  Fecha: string;
  Sello: '';
  NoCertificado: '';
  Certificado: '';
  SubTotal: string;
  Descuento?: string;
  Moneda: 'MXN';
  Total: string;
  TipoDeComprobante: 'I';
  Exportacion: '01';
  MetodoPago: 'PUE';
  LugarExpedicion: string;
  Emisor: {
    Rfc: string;
    Nombre: string;
    RegimenFiscal: string;
  };
  Receptor: {
    Rfc: string;
    Nombre: string;
    DomicilioFiscalReceptor: string;
    RegimenFiscalReceptor: string;
    UsoCFDI: string;
  };
  Conceptos: CfdiConcepto[];
  Impuestos: {
    TotalImpuestosTrasladados: string;
    Traslados: CfdiTraslado[];
  };
}

export interface CfdiConcepto {
  ClaveProdServ: string;
  Cantidad: string;
  ClaveUnidad: string;
  Unidad: string;
  Descripcion: string;
  ValorUnitario: string;
  Importe: string;
  Descuento?: string;
  ObjetoImp: '02';
  Impuestos: {
    Traslados: CfdiTraslado[];
  };
}

export interface CfdiTraslado {
  Base: string;
  Impuesto: '002';
  TipoFactor: 'Tasa';
  TasaOCuota: '0.160000';
  Importe: string;
}
