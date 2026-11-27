export type AddressInputLocale = 'en' | 'es' | 'fr' | 'zh' | 'ru';

export interface AddressInputTranslations {
  contractAddressWarning: string;
  muxedAddressMemoWarning: string;
}

export const ADDRESS_INPUT_TRANSLATIONS: Record<AddressInputLocale, AddressInputTranslations> = {
  en: {
    contractAddressWarning: 'Contract addresses cannot be used for standard payments.',
    muxedAddressMemoWarning: 'Memo is ignored when using an M-address (routing ID is encoded in the address).',
  },
  es: {
    contractAddressWarning: 'Las direcciones de contrato no se pueden usar para pagos estándar.',
    muxedAddressMemoWarning: 'El memo se ignora al usar una dirección M (el ID de enrutamiento está codificado en la dirección).',
  },
  fr: {
    contractAddressWarning: 'Les adresses de contrat ne peuvent pas être utilisées pour des paiements standard.',
    muxedAddressMemoWarning: "Le mémo est ignoré avec une adresse M (l'identifiant de routage est intégré à l'adresse).",
  },
  zh: {
    contractAddressWarning: '合约地址不能用于标准付款。',
    muxedAddressMemoWarning: '使用 M 地址时会忽略备注（路由 ID 已编码在地址中）。',
  },
  ru: {
    contractAddressWarning: 'Адреса контрактов нельзя использовать для стандартных платежей.',
    muxedAddressMemoWarning: 'При использовании M-адреса memo игнорируется (идентификатор маршрутизации закодирован в адресе).',
  },
};

export function getAddressInputTranslations(
  locale: AddressInputLocale,
  overrides?: Partial<AddressInputTranslations>,
): AddressInputTranslations {
  return { ...ADDRESS_INPUT_TRANSLATIONS[locale], ...overrides };
}
