type AddressFields = {
  address?: string | null;
  fullAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type ShootAddress = AddressFields & {
  location?: AddressFields | null;
  addressLine?: string | null;
  cityStateZip?: string | null;
};

/** Use the displayed property, including its locality, for downloaded packages. */
export const getShootDownloadAddress = (shoot?: ShootAddress | null): string => {
  if (!shoot) return '';
  const street = shoot.location?.address || shoot.address || shoot.addressLine;
  if (!street && (shoot.location?.fullAddress || shoot.fullAddress)) {
    return (shoot.location?.fullAddress || shoot.fullAddress || '').trim();
  }
  const locality = [
    shoot.location?.city || shoot.city,
    shoot.location?.state || shoot.state,
    shoot.location?.zip || shoot.zip,
  ].filter((part): part is string => Boolean(part?.trim()));
  return [street, ...(locality.length ? locality : [shoot.cityStateZip])]
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => part.trim())
    .join(', ');
};

export const buildShootZipFilename = (
  address: string | null | undefined,
  suffix: string,
  fallbackShootId?: string | number,
): string => {
  const slug = (value: string) => value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const property = slug(address || '') || slug(`shoot-${fallbackShootId ?? 'files'}`);
  const ending = slug(suffix) || 'files';
  return `${property.slice(0, 180).replace(/-+$/, '')}-${ending.slice(0, 40)}.zip`;
};

const safeBasename = (value: string): string | null => {
  const basename = value.replace(/\\/g, '/').split('/').pop()
    ?.split('').map((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? '-' : character).join('')
    .replace(/[<>:"|?*]/g, '-')
    .replace(/^\.+/, '').replace(/[. ]+$/, '').trim();
  if (!basename) return null;
  const extension = /\.[a-z0-9]{1,12}$/i.exec(basename)?.[0] || '';
  return basename.length <= 220 ? basename : `${basename.slice(0, 220 - extension.length)}${extension}`;
};

/** RFC 5987 and legacy attachment names, reduced to a safe local basename. */
export const parseDownloadFilename = (header: string | null): string | null => {
  if (!header) return null;
  const encoded = /(?:^|;)\s*filename\*\s*=\s*([^;]+)/i.exec(header)?.[1];
  if (encoded) {
    const value = encoded.trim().replace(/^"|"$/g, '');
    const encodedName = /^[^']*'[^']*'(.*)$/.exec(value)?.[1] ?? value;
    try {
      const name = safeBasename(decodeURIComponent(encodedName));
      if (name) return name;
    } catch { /* Try the ordinary filename when the encoded name is malformed. */ }
  }
  const quoted = /(?:^|;)\s*filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(header)?.[1];
  const plain = /(?:^|;)\s*filename\s*=\s*([^;]+)/i.exec(header)?.[1];
  const name = quoted?.replace(/\\"/g, '"') ?? plain?.trim();
  return name ? safeBasename(name) : null;
};
